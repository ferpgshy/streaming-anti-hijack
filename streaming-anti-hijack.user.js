// ==UserScript==
// @name         Streaming Anti-Hijack
// @namespace    pgshy.antihijack
// @version      4.10
// @description  Defesa em camadas contra popup/popunder/click-hijack em sites de streaming. Lista de sites configurável.
// @author       ferpgshy
// @homepageURL  https://github.com/ferpgshy/streaming-anti-hijack
// @supportURL   https://github.com/ferpgshy/streaming-anti-hijack/issues
// @updateURL    https://raw.githubusercontent.com/ferpgshy/streaming-anti-hijack/main/streaming-anti-hijack.user.js
// @downloadURL  https://raw.githubusercontent.com/ferpgshy/streaming-anti-hijack/main/streaming-anti-hijack.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ================================================================
  // CONFIG — ADICIONE SEUS SITES AQUI (uma linha por site)
  // O regex casa com qualquer TLD, então "redecanais" pega
  // redecanais.gs, redecanais.tw, redecanais.la, etc.
  // ================================================================
  const SITES = [
    // --- Pobreflix e variações ---
    /pobreflix/i,
    /pobretv/i,
    // --- Redecanais (troca de TLD direto: .in .gs .tw .la ...) ---
    /redecanais/i,
    /redecanal/i,
    // --- Superflix ---
    /superflix/i,
    /supercine/i,
    // --- Vizer ---
    /vizer/i,
    // --- Overflix / Obaflix / Megaflix / Netcine / Netmovies ---
    /overflix/i,
    /obaflix/i,
    /megaflix/i,
    /megacine/i,
    /netcine/i,
    /netmovies/i,
    // --- Cine Vision / Visioncine / Topflix / Ultracine ---
    /cinevision/i,
    /visioncine/i,
    /topflix/i,
    /ultracine/i,
    // --- Outros do nicho ---
    /mmfilmes/i,
    /filmize/i,
    /filmix/i,
    /starflix/i,
    /youcine/i,
    /comandoflix/i,
    /playseries/i,
    /queroseries/i,
    /querofilmes/i,
    /donflix/i,
    /warezcdn/i,   // provedor de embed muito usado por esses sites
    // Adicione mais aqui conforme encontrar. Use só o NOME (sem TLD)
    // pra pegar todas as trocas de domínio automaticamente.
  ];

  // Domínios de player/embed (F12 > Elements > procura <iframe src=...>)
  // Adicione aqui se o player de algum site ficar em domínio separado.
  // Hosts daqui são EXCEÇÃO total: navegar até eles nunca é bloqueado
  // (nem o clique 2x da camada 7) e dentro deles o modo full protege.
  const PLAYER_HOSTS = [
    // --- Byse / Filemoon (pool de domínios byse*.com rotativo) ---
    /byse[a-z]*\./i,    // bysebuho, bysefujedu, bysezoxexe, bysejikuar...
    /filemoon/i,        // Byse é o player da rede Filemoon
    /q8y5z\.com/i,      // player JW do pobreflix (visto nos logs)
    // --- DoodStream e aliases (dood.to .li .watch, d000d, ds2play...) ---
    /doods?\./i, /doodstream/i, /d[o0]{2,5}d\./i, /ds2play/i, /ds2video/i,
    /dooodster/i, /vidply/i, /do7go/i, /vide0\./i,
    // --- MixDrop e aliases/CDNs ---
    /mixdrop/i, /mixdroop/i, /mxdrop/i, /mixdrp/i, /m1xdrop/i,
    /mdy48tn97/i, /mdfx9dc8n/i, /md3b0j6hj/i, /mdzsmutpcvykb/i,
    // --- Streamtape e aliases ---
    /streamtape/i, /strtape/i, /strtpe/i, /streamta\.pe/i, /strcloud/i,
    /(^|\.)stape\./i, /shavetape/i, /tapecontent/i, /adblocktape/i,
    /antiadtape/i, /watchadsontape/i, /tapewithadblock/i, /tapeblocker/i,
    /streamadbl/i,
    // /exemplo-player\.xyz/i,
  ];

  // Links externos que você QUER que funcionem (whitelist):
  const ALLOW = [
    // /discord\.gg/i,
  ];

  // ================================================================
  // BLOQUEIO DE REDE (camada 11) — config. Implementação mais abaixo,
  // depois que matchesSite/isAllowed existirem.
  // ================================================================
  const NETWORK_BLOCK = true; // true = autossuficiente, não depende de adblock

  // TLDs-lixo usados quase só por ad networks (bate com .cfd/.cyou dos logs).
  // CUIDADO: bloqueia o TLD inteiro — todos aqui têm reputação horrível.
  const AD_TLDS = /\.(cfd|cyou|sbs|gdn|icu|lol|bond|makeup|hair|skin|beauty|quest|monster|rest|cam|autos|boats|mom|lat|christmas|cricket|country|download|stream|review|date|racing|win|bid|loan|men|click|link|work|kim|party|trade|webcam|science|accountant|faith|zip|mov)$/i;

  // Ad networks / trackers de popunder conhecidos (nome-base, qualquer TLD).
  const AD_HOSTS = [
    /popads/i, /popcash/i, /popunder/i, /propellerads/i, /propeller/i,
    /exoclick/i, /exosrv/i, /juicyads/i, /adsterra/i, /hilltopads/i,
    /clickadu/i, /adnium/i, /trafficstars/i, /trafficjunky/i, /plugrush/i,
    /admaven/i, /ad-maven/i, /onclickalgo/i, /onclckbdr/i, /onclicka/i,
    /mgid/i, /revcontent/i, /taboola/i, /outbrain/i, /adcash/i,
    /monetag/i, /galaksion/i, /clickaine/i, /richads/i, /coinzilla/i,
    /pushnami/i, /pushwoosh/i, /notix/i, /pushground/i, /datsprings/i,
    /highperformanceformat/i, /displaycontentnetwork/i, /bidgear/i,
  ];

  // Proteção "só popup" em iframes cuja origem não dá pra identificar
  // (Firefox sem ancestorOrigins, referrer vazio). true = mais blindado.
  // Se quebrar login em popup de algum site normal, mude pra false.
  const PROTECT_UNKNOWN_IFRAMES = true;

  const log = (...a) => console.log('%c[AntiHijack v4]', 'color:#f59e0b;font-weight:bold', ...a);

  const matchesSite = (str) => !!str && (SITES.some((re) => re.test(str)) || PLAYER_HOSTS.some((re) => re.test(str)));

  // ================================================================
  // GATE — modo por contexto:
  //   'full'  : site da lista, players conhecidos, iframes filhos deles
  //   'light' : iframe de origem desconhecida (só bloqueio de popup)
  //   null    : resto da web, não toca em nada
  // ================================================================
  function getMode() {
    if (matchesSite(location.hostname)) return 'full';
    if (window.top !== window.self) {
      try {
        const ao = location.ancestorOrigins;
        if (ao) {
          for (let i = 0; i < ao.length; i++) if (matchesSite(ao[i])) return 'full';
          return null; // ancestrais conhecidos e nenhum é da lista
        }
      } catch (e) {}
      try {
        if (document.referrer && matchesSite(new URL(document.referrer).hostname)) return 'full';
      } catch (e) {}
      return PROTECT_UNKNOWN_IFRAMES ? 'light' : null;
    }
    return null;
  }

  const MODE = getMode();
  if (!MODE) return;

  // ================================================================
  // Silenciador cosmético: o swiper.min.js do pobreflix chama
  // insertAdjacentHTML num elemento null (bug DO SITE, não nosso).
  // Não dá pra consertar o carrossel deles, mas dá pra evitar que o
  // erro suje o console. Só engole ESSA exceção específica; qualquer
  // outro erro passa normal.
  // ================================================================
  window.addEventListener('error', (ev) => {
    const f = ev.filename || '';
    const m = ev.message || '';
    if (/swiper\.min\.js/i.test(f) && /insertAdjacentHTML/i.test(m)) {
      ev.preventDefault(); // some do console
      return true;
    }
  }, true);

  const isAllowed = (url) => ALLOW.some((re) => re.test(String(url)));
  const baseDomain = location.hostname.split('.').slice(-2).join('.');
  function isExternal(url) {
    try {
      const d = new URL(url, location.href);
      if (!/^https?:$/.test(d.protocol)) return false; // javascript:, blob:, about: => não bloqueia
      if (d.hostname === location.hostname || d.hostname.endsWith('.' + baseDomain)) return false;
      if (matchesSite(d.hostname)) return false; // navegar entre sites/players da lista é ok
      return true;
    } catch (e) { return false; }
  }

  function isAdRequest(url) {
    try {
      const u = new URL(url, location.href);
      const h = u.hostname;
      if (matchesSite(h)) return false;          // nunca bloqueia site/player da lista
      if (isAllowed(u.href)) return false;        // nem whitelist
      if (h === location.hostname) return false;  // requisições do próprio site passam
      if (AD_TLDS.test(h)) return true;
      if (AD_HOSTS.some((re) => re.test(h))) return true;
      return false;
    } catch (e) { return false; }
  }

  // ================================================================
  // CAMADA 0 — ANTI-DETECÇÃO
  // Ad scripts checam ('' + window.open).includes('[native code]') pra
  // detectar bloqueador e trocar de tática. Toda função nossa responde
  // toString() como se fosse nativa.
  // ================================================================
  const disguise = new WeakMap();
  const _fnToString = Function.prototype.toString;
  Function.prototype.toString = new Proxy(_fnToString, {
    apply(target, thisArg, args) {
      if (disguise.has(thisArg)) return disguise.get(thisArg);
      return Reflect.apply(target, thisArg, args);
    },
  });
  disguise.set(Function.prototype.toString, 'function toString() { [native code] }');

  function cloak(fn, name) {
    disguise.set(fn, `function ${name}() { [native code] }`);
    try { Object.defineProperty(fn, 'name', { value: name }); } catch (e) {}
    return fn;
  }

  // ================================================================
  // CAMADA 1 — window.open TRAVADO + FALSO SUCESSO
  // Janela fake que parece viva (closed:false) pra o ad script achar
  // que funcionou e não tentar fallback.
  // ================================================================
  function makeFakeWindow() {
    const fake = new Proxy(function () {}, {
      get(t, p) {
        if (p === 'closed') return false;
        if (p === 'location') return { href: 'about:blank', assign() {}, replace() {}, reload() {} };
        if (p === 'document') return { write() {}, writeln() {}, close() {}, body: {} };
        if (p === Symbol.toPrimitive) return () => '[object Window]';
        return fake;
      },
      apply: () => fake,
      set: () => true,
    });
    return fake;
  }
  const fakeWindow = makeFakeWindow();

  function lockOpen(win, label) {
    try {
      if (win.__ahj4) return;
      const blocked = cloak(function open(url, target, features) {
        // Em host de PLAYER, open pro próprio player (botão de download
        // do Byse etc.) é legítimo — só destino externo é anúncio.
        // No site de streaming continua tudo bloqueado: liberar open da
        // própria página lá reabriria o tabunder clássico (duplica o
        // site em aba nova e redireciona a atual pro anúncio).
        try {
          if (IS_PLAYER_HOST && url && !isExternal(url) && nativeOpen) {
            log('window.open PERMITIDO (player) ->', url);
            return nativeOpen(url, target, features);
          }
        } catch (e) {}
        log('window.open BLOQUEADO em [' + label + '] ->', url);
        return fakeWindow;
      }, 'open');
      Object.defineProperty(win, 'open', { value: blocked, writable: false, configurable: false });
      Object.defineProperty(win, '__ahj4', { value: true });
    } catch (e) {
      try { win.open = () => fakeWindow; } catch (e2) {}
    }
  }

  // Guarda o open NATIVO antes de travar — usado pela camada 7 pra
  // abrir a página de download num clique permitido pelo usuário e
  // pelo lockOpen pra liberar open interno em host de player.
  const nativeOpen = window.open && window.open.bind(window);

  // Estamos numa página/iframe DO PRÓPRIO player? (q8y5z, byse*, dood...)
  const IS_PLAYER_HOST = PLAYER_HOSTS.some((re) => re.test(location.hostname));

  lockOpen(window, MODE + ':' + location.hostname);

  // ================================================================
  // CAMADA 11 — BLOQUEIO DE REDE (autossuficiência sem adblock)
  // Corta fetch / XHR / sendBeacon / new Image / <script|img>.src pra
  // domínios de anúncio. É isto que faz o script "tankar" em Chrome
  // puro ou com o Brave Shields desligado — sem depender de nada.
  // ================================================================
  if (NETWORK_BLOCK) {
    // fetch
    const _fetch = window.fetch;
    if (_fetch) {
      window.fetch = cloak(function fetch(input, init) {
        const url = (input && input.url) ? input.url : input;
        if (isAdRequest(url)) {
          log('fetch BLOQUEADO ->', String(url).slice(0, 80));
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return _fetch.apply(this, arguments);
      }, 'fetch');
    }

    // XMLHttpRequest
    const _xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = cloak(function open(method, url) {
      this.__adBlocked = isAdRequest(url);
      if (this.__adBlocked) log('XHR BLOQUEADO ->', String(url).slice(0, 80));
      return _xhrOpen.apply(this, arguments);
    }, 'open');
    const _xhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = cloak(function send() {
      if (this.__adBlocked) return; // engole o envio
      return _xhrSend.apply(this, arguments);
    }, 'send');

    // navigator.sendBeacon (usado pra tracking/telemetria de ad)
    if (navigator.sendBeacon) {
      const _beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = cloak(function sendBeacon(url) {
        if (isAdRequest(url)) { log('sendBeacon BLOQUEADO ->', String(url).slice(0, 80)); return true; }
        return _beacon.apply(this, arguments);
      }, 'sendBeacon');
    }

    // new Image().src = ad (pixel tracker / cache-bust de popunder)
    const _imgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (_imgSrc && _imgSrc.set) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        get: _imgSrc.get,
        set(v) {
          if (isAdRequest(v)) { log('img.src BLOQUEADO ->', String(v).slice(0, 80)); return; }
          return _imgSrc.set.call(this, v);
        },
        configurable: true,
      });
    }

    // <script>.src / <iframe>.src / <img>.src via setAttribute
    const _setAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = cloak(function setAttribute(name, value) {
      if (/^(src|href|data-src)$/i.test(name) && isAdRequest(value)) {
        log('setAttribute(' + name + ') BLOQUEADO ->', String(value).slice(0, 80));
        return;
      }
      return _setAttr.apply(this, arguments);
    }, 'setAttribute');

    // <script>.src via propriedade (injeção de loader de ad)
    const _scriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (_scriptSrc && _scriptSrc.set) {
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        get: _scriptSrc.get,
        set(v) {
          if (isAdRequest(v)) { log('script.src BLOQUEADO ->', String(v).slice(0, 80)); return; }
          return _scriptSrc.set.call(this, v);
        },
        configurable: true,
      });
    }
  }

  // ================================================================
  // CAMADA 2 — BLINDAGEM DE REALMS FILHOS (bypass do "iframe limpo")
  // Todo iframe same-origin é neutralizado no instante da inserção
  // (hooks síncronos), no acesso via contentWindow/contentDocument,
  // no load, e num sweep periódico. Trava open + click + dispatchEvent
  // + submit do realm filho (fontes de funções "limpas").
  // ================================================================
  function hardenRealm(win, label) {
    try {
      if (!win || win.__ahj4) return;
      lockOpen(win, label);
      try {
        const HP = win.HTMLElement && win.HTMLElement.prototype;
        if (HP) HP.click = cloak(function click() { return patchedClick.apply(this, arguments); }, 'click');
        const EP = win.EventTarget && win.EventTarget.prototype;
        if (EP) EP.dispatchEvent = cloak(function dispatchEvent(ev) { return patchedDispatch.call(this, ev); }, 'dispatchEvent');
        const FP = win.HTMLFormElement && win.HTMLFormElement.prototype;
        if (FP) FP.submit = cloak(function submit() { return patchedSubmit.apply(this, arguments); }, 'submit');
      } catch (e) {}
    } catch (e) { /* cross-origin: TM injeta lá pelo @match */ }
  }

  function hardenFrame(f) {
    try { hardenRealm(f.contentWindow, 'iframe:' + (f.src || 'blank')); } catch (e) {}
    if (!f.__ahjLoad) {
      f.__ahjLoad = true;
      f.addEventListener('load', () => { try { hardenRealm(f.contentWindow, 'iframe:reload'); } catch (e) {} });
    }
    const sb = f.getAttribute && f.getAttribute('sandbox');
    if (sb && /allow-popups/.test(sb)) {
      f.setAttribute('sandbox', sb.replace(/allow-popups(-to-escape-sandbox)?/g, '').trim());
      log('allow-popups removido de iframe sandboxed:', f.src || '(inline)');
    }
  }

  function patchInserted(node) {
    try {
      if (!node || node.nodeType !== 1) return; // só Element; ignora texto/comentário/null
      if (node instanceof HTMLIFrameElement) hardenFrame(node);
      else if (node.querySelectorAll) node.querySelectorAll('iframe').forEach(hardenFrame);
      if (node instanceof HTMLBaseElement) neutralizeBase(node);
    } catch (e) {}
  }

  // Hooks SÍNCRONOS de inserção — roda ANTES do ad script usar o iframe
  ['appendChild', 'insertBefore', 'replaceChild'].forEach((m) => {
    const orig = Node.prototype[m];
    Node.prototype[m] = cloak(function (...args) {
      const r = orig.apply(this, args);
      patchInserted(args[0]);
      return r;
    }, m);
  });
  ['append', 'prepend', 'before', 'after', 'replaceWith'].forEach((m) => {
    const orig = Element.prototype[m];
    if (!orig) return;
    Element.prototype[m] = cloak(function (...args) {
      const r = orig.apply(this, args);
      args.forEach(patchInserted);
      return r;
    }, m);
  });
  const _insAdj = Element.prototype.insertAdjacentElement;
  Element.prototype.insertAdjacentElement = cloak(function (pos, el) {
    const r = _insAdj.call(this, pos, el);
    patchInserted(el);
    return r;
  }, 'insertAdjacentElement');
  const _insHTML = Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML = cloak(function (pos, html) {
    const r = _insHTML.call(this, pos, html);
    try {
      // 'beforebegin'/'afterend' inserem no PAI; 'afterbegin'/'beforeend' em THIS.
      // Se o alvo for null (nó solto), não faz nada — evita quebrar libs como o Swiper.
      const target = (pos === 'beforebegin' || pos === 'afterend') ? this.parentElement : this;
      if (target) patchInserted(target);
    } catch (e) {}
    return r;
  }, 'insertAdjacentHTML');

  ['contentWindow', 'contentDocument'].forEach((prop) => {
    const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, prop);
    if (!d || !d.get) return;
    Object.defineProperty(HTMLIFrameElement.prototype, prop, {
      get: cloak(function () {
        const v = d.get.call(this);
        try { hardenRealm(prop === 'contentDocument' ? v && v.defaultView : v, 'accessor'); } catch (e) {}
        return v;
      }, 'get ' + prop),
      configurable: true,
    });
  });

  setInterval(() => {
    try { document.querySelectorAll('iframe').forEach(hardenFrame); } catch (e) {}
  }, 800);

  // ================================================================
  // CAMADA 3 — CLIQUES SINTÉTICOS (click(), dispatchEvent, initMouseEvent)
  // ================================================================
  const _click = HTMLElement.prototype.click;
  const patchedClick = cloak(function click() {
    const a = this.closest ? (this.closest('a') || this) : this;
    if (a.tagName === 'A' && a.href && isExternal(a.href) && !isAllowed(a.href)) {
      log('clique sintético bloqueado ->', a.href);
      return;
    }
    return _click.apply(this, arguments);
  }, 'click');
  HTMLElement.prototype.click = patchedClick;

  const _dispatch = EventTarget.prototype.dispatchEvent;
  const patchedDispatch = cloak(function dispatchEvent(ev) {
    if (ev && !ev.isTrusted && /^(click|auxclick|mousedown|mouseup|pointerdown|pointerup)$/.test(ev.type)) {
      const el = this;
      const a = el instanceof Element ? (el.closest && el.closest('a')) || (el.tagName === 'A' ? el : null) : null;
      if (a && a.href && isExternal(a.href) && !isAllowed(a.href)) {
        log('dispatchEvent bloqueado ->', a.href);
        return false;
      }
    }
    return _dispatch.call(this, ev);
  }, 'dispatchEvent');
  EventTarget.prototype.dispatchEvent = patchedDispatch;

  // ================================================================
  // CAMADA 4 — FORMS FANTASMA (form.submit() pra fora / target=_blank)
  // ================================================================
  const _submit = HTMLFormElement.prototype.submit;
  const patchedSubmit = cloak(function submit() {
    if (this.action && isExternal(this.action) && !isAllowed(this.action)) {
      log('form.submit() externo bloqueado ->', this.action);
      return;
    }
    return _submit.apply(this, arguments);
  }, 'submit');
  HTMLFormElement.prototype.submit = patchedSubmit;
  if (HTMLFormElement.prototype.requestSubmit) {
    const _reqSubmit = HTMLFormElement.prototype.requestSubmit;
    HTMLFormElement.prototype.requestSubmit = cloak(function requestSubmit() {
      if (this.action && isExternal(this.action) && !isAllowed(this.action)) {
        log('requestSubmit externo bloqueado ->', this.action);
        return;
      }
      return _reqSubmit.apply(this, arguments);
    }, 'requestSubmit');
  }

  // ================================================================
  // CAMADA 5 — <base target=_blank> (redirect via base header)
  // ================================================================
  function neutralizeBase(b) {
    if (b.target) { log('<base target> neutralizado:', b.target); b.removeAttribute('target'); }
  }

  // ================================================================
  // CAMADA 6 — FLAGS "JÁ CARREGUEI" de popunders conhecidos
  // ================================================================
  try {
    const flags = ['zfgloadedpopup', 'zfgloadedrun', 'exoJsPop101', 'popMagic', 'popunderSetup', 'puShown'];
    flags.forEach((k) => { try { Object.defineProperty(window, k, { value: true, writable: false }); } catch (e) {} });
  } catch (e) {}

  // ================================================================
  // Camadas abaixo só no modo FULL (sites da lista + players).
  // ================================================================
  if (MODE === 'full') {

    // Toast discreto no rodapé — o usuário comum não olha o console,
    // então avisos que exigem ação dele aparecem na página.
    let toastEl = null, toastTimer = null;
    function toast(msg) {
      try {
        if (!document.body) return;
        if (!toastEl) {
          toastEl = document.createElement('div');
          toastEl.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
            'background:#111;color:#f59e0b;font:13px/1.4 system-ui,sans-serif;padding:10px 16px;' +
            'border-radius:8px;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.5);' +
            'transition:opacity .3s;max-width:90vw;text-align:center;';
        }
        toastEl.textContent = msg;
        toastEl.style.opacity = '1';
        document.body.appendChild(toastEl);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 2800);
      } catch (e) {}
    }

    // CAMADA 7 — clique REAL sequestrado (href/target trocado no mousedown,
    // links externos com stopPropagation, named targets).
    // Link externo NÃO é bloqueado pra sempre: o 1º clique é barrado e
    // avisa; clicar DE NOVO no mesmo link em até 5s deixa passar (é assim
    // que a página de download legítima do player funciona). Hijack não
    // clica duas vezes no mesmo href — e se ele trocar o href no meio,
    // o destino muda e o desbloqueio não vale.
    let lastBlocked = { href: '', t: 0 };
    const userInsisted = (href) => lastBlocked.href === href && (Date.now() - lastBlocked.t) < 5000;

    ['pointerdown', 'mousedown', 'click', 'auxclick'].forEach((type) => {
      document.addEventListener(type, (ev) => {
        const a = ev.composedPath().find((n) => n instanceof HTMLAnchorElement);
        if (!a || !a.href) return;
        if (isExternal(a.href) && !isAllowed(a.href)) {
          if (userInsisted(a.href)) {
            // Mesmo no clique PERMITIDO os handlers do site não rodam:
            // a navegação é feita por nós, direto pro href que o
            // usuário viu. Sem isso, o script do site pega carona no
            // clique liberado e redireciona pra onde quiser.
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (type === 'click') {
              log('navegação externa PERMITIDA (2º clique) ->', a.href);
              lastBlocked = { href: '', t: 0 };
              if (a.target === '_blank' && nativeOpen) nativeOpen(a.href, '_blank', 'noopener');
              else location.href = a.href;
            }
            return;
          }
          ev.preventDefault();
          ev.stopImmediatePropagation();
          if (type === 'click') {
            lastBlocked = { href: a.href, t: Date.now() };
            let host = ''; try { host = new URL(a.href).hostname; } catch (e) {}
            toast('🛡️ Link externo bloqueado (' + host + ') — clique de novo pra abrir');
          }
          log('navegação externa bloqueada (' + type + ') ->', a.href);
        } else if (a.target && !/^(_self|_parent|_top)$/.test(a.target) && isExternal(a.href)) {
          a.removeAttribute('target');
        }
      }, true);
    });

    document.addEventListener('submit', (ev) => {
      const f = ev.target;
      if (f && f.action && isExternal(f.action) && !isAllowed(f.action)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        log('submit externo bloqueado ->', f.action);
      }
    }, true);

    // CAMADA 8 — beforeunload/unload traps
    const _addEv = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = cloak(function addEventListener(type, ...rest) {
      if ((type === 'beforeunload' || type === 'unload') && (this === window || this === document)) {
        log('listener de ' + type + ' recusado');
        return;
      }
      return _addEv.call(this, type, ...rest);
    }, 'addEventListener');
    try { Object.defineProperty(window, 'onbeforeunload', { get: () => null, set: () => {} }); } catch (e) {}

    // CAMADA 9 — Notificações push / service worker de anúncio
    try { if (window.Notification) Notification.requestPermission = cloak(() => Promise.resolve('denied'), 'requestPermission'); } catch (e) {}
    try {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.register = cloak((...a) => {
          log('serviceWorker.register bloqueado:', a[0]);
          return new Promise(() => {});
        }, 'register');
      }
    } catch (e) {}

    // CAMADA 10 — Overlays invisíveis (o "vidro" sobre o player)
    // Um elemento é "do player" se ele é, contém, ou está dentro de
    // um <video>, <iframe>, ou do elemento em fullscreen. Nesses casos
    // NUNCA removemos — senão a gente quebra os controles do player.
    function isPlayerRelated(el) {
      try {
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (fs && (el === fs || fs.contains(el) || el.contains(fs))) return true;
        if (el.querySelector && el.querySelector('video, iframe')) return true; // contém player
        if (el.closest && el.closest('video, iframe, [class*="player" i], [id*="player" i], [class*="jw" i], [class*="video" i], [class*="fullscreen" i]')) return true;
        // heurística de controles: overlay que tem botões/filhos interativos não é armadilha
        if (el.querySelector && el.querySelector('button, [role="button"], input, video, iframe, canvas')) return true;
      } catch (e) {}
      return false;
    }

    function isClickTrap(el) {
      if (!(el instanceof HTMLElement)) return false;
      if (/^(VIDEO|IFRAME|CANVAS)$/.test(el.tagName)) return false;
      if (isPlayerRelated(el)) return false;           // <- protege o player/fullscreen
      // Se qualquer coisa está em fullscreen, não removemos overlays de tela cheia:
      // nesse estado é quase certeza que é UI do player, não anúncio.
      if (document.fullscreenElement || document.webkitFullscreenElement) return false;
      const s = getComputedStyle(el);
      if (s.position !== 'fixed' && s.position !== 'absolute') return false;
      if ((parseInt(s.zIndex, 10) || 0) < 999) return false;
      if (s.pointerEvents === 'none') return false;    // não intercepta clique => não é armadilha
      const r = el.getBoundingClientRect();
      const covers = r.width >= innerWidth * 0.85 && r.height >= innerHeight * 0.85;
      const ghost = parseFloat(s.opacity) < 0.05 ||
        (s.backgroundColor === 'rgba(0, 0, 0, 0)' && el.childElementCount === 0 && !el.textContent.trim());
      return covers && ghost;
    }
    function sweepDOM(root) {
      if (!root.querySelectorAll) return;
      root.querySelectorAll('div, a, span').forEach((el) => {
        if (isClickTrap(el)) { log('overlay removido:', el); el.remove(); }
      });
      root.querySelectorAll('base[target]').forEach(neutralizeBase);
      sweepAdRemnants(root);
    }
    const mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n instanceof HTMLElement) {
          patchInserted(n); // pega iframes que entraram via innerHTML/parser
          if (isClickTrap(n)) { log('overlay removido:', n); n.remove(); }
          else sweepDOM(n);
        }
      }
    });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    document.addEventListener('DOMContentLoaded', () => sweepDOM(document));

    // ============================================================
    // CAMADA 12 — RESQUÍCIOS COSMÉTICOS (falso diálogo de permissão)
    // Aquele card "Permitir / Cancelar" fingindo prompt de notificação
    // vem pronto no HTML parseado, então escapa dos hooks de rede da
    // camada 11 (que só pegam src setado via JS) e da camada 10 (não
    // é overlay de tela cheia). Detecta pelo template do ad network
    // (data-onopen/data-onclose/data-area) e por qualquer <img> cujo
    // src aponte pra domínio de anúncio, e remove o card inteiro.
    // ============================================================
    const AD_REMNANT_SELECTORS = [
      '#trigger_target',
      '[data-area][data-onopen]',
      '[data-area][data-onclose]',
    ].join(',');

    // Sobe até o contêiner do anúncio, sem engolir conteúdo do site:
    // para no body, em qualquer coisa que contenha player, ou quando
    // o pai tem subárvore grande demais pra ser só o card do ad.
    function adContainer(el) {
      let box = el;
      while (
        box.parentElement &&
        box.parentElement !== document.body &&
        box.parentElement !== document.documentElement &&
        !box.parentElement.querySelector('video, iframe') &&
        box.parentElement.querySelectorAll('*').length <= 40
      ) box = box.parentElement;
      return box;
    }

    function sweepAdRemnants(root) {
      try {
        if (!root.querySelectorAll) return;
        const hits = new Set();
        if (root.matches && root.matches(AD_REMNANT_SELECTORS)) hits.add(root);
        root.querySelectorAll(AD_REMNANT_SELECTORS).forEach((el) => hits.add(el));
        root.querySelectorAll('img[src]').forEach((img) => {
          if (isAdRequest(img.src)) hits.add(img);
        });
        hits.forEach((el) => {
          if (!el.isConnected) return;
          const box = adContainer(el);
          log('resquício de anúncio removido:', box.id ? '#' + box.id : box);
          box.remove();
        });
      } catch (e) {}
    }

    // O card às vezes é injetado bem depois do load — varredura leve.
    setInterval(() => sweepAdRemnants(document), 1200);

    // ============================================================
    // FULLSCREEN — tratamento especial.
    // Em fullscreen NÃO removemos elementos (risco de quebrar a UI do
    // player). Em vez disso, quando um overlay de anúncio cobre a tela
    // por cima do vídeo, só desligamos o pointer-events dele: o clique
    // atravessa e vai pro player, sem travar a tela nem abrir aba.
    // ============================================================
    function neutralizeFullscreenOverlays() {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fs) return;
      const all = document.querySelectorAll('body > div, body > a, ' + (fs.tagName.toLowerCase()) + ' > div');
      all.forEach((el) => {
        try {
          if (isPlayerRelated(el)) return;          // não toca no player
          if (fs.contains(el)) return;              // filho do player = UI dele
          const s = getComputedStyle(el);
          if (s.position !== 'fixed' && s.position !== 'absolute') return;
          if ((parseInt(s.zIndex, 10) || 0) < 999) return;
          const r = el.getBoundingClientRect();
          const covers = r.width >= innerWidth * 0.7 && r.height >= innerHeight * 0.7;
          if (!covers) return;
          // overlay grande, fora do player, em cima da tela cheia => neutraliza
          if (s.pointerEvents !== 'none') {
            el.style.setProperty('pointer-events', 'none', 'important');
            log('overlay de fullscreen neutralizado (pointer-events:none):', el);
          }
          // se for totalmente invisível e vazio, pode esconder de vez
          if ((parseFloat(s.opacity) < 0.05 || s.backgroundColor === 'rgba(0, 0, 0, 0)') &&
              el.childElementCount === 0 && !el.textContent.trim()) {
            el.style.setProperty('display', 'none', 'important');
          }
        } catch (e) {}
      });
    }

    ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => {
      document.addEventListener(ev, () => {
        // roda algumas vezes: o overlay às vezes entra depois do fullscreen
        neutralizeFullscreenOverlays();
        setTimeout(neutralizeFullscreenOverlays, 300);
        setTimeout(neutralizeFullscreenOverlays, 1000);
      });
    });

    // Enquanto estiver em fullscreen, varre periodicamente (leve) pra
    // pegar overlay que aparece no meio do filme.
    setInterval(() => {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        neutralizeFullscreenOverlays();
      }
    }, 1500);

    // ============================================================
    // CAMADA 13 — ANTI ANTI-DEVTOOLS
    // O site roda new Function('debugger')() em loop pra travar o F12
    // no breakpoint. Todo código criado dinamicamente (Function, eval
    // indireto, setTimeout/setInterval com string) passa por um filtro
    // que arranca o statement 'debugger'. Também impede o site de
    // limpar o console pra esconder o que está fazendo.
    // ============================================================
    const stripDebugger = (code) => {
      if (typeof code === 'string' && /\bdebugger\b/.test(code)) {
        log('debugger removido de código dinâmico');
        return code.replace(/\bdebugger\b/g, ';');
      }
      return code;
    };

    const _Function = window.Function;
    const patchedFunction = cloak(function Function(...args) {
      if (args.length) args[args.length - 1] = stripDebugger(args[args.length - 1]);
      return _Function.apply(this, args);
    }, 'Function');
    patchedFunction.prototype = _Function.prototype;
    try {
      window.Function = patchedFunction;
      Object.defineProperty(_Function.prototype, 'constructor', {
        value: patchedFunction, writable: true, configurable: true,
      });
    } catch (e) {}

    ['setTimeout', 'setInterval'].forEach((k) => {
      const orig = window[k];
      window[k] = cloak(function (fn, ...rest) {
        return orig.call(this, typeof fn === 'string' ? stripDebugger(fn) : fn, ...rest);
      }, k);
    });

    const _eval = window.eval;
    window.eval = cloak(function (code) {
      return _eval.call(window, stripDebugger(code));
    }, 'eval');

    try { console.clear = cloak(function clear() {}, 'clear'); } catch (e) {}

    // ============================================================
    // CAMADA 14 — BOTÃO DIREITO LIVRE
    // O site cancela o 'contextmenu' pra esconder "Inspecionar".
    // Nosso listener registra em document-start (antes de qualquer
    // script do site) na fase de captura da window — o primeiro da
    // fila. stopImmediatePropagation() impede TODOS os listeners do
    // site de rodarem, e como não chamamos preventDefault, o menu
    // nativo do navegador abre normalmente.
    // ============================================================
    window.addEventListener('contextmenu', (ev) => ev.stopImmediatePropagation(), true);
  }

  log('MODO ' + MODE.toUpperCase() + ' ativo em', (window.top === window.self ? 'TOP' : 'IFRAME'), '->', location.href);
})();
