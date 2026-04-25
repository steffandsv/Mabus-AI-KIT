# 📖 Mabus Plugin Recipes

> Receitas prontas para IAs (Claude, ChatGPT, Jules) criarem plugins para a Plataforma Mabus.
> Cada receita é um padrão completo com manifest + main.js.

---

## Catálogo de Receitas

| # | Receita | Tipo | Complexidade | Slots Usados |
|---|---------|------|-------------|--------------|
| 1 | Widget de Dashboard | `ui_widget` | ⭐ Simples | `dashboard.main` |
| 2 | Menu Item na Sidebar | `ui_widget` | ⭐ Simples | `sidebar.radar` |
| 3 | **Data Enrichment Badge** | `integration_connector` | ⭐⭐ Médio | `licitacao.detail.orgao_badge` |
| 4 | **Painel de Detalhe** | `integration_connector` | ⭐⭐ Médio | `licitacao.detail.after_orgao` |
| 5 | Automação com Hooks | `workflow_action` | ⭐⭐⭐ Avançado | N/A (backend only) |
| 6 | API Externa + Cache | `integration_connector` | ⭐⭐⭐ Avançado | Múltiplos |

---

## Receita 1: Widget de Dashboard

### Quando usar
Plugin que adiciona um widget visual no dashboard principal do usuário.

### Manifest snippet
```json
{
  "type": "ui_widget",
  "entrypoints": {
    "ui_slots": [
      {
        "slot_id": "dashboard.main",
        "label": "Meu Widget",
        "priority": 100
      }
    ]
  }
}
```

### main.js snippet
```javascript
MabusSDK.UI.registerWidget('dashboard.main', {
    title: '📊 Meu Widget',
    render: () => `
        <div style="text-align:center;padding:24px;">
            <div style="font-size:2rem;font-weight:900;">42</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">
                Algum dado importante
            </div>
        </div>
    `
});
```

---

## Receita 2: Menu Item na Sidebar

### Quando usar
Plugin que adiciona um link de navegação na sidebar, apontando para uma página própria.

### Manifest snippet
```json
{
  "type": "ui_widget",
  "route": "/minha-pagina",
  "entrypoints": {
    "ui_slots": [
      {
        "slot_id": "sidebar.radar",
        "label": "Minha Ferramenta",
        "icon_class": "fas fa-tools text-info",
        "route": "/minha-pagina",
        "priority": 250
      }
    ]
  }
}
```

---

## Receita 3: Data Enrichment Badge ⭐

### Quando usar
Plugin que exibe um badge pequeno e informativo ao lado de dados existentes
na plataforma (ex: nota fiscal, score de crédito, certificação).

### Manifest snippet
```json
{
  "type": "integration_connector",
  "entrypoints": {
    "enrichment_slots": [
      {
        "slot_id": "licitacao.detail.orgao_badge",
        "priority": 5,
        "description": "Badge inline com indicador"
      }
    ]
  }
}
```

### main.js snippet
```javascript
MabusSDK.UI.registerSlotWidget('licitacao.detail.orgao_badge', {
    priority: 5,
    render: (context) => {
        // context = { codigo_ibge, cnpj, esfera, uf }
        if (!context.codigo_ibge) return '';
        
        return `
            <span style="display:inline-flex;align-items:center;gap:3px;
                         padding:2px 8px;border-radius:6px;font-size:0.65rem;
                         background:rgba(52,199,89,0.15);border:1px solid rgba(52,199,89,0.3);
                         color:#34C759;font-weight:700;cursor:help;">
                🏦 Nota A
            </span>
        `;
    }
});
```

---

## Receita 4: Painel de Detalhe com Dados Externos

### Quando usar
Plugin que adiciona uma seção completa na página de detalhe da licitação
com dados enriquecidos (tabelas, gráficos, indicadores).

### Manifest snippet
```json
{
  "type": "integration_connector",
  "entrypoints": {
    "enrichment_slots": [
      {
        "slot_id": "licitacao.detail.after_orgao",
        "priority": 10
      }
    ],
    "backend_hooks": [
      {
        "event": "licitacao.detail.data",
        "type": "filter"
      }
    ]
  },
  "permissions": [
    { "scope": "read:entity.basic" }
  ]
}
```

### main.js snippet
```javascript
// 1. Enrich data via filter (server-side)
MabusSDK.Hooks.addFilter('licitacao.detail.data', async (licitacao) => {
    const cacheKey = `mydata_${licitacao.codigo_ibge}`;
    let data = await MabusSDK.DB.Storage.get(cacheKey);
    
    if (!data) {
        // Fetch from external API
        const response = await MabusSDK.Net.fetch(
            `https://api.example.com/data/${licitacao.codigo_ibge}`
        );
        data = JSON.parse(response.body);
        await MabusSDK.DB.Storage.set(cacheKey, data);
    }
    
    licitacao._plugin_mydata = data;
    return licitacao;
});

// 2. Render UI (client-side via slot)
MabusSDK.UI.registerSlotWidget('licitacao.detail.after_orgao', {
    render: (context) => `
        <div style="background:rgba(0,240,255,0.04);border:1px solid rgba(0,240,255,0.1);
                    border-radius:12px;padding:16px;margin-top:12px;">
            <h3 style="font-size:0.8rem;font-weight:700;margin:0 0 12px;">
                📊 Dados Enriquecidos
            </h3>
            <!-- Your rich content here -->
        </div>
    `
});
```

---

## Receita 5: Automação com Hooks (Backend Only)

### Quando usar
Plugin que reage a eventos da plataforma sem UI visual.
Ex: notificar webhook externo quando licitação é salva.

### main.js snippet
```javascript
// React to save events
MabusSDK.Hooks.addAction('licitacao.viewed', async (data) => {
    // Send to external webhook
    await MabusSDK.Net.fetch('https://hooks.example.com/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'licitacao_viewed',
            licitacao_id: data.id,
            orgao: data.orgao,
            timestamp: new Date().toISOString(),
        }),
    });
    
    MabusSDK.Log.info(`Webhook sent for licitação ${data.id}`);
});
```

---

## Receita 6: Conector de API Externa com Cache

### Quando usar
Plugin que integra dados de uma API externa, com cache agressivo
para performance e resiliência.

### main.js snippet
```javascript
const CACHE_TTL_HOURS = 24;

async function fetchWithCache(key, fetchFn) {
    const cached = await MabusSDK.DB.Storage.get(key);
    
    if (cached && cached._cachedAt) {
        const age = Date.now() - new Date(cached._cachedAt).getTime();
        if (age < CACHE_TTL_HOURS * 60 * 60 * 1000) {
            return cached;
        }
    }
    
    try {
        const fresh = await fetchFn();
        fresh._cachedAt = new Date().toISOString();
        await MabusSDK.DB.Storage.set(key, fresh);
        return fresh;
    } catch (err) {
        MabusSDK.Log.warn(`Cache miss and fetch failed for ${key}: ${err.message}`);
        return cached || null; // Fall back to stale cache
    }
}

// Usage in a filter
MabusSDK.Hooks.addFilter('licitacao.detail.data', async (licitacao) => {
    if (!licitacao.cnpj_orgao) return licitacao;
    
    const data = await fetchWithCache(
        `api_${licitacao.cnpj_orgao}`,
        async () => {
            const res = await MabusSDK.Net.fetch(
                `https://api.example.com/cnpj/${licitacao.cnpj_orgao}`
            );
            return JSON.parse(res.body);
        }
    );
    
    if (data) licitacao._plugin_api_data = data;
    return licitacao;
});
```

---

## Slots Disponíveis (Referência Rápida)

### Sidebar
| Slot | Localização | Uso |
|------|------------|-----|
| `sidebar.radar` | Seção "Radar" | Links de navegação |
| `sidebar.menu_items` | Seção "Plugins" | Links customizados |

### Dashboard
| Slot | Localização | Uso |
|------|------------|-----|
| `dashboard.main` | Área principal | Widgets de dados |
| `dashboard.sidebar` | Barra lateral | Widgets menores |

### Licitação (Detail Page)
| Slot | Localização | Uso |
|------|------------|-----|
| `licitacao.detail.orgao_badge` | Inline, ao lado do nome do órgão | Badges pequenos (CAPAG, score) |
| `licitacao.detail.after_orgao` | Abaixo da seção "Órgão Contratante" | Painéis detalhados |
| `licitacao.detail.after_info` | Após todas as informações | Seções de extensão |

### Licitação (Cards / Feed)
| Slot | Localização | Uso |
|------|------------|-----|
| `licitacao.card.badge` | Badge no card | Indicadores visuais |
| `licitacao.card.footer` | Rodapé do card | Informações extras |

### Hooks (Eventos)
| Evento | Tipo | Quando Dispara |
|--------|------|---------------|
| `licitacao.viewed` | Action | Usuário abre detalhe |
| `licitacao.detail.data` | Filter | Antes de renderizar detalhe |
| `licitacao.cards.data` | Filter | Antes de retornar cards do feed |

---

## Contexto Disponível nos Slots

Todos os slots de licitação recebem um objeto `context` com:

```javascript
{
  codigo_ibge: "3550308",   // Código IBGE do município
  cnpj: "12345678000199",   // CNPJ do órgão contratante
  esfera: "M",              // M=Municipal, E=Estadual, F=Federal
  uf: "SP",                 // Sigla da UF
  orgao: "Prefeitura...",   // Nome do órgão (quando disponível)
  municipio: "São Paulo",   // Nome do município (quando disponível)
  id: "abc123"              // ID da licitação (quando disponível)
}
```

> ⚠️ Nem todos os campos estarão presentes em todos os slots.
> Sempre verifique se o campo existe antes de usar.
