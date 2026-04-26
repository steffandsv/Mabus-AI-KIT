/**
 * Cronjob de Ingestão de Dados CAPAG (Tesouro Transparente)
 *
 * Conforme o plano de ação: "Arquitetura do cronjob em Node.js, estratégia de ingestão e upsert com pg-pool"
 */

const { Pool } = require('pg');

const pool = new Pool({
  // Configuração via variáveis de ambiente seria usada aqui no ambiente de prod
  // connectionString: process.env.DATABASE_URL
});

async function runSync() {
    console.log("Iniciando sincronização CAPAG...");
    // 1. Descoberta de “qual recurso é o mais recente”
    // 2. Download do arquivo XLSX para municípios e CSV para Estados
    // 3. Parser e Normalização
    // 4. Persistência no Postgres com upsert

    const client = await pool.connect();

    try {
        console.log("Criando schema entes_capag_snapshot e view...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS entes_capag_snapshot (
                id BIGSERIAL PRIMARY KEY,
                esfera VARCHAR(12) NOT NULL CHECK (esfera IN ('MUNICIPIO', 'ESTADO', 'DF')),
                codigo_ibge_7 VARCHAR(7),
                uf_sigla VARCHAR(2),
                nome_ente VARCHAR(200),
                referencia_siconfi DATE,
                ano_base INTEGER,
                fonte_resource_id UUID,
                fonte_dataset VARCHAR(64) NOT NULL,
                capag_classificacao VARCHAR(8),
                indicador1_valor NUMERIC(12,6),
                indicador1_nota VARCHAR(8),
                indicador2_valor NUMERIC(12,6),
                indicador2_nota VARCHAR(8),
                indicador3_valor NUMERIC(12,6),
                indicador3_nota VARCHAR(8),
                icf_nota VARCHAR(8),
                observacao TEXT,
                coletado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT chk_chave_municipio
                    CHECK ( (esfera = 'MUNICIPIO' AND codigo_ibge_7 IS NOT NULL AND uf_sigla IS NOT NULL)
                         OR (esfera IN ('ESTADO','DF') AND uf_sigla IS NOT NULL) )
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ux_capag_snapshot
            ON entes_capag_snapshot (esfera, COALESCE(codigo_ibge_7, ''), uf_sigla, COALESCE(referencia_siconfi, DATE '1900-01-01'), COALESCE(ano_base, -1));

            CREATE OR REPLACE VIEW entes_capag_latest AS
            SELECT DISTINCT ON (esfera, COALESCE(codigo_ibge_7,''), uf_sigla)
                *
            FROM entes_capag_snapshot
            ORDER BY esfera, COALESCE(codigo_ibge_7,''), uf_sigla, COALESCE(referencia_siconfi, DATE '1900-01-01') DESC, coletado_em DESC;
        `);

        console.log("Criando tabela integracoes_estado...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS integracoes_estado (
                chave TEXT PRIMARY KEY,
                valor TEXT NOT NULL,
                atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        // 1. Descoberta de “qual recurso é o mais recente”
        const ckanEstadosUrl = 'https://www.tesourotransparente.gov.br/ckan/api/3/action/package_search?q=capag';
        const resSearch = await fetch(ckanEstadosUrl, {
            headers: { 'User-Agent': 'mabus-capag-sync/1.0 (+contato@mabus.com.br)', 'Accept': '*/*' }
        });
        const jsonSearch = await resSearch.json();

        let estadosUrl = null;
        let estadosCreated = null;
        const estadosPkg = jsonSearch.result.results.find(p => p.title.includes('Estados'));
        if (estadosPkg) {
            const csvResources = estadosPkg.resources.filter(r => r.format.toUpperCase() === 'CSV');
            const latestCsv = csvResources.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))[0];
            if (latestCsv) {
                estadosUrl = latestCsv.url;
                estadosCreated = latestCsv.created;
            }
        }

        let municipiosUrl = null;
        let municipiosCreated = null;
        const muniPkg = jsonSearch.result.results.find(p => p.title.includes('Municípios'));
        if (muniPkg) {
            const xlsxResources = muniPkg.resources.filter(r => r.format.toUpperCase() === 'XLSX');
            const latestXlsx = xlsxResources.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))[0];
            if (latestXlsx) {
                municipiosUrl = latestXlsx.url;
                municipiosCreated = latestXlsx.created;
            }
        }

        console.log(`Estados: ${estadosUrl}`);
        console.log(`Municípios: ${municipiosUrl}`);

        const crypto = require('crypto');

        // 2 & 3: Parser de Estados
        if (estadosUrl) {
            console.log("Baixando e parseando Estados...");
            const resEstados = await fetch(estadosUrl);
            const csvText = await resEstados.text();
            const hash = crypto.createHash('sha256').update(csvText).digest('hex');

            const checkHash = await client.query(`SELECT valor FROM integracoes_estado WHERE chave = 'capag_estados_hash'`);
            if (checkHash.rows.length === 0 || checkHash.rows[0].valor !== hash) {
                const xlsx = require('xlsx');
                // Use xlsx library to safely parse CSV with quotes
                const workbook = xlsx.read(csvText, { type: 'string' });
                const sheetName = workbook.SheetNames[0];
                const records = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: null });

                const getField = (obj, partials) => {
                    const key = Object.keys(obj).find(k => partials.some(p => k.toLowerCase().includes(p)));
                    return key ? obj[key] : null;
                };

                let p_esfera=[], p_ibge=[], p_uf=[], p_nome=[], p_ref=[], p_ano=[];
                let p_dataset=[], p_nota=[], p_i1v=[], p_i1n=[], p_i2v=[], p_i2n=[], p_i3v=[], p_i3n=[];
                let p_icf=[], p_obs=[];

                for (const row of records) {
                    const uf = getField(row, ['uf', 'estado']);
                    if (!uf) continue;

                    const nota = getField(row, ['capag', 'classifica']) || 'ND';
                    const ind1Valor = parseFloat(getField(row, ['indicador 1', 'endividamento'])) || null;
                    const ind1Nota = getField(row, ['nota 1']);
                    const ind2Valor = parseFloat(getField(row, ['indicador 2', 'poupança', 'poupanca'])) || null;
                    const ind2Nota = getField(row, ['nota 2']);
                    const ind3Valor = parseFloat(getField(row, ['indicador 3', 'liquidez'])) || null;
                    const ind3Nota = getField(row, ['nota 3']);
                    const obs = getField(row, ['observa']) || null;
                    const icf = getField(row, ['qualidade', 'icf']) || null;

                    p_esfera.push('ESTADO');
                    p_ibge.push(null);
                    p_uf.push(uf.trim().substring(0, 2));
                    p_nome.push(`Estado ${uf}`);
                    p_ref.push(estadosCreated ? estadosCreated.split('T')[0] : '1900-01-01');
                    p_ano.push(new Date().getFullYear());
                    p_dataset.push('capag-estados');
                    p_nota.push(nota);
                    p_i1v.push(ind1Valor); p_i1n.push(ind1Nota);
                    p_i2v.push(ind2Valor); p_i2n.push(ind2Nota);
                    p_i3v.push(ind3Valor); p_i3n.push(ind3Nota);
                    p_icf.push(icf); p_obs.push(obs);
                }

                if (p_esfera.length > 0) {
                    await client.query(`
                        INSERT INTO entes_capag_snapshot (
                            esfera, codigo_ibge_7, uf_sigla, nome_ente, referencia_siconfi, ano_base,
                            fonte_dataset, capag_classificacao, indicador1_valor, indicador1_nota,
                            indicador2_valor, indicador2_nota, indicador3_valor, indicador3_nota, icf_nota, observacao
                        )
                        SELECT * FROM UNNEST (
                            $1::VARCHAR[], $2::VARCHAR[], $3::VARCHAR[], $4::VARCHAR[], $5::DATE[], $6::INTEGER[],
                            $7::VARCHAR[], $8::VARCHAR[], $9::NUMERIC[], $10::VARCHAR[], $11::NUMERIC[], $12::VARCHAR[],
                            $13::NUMERIC[], $14::VARCHAR[], $15::VARCHAR[], $16::TEXT[]
                        )
                        ON CONFLICT (esfera, COALESCE(codigo_ibge_7, ''), uf_sigla, COALESCE(referencia_siconfi, DATE '1900-01-01'), COALESCE(ano_base, -1))
                        DO UPDATE SET
                            capag_classificacao = EXCLUDED.capag_classificacao,
                            indicador1_valor = EXCLUDED.indicador1_valor,
                            indicador1_nota = EXCLUDED.indicador1_nota,
                            indicador2_valor = EXCLUDED.indicador2_valor,
                            indicador2_nota = EXCLUDED.indicador2_nota,
                            indicador3_valor = EXCLUDED.indicador3_valor,
                            indicador3_nota = EXCLUDED.indicador3_nota,
                            icf_nota = EXCLUDED.icf_nota,
                            observacao = EXCLUDED.observacao,
                            coletado_em = now();
                    `, [p_esfera, p_ibge, p_uf, p_nome, p_ref, p_ano, p_dataset, p_nota, p_i1v, p_i1n, p_i2v, p_i2n, p_i3v, p_i3n, p_icf, p_obs]);

                    console.log(`Inseridos/Atualizados ${p_esfera.length} estados.`);
                    await client.query(`
                        INSERT INTO integracoes_estado (chave, valor, atualizado_em)
                        VALUES ('capag_estados_hash', $1, now())
                        ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = EXCLUDED.atualizado_em;
                    `, [hash]);
                }
            } else {
                console.log("Dataset de Estados não sofreu alteração. Ignorando processamento.");
            }
        }

        // 2 & 3: Parser de Municípios (XLSX)
        if (municipiosUrl) {
            console.log("Baixando e parseando Municípios...");
            const resMuni = await fetch(municipiosUrl);
            const buffer = await resMuni.arrayBuffer();

            const hash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
            const checkHash = await client.query(`SELECT valor FROM integracoes_estado WHERE chave = 'capag_municipios_hash'`);

            if (checkHash.rows.length === 0 || checkHash.rows[0].valor !== hash) {
                const xlsx = require('xlsx');
                const workbook = xlsx.read(buffer, { type: 'buffer' });

                // Procurar aba "Prévia da Capag"
                const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('prévia') || n.toLowerCase().includes('capag'));
                if (sheetName) {
                    const sheet = workbook.Sheets[sheetName];
                    const data = xlsx.utils.sheet_to_json(sheet, { raw: false, defval: null });

                    const getField = (obj, partials) => {
                        const key = Object.keys(obj).find(k => partials.some(p => k.toLowerCase().includes(p)));
                        return key ? obj[key] : null;
                    };

                    let p_esfera=[], p_ibge=[], p_uf=[], p_nome=[], p_ref=[], p_ano=[];
                    let p_dataset=[], p_nota=[], p_i1v=[], p_i1n=[], p_i2v=[], p_i2n=[], p_i3v=[], p_i3n=[];
                    let p_icf=[], p_obs=[];

                    for (const row of data) {
                        let ibge = getField(row, ['ibge', 'município completo', 'municipio completo']);
                        if (!ibge || ibge.toString().trim() === '') continue;
                        ibge = ibge.toString().trim();
                        if (ibge.length > 7) ibge = ibge.substring(0, 7);

                        const uf = getField(row, ['uf']) || 'XX';
                        const nome = getField(row, ['nome']) || `Município ${ibge}`;
                        const nota = getField(row, ['capag']) || 'ND';

                        const ind1Valor = parseFloat(getField(row, ['indicador 1'])) || null;
                        const ind1Nota = getField(row, ['nota 1']) || null;
                        const ind2Valor = parseFloat(getField(row, ['indicador 2'])) || null;
                        const ind2Nota = getField(row, ['nota 2']) || null;
                        const ind3Valor = parseFloat(getField(row, ['indicador 3'])) || null;
                        const ind3Nota = getField(row, ['nota 3']) || null;
                        const obs = getField(row, ['observa']) || null;
                        const icf = getField(row, ['icf']) || null;

                        p_esfera.push('MUNICIPIO');
                        p_ibge.push(ibge);
                        p_uf.push(uf.trim().substring(0, 2));
                        p_nome.push(nome);
                        p_ref.push(municipiosCreated ? municipiosCreated.split('T')[0] : '1900-01-01');
                        p_ano.push(new Date().getFullYear());
                        p_dataset.push('capag-municipios');
                        p_nota.push(nota);
                        p_i1v.push(ind1Valor); p_i1n.push(ind1Nota);
                        p_i2v.push(ind2Valor); p_i2n.push(ind2Nota);
                        p_i3v.push(ind3Valor); p_i3n.push(ind3Nota);
                        p_icf.push(icf); p_obs.push(obs);
                    }

                    if (p_esfera.length > 0) {
                        const batchSize = 1000;
                        for (let i = 0; i < p_esfera.length; i += batchSize) {
                            await client.query(`
                                INSERT INTO entes_capag_snapshot (
                                    esfera, codigo_ibge_7, uf_sigla, nome_ente, referencia_siconfi, ano_base,
                                    fonte_dataset, capag_classificacao, indicador1_valor, indicador1_nota,
                                    indicador2_valor, indicador2_nota, indicador3_valor, indicador3_nota, icf_nota, observacao
                                )
                                SELECT * FROM UNNEST (
                                    $1::VARCHAR[], $2::VARCHAR[], $3::VARCHAR[], $4::VARCHAR[], $5::DATE[], $6::INTEGER[],
                                    $7::VARCHAR[], $8::VARCHAR[], $9::NUMERIC[], $10::VARCHAR[], $11::NUMERIC[], $12::VARCHAR[],
                                    $13::NUMERIC[], $14::VARCHAR[], $15::VARCHAR[], $16::TEXT[]
                                )
                                ON CONFLICT (esfera, COALESCE(codigo_ibge_7, ''), uf_sigla, COALESCE(referencia_siconfi, DATE '1900-01-01'), COALESCE(ano_base, -1))
                                DO UPDATE SET
                                    capag_classificacao = EXCLUDED.capag_classificacao,
                                    indicador1_valor = EXCLUDED.indicador1_valor,
                                    indicador1_nota = EXCLUDED.indicador1_nota,
                                    indicador2_valor = EXCLUDED.indicador2_valor,
                                    indicador2_nota = EXCLUDED.indicador2_nota,
                                    indicador3_valor = EXCLUDED.indicador3_valor,
                                    indicador3_nota = EXCLUDED.indicador3_nota,
                                    icf_nota = EXCLUDED.icf_nota,
                                    observacao = EXCLUDED.observacao,
                                    coletado_em = now();
                            `, [
                                p_esfera.slice(i, i + batchSize), p_ibge.slice(i, i + batchSize), p_uf.slice(i, i + batchSize), p_nome.slice(i, i + batchSize),
                                p_ref.slice(i, i + batchSize), p_ano.slice(i, i + batchSize), p_dataset.slice(i, i + batchSize), p_nota.slice(i, i + batchSize),
                                p_i1v.slice(i, i + batchSize), p_i1n.slice(i, i + batchSize), p_i2v.slice(i, i + batchSize), p_i2n.slice(i, i + batchSize),
                                p_i3v.slice(i, i + batchSize), p_i3n.slice(i, i + batchSize), p_icf.slice(i, i + batchSize), p_obs.slice(i, i + batchSize)
                            ]);
                        }
                        console.log(`Inseridos/Atualizados ${p_esfera.length} municípios.`);
                        await client.query(`
                            INSERT INTO integracoes_estado (chave, valor, atualizado_em)
                            VALUES ('capag_municipios_hash', $1, now())
                            ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = EXCLUDED.atualizado_em;
                        `, [hash]);
                    }
                }
            } else {
                console.log("Dataset de Municípios não sofreu alteração. Ignorando processamento.");
            }
        }

        console.log("Ingestão base finalizada com sucesso.");

    } catch (e) {
        console.error("Erro no job de sync:", e);
    } finally {
        client.release();
    }
}

// Execução via node-cron (conforme plano)
const cron = require('node-cron');
// Roda toda noite às 03:00 da manhã
cron.schedule('0 3 * * *', () => {
    runSync().catch(console.error);
});

if (require.main === module) {
    runSync().catch(console.error).finally(() => pool.end());
}

module.exports = { runSync };
