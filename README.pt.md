<!-- Generated from launch/locales/pt.json; run npm run docs:generate. -->
# Agent Canvas

[English](README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Italiano](README.it.md) · [한국어](README.ko.md) · [Nederlands](README.nl.md)

## O agente constrói.
Você dá forma ao próximo passo.

Um espaço leve para ver, testar e melhorar a app do seu agente. Explore ecrãs reais, aponte o que mudar e continue a construir a partir do código.

**[Abrir demonstração](https://agent-canvas-app.pages.dev/demo/?lang=en) · [Começar grátis](https://agent-canvas-app.pages.dev/about/pt/start/) · [Artigo de lançamento](https://agent-canvas-app.pages.dev/about/pt/release/)**

Demonstração em inglês

## Para construir, rever e melhorar

- Veja juntas as páginas completas, os estados identificados e os fluxos implementados.
- Mantenha uma única implementação de UI. O agente cria fixtures, adapter e verificações de cobertura.
- Experimente 77 estados e 44 fluxos com dados sintéticos, sem conta nem chave API.



## Explore, interaja e reproduza

### Afaste para entender a aplicação

Páginas completas agrupadas, pesquisa, filtros e painéis recolhíveis. Os links de fluxo movem a câmara para o destino.

### Aproxime para usar a UI real

Browse bloqueia os controlos para mover a tela. Selecione uma página e Interact para usar o código original com dados descartáveis.

### Aponte exatamente o que mudar

Selecione um ecrã ou elemento UI, adicione o pedido e copie uma referência para o agente. Peça-lhe que altere o código; as prévias ligadas ao código são reconstruídas.



## De um repositório existente a uma tela interativa

Peça a integração a um agente capaz de ler, editar e executar comandos. Não exige Storybook nem uma lista manual de páginas. Instalar o pacote não preenche a tela por si só.

### Cole no seu agente

```text
Read https://github.com/tombelieber/app-canvas/blob/v0.16.1/AGENT_GUIDE.md and add a completely populated Agent Canvas to this repository. Discover all screens, components, variants, states and navigation from the whole application source. Use original UI code. Create the missing synthetic fixtures and render harnesses. Reconcile an independent source inventory with rendered cases and source-linked runtime checks. Add checked happy, failure and recovery journeys. Group by actual page and feature, connect checked flows, deduplicate repeated captures and resume checkpoints. Run --ui-complete against the original source root; keep the stricter --complete source audit separate and unchanged. Continue until the full landscape is populated and verified; report genuine blockers as incomplete. Keep production sessions, credentials and real user data out of previews.
```

### 1. Instale a ferramenta partilhada

Use Node.js 22+ e o gestor e lockfile do projeto. Instale a versão GitHub fixa e o navegador. No npm 12, adicione --allow-git=root apenas se bloquear esta dependência Git direta; não altere a política global.

```sh
npm install --save-dev github:tombelieber/app-canvas#v0.16.1
npx agent-canvas browsers
```

### 2. Faça o inventário antes dos casos

Execute plan em todo o repositório original. Reveja cada ficheiro, âncora UI, dependência que afete a UI e navegação real. Enumere ecrãs e estados independentemente do catálogo; mantenha visíveis as UI por resolver.

```sh
npx agent-canvas plan --source-root . --out ui-review/ui-inventory.json
npx agent-canvas status --inventory ui-review/ui-inventory.json
```

### 3. Renderize a UI original com fixtures

Crie config, catalog, fixtures sintéticos, preview entry e journeys em ui-review. O adapter importa páginas, providers e estilos reais. Substitua dados e dependências, nunca a UI; rejeite pedidos de rede desconhecidos.

### 4. Verifique estados e interações

Inclua normal, vazio, carregamento, erro, acesso negado, diálogos e recuperação. Verifique cada caso e controlos reais em fluxos contínuos. Concilie inventory, assertions ligadas ao código e rotas; passe --ui-complete na mesma raiz. --complete continua a ser uma auditoria rigorosa e separada de todo o código fonte. As pendências não contam ecrãs em falta.

```sh
npx agent-canvas populate --config ui-review/canvas.config.mjs --source-root . --verify
```

### 5. Reveja e mantenha a partir do código

Execute ui:review, veja a tela e o grafo e reproduza um fluxo. Peça alterações ao código real. Os previews existentes são reconstruídos; novas rotas e estados exigem atualizar inventory, fixtures e journeys. Exija a verificação completa antes da entrega.

```sh
npm run ui:review
```


### O que fica na sua aplicação

O pacote partilhado mantém viewer, CLI e skill. O repositório mantém adapter, fixtures, inventory independente, catalog e testes de interação. Comece pelo exemplo React/Vite executável; outras stacks precisam do seu adapter.

[Agent guide](https://github.com/tombelieber/app-canvas/blob/v0.16.1/AGENT_GUIDE.md) · [React/Vite](https://github.com/tombelieber/app-canvas/tree/v0.16.1/examples/react-vite)

### Skill opcional

Codex e Claude Code podem instalar a skill incluída. Outros agentes seguem AGENT_GUIDE.md diretamente. O runtime não chama modelos nem exige chave API; o agente escolhido tem os seus custos e permissões.

```sh
npx agent-canvas install --target both
```

## Âmbito e limites

- Web usa HTML/CSS reais e JavaScript original nas interações. UIKit, SwiftUI e Android exigem harnesses e evidência do runtime original; uma captura não é uma aplicação nativa interativa.
- A cobertura liga código revisto a casos; não descobre automaticamente todas as condições de negócio. Os testes UI não qualificam backends de produção nem precisão clínica ou de modelos.
- Viewer: inglês por defeito, com 11 idiomas. A demo pública é um frontend sintético fixo; as integrações locais seguem o código. Não foi medido o desempenho num iPad físico.

Dados sintéticos · sem backend da app · sem conta · sem chave API

[Artigo técnico Safari](https://tomtang3.ai/blog/app-canvas-safari-rendering/)

API detalhada, fluxo nativo, alternativas e manutenção no README inglês e guia do agente. [English README](README.md) · [MIT](LICENSE)
