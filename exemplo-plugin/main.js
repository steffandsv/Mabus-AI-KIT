/**
 * Contador de Licitações — Plugin de Exemplo
 * 
 * Demonstra:
 * - MabusSDK.DB (persistência)
 * - MabusSDK.Hooks (eventos)
 * - MabusSDK.UI (widget visual)
 * - MabusSDK.Log (logging)
 */

// Get today's date as key
const today = new Date().toISOString().split('T')[0];

// Load or initialize daily count
let countData = await MabusSDK.DB.get('daily_count') || {};
if (countData.date !== today) {
    countData = { date: today, count: 0 };
    await MabusSDK.DB.set('daily_count', countData);
}

// Listen for viewed events
MabusSDK.Hooks.on('licitacao:viewed', async () => {
    countData.count++;
    await MabusSDK.DB.set('daily_count', countData);
    renderWidget();
});

// Render dashboard widget
function renderWidget() {
    MabusSDK.UI.registerWidget('dashboard.main', {
        title: '📊 Licitações Hoje',
        render: () => `
            <div style="text-align:center;padding:24px;">
                <div style="font-size:56px;font-weight:900;
                    background:linear-gradient(135deg,#00F0FF,#10b981);
                    -webkit-background-clip:text;-webkit-text-fill-color:transparent;">
                    ${countData.count}
                </div>
                <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:8px;">
                    licitações visualizadas em ${new Date().toLocaleDateString('pt-BR')}
                </div>
                <div style="margin-top:16px;height:4px;background:rgba(255,255,255,0.05);border-radius:99px;overflow:hidden;">
                    <div style="height:100%;width:${Math.min(100, countData.count * 2)}%;background:linear-gradient(90deg,#00F0FF,#10b981);border-radius:99px;transition:width 0.5s;"></div>
                </div>
                <div style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:6px;">
                    Meta: 50 licitações/dia
                </div>
            </div>
        `
    });
}

renderWidget();
MabusSDK.Log.info('Plugin Contador de Licitações iniciado com sucesso!');
