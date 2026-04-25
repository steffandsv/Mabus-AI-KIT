# 🤖 Mabus AI Kit

> Kit de desenvolvimento para criar plugins na plataforma **Mabus** usando Inteligência Artificial.  
> Sem saber programar. Usando qualquer agente de IA.

---

## 🚀 O que é?

O **Mabus AI Kit** é um conjunto de arquivos de contexto que ensinam qualquer agente de IA a criar plugins para a plataforma Mabus — uma plataforma de inteligência em licitações públicas.

Basta enviar estes arquivos ao seu agente de IA favorito, descrever o que deseja, e ele gera o plugin completo automaticamente.

## 📦 Conteúdo do Kit

| Arquivo | Descrição |
|---------|-----------|
| `PLATFORM_CONTEXT.md` | Documentação completa: arquitetura, SDK, tabelas, slots de UI e APIs |
| `PLUGIN_RECIPES.md` | 6 receitas prontas (enrichment, API, background worker, etc.) |
| `exemplo-enrichment/` | Plugin completo de referência com manifest.json e main.js |
| `exemplo-plugin/` | Template base para criar novos plugins do zero |

## 🤖 Agentes de IA Compatíveis

Funciona com **qualquer** agente que aceite arquivos de contexto:

| Agente | Empresa | Como usar |
|--------|---------|-----------|
| **Jules** | Google DeepMind | Envie o link deste repo → ele clona e cria o plugin |
| **Claude Code** | Anthropic | Cole o conteúdo do `PLATFORM_CONTEXT.md` como contexto |
| **Codex** | OpenAI / ChatGPT | Crie uma issue no GitHub descrevendo o plugin |
| **Cursor / Windsurf** | IDEs com IA | Abra esta pasta no projeto, a IA lê automaticamente |
| **Gemini Code Assist** | Google | Adicione como repositório de referência |

## ⚡ Como Usar

### Opção 1: Link direto (Jules, Codex)
Cole o link deste repositório na ferramenta:
```
https://github.com/steffandsv/mabus-ai-kit
```

### Opção 2: Clonar localmente (Cursor, Claude Code)
```bash
git clone https://github.com/steffandsv/mabus-ai-kit.git
```

### Opção 3: Copiar e colar (ChatGPT, qualquer chat)
Copie o conteúdo de `PLATFORM_CONTEXT.md` e cole na conversa.

## 💬 Exemplos de Prompts

### Plugin de Enrichment
```
Leia o PLATFORM_CONTEXT.md e PLUGIN_RECIPES.md. Crie um plugin do tipo 
"enrichment" para o Mabus que consulte a API do CNPJ.ws para cada órgão 
licitante e exiba informações da empresa (capital social, atividade 
principal) como um widget na página de detalhe da licitação. Use o slot 
"licitacao.detail.sidebar". Siga o padrão do exemplo-enrichment.
```

### Plugin de Dashboard Widget
```
Leia o PLATFORM_CONTEXT.md. Crie um plugin que adicione um card no 
dashboard mostrando as 5 licitações mais próximas de encerrar na região 
do usuário. Use eventBus.addAction para registrar uma rota GET e 
eventBus.applyFilter para injetar o widget.
```

### Plugin de Alerta por Email
```
Leia o PLATFORM_CONTEXT.md e PLUGIN_RECIPES.md (receita "Background Worker"). 
Crie um plugin que rode a cada 6 horas verificando novas licitações que 
correspondam às categorias do usuário e envie um resumo por email.
```

## 🏗️ Estrutura de um Plugin

```
meu-plugin/
├── manifest.json    ← Identidade (nome, versão, permissões)
└── main.js          ← Lógica (recebe o SDK como parâmetro)
```

**manifest.json** mínimo:
```json
{
  "id": "com.seuusuario.meu-plugin",
  "name": "Meu Plugin",
  "version": "1.0.0",
  "description": "Descrição do plugin",
  "permissions": ["database.read", "http.outbound"],
  "entry_point": "main.js"
}
```

**main.js** mínimo:
```javascript
module.exports = {
  activate(sdk) {
    sdk.logger.info('Plugin ativado!');
    
    // Exemplo: filtrar dados de licitação
    sdk.events.addFilter('licitacao.detail.data', async (data) => {
      data.myField = 'Hello!';
      return data;
    });
  }
};
```

## 📚 Tipos de Plugin

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| 🔍 **Enrichment** | Adiciona dados de APIs externas às licitações | CNPJ, CAPAG, certidões |
| 📊 **Dashboard Widget** | Cards e gráficos no painel do usuário | Licitações expirando |
| ⚙️ **Background Worker** | Tarefas agendadas | Alertas por email |
| 🌐 **API / Integração** | Rotas customizadas, webhooks | Integração com ERP |
| 📄 **Página Standalone** | Páginas completas com interface própria | Relatórios avançados |
| 🎨 **Tema** | Modificações visuais | Temas alternativos |

## 🔗 Links

- **App Store**: acesse `/apps` na plataforma para ver plugins publicados
- **App Store Connect**: acesse `/developer/apps` para gerenciar seus plugins
- **Documentação**: acesse `/developer/docs` para a Central do Desenvolvedor

## 📄 Licença

Este kit é fornecido para uso exclusivo de desenvolvedores aprovados na plataforma Mabus.

---

<p align="center">
  <strong>Mabus</strong> — Plataforma de Inteligência em Licitações<br>
  <sub>Crie plugins. Publique. Monetize.</sub>
</p>
