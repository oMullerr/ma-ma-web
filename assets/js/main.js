/* Ma&Ma Atelier · interações da vitrine */
(() => {
  'use strict';

  const WHATSAPP = '5541984016673';
  const EMAIL = 'maema.atelier@gmail.com';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const waLink = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;

  /* ---------- Links de WhatsApp com mensagem pronta ---------- */
  $$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });

  /* ---------- Ano no rodapé ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Chamas: converte a posição da chama na foto para a área visível (object-fit: cover) ---------- */
  function placeFlame(flame) {
    const box = flame.parentElement;
    const img = $('img', box);
    if (!img || !img.naturalWidth) return;
    if (!flame.dataset.fx) {
      flame.dataset.fx = parseFloat(flame.style.getPropertyValue('--fx')) || 50;
      flame.dataset.fy = parseFloat(flame.style.getPropertyValue('--fy')) || 50;
    }
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const scale = Math.max(w / nw, h / nh);
    const dw = nw * scale, dh = nh * scale;
    const pos = getComputedStyle(img).objectPosition.split(' ');
    const px = pos[0] && pos[0].endsWith('%') ? parseFloat(pos[0]) / 100 : 0.5;
    const py = pos[1] && pos[1].endsWith('%') ? parseFloat(pos[1]) / 100 : 0.5;
    const x = (w - dw) * px + (flame.dataset.fx / 100) * dw;
    const y = (h - dh) * py + (flame.dataset.fy / 100) * dh;
    flame.style.setProperty('--fx', `${(x / w) * 100}%`);
    flame.style.setProperty('--fy', `${(y / h) * 100}%`);
  }
  const placeAllFlames = () => $$('.flame').forEach(placeFlame);
  $$('.flame').forEach((f) => {
    const img = $('img', f.parentElement);
    if (img && !img.complete) img.addEventListener('load', () => placeFlame(f), { once: true });
  });
  placeAllFlames();

  /* ==========================================================
     HERO · a luz acompanha quem visita
     ========================================================== */
  const hero = $('.hero');
  const heroMedia = $('.hero__media');
  const heroImg = $('.hero__img--base');
  const heroFlame = $('.flame--hero');

  function ignite() {
    if (body.classList.contains('is-lit')) return;
    setTimeout(() => body.classList.add('is-lit'), 60);
    igniteAt = performance.now();
  }
  let igniteAt = 0;
  if (heroImg.complete) ignite();
  else {
    heroImg.addEventListener('load', ignite, { once: true });
    setTimeout(ignite, 1600);
  }

  if (!reduced) {
    let heroRect = hero.getBoundingClientRect();
    let mediaRect = heroMedia.getBoundingClientRect();
    let pointerActive = false;
    let tx = 0, ty = 0, cx = -999, cy = -999;
    let travelled = 0, lastX = null, lastY = null;
    let running = false, heroVisible = true;

    const measure = () => {
      heroRect = hero.getBoundingClientRect();
      mediaRect = heroMedia.getBoundingClientRect();
    };

    const candleCenter = () => {
      const fx = parseFloat(heroFlame.style.getPropertyValue('--fx')) || 45;
      const fy = parseFloat(heroFlame.style.getPropertyValue('--fy')) || 50;
      return {
        x: mediaRect.left - heroRect.left + (fx / 100) * mediaRect.width,
        y: mediaRect.top - heroRect.top + (fy / 100) * mediaRect.height,
      };
    };

    const onMove = (e) => {
      tx = e.clientX - heroRect.left;
      ty = e.clientY - heroRect.top;
      if (!pointerActive) {
        pointerActive = true;
        hero.classList.add('has-pointer');
        if (cx < -900) { cx = tx; cy = ty; }
      }
      if (lastX !== null) travelled += Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
      if (travelled > 160) hero.classList.add('hint-done');
    };

    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerdown', onMove, { passive: true });
    hero.addEventListener('pointerleave', () => {
      pointerActive = false;
      hero.classList.remove('has-pointer');
    });

    const frame = (now) => {
      if (!heroVisible || document.hidden) { running = false; return; }
      const t = now / 1000;
      const c = candleCenter();
      if (cx < -900) { cx = c.x; cy = c.y; }

      // Sem cursor, a luz respira devagar ao redor da vela
      const gx = pointerActive ? tx : c.x + Math.sin(t * 0.45) * mediaRect.width * 0.22;
      const gy = pointerActive ? ty : c.y + Math.cos(t * 0.33) * mediaRect.height * 0.16;
      cx += (gx - cx) * (pointerActive ? 0.09 : 0.03);
      cy += (gy - cy) * (pointerActive ? 0.09 : 0.03);

      const flicker = 1 + 0.035 * Math.sin(t * 13.1) + 0.025 * Math.sin(t * 7.3 + 1.3) + 0.02 * Math.sin(t * 23.7 + 0.4);
      const grow = igniteAt ? smooth(0, 2600, now - igniteAt) : 0;
      const base = Math.min(window.innerWidth, window.innerHeight) * 0.3;
      const r = base * flicker * grow;

      hero.style.setProperty('--gx', `${cx}px`);
      hero.style.setProperty('--gy', `${cy}px`);
      hero.style.setProperty('--lx', `${cx - (mediaRect.left - heroRect.left)}px`);
      hero.style.setProperty('--ly', `${cy - (mediaRect.top - heroRect.top)}px`);
      hero.style.setProperty('--r', `${r.toFixed(1)}px`);
      requestAnimationFrame(frame);
    };
    const start = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      if (heroVisible) { measure(); start(); }
    }).observe(hero);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    start();
  }

  /* ==========================================================
     MANIFESTO · palavras acendem, depois amanhece
     ========================================================== */
  const manifesto = $('.manifesto');
  const words = [];
  const wordsHost = $('[data-words]');
  if (wordsHost) {
    const text = wordsHost.textContent.trim().split(/\s+/);
    wordsHost.textContent = '';
    text.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = w;
      wordsHost.appendChild(span);
      if (i < text.length - 1) wordsHost.appendChild(document.createTextNode(' '));
      words.push(span);
    });
  }
  let dawn = 0;

  function updateManifesto() {
    if (!manifesto || reduced) return;
    const rect = manifesto.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const p = clamp(-rect.top / total, 0, 1);
    const lit = Math.round(smooth(0.02, 0.52, p) * words.length);
    words.forEach((w, i) => w.classList.toggle('is-on', i < lit));
    dawn = smooth(0.56, 0.8, p);
    manifesto.style.setProperty('--dawn', dawn.toFixed(3));
    manifesto.style.setProperty('--fade', smooth(0.6, 0.78, p).toFixed(3));
  }

  /* ==========================================================
     NAVEGAÇÃO
     ========================================================== */
  const nav = $('.nav');
  const navSections = $$('[data-nav]');
  const navLinks = $$('.nav__links a');
  const menu = $('#menu');
  const toggle = $('.nav__toggle');
  let lastY = window.scrollY;

  function updateNav() {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 40);

    const menuOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (!menuOpen && y > 700 && y > lastY + 4) nav.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 700) nav.classList.remove('is-hidden');
    lastY = y;

    const probe = nav.offsetHeight / 2;
    let theme = 'dark';
    for (const s of navSections) {
      const r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        theme = s === manifesto ? (dawn > 0.5 ? 'light' : 'dark') : s.dataset.nav;
        break;
      }
    }
    if (menuOpen) theme = 'dark';
    nav.dataset.theme = theme;

    const mid = window.innerHeight * 0.4;
    navLinks.forEach((a) => {
      const target = $(a.getAttribute('href'));
      const r = target && target.getBoundingClientRect();
      a.classList.toggle('is-current', !!r && r.top <= mid && r.bottom > mid);
    });
  }

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      body.style.overflow = 'hidden';
    } else {
      menu.classList.remove('is-open');
      body.style.overflow = '';
      setTimeout(() => { if (toggle.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 500);
    }
    updateNav();
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); } });

  /* ---------- Botão flutuante ---------- */
  const floatWa = $('.float-wa');
  const contact = $('#contato');
  const orderSection = $('#encomende');
  function updateFloat() {
    const vh = window.innerHeight;
    const pastHero = window.scrollY > hero.offsetHeight * 0.85;
    const inContact = contact.getBoundingClientRect().top < vh * 0.7;
    // a encomenda já tem o próprio botão de WhatsApp
    const o = orderSection.getBoundingClientRect();
    const inOrder = o.top < vh * 0.6 && o.bottom > vh * 0.4;
    floatWa.classList.toggle('is-visible', pastHero && !inContact && !inOrder);
  }

  /* ---------- Passo a passo: a linha se preenche ao rolar ---------- */
  const process = $('[data-process]');
  const steps = $$('.process__steps li');
  function measureProcess() {
    const n = $('.process__n', process);
    if (!n) return;
    const top = n.getBoundingClientRect().top - process.getBoundingClientRect().top + n.offsetHeight / 2;
    process.style.setProperty('--track-top', `${top}px`);
  }
  function updateProcess() {
    if (!process) return;
    const r = $('.process__steps', process).getBoundingClientRect();
    const p = reduced ? 1 : clamp((window.innerHeight * 0.8 - r.top) / (window.innerHeight * 0.45), 0, 1);
    process.style.setProperty('--progress', p.toFixed(3));
    steps.forEach((li, i) => li.classList.toggle('is-reached', p >= i / (steps.length - 1) - 0.001));
  }

  /* ---------- Selo gira devagar ---------- */
  const seal = $('.atelier__seal');
  function updateSeal() {
    if (!seal || reduced) return;
    const r = seal.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    seal.style.setProperty('--spin', `${(r.top - window.innerHeight / 2) * -0.06}deg`);
  }

  /* ---------- Laço único de rolagem ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateManifesto();
      updateNav();
      updateFloat();
      updateProcess();
      updateSeal();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measureProcess(); placeAllFlames(); onScroll(); });
  window.addEventListener('load', () => { measureProcess(); placeAllFlames(); onScroll(); });
  measureProcess();
  onScroll();

  /* ---------- Revelação ao rolar ---------- */
  const revealables = $$('[data-reveal]');
  revealables.forEach((el) => {
    const siblings = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
    const i = siblings.indexOf(el);
    if (i > 0) el.style.setProperty('--d', `${Math.min(i, 5) * 0.09}s`);
  });
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* ==========================================================
     GALERIAS
     ========================================================== */
  $$('[data-gallery]').forEach((g) => {
    const shots = $$('.shot', g);
    const thumbs = $$('.thumb', g);
    const stage = $('.gallery__stage', g);
    let index = 0;

    const go = (n, silent) => {
      index = (n + shots.length) % shots.length;
      shots.forEach((s, k) => s.classList.toggle('is-active', k === index));
      thumbs.forEach((t, k) => {
        t.classList.toggle('is-active', k === index);
        t.setAttribute('aria-pressed', String(k === index));
      });
      if (!silent) g.dispatchEvent(new CustomEvent('gallery:change', { detail: { shot: shots[index] } }));
    };
    g.galleryGo = go;
    thumbs.forEach((t, k) => t.addEventListener('click', () => go(k)));

    // deslizar com o dedo
    let startX = null, startY = null;
    stage.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; });
    stage.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
      else if (e.pointerType === 'mouse' && Math.abs(dx) < 6) go(index + 1);
      startX = null;
    });
    stage.style.cursor = shots.length > 1 ? 'pointer' : '';
  });

  /* ---------- Duração da queima em noites ---------- */
  const extenso = { 5: 'cinco', 10: 'dez', 15: 'quinze', 20: 'vinte', 25: 'vinte e cinco', 30: 'trinta', 40: 'quarenta' };
  function renderBurn(scope) {
    const dd = $('dd[data-hours]', scope);
    const note = $('[data-burn-note]', scope);
    if (!dd || !note) return;
    const hours = parseFloat(dd.dataset.hours);
    dd.textContent = `${hours} horas`;
    const nights = Math.round(hours / 2);
    note.textContent = `Cerca de ${extenso[nights] || nights} noites de duas horas à luz de vela.`;
  }
  $$('.product__body').forEach(renderBurn);

  /* ---------- Bubble: Pequena ou Grande ---------- */
  const sizeToggle = $('[data-size-toggle]');
  if (sizeToggle) {
    const product = sizeToggle.closest('.product');
    const gallery = $('[data-gallery]', product);
    const weightOut = $('[data-weight-out]', product);
    const hoursOut = $('dd[data-hours]', product);
    const cta = $('[data-bubble-cta]', product);
    const options = $$('button', sizeToggle);

    const setSize = (size, fromGallery) => {
      const btn = options.find((b) => b.dataset.size === size);
      if (!btn) return;
      options.forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      sizeToggle.dataset.active = size;
      weightOut.textContent = btn.dataset.weight;
      hoursOut.dataset.hours = btn.dataset.hours;
      cta.dataset.pickModel = btn.dataset.model;
      cta.textContent = `Encomende a sua ${btn.dataset.model}`;
      renderBurn(product);
      if (!fromGallery) {
        const shots = $$('.shot', gallery);
        const k = shots.findIndex((s) => s.dataset.size === size);
        if (k > -1) gallery.galleryGo(k, true);
      }
    };
    options.forEach((b) => b.addEventListener('click', () => setSize(b.dataset.size)));
    sizeToggle.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const next = sizeToggle.dataset.active === 'grande' ? 'pequena' : 'grande';
      setSize(next);
      options.find((b) => b.dataset.size === next).focus();
      e.preventDefault();
    });
    gallery.addEventListener('gallery:change', (e) => {
      const size = e.detail.shot.dataset.size;
      if (size) setSize(size, true);
    });
    setSize('pequena');
  }

  /* ==========================================================
     CARTA DE AROMAS
     ========================================================== */
  const aromasSection = $('#aromas');
  $$('.family').forEach((fam) => {
    const key = fam.dataset.familyKey;
    const set = () => { aromasSection.dataset.family = key; };
    fam.addEventListener('pointerenter', set);
    fam.addEventListener('focusin', set);
  });

  /* ==========================================================
     ENCOMENDE · monta a mensagem
     ========================================================== */
  const form = $('#order-form');
  const aromaChips = $('[data-chips="aroma"]');
  const firstSoft = $('.chip', aromaChips);
  $$('.aroma').forEach((li) => {
    const name = li.dataset.aroma;
    const label = document.createElement('label');
    label.className = 'chip';
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'aroma'; input.value = name;
    const span = document.createElement('span');
    span.textContent = name;
    label.append(input, span);
    aromaChips.insertBefore(label, firstSoft);

    const pick = $('.aroma__pick', li);
    pick.setAttribute('aria-label', `Escolher o aroma ${name} para a encomenda`);
    pick.addEventListener('click', () => {
      input.checked = true;
      $$('.aroma').forEach((x) => x.classList.toggle('is-picked', x === li));
      updateOrder();
      goToOrder();
    });
  });

  const PREVIEW = {
    'Presença': { src: 'assets/img/presenca-800.webp', alt: 'Vela Presença', pos: '50% 55%' },
    'Espiral': { src: 'assets/img/espiral-luz-800.webp', alt: 'Vela Espiral acesa', pos: '50% 62%', fx: 61, fy: 37 },
    'Bubble Pequena': { src: 'assets/img/bubble-pequena.webp', alt: 'Vela Bubble Pequena', pos: '50% 62%' },
    'Bubble Grande': { src: 'assets/img/bubble-grande.webp', alt: 'Vela Bubble Grande', pos: '50% 60%' },
    '': { src: 'assets/img/espiral-chama-800.webp', alt: 'Vela Espiral acesa em close', pos: '50% 62%', fx: 55, fy: 59 },
  };
  const previewImg = $('[data-preview-img]');
  const previewFlame = $('[data-preview-flame]');
  const previewMsg = $('[data-preview-msg]');
  const orderWa = $('[data-order-wa]');
  const orderMail = $('[data-order-mail]');
  const qty = $('#qty');
  let currentModel = null;

  function composeMessage() {
    const data = new FormData(form);
    const model = data.get('model') || '';
    const aroma = data.get('aroma') || '';
    const occasion = data.get('occasion') || '';
    const n = clamp(parseInt(data.get('qty'), 10) || 1, 1, 9999);
    const custom = form.elements.custom.checked;
    const details = (data.get('details') || '').trim();

    const lines = ['Olá, Ma&Ma!'];
    let s;
    if (model) s = `Gostaria de encomendar ${n === 1 ? 'uma vela' : `${n} velas`} ${model}`;
    else s = n === 1 ? 'Gostaria de ajuda para escolher a vela ideal' : `Gostaria de ajuda para escolher ${n} velas`;
    if (aroma === 'sob encomenda') s += ' com um aroma criado sob encomenda';
    else if (aroma) s += ` com aroma ${aroma}`;
    s += occasion ? `, ${occasion}.` : '.';
    lines.push(s);
    if (!aroma) lines.push('Ainda estou escolhendo o aroma.');
    if (custom) lines.push(n === 1 ? 'Quero personalizar a vela com nome, data ou mensagem.' : 'Quero personalizar as velas com nome, data ou mensagem.');
    if (details) lines.push(`Sobre o momento: ${details}`);
    return { text: lines.join('\n'), model };
  }

  function updatePreviewImage(model) {
    if (model === currentModel) return;
    currentModel = model;
    const p = PREVIEW[model] || PREVIEW[''];
    const swap = () => {
      previewImg.style.objectPosition = p.pos;
      previewImg.alt = p.alt;
      previewImg.onload = () => {
        previewImg.classList.remove('is-swapping');
        if (p.fx) {
          previewFlame.hidden = false;
          delete previewFlame.dataset.fx;
          previewFlame.style.setProperty('--fx', `${p.fx}%`);
          previewFlame.style.setProperty('--fy', `${p.fy}%`);
          placeFlame(previewFlame);
        }
      };
      previewImg.src = p.src;
    };
    previewFlame.hidden = true;
    if (reduced || !previewImg.complete) { swap(); return; }
    previewImg.classList.add('is-swapping');
    setTimeout(swap, 260);
  }

  function updateOrder() {
    const { text, model } = composeMessage();
    previewMsg.textContent = text;
    orderWa.href = waLink(text);
    orderMail.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Encomenda Ma&Ma Atelier')}&body=${encodeURIComponent(text)}`;
    updatePreviewImage(model);
  }

  form.addEventListener('input', updateOrder);
  form.addEventListener('change', updateOrder);
  form.addEventListener('submit', (e) => e.preventDefault());

  $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
    qty.value = clamp((parseInt(qty.value, 10) || 1) + Number(b.dataset.step), 1, 9999);
    updateOrder();
  }));
  qty.addEventListener('blur', () => { qty.value = clamp(parseInt(qty.value, 10) || 1, 1, 9999); updateOrder(); });

  function goToOrder() {
    $('#encomende').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  $$('[data-pick-model]').forEach((a) => a.addEventListener('click', () => {
    const input = $(`input[name="model"][value="${a.dataset.pickModel}"]`, form);
    if (input) input.checked = true;
    updateOrder();
  }));
  $$('[data-pick-custom]').forEach((a) => a.addEventListener('click', () => {
    form.elements.custom.checked = true;
    updateOrder();
  }));

  updateOrder();
})();
