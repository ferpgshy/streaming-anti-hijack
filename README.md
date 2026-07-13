# Streaming Anti-Hijack

> Defesa em camadas contra popup, popunder e sequestro de clique (*click-hijack*) em sites de streaming.

Um userscript para **Tampermonkey / Violentmonkey** que neutraliza as táticas de anúncio mais agressivas dos sites de filmes e séries: aquela nova aba que abre do nada, o clique no player que vira propaganda, o overlay invisível por cima do vídeo e os popunders que ficam empilhando janela. Tudo isso **sem depender de adblock** — o próprio script corta as requisições de rede das *ad networks*.

<p>
  <img alt="version" src="https://img.shields.io/badge/version-4.5-f59e0b">
  <img alt="tampermonkey" src="https://img.shields.io/badge/Tampermonkey-compat%C3%ADvel-00485b">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
</p>

---

## Instalação

1. Instale a extensão [**Tampermonkey**](https://www.tampermonkey.net/) (ou [Violentmonkey](https://violentmonkey.github.io/)) no seu navegador.
2. Clique no link abaixo — a extensão abre a tela de instalação automaticamente:

   ### 👉 [**Instalar Streaming Anti-Hijack**](https://raw.githubusercontent.com/ferpgshy/streaming-anti-hijack/main/streaming-anti-hijack.user.js)

3. Confirme em **Instalar**. Pronto.

> **Atualização automática:** depois de instalado, o Tampermonkey verifica o repositório de tempos em tempos e puxa a nova versão sozinho sempre que o `@version` do script subir. Você **nunca mais precisa reinstalar** — só instalar uma vez.

---

## Por que ele existe

Sites de streaming gratuito vivem de anúncio, e os piores usam técnicas que passam por cima de adblock comum:

- `window.open()` disparado no primeiro clique da página (popunder);
- links e formulários que redirecionam pra fora no `mousedown`;
- overlays transparentes de tela cheia por cima do player (você acha que clicou no play, clicou no anúncio);
- iframes `sandbox="allow-popups"` que escapam pra abrir aba;
- push notifications e service workers de propaganda;
- detecção de adblock que troca de tática quando percebe que está bloqueada.

Este script trata **cada uma dessas camadas** de forma independente, e só age nos sites que você configurar — no resto da web ele fica inerte.

---

## Como funciona

O script roda em `document-start` e decide um **modo de operação** por contexto:

| Modo | Quando | O que faz |
|------|--------|-----------|
| `full`  | Site da sua lista, players conhecidos e iframes filhos deles | Todas as camadas ativas |
| `light` | Iframe de origem desconhecida | Só o bloqueio de popup |
| *(nenhum)* | Resto da web | Não toca em nada |

As camadas de defesa:

- **0 · Anti-detecção** — toda função sobrescrita responde `toString()` como se fosse nativa, então o *ad script* não percebe que foi bloqueado e não parte pro plano B.
- **1 · `window.open` travado** — devolve uma "janela fake" (`closed: false`) pra fingir sucesso e o anúncio não tentar outro método.
- **2 · Blindagem de iframes** — todo iframe same-origin é neutralizado no instante da inserção (hooks síncronos), no acesso via `contentWindow`, no `load` e num *sweep* periódico. O truque do "iframe limpo" não passa.
- **3 · Cliques sintéticos** — `click()`, `dispatchEvent` e eventos não confiáveis apontando pra links externos são barrados.
- **4 · Forms fantasma** — `form.submit()` / `requestSubmit()` pra domínio externo são bloqueados.
- **5 · `<base target>`** — neutraliza o redirect por header `<base>`.
- **6 · Flags de popunder** — marca como "já carregado" as *flags* dos popunders mais conhecidos.
- **7–8 · Cliques reais e `beforeunload`** — intercepta a navegação externa no `pointerdown`/`mousedown` e recusa *traps* de saída de página.
- **9 · Push / Service Worker** — nega permissão de notificação e bloqueia registro de SW de anúncio.
- **10 · Overlays invisíveis** — remove o "vidro" transparente por cima do player, com heurística que **preserva o player e o fullscreen** (nunca quebra os controles do vídeo).
- **11 · Bloqueio de rede** — corta `fetch`, `XHR`, `sendBeacon`, `Image().src` e `<script|img>.src` para *ad networks* conhecidas e TLDs-lixo. É esta camada que faz o script se sustentar **em Chrome puro, sem adblock nenhum**.

---

## Configuração

Toda a configuração fica no topo do arquivo, em blocos bem sinalizados. Não precisa entender o resto do código.

### Adicionar um site

Em `SITES`, adicione o **nome-base** do site (sem TLD). O regex casa com qualquer terminação, então uma linha já cobre todas as trocas de domínio:

```js
const SITES = [
  /pobreflix/i,     // pega pobreflix.* em qualquer TLD
  /redecanais/i,    // .gs .tw .la .in ... todos de uma vez
  /meunovosite/i,   // <- adicione o seu aqui
];
```

### Player em domínio separado

Se o player de um site ficar num domínio próprio (veja em `F12 › Elements` o `<iframe src=...>`), adicione em `PLAYER_HOSTS`:

```js
const PLAYER_HOSTS = [
  /bysebuho\.com/i,
  /meu-player\.xyz/i,   // <- aqui
];
```

### Whitelist

Links externos que você **quer** que funcionem (ex.: Discord) vão em `ALLOW`:

```js
const ALLOW = [
  /discord\.gg/i,
];
```

### Ajustes finos

| Flag | Padrão | Efeito |
|------|--------|--------|
| `NETWORK_BLOCK` | `true` | Bloqueio de rede autossuficiente (não depende de adblock) |
| `PROTECT_UNKNOWN_IFRAMES` | `true` | Protege também iframes de origem indeterminada. Se quebrar login em popup de algum site normal, mude pra `false` |

---

## Verificando que está funcionando

Abra o **Console** (`F12 › Console`) num site da lista. Você vai ver logs em laranja:

```
[AntiHijack v4] MODO FULL ativo em TOP -> https://...
[AntiHijack v4] window.open BLOQUEADO em [full:...] -> https://ad...
[AntiHijack v4] overlay removido: <div ...>
```

Cada linha é uma tentativa de sequestro que foi barrada.

---

## Contribuindo

Encontrou um site novo ou um player que escapou? Abra uma [issue](https://github.com/ferpgshy/streaming-anti-hijack/issues) com o domínio, ou mande um PR adicionando o padrão em `SITES` / `PLAYER_HOSTS`.

Ao alterar o script, **suba o número em `@version`** no cabeçalho — é isso que dispara a atualização automática em quem já tem instalado.

---

## Aviso

Este projeto é uma ferramenta **defensiva**, feita para melhorar a segurança e a experiência de navegação do próprio usuário contra anúncios abusivos. Ele não altera nem redistribui o conteúdo de nenhum site.

---

## Licença

[MIT](LICENSE) © ferpgshy
