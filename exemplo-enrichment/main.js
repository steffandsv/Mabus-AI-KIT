/**
 * Indicador Fiscal do Órgão — Plugin de Exemplo (Enrichment)
 * 
 * Demonstra o padrão de Data Enrichment:
 * - MabusSDK.Hooks.addFilter (enriquecer dados antes do render)
 * - MabusSDK.UI.registerSlotWidget (widgets contextuais em slots)
 * - MabusSDK.DB.Storage (cache local de dados)
 * - MabusSDK.Log (logging)
 * 
 * Este plugin consulta dados fiscais armazenados localmente
 * e exibe badges e painéis nas páginas de licitação.
 */

// ══════════════════════════════════════════════════════
// 1. DATA ENRICHMENT (Filter Hook)
// ══════════════════════════════════════════════════════

// Enrich licitacao data with fiscal info before rendering
MabusSDK.Hooks.addFilter('licitacao.detail.data', async (licitacao) => {
    if (!licitacao.codigo_ibge) return licitacao;

    // Try to get cached fiscal data
    const cacheKey = `fiscal_${licitacao.codigo_ibge}`;
    let fiscalData = await MabusSDK.DB.Storage.get(cacheKey);

    if (!fiscalData) {
        // Simulate looking up fiscal data (in a real plugin, this would come from
        // a pre-populated database or external API via MabusSDK.Net.fetch)
        fiscalData = {
            nota: 'B',
            endividamento: 42.5,
            poupanca: 8.2,
            liquidez: 1.3,
            ente: 'Município de Exemplo',
            ano_referencia: 2025,
            atualizado_em: new Date().toISOString(),
        };
        // Cache for 24 hours
        await MabusSDK.DB.Storage.set(cacheKey, fiscalData);
    }

    // Attach fiscal data to the licitacao object
    licitacao._plugin_fiscal = fiscalData;
    return licitacao;
});

// ══════════════════════════════════════════════════════
// 2. UI SLOT WIDGETS (Visual Components)
// ══════════════════════════════════════════════════════

// Badge inline ao lado do nome do órgão
MabusSDK.UI.registerSlotWidget('licitacao.detail.orgao_badge', {
    priority: 5,
    render: (context) => {
        // context contains: { codigo_ibge, cnpj, esfera, uf }
        if (!context.codigo_ibge) return '';

        // In a real implementation, this would look up cached data
        const nota = 'B'; // Would come from cached data
        const colors = {
            'A': { bg: 'rgba(52,199,89,0.15)', border: 'rgba(52,199,89,0.3)', text: '#34C759', label: 'Excelente' },
            'B': { bg: 'rgba(0,122,255,0.15)', border: 'rgba(0,122,255,0.3)', text: '#007AFF', label: 'Boa' },
            'C': { bg: 'rgba(255,159,10,0.15)', border: 'rgba(255,159,10,0.3)', text: '#FF9F0A', label: 'Atenção' },
            'D': { bg: 'rgba(255,69,58,0.15)', border: 'rgba(255,69,58,0.3)', text: '#FF453A', label: 'Crítica' },
        };
        const c = colors[nota] || colors['C'];

        return `
            <span title="Saúde Fiscal: ${c.label} (${nota})" 
                  style="display:inline-flex;align-items:center;gap:3px;
                         padding:2px 8px;border-radius:6px;font-size:0.65rem;
                         background:${c.bg};border:1px solid ${c.border};
                         color:${c.text};font-weight:700;cursor:help;
                         letter-spacing:0.02em;vertical-align:middle;">
                <span style="font-size:0.55rem;">🏦</span>
                CAPAG ${nota}
            </span>
        `;
    }
});

// Painel detalhado após a seção Órgão Contratante
MabusSDK.UI.registerSlotWidget('licitacao.detail.after_orgao', {
    priority: 10,
    render: (context) => {
        if (!context.codigo_ibge) return '';

        return `
            <div style="background:rgba(0,122,255,0.04);border:1px solid rgba(0,122,255,0.1);
                        border-radius:12px;padding:16px;margin-top:12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                    <span style="font-size:14px;">🏦</span>
                    <span style="font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.8);">
                        Saúde Fiscal do Ente
                    </span>
                    <span style="margin-left:auto;font-size:0.6rem;color:rgba(255,255,255,0.3);">
                        Fonte: STN/CAPAG · Ref: 2025
                    </span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;">
                        <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);margin-bottom:4px;">Endividamento</div>
                        <div style="font-size:1rem;font-weight:800;color:#007AFF;">42.5%</div>
                    </div>
                    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;">
                        <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);margin-bottom:4px;">Poupança</div>
                        <div style="font-size:1rem;font-weight:800;color:#34C759;">8.2%</div>
                    </div>
                    <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;">
                        <div style="font-size:0.6rem;color:rgba(255,255,255,0.4);margin-bottom:4px;">Liquidez</div>
                        <div style="font-size:1rem;font-weight:800;color:#FF9F0A;">1.3x</div>
                    </div>
                </div>
                <div style="margin-top:8px;font-size:0.6rem;color:rgba(255,255,255,0.25);text-align:center;">
                    ⚠️ Indicador fiscal do ente, não do órgão individualmente
                </div>
            </div>
        `;
    }
});

// ══════════════════════════════════════════════════════
// 3. EVENT SUBSCRIPTION (Side-effects)
// ══════════════════════════════════════════════════════

// Track views for analytics
MabusSDK.Hooks.addAction('licitacao.viewed', async (data) => {
    MabusSDK.Log.info(`Licitação viewed: ${data.id} (IBGE: ${data.codigo_ibge})`);
});

MabusSDK.Log.info('Plugin Indicador Fiscal iniciado com sucesso!');
