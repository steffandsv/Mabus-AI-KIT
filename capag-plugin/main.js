/**
 * Capacidade de Pagamento (CAPAG) Plugin
 *
 * Integração com a API do Tesouro Transparente para exibição da CAPAG
 */

const CACHE_TTL_HOURS = 24 * 7; // Cache for 7 days

// Obtém dados usando a API interna exposta pela tabela entes_capag_latest
// (criada pelo job de sincronização sync_capag.js no backend)
async function fetchCapagFromApi(codigo_ibge, uf, esfera) {
    // Como estamos num plugin SDK local da plataforma, usamos o MabusSDK.DB
    // para consultar os dados consolidados pelo cronjob.
    let record = null;

    if (esfera === 'E' || esfera === 'ESTADO' || esfera === 'DF') {
        if (!uf) throw new Error('UF não fornecida para busca estadual');
        // Consulta na base agregada (tabela view entes_capag_latest,
        // mas através do SDK Mabus que fornece acesso unificado às coleções permitidas)
        // Assume-se que o Mabus expôs `entes_capag_latest` ou análogo
        const result = await MabusSDK.DB.query('entes_capag_latest', { uf_sigla: uf, _limit: 1 });
        if (result && result.length > 0) record = result[0];
    } else {
        if (!codigo_ibge) throw new Error('codigo_ibge não fornecido para busca municipal');
        const result = await MabusSDK.DB.query('entes_capag_latest', { codigo_ibge_7: codigo_ibge, _limit: 1 });
        if (result && result.length > 0) record = result[0];
    }

    if (!record) {
        throw new Error('Dados da CAPAG não encontrados para o ente especificado.');
    }

    return {
        nota: record.capag_classificacao || 'ND',
        endividamento: {
            valor: record.indicador1_valor || 0,
            nota: record.indicador1_nota || 'ND'
        },
        poupanca: {
            valor: record.indicador2_valor || 0,
            nota: record.indicador2_nota || 'ND'
        },
        liquidez: {
            valor: record.indicador3_valor || 0,
            nota: record.indicador3_nota || 'ND'
        },
        ente: record.nome_ente || (esfera === 'E' ? `Estado ${uf}` : `Município ${codigo_ibge}`),
        ano_referencia: record.ano_base || new Date().getFullYear(),
        atualizado_em: record.coletado_em || new Date().toISOString()
    };
}

async function getCapagData(codigo_ibge, uf, esfera) {
    if (!codigo_ibge && !uf) return null;

    const cacheKey = `capag_${esfera}_${codigo_ibge || uf}`;
    let cached = await MabusSDK.DB.Storage.get(cacheKey);

    if (cached && cached._cachedAt) {
        const age = Date.now() - new Date(cached._cachedAt).getTime();
        if (age < CACHE_TTL_HOURS * 60 * 60 * 1000) {
            return cached;
        }
    }

    try {
        const fresh = await fetchCapagFromApi(codigo_ibge, uf, esfera);
        fresh._cachedAt = new Date().toISOString();
        await MabusSDK.DB.Storage.set(cacheKey, fresh);
        return fresh;
    } catch (err) {
        MabusSDK.Log.warn(`Falha ao buscar CAPAG para ${cacheKey}: ${err.message}`);
        return cached || null;
    }
}

// ══════════════════════════════════════════════════════
// 1. DATA ENRICHMENT
// ══════════════════════════════════════════════════════

async function enrichLicitacao(licitacao) {
    // Inferir esfera. Se não houver, assumir Município (MVP) se codigo_ibge existir.
    let esfera = licitacao.esfera || (licitacao.codigo_ibge ? 'M' : null);
    if (!esfera) return licitacao;

    // Tratamento de herança de autarquias:
    // O plugin buscará CAPAG baseado no IBGE do Município (M) ou UF (E).
    const capagData = await getCapagData(licitacao.codigo_ibge, licitacao.uf_sigla, esfera);

    if (capagData) {
        licitacao._plugin_capag = capagData;
    }

    return licitacao;
}

MabusSDK.Hooks.addFilter('licitacao.detail.data', enrichLicitacao);

MabusSDK.Hooks.addFilter('licitacao.cards.data', async (licitacoes) => {
    return await Promise.all(licitacoes.map(enrichLicitacao));
});


// ══════════════════════════════════════════════════════
// 2. UI SLOT WIDGETS
// ══════════════════════════════════════════════════════

function getCapagColor(nota) {
    const n = (nota || 'ND').toUpperCase().replace('+', '');
    const colors = {
        'A': { bg: 'rgba(52,199,89,0.15)', border: 'rgba(52,199,89,0.3)', text: '#34C759', label: 'Excelente' },
        'B': { bg: 'rgba(0,122,255,0.15)', border: 'rgba(0,122,255,0.3)', text: '#007AFF', label: 'Boa' },
        'C': { bg: 'rgba(255,159,10,0.15)', border: 'rgba(255,159,10,0.3)', text: '#FF9F0A', label: 'Atenção' },
        'D': { bg: 'rgba(255,69,58,0.15)', border: 'rgba(255,69,58,0.3)', text: '#FF453A', label: 'Crítica' },
        'ND': { bg: 'rgba(150,150,150,0.15)', border: 'rgba(150,150,150,0.3)', text: '#969696', label: 'Não Disponível' }
    };
    return colors[n] || colors['ND'];
}

function renderBadge(context, isCard = false) {
    if (!context.codigo_ibge && !context.uf) return '';

    // Simulando acesso ao dado injetado (no SDK o context da view muitas vezes reflete o dado,
    // mas se não, buscaremos do cache via ID ou render passivo se injetado na view).
    // Idealmente, a view do SDK passaria licitacao._plugin_capag via context.
    const nota = context._plugin_capag ? context._plugin_capag.nota : 'ND';
    const c = getCapagColor(nota);

    const tooltipText = "Saúde fiscal do ente (CAPAG/ STN). Proxy de capacidade fiscal; não vincula decisão formal da STN e não garante prazo de pagamento.";

    const sizeStyles = isCard
        ? 'padding:1px 6px;border-radius:4px;font-size:0.60rem;'
        : 'padding:2px 8px;border-radius:6px;font-size:0.65rem;';

    return `
        <span title="${tooltipText}"
              style="display:inline-flex;align-items:center;gap:3px;
                     ${sizeStyles}
                     background:${c.bg};border:1px solid ${c.border};
                     color:${c.text};font-weight:700;cursor:help;
                     letter-spacing:0.02em;vertical-align:middle;">
            <span style="font-size:0.55rem;">🏦</span>
            CAPAG ${nota}
        </span>
    `;
}

// Badge inline ao lado do nome do órgão
MabusSDK.UI.registerSlotWidget('licitacao.detail.orgao_badge', {
    priority: 5,
    render: (context) => renderBadge(context, false)
});

// Badge de card
MabusSDK.UI.registerSlotWidget('licitacao.card.badge', {
    priority: 5,
    render: (context) => renderBadge(context, true)
});


// Painel detalhado
MabusSDK.UI.registerSlotWidget('licitacao.detail.after_orgao', {
    priority: 10,
    render: (context) => {
        if (!context.codigo_ibge && !context.uf) return '';

        const data = context._plugin_capag;
        if (!data) return ''; // Se não houver dados, não renderiza o painel

        const notaCor = getCapagColor(data.nota);

        return `
            <div style="background:rgba(0,122,255,0.04);border:1px solid rgba(0,122,255,0.1);
                        border-radius:12px;padding:16px;margin-top:12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <span style="font-size:14px;">🏦</span>
                    <span style="font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.8);">
                        Saúde fiscal do ente (CAPAG/ STN)
                    </span>
                    <span style="margin-left:auto;font-size:0.6rem;color:rgba(255,255,255,0.3);">
                        Fonte: Tesouro Transparente • Atualização: ${new Date(data.atualizado_em).toLocaleDateString()}
                    </span>
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;">
                        <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);margin-bottom:4px;">Endividamento</div>
                        <div style="font-size:1rem;font-weight:800;color:#007AFF;">${data.endividamento.valor}%</div>
                        <div style="font-size:0.55rem;color:rgba(255,255,255,0.3);margin-top:2px;">Nota: ${data.endividamento.nota}</div>
                    </div>
                    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;">
                        <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);margin-bottom:4px;">Poupança Corrente</div>
                        <div style="font-size:1rem;font-weight:800;color:#34C759;">${data.poupanca.valor}%</div>
                        <div style="font-size:0.55rem;color:rgba(255,255,255,0.3);margin-top:2px;">Nota: ${data.poupanca.nota}</div>
                    </div>
                    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;">
                        <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);margin-bottom:4px;">Liquidez</div>
                        <div style="font-size:1rem;font-weight:800;color:#FF9F0A;">${data.liquidez.valor}%</div>
                        <div style="font-size:0.55rem;color:rgba(255,255,255,0.3);margin-top:2px;">Nota: ${data.liquidez.nota}</div>
                    </div>
                </div>

                <div style="margin-top:12px;font-size:0.6rem;color:rgba(255,255,255,0.4);text-align:center;background:rgba(255,255,255,0.05);padding:6px;border-radius:4px;">
                    ⚠️ Proxy de capacidade fiscal; não vincula decisão formal da STN e não garante prazo de pagamento. CAPAG do ente, aplicada como proxy ao órgão comprador.
                </div>
            </div>
        `;
    }
});

MabusSDK.Log.info('Plugin CAPAG iniciado com sucesso!');
