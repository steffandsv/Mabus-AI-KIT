# Mabus Plugin Platform — AI Context Document v3.0
# Cole este arquivo inteiro na sua IA generativa favorita (ChatGPT, Claude, Gemini)
# e peça para criar o plugin que você imaginar.

---

## 🏗️ Arquitetura da Plataforma

A Mabus usa uma arquitetura **Microkernel + Plugin Sandbox**.

- Cada plugin roda em um **sandbox isolado** (`isolated-vm`)
- Plugins comunicam-se com a plataforma através do **MabusSDK**
- Toda comunicação é assíncrona e baseada em permissões
- O Event Bus suporta **Actions** (side-effects) e **Filters** (data transformation)

### Tecnologias
- **Backend:** Node.js + Express
- **Frontend:** EJS Templates + Vanilla JS
- **Database:** PostgreSQL
- **Cache:** Redis
- **UI Framework:** DaisyUI + TailwindCSS (Dark Theme)

---

## 📦 Estrutura de um Plugin

```
meu-plugin/
├── manifest.json      ← OBRIGATÓRIO: Metadados e permissões
├── main.js            ← OBRIGATÓRIO: Ponto de entrada
├── README.md          ← Recomendado: Documentação
└── assets/            ← Opcional: Ícones, imagens, CSS
    └── icon.png
```

---

## 📋 manifest.json (Campos Obrigatórios)

```json
{
  "schema_version": "1.0.0",
  "plugin_id": "meu-plugin-unico",
  "name": "Nome do Meu Plugin",
  "version": "1.0.0",
  "description": "Descrição clara do que o plugin faz",
  "type": "ui_widget",
  "category": "analytics",
  "publisher": {
    "developer_id": "meu-id",
    "legal_region": "BR"
  },
  "entrypoints": {
    "ui_slots": [],
    "enrichment_slots": [],
    "backend_hooks": [],
    "event_subscriptions": [],
    "event_publications": []
  },
  "permissions": [
    {
      "scope": "read:entity.basic",
      "purpose": "Para que o plugin precisa desta permissão"
    }
  ],
  "security": {
    "declared_egress_domains": [],
    "data_classification": ["public"],
    "stores_personal_data": false
  },
  "distribution": {
    "visibility": "public",
    "pricing_model": "free",
    "regions": ["BR"]
  }
}
```

### Tipos de Plugin (`type`)
| Tipo | Descrição | Quando usar |
|------|-----------|-------------|
| `ui_widget` | Widget visual (dashboard, sidebar, page) | Mostrar dados, menus, painéis |
| `integration_connector` | Integração com dados/API externa | CAPAG, CNPJ, score de crédito |
| `workflow_action` | Automação de workflow | Webhooks, notificações, automações |
| `ai_tool` | Ferramenta com IA integrada | Análise, classificação, sugestões |

### Modelos de Preço (`pricing_model`)
| Modelo | Descrição |
|--------|-----------|
| `free` | Gratuito para todos |
| `paid_monthly` | Assinatura mensal |
| `paid_yearly` | Assinatura anual |
| `paid_lifetime` | Pagamento único vitalício |

---

## 🔧 MabusSDK — API Completa

### Dados Persistentes (Plugin-Scoped Storage)
```javascript
// Salvar dado vinculado ao plugin + usuário
await MabusSDK.DB.Storage.set('chave', { qualquer: 'valor' });
// Ler dado
const data = await MabusSDK.DB.Storage.get('chave');
```

### Consulta de Dados da Plataforma (Read-Only)
```javascript
// Consultar licitações (campos permitidos apenas)
const licitacoes = await MabusSDK.DB.query('licitacoes', {
    uf_sigla: 'SP',
    esfera: 'M',
    _limit: 50,
    _offset: 0,
});

// Consultar itens de licitação
const itens = await MabusSDK.DB.query('licitacoes_itens', {
    licitacao_id: 'abc123',
});

// Consultar municípios IBGE
const municipios = await MabusSDK.DB.query('municipios_ibge', {
    uf_sigla: 'SP',
    _limit: 100,
});
```

**Campos consultáveis por collection:**

| Collection | Campos |
|-----------|--------|
| `licitacoes` | id, objeto_compra, situacao_compra, modalidade_licitacao, valor_estimado_total, data_publicacao_pncp, data_abertura_proposta, razao_social_orgao, cnpj_orgao, uf_sigla, municipio_nome, **codigo_ibge**, **esfera**, **poder** |
| `licitacoes_itens` | id, licitacao_id, numero_item, descricao_item, quantidade, unidade_medida, valor_unitario_estimado |
| `municipios_ibge` | codigo_ibge, nome, uf_sigla, latitude, longitude, populacao |

### Hooks — Actions (Side-effects)
```javascript
// Reagir quando uma licitação é visualizada (fire-and-forget)
MabusSDK.Hooks.addAction('licitacao.viewed', async (data) => {
    // data = { id, orgao, cnpj, codigo_ibge, esfera, uf }
    MabusSDK.Log.info(`Licitação vista: ${data.id}`);
});
```

### Hooks — Filters (Data Transformation)
```javascript
// Enriquecer dados de licitação ANTES do render
MabusSDK.Hooks.addFilter('licitacao.detail.data', async (licitacao) => {
    // Adicionar campo customizado
    licitacao._plugin_meus_dados = { nota: 'A', score: 95 };
    return licitacao; // IMPORTANTE: sempre retornar o objeto modificado
});

// Enriquecer cards do feed
MabusSDK.Hooks.addFilter('licitacao.cards.data', async (cards) => {
    return cards.map(card => {
        card._plugin_badge = calcularBadge(card);
        return card;
    });
});
```

### Eventos Disponíveis
| Evento | Tipo | Dados | Descrição |
|--------|------|-------|-----------|
| `licitacao.viewed` | Action | `{id, orgao, cnpj, codigo_ibge, esfera, uf}` | Licitação visualizada (página de detalhe) |
| `licitacao.detail.data` | Filter | `licitacao` (objeto completo) | Enriquecer dados antes de renderizar detalhe |
| `licitacao.cards.data` | Filter | `cards` (array de licitações) | Enriquecer cards do feed antes de retornar |

### UI — Widgets Visuais (Básico)
```javascript
// Registrar widget no dashboard
MabusSDK.UI.registerWidget('dashboard.main', {
    title: 'Meu Widget',
    render: () => `
        <div style="padding:16px;">
            <h3>Olá do meu plugin!</h3>
        </div>
    `
});
```

### UI — Slot Widgets Contextuais (Enrichment) ⭐ NOVO
```javascript
// Registrar widget que recebe contexto da licitação atual
MabusSDK.UI.registerSlotWidget('licitacao.detail.orgao_badge', {
    priority: 5,
    render: (context) => {
        // context = { codigo_ibge, cnpj, esfera, uf, orgao, municipio }
        if (!context.codigo_ibge) return '';

        return `
            <span style="display:inline-flex;align-items:center;gap:3px;
                         padding:2px 8px;border-radius:6px;font-size:0.65rem;
                         background:rgba(52,199,89,0.15);border:1px solid rgba(52,199,89,0.3);
                         color:#34C759;font-weight:700;">
                🏦 Nota A
            </span>
        `;
    }
});
```

### Slots de UI Disponíveis

#### Sidebar
| Slot | Local | Tipo |
|------|-------|------|
| `sidebar.radar` | Seção "Radar" do sidebar | Link/item |
| `sidebar.menu_items` | Seção "Plugins" do sidebar | Link/item |

#### Dashboard
| Slot | Local | Tipo |
|------|-------|------|
| `dashboard.main` | Área principal do dashboard | Widget HTML |
| `dashboard.sidebar` | Barra lateral do dashboard | Widget HTML |

#### Licitação — Página de Detalhe ⭐ NOVO
| Slot | Local | Tipo |
|------|-------|------|
| `licitacao.detail.orgao_badge` | Inline, ao lado do nome do órgão | Badge pequeno |
| `licitacao.detail.after_orgao` | Abaixo da seção "Órgão Contratante" | Painel/card |
| `licitacao.detail.after_info` | Após todas as informações | Seção de extensão |

#### Licitação — Cards / Feed
| Slot | Local | Tipo |
|------|-------|------|
| `licitacao.card.badge` | Badge no card | Indicador visual |
| `licitacao.card.footer` | Rodapé do card | Info extra |

#### Outros
| Slot | Local | Tipo |
|------|-------|------|
| `app_detail.extra` | Página de detalhe do app | Widget HTML |

### HTTP Requests (Sandboxed)
```javascript
// Fetch externo (requer declared_egress_domains no manifest)
const response = await MabusSDK.Net.fetch('https://api.exemplo.com/dados', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer token' }
});
// response = { status: 200, headers: {...}, body: '...' }
const data = JSON.parse(response.body);
```

### Logs
```javascript
MabusSDK.Log.info('Plugin iniciado com sucesso');
MabusSDK.Log.warn('Algo inesperado mas não crítico');
MabusSDK.Log.error('Falha ao conectar');
```

---

## 🔐 Permissões

No `manifest.json`, declare as permissões necessárias com justificativa:

```json
{
  "permissions": [
    {
      "scope": "read:entity.basic",
      "purpose": "Ler dados das licitações para exibir indicadores fiscais",
      "data_minimization": "Apenas codigo_ibge e esfera"
    },
    {
      "scope": "external:http.egress",
      "purpose": "Consultar API do Tesouro Nacional"
    }
  ],
  "security": {
    "declared_egress_domains": ["apidatalake.tesouro.gov.br"],
    "data_classification": ["public"],
    "stores_personal_data": false
  }
}
```

### Scopes Disponíveis
| Scope | Descrição |
|-------|-----------|
| `read:entity.basic` | Consultar licitações e itens (read-only) |
| `external:http.egress` | Fazer requests HTTP externos |
| `storage:plugin_data` | Ler/gravar dados do plugin (implícito) |

### Regras de Segurança (OBRIGATÓRIO)
- ❌ **PROIBIDO** acessar `process`, `require`, `fs`, `child_process`
- ❌ **PROIBIDO** coletar dados pessoais além do necessário
- ❌ **PROIBIDO** minerar criptomoedas ou executar código malicioso
- ❌ **PROIBIDO** fazer scraping de outros sites sem autorização
- ❌ **PROIBIDO** usar `eval()`, `new Function()`, `import()`
- ✅ Usar apenas o `MabusSDK` para toda interação
- ✅ Tratar erros com try/catch (plugins que crasham são desativados)
- ✅ Declarar todos os domínios de egress no manifest

---

## 💡 Exemplo Completo: Plugin de Enrichment

> **Caso de uso:** Exibir saúde fiscal do ente federativo em licitações.

### manifest.json
```json
{
  "schema_version": "1.0.0",
  "plugin_id": "indicador-fiscal",
  "name": "Indicador Fiscal do Órgão",
  "version": "1.0.0",
  "description": "Exibe nota CAPAG do ente federativo ao lado do nome do órgão em cada licitação",
  "type": "integration_connector",
  "category": "analytics",
  "entrypoints": {
    "enrichment_slots": [
      { "slot_id": "licitacao.detail.orgao_badge", "priority": 5 },
      { "slot_id": "licitacao.detail.after_orgao", "priority": 10 }
    ],
    "backend_hooks": [
      { "event": "licitacao.detail.data", "type": "filter" }
    ],
    "event_subscriptions": ["licitacao.viewed"]
  },
  "permissions": [
    { "scope": "read:entity.basic", "purpose": "Ler codigo_ibge da licitação" }
  ],
  "security": {
    "declared_egress_domains": [],
    "data_classification": ["public"],
    "stores_personal_data": false
  },
  "distribution": {
    "visibility": "public",
    "pricing_model": "free"
  }
}
```

### main.js
```javascript
// 1. Enriquecer dados via Filter
MabusSDK.Hooks.addFilter('licitacao.detail.data', async (licitacao) => {
    if (!licitacao.codigo_ibge) return licitacao;

    const cacheKey = `fiscal_${licitacao.codigo_ibge}`;
    let data = await MabusSDK.DB.Storage.get(cacheKey);

    if (!data) {
        data = { nota: 'B', endividamento: 42.5, poupanca: 8.2 };
        await MabusSDK.DB.Storage.set(cacheKey, data);
    }

    licitacao._plugin_fiscal = data;
    return licitacao;
});

// 2. Badge visual no slot
MabusSDK.UI.registerSlotWidget('licitacao.detail.orgao_badge', {
    priority: 5,
    render: (context) => {
        if (!context.codigo_ibge) return '';
        return `<span style="padding:2px 8px;border-radius:6px;font-size:0.65rem;
                       background:rgba(0,122,255,0.15);border:1px solid rgba(0,122,255,0.3);
                       color:#007AFF;font-weight:700;">🏦 CAPAG B</span>`;
    }
});

// 3. Painel detalhado
MabusSDK.UI.registerSlotWidget('licitacao.detail.after_orgao', {
    render: (context) => {
        if (!context.codigo_ibge) return '';
        return `<div style="background:rgba(0,122,255,0.04);border:1px solid rgba(0,122,255,0.1);
                    border-radius:12px;padding:16px;margin-top:12px;">
            <h4 style="font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.8);margin:0 0 8px;">
                🏦 Saúde Fiscal do Ente
            </h4>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                <div style="text-align:center;padding:8px;background:rgba(255,255,255,0.03);border-radius:8px;">
                    <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);">Endividamento</div>
                    <div style="font-size:0.9rem;font-weight:800;color:#007AFF;">42.5%</div>
                </div>
                <div style="text-align:center;padding:8px;background:rgba(255,255,255,0.03);border-radius:8px;">
                    <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);">Poupança</div>
                    <div style="font-size:0.9rem;font-weight:800;color:#34C759;">8.2%</div>
                </div>
            </div>
        </div>`;
    }
});

// 4. Tracking
MabusSDK.Hooks.addAction('licitacao.viewed', async (data) => {
    MabusSDK.Log.info(`Viewed: ${data.id} (IBGE: ${data.codigo_ibge})`);
});

MabusSDK.Log.info('Plugin Indicador Fiscal ativo!');
```

---

## 🎨 Guia de Design

Use estes tokens visuais para manter consistência com a plataforma:

```css
/* Cores */
--primary: #00F0FF;     /* Cyan principal */
--success: #10b981;     /* Verde */
--warning: #f59e0b;     /* Amarelo */
--error: #ef4444;       /* Vermelho */
--bg: #0a0a0f;          /* Fundo escuro */
--card: rgba(255,255,255,0.02);  /* Cards */
--border: rgba(255,255,255,0.06); /* Bordas */
--text: rgba(255,255,255,0.6);    /* Texto */
--text-muted: rgba(255,255,255,0.3); /* Texto secundário */

/* Border Radius */
--radius-sm: 8px;
--radius-md: 14px;
--radius-lg: 20px;

/* Fonte */
font-family: 'Inter', sans-serif;
```

---

## 📤 Como Publicar

1. Empacote seu plugin em um arquivo `.zip`
2. Acesse **App Store Connect** → **Novo Plugin**
3. Faça upload do ZIP
4. Defina preço e modelo de precificação
5. Envie para revisão
6. Após aprovação, seu plugin estará na App Store!

---

## 🤖 Prompts Prontos para IA

### Criar Widget de Dashboard
> "Crie um plugin Mabus do tipo ui_widget que [DESCREVA O QUE QUER]. Use o MabusSDK para dados persistentes e registre um widget no slot dashboard.main. Siga as regras de segurança do PLATFORM_CONTEXT."

### Criar Plugin de Enrichment (CAPAG, Score, etc.)
> "Crie um plugin Mabus do tipo integration_connector que enriquece licitações com [DADOS QUE QUER]. Use MabusSDK.Hooks.addFilter para 'licitacao.detail.data' e MabusSDK.UI.registerSlotWidget para os slots 'licitacao.detail.orgao_badge' e 'licitacao.detail.after_orgao'. Inclua cache via MabusSDK.DB.Storage."

### Criar Automação
> "Crie um plugin Mabus do tipo workflow_action que escuta o evento [NOME_EVENTO] e automaticamente [AÇÃO DESEJADA]. Use MabusSDK.Hooks.addAction e armazene estado via MabusSDK.DB.Storage."

### Criar Conector de API
> "Crie um plugin Mabus do tipo integration_connector que integra com [SERVIÇO/API]. Use MabusSDK.Net.fetch para chamadas HTTP, declare os domínios no declared_egress_domains, e use MabusSDK.DB.Storage para cache. Inclua tratamento de erros."

---

## 📖 Recursos Adicionais

- **PLUGIN_RECIPES.md** — Receitas prontas para cenários comuns
- **exemplo-plugin/** — Plugin simples de referência (contador)
- **exemplo-enrichment/** — Plugin de enrichment de referência (indicador fiscal)

---

*Versão do Contexto: 3.0 | Atualizado em: Abril 2026*
*Dúvidas? Acesse docs.mabus.com.br/developers*
