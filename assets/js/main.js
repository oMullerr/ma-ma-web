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
  const buzz = (ms) => {
    // o navegador só permite vibrar depois de um primeiro toque na página
    if (!navigator.vibrate || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
    try { navigator.vibrate(ms); } catch (e) { /* sem vibração */ }
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = window.matchMedia('(max-width: 900px)');
  const touchUI = window.matchMedia('(hover: none)');
  const body = document.body;
  const root = document.documentElement;

  const ICON = {
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c.6 3.2 4.5 5.4 4.5 9.6A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.4c0-2.2 1.3-3.4 2.2-4.6.3 1.4 1 2.3 1.9 2.6C11.4 8.5 11.2 5.6 12 3z"/><path d="M12 17v4"/></svg>',
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  };

  /* ---------- Links de WhatsApp com mensagem pronta ---------- */
  $$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });

  /* ---------- Ano no rodapé ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Converte um ponto da foto (em %) para a área visível (object-fit: cover) ---------- */
  function mapPoint(box, img, fx, fy) {
    const w = box.clientWidth, h = box.clientHeight;
    if (!img || !img.naturalWidth || !w || !h) return null;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const scale = Math.max(w / nw, h / nh);
    const dw = nw * scale, dh = nh * scale;
    const pos = getComputedStyle(img).objectPosition.split(' ');
    const px = pos[0] && pos[0].endsWith('%') ? parseFloat(pos[0]) / 100 : 0.5;
    const py = pos[1] && pos[1].endsWith('%') ? parseFloat(pos[1]) / 100 : 0.5;
    return {
      x: ((w - dw) * px + (fx / 100) * dw) / w * 100,
      y: ((h - dh) * py + (fy / 100) * dh) / h * 100,
      dw,
    };
  }

  /* ---------- Chamas das fotos acesas ---------- */
  function placeFlame(flame) {
    if (!flame.dataset.fx) {
      flame.dataset.fx = parseFloat(flame.style.getPropertyValue('--fx')) || 50;
      flame.dataset.fy = parseFloat(flame.style.getPropertyValue('--fy')) || 50;
    }
    const p = mapPoint(flame.parentElement, $('img', flame.parentElement), +flame.dataset.fx, +flame.dataset.fy);
    if (!p) return;
    flame.style.setProperty('--fx', `${p.x}%`);
    flame.style.setProperty('--fy', `${p.y}%`);
  }

  /* ==========================================================
     CHAMA · fogo e pavio desenhados quadro a quadro
     ========================================================== */
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const rgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',');
  const CREAM = [239, 230, 210], CHARRED = [26, 18, 13], WAXY = [92, 72, 56];

  // ruído suave: valores aleatórios nos inteiros, interpolados entre eles
  function makeNoise() {
    const v = new Float32Array(256);
    for (let i = 0; i < 256; i++) v[i] = Math.random() * 2 - 1;
    return (x) => {
      const i = Math.floor(x), f = x - i, a = v[i & 255];
      return a + (v[(i + 1) & 255] - a) * f * f * (3 - 2 * f);
    };
  }

  // perfil da gota: pé arredondado, mais larga no primeiro terço, ponta fina
  const profile = (u) => Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.6)), 0.8);

  // um só laço de animação para todas as chamas acesas e visíveis
  const activeFlames = new Set();
  let flameLoop = false;
  function flameTick(now) {
    if (!activeFlames.size) { flameLoop = false; return; }
    requestAnimationFrame(flameTick);
    activeFlames.forEach((f) => f.frame(now / 1000));
  }
  function wakeFlame(f) {
    activeFlames.add(f);
    if (!flameLoop) { flameLoop = true; requestAnimationFrame(flameTick); }
  }

  function createFlame(scene, canvas) {
    const ctx = canvas.getContext('2d');
    const top = scene.dataset.view === 'top';
    const n = makeNoise();
    const clock = () => performance.now() / 1000;
    let W = 0, ox = 0, oy = 0, dpr = 1, sizeKey = '';
    // pavio da foto em unidades da largura da chama, com a ponta na origem
    let wick = { base: [0, 0.3], bend: null, w: 0.2 }, wickLen = 0.3, curl = 1;
    let state = 'off', litAt = 0, outAt = 0, char = 0, charFrom = 0, quick = false;
    let visible = !('IntersectionObserver' in window);
    let size = 0, lit = 0, sway = 0, outSize = 0, outLit = 0, outSway = 0;
    let lean = 0, leanV = 0, stretch = 0, stretchV = 0;
    let lastT = 0, lastX = null, lastY = null, lastLit = -1, lastGlow = -1;
    let gustAt = -9, gustDir = 1, nextGust = 0;
    let smoke = [], lastEmit = 0;

    // a chama reage ao movimento: deslizar a galeria deixa a ponta para trás, rolar estica ou achata
    function physics(dt) {
      const r = scene.getBoundingClientRect();
      let vx = 0, vy = 0;
      if (lastX !== null) { vx = (r.left - lastX) / dt; vy = (r.top - lastY) / dt; }
      lastX = r.left; lastY = r.top;
      leanV += ((clamp(-vx / 1400, -0.7, 0.7) - lean) * 70 - leanV * 9) * dt;
      lean += leanV * dt;
      stretchV += ((clamp(vy / 2600, -0.18, 0.18) - stretch) * 60 - stretchV * 10) * dt;
      stretch += stretchV * dt;
    }

    // contorno da gota entre as alturas s0 e s1 (0 = pé, 1 = ponta)
    function drop(f, s0, s1, k) {
      const N = 26;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i / N, s = lerp(s0, s1, u);
        ctx.lineTo(f.sw * 0.35 * f.H * s ** 1.8 - f.R * k * profile(u), f.ay - s * f.H);
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N, s = lerp(s0, s1, u);
        ctx.lineTo(f.sw * 0.35 * f.H * s ** 1.8 + f.R * k * profile(u), f.ay - s * f.H);
      }
      ctx.closePath();
    }
    function ellipseFill(x, y, rx, ry, stops, alpha = 1) {
      rx = Math.max(0.1, rx); ry = Math.max(0.1, ry);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      stops.forEach(([o, c]) => g.addColorStop(o, c));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // pavio de algodão: creme na foto, carbonizado da ponta para a base, ponta curvada
    function drawWick() {
      if (char <= 0) return null;
      if (top) {
        ctx.fillStyle = `rgb(${rgb(CREAM, CHARRED, Math.min(1, char * 3))})`;
        ctx.beginPath();
        ctx.arc(0, 0, W * wick.w * 0.58, 0, Math.PI * 2);
        ctx.fill();
        return [0, 0];
      }
      const bx = wick.base[0] * W, by = wick.base[1] * W;
      const mid = wick.bend || [wick.base[0] / 2, wick.base[1] / 2];
      const mx = mid[0] * W, my = mid[1] * W;
      // queimando, a ponta se curva um pouco mais para o lado em que já pendia
      const tx = (curl * 0.22 * wickLen * char + sway * 0.03) * W, ty = -0.04 * W * char;
      const at = (u) => { const v = 1 - u; return [v * v * bx + 2 * v * u * mx + u * u * tx, v * v * by + 2 * v * u * my + u * u * ty]; };
      // fio de algodão afinando para a ponta, um pouco mais largo que o da foto para cobri-lo
      const left = [], right = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10, [x, y] = at(u), [x1, y1] = at(Math.max(0, u - 0.02)), [x2, y2] = at(Math.min(1, u + 0.02));
        const len = Math.hypot(x2 - x1, y2 - y1) || 1, w = W * wick.w * lerp(0.6, 0.46, u);
        const nx = -(y2 - y1) / len * w, ny = (x2 - x1) / len * w;
        left.push([x + nx, y + ny]);
        right.unshift([x - nx, y - ny]);
      }
      const front = 1 - 0.88 * char;
      const burnt = `rgb(${rgb(CREAM, CHARRED, Math.min(1, char * 3))})`;
      const g = ctx.createLinearGradient(bx, by, tx, ty);
      g.addColorStop(0, `rgb(${rgb(CREAM, WAXY, char)})`);
      g.addColorStop(Math.max(0, front - 0.14), `rgb(${rgb(CREAM, WAXY, char * 0.6)})`);
      g.addColorStop(front, burnt);
      g.addColorStop(1, burnt);
      ctx.fillStyle = g;
      ctx.beginPath();
      left.concat(right).forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fill();
      // a ponta queimada engrossa um pouco, como carvão
      ctx.fillStyle = burnt;
      ctx.beginPath();
      ctx.arc(tx, ty, W * wick.w * 0.5 * Math.min(1, char * 2), 0, Math.PI * 2);
      ctx.fill();
      return [tx, ty];
    }

    // brasa na ponta do pavio: laranja acesa, vermelho escuro quando esfria
    function drawEmber(t, at, ember) {
      if (!at || ember < 0.01) return;
      const cool = state === 'out' ? smooth(0.3, 2.8, t - outAt) : 0;
      const col = rgb([255, 150, 60], [190, 30, 10], cool);
      const er = W * (0.1 + 0.06 * ember);
      ctx.globalCompositeOperation = 'lighter';
      ellipseFill(at[0], at[1], er, er, [[0, `rgba(${col},${0.95 * ember})`], [1, `rgba(${col},0)`]]);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${col},${ember})`;
      ctx.beginPath();
      ctx.arc(at[0], at[1], W * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // fio de fumaça: cada partícula nasce na brasa e sobe acelerando; ligadas, formam uma fita que ondula
    function emitSmoke(t, at) {
      const to = t - outAt;
      if (!at || to < 0.06 || to > 3.2) return;
      if (t - lastEmit > 0.5) lastEmit = t - 0.02;
      while (lastEmit < t) {
        lastEmit += 1 / (80 * Math.exp(-to / 1.1) + 6);
        smoke.push({ b: lastEmit, x: at[0], y: at[1], life: 2.3 + Math.random() * 0.8 });
      }
    }
    function drawSmoke(t) {
      smoke = smoke.filter((p) => t - p.b < p.life);
      let prev = null;
      ctx.lineCap = 'round';
      smoke.forEach((p) => {
        const a = Math.max(0, t - p.b), k = a / p.life;
        const h = W * (0.9 * a + 1.6 * a * a), hn = h / W;
        let x, y;
        if (top) {
          const ang = 2.4 * n(p.b * 0.7 + 101) + a * 1.4, rr = W * (0.15 + 1.3 * a);
          x = p.x + Math.cos(ang) * rr;
          y = p.y + Math.sin(ang) * rr * 0.9;
        } else {
          x = p.x + W * 0.55 * Math.pow(hn / 6, 1.4) * n(hn * 0.45 - t * 0.5 + 81)
            + W * 0.12 * (hn / 4) * n(hn * 1.6 - t * 1.3 + 91)
            + outSway * 0.08 * h;
          y = p.y - h;
        }
        if (prev) {
          // um véu largo e claro em volta de um fio mais denso: a fumaça se abre ao subir
          const alpha = (top ? 0.22 : 0.32) * Math.min(1, a / 0.15) * (1 - k) ** 1.6;
          const width = W * (0.05 + 0.42 * k ** 1.2);
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(x, y);
          ctx.strokeStyle = `rgba(150,146,142,${(alpha * 0.28).toFixed(3)})`;
          ctx.lineWidth = width * 3.2;
          ctx.stroke();
          ctx.strokeStyle = `rgba(132,128,124,${alpha.toFixed(3)})`;
          ctx.lineWidth = width;
          ctx.stroke();
        }
        prev = [x, y];
      });
    }

    function draw(t) {
      let ember = 0, blue = 0, glow = 1, extra = 0, lift = 0;
      if (state === 'lit') {
        // acender: brasa, conta pequena e azulada, cresce com engasgos, passa um pouco e assenta
        const te = reduced ? 9 : (t - litAt) * (quick ? 1.6 : 1);
        if (te < 0.12) size = 0.14 * te / 0.12;
        else if (te < 1.7) {
          const p = (te - 0.12) / 1.58;
          size = lerp(0.14, 1.06, easeOut(p)) * (1 - 0.22 * (1 - p) * Math.max(0, n(t * 9 + 51)));
        } else size = lerp(1.06, 1, smooth(1.7, 2.4, te));
        lit = smooth(0, 1.6, te);
        blue = 1 - smooth(0.1, 1.1, te);
        glow = smooth(0.12, 1, te);
        char = Math.max(char, lerp(charFrom, 1, smooth(0, 0.9, te)));
        ember = 0.38 + 0.1 * n(t * 3 + 61);
      } else if (state === 'out') {
        // apagar: a chama encolhe, inclina e se solta; a brasa esfria e solta fumaça
        const to = t - outAt, k = smooth(0, 0.3, to);
        size = outSize * (1 - k);
        lit = outLit * (1 - smooth(0, 1.4, to));
        extra = outSway * k;
        lift = k * 0.6;
        ember = (to < 0.12 ? lerp(0.6, 1, to / 0.12) : Math.exp(-(to - 0.12) / 1.1)) * (1 + 0.12 * n(t * 7 + 71));
        if (to > 4.2) { state = 'off'; smoke = []; }
      }
      if (state === 'off') { size = 0; lit = 0; ember = 0; }

      if (state === 'lit' && !reduced && t > nextGust) {
        gustAt = t; gustDir = Math.random() < 0.5 ? -1 : 1; nextGust = t + 5 + Math.random() * 7;
      }
      const tg = t - gustAt;
      const gust = tg < 2.5 ? Math.sin(Math.min(1, tg / 0.12) * Math.PI / 2) * Math.exp(-tg / 0.45) : 0;
      sway = 0.1 * n(t * 0.55 + 3) + 0.035 * n(t * 2.3 + 11) + gustDir * 0.22 * gust + 0.05 * gust * n(t * 14 + 7) + lean;
      const breath = 1 + 0.045 * n(t * 1.1 + 21) + 0.02 * n(t * 5.7 + 31) + 0.008 * n(t * 13 + 41) - 0.1 * gust;
      const flick = clamp(1 + (breath - 1) * 2.5, 0.75, 1.15);
      const hf = breath * (1 + stretch);
      const f = {
        H: 3.2 * W * size * hf,
        R: 0.5 * W * (0.35 + 0.65 * size) / Math.sqrt(hf),
        ay: (Math.min(0.46, 0.8 * wickLen) - lift) * W, // pé da chama: a ponta do pavio fica dentro dela
        sw: sway + extra,
      };
      const cxAt = (s) => f.sw * 0.35 * f.H * s ** 1.8;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W * 8, W * 16);
      ctx.translate(ox, oy);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      if (smoke.length) drawSmoke(t);

      if (top) {
        // vista de cima: a gota vira um disco de luz em volta do pavio
        const at = drawWick();
        if (size > 0.01) {
          const r = 0.55 * W * (0.35 + 0.65 * size) * Math.sqrt(breath);
          const x = f.sw * 0.12 * W, y = -0.04 * W * size;
          ellipseFill(x, y, r * 3.2, r * 3.2, [[0, `rgba(255,190,110,${0.3 * size * flick})`], [1, 'rgba(255,150,70,0)']]);
          ellipseFill(x, y, r, r * 1.1, [[0, '#fffef8'], [0.3, '#fff3c8'], [0.6, 'rgba(255,205,110,0.95)'], [0.85, 'rgba(255,140,50,0.55)'], [1, 'rgba(255,120,40,0)']], 0.5 + 0.5 * glow);
          ctx.strokeStyle = `rgba(90,130,255,${((0.18 + 0.3 * blue) * size).toFixed(3)})`;
          ctx.lineWidth = 0.05 * W;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 0.9, r * 0.98, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (state === 'out') { emitSmoke(t, at); drawEmber(t, at, ember); }
      } else {
        if (size > 0.01) {
          // halo curto em volta da chama
          const hr = W * (0.9 + 1.3 * size);
          ellipseFill(cxAt(0.35), f.ay - 0.35 * f.H, hr, hr, [[0, `rgba(255,190,110,${0.3 * size * flick})`], [0.45, `rgba(255,160,80,${0.1 * size * flick})`], [1, 'rgba(255,150,70,0)']]);
          // base azul: a borda de baixo da chama, onde a queima é mais limpa
          ctx.beginPath();
          for (let i = 6; i >= 0; i--) { const s = i / 50; ctx.lineTo(cxAt(s) - f.R * 0.92 * profile(s), f.ay - s * f.H); }
          for (let i = 1; i <= 6; i++) { const s = i / 50; ctx.lineTo(cxAt(s) + f.R * 0.92 * profile(s), f.ay - s * f.H); }
          const ba = (0.28 + 0.4 * blue) * Math.min(1, size * 3);
          const bg = ctx.createLinearGradient(0, f.ay, 0, f.ay - 0.12 * f.H);
          bg.addColorStop(0, `rgba(70,112,255,${ba.toFixed(3)})`);
          bg.addColorStop(1, 'rgba(70,112,255,0)');
          ctx.strokeStyle = bg;
          ctx.lineWidth = 0.08 * W * (0.6 + 0.4 * size);
          ctx.lineCap = 'round';
          ctx.stroke();
          // manto: translúcido no pé, amarelo‑âmbar no corpo, borda laranja fina, ponta que se desfaz
          const mg = ctx.createLinearGradient(0, f.ay, 0, f.ay - f.H);
          mg.addColorStop(0, 'rgba(255,150,60,0)');
          mg.addColorStop(0.08, 'rgba(255,170,70,0.5)');
          mg.addColorStop(0.25, 'rgba(255,198,98,0.95)');
          mg.addColorStop(0.6, 'rgba(255,186,82,0.9)');
          mg.addColorStop(0.86, 'rgba(255,142,52,0.55)');
          mg.addColorStop(1, 'rgba(255,112,36,0)');
          ctx.fillStyle = mg;
          [[1.12, 1.04, 0.1], [1, 1, 0.32], [0.88, 0.96, 0.62]].forEach(([rk, hk, a]) => {
            drop(f, 0, hk, rk);
            ctx.globalAlpha = a * (0.45 + 0.55 * glow);
            ctx.fill();
          });
          ctx.globalAlpha = 1;
          // zona escura em volta do pavio, onde a cera ainda é vapor
          ellipseFill(cxAt(0.08), f.ay - 0.08 * f.H, f.R * 0.42, 0.11 * f.H, [[0, `rgba(150,70,28,${0.4 * glow})`], [1, 'rgba(150,70,28,0)']]);
        }
        const at = drawWick();
        if (size > 0.04) {
          // zona luminosa: quase branca logo acima do pavio, amarela para cima
          drop(f, 0.13, 0.9, 0.82);
          ctx.fillStyle = `rgba(255,218,136,${(0.4 * glow).toFixed(3)})`;
          ctx.fill();
          drop(f, 0.15, 0.86, 0.7);
          ctx.save();
          const rx = Math.max(0.1, f.R * 0.7), ry = Math.max(0.1, 0.44 * f.H);
          ctx.translate(cxAt(0.38), f.ay - 0.38 * f.H);
          ctx.scale(1, ry / rx);
          const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          cg.addColorStop(0, '#fffef8');
          cg.addColorStop(0.42, '#fff5d4');
          cg.addColorStop(0.78, 'rgba(255,226,150,0.85)');
          cg.addColorStop(1, 'rgba(255,206,112,0)');
          ctx.globalAlpha = glow;
          ctx.fillStyle = cg;
          ctx.fill();
          ctx.restore();
        }
        if (state === 'out') emitSmoke(t, at);
        drawEmber(t, at, ember);
      }

      // a luz da cena acompanha a chama
      const glowVar = Math.round(Math.min(lit, size) * flick * 1000) / 1000;
      const litVar = Math.round(lit * 1000) / 1000;
      if (litVar !== lastLit) { scene.style.setProperty('--lit', litVar); lastLit = litVar; }
      if (glowVar !== lastGlow) { scene.style.setProperty('--glow', glowVar); lastGlow = glowVar; }
    }

    function frame(t) {
      const dt = clamp(t - lastT, 0.001, 0.05);
      lastT = t;
      physics(dt);
      draw(t);
      if (state === 'off' || !visible) { activeFlames.delete(api); lastX = null; }
    }

    const api = {
      frame,
      layout(xPct, yPct, fw, w) {
        if (w) {
          wick = w;
          wickLen = Math.hypot(w.base[0], w.base[1]);
          curl = w.base[0] > 0.02 ? -1 : 1;
        }
        const d = Math.min(window.devicePixelRatio || 1, 2);
        canvas.style.left = `calc(${xPct}% - ${fw * 4}px)`;
        canvas.style.top = `calc(${yPct}% - ${fw * (top ? 8 : 12)}px)`;
        const key = `${fw.toFixed(2)}|${d}`;
        if (key === sizeKey) return;
        sizeKey = key; W = fw; dpr = d; ox = W * 4; oy = W * (top ? 8 : 12);
        canvas.style.width = `${W * 8}px`;
        canvas.style.height = `${W * 16}px`;
        canvas.width = Math.round(W * 8 * dpr);
        canvas.height = Math.round(W * 16 * dpr);
        if (!activeFlames.has(api)) draw(lastT || clock());
      },
      light() {
        if (state === 'lit') return;
        quick = char > 0.9;
        charFrom = char;
        state = 'lit';
        litAt = lastT = clock();
        nextGust = litAt + 4 + Math.random() * 5;
        smoke = [];
        if (reduced) { draw(litAt); return; }
        lastX = null;
        if (visible) wakeFlame(api);
      },
      snuff() {
        if (state !== 'lit') return;
        state = 'out';
        outAt = lastT = clock();
        outSize = size; outLit = lit; outSway = (sway >= 0 ? 1 : -1) * 0.5;
        smoke = []; lastEmit = outAt + 0.06;
        if (reduced) { state = 'off'; draw(outAt); return; }
        if (visible) wakeFlame(api);
      },
      setVisible(v) {
        visible = v;
        if (v && state !== 'off' && !reduced) { lastX = null; wakeFlame(api); }
      },
    };
    return api;
  }

  /* ---------- Velas que podem ser acesas ---------- */
  const scenes = $$('[data-wick]');
  const sceneIo = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => e.target.flame.setVisible(e.isIntersecting)))
    : null;
  scenes.forEach((scene) => {
    scene.classList.add('scene');
    const fx = document.createElement('div');
    fx.className = 'candle-fx';
    fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = '<span class="candle-fx__dim"></span><span class="candle-fx__glow"></span><canvas class="candle-fx__canvas"></canvas><span class="candle-fx__spot"></span>';
    scene.appendChild(fx);
    scene.flame = createFlame(scene, $('canvas', fx));
    if (sceneIo) sceneIo.observe(scene);
  });
  function layoutScene(scene) {
    const img = $('img', scene);
    const [wx, wy] = scene.dataset.wick.split(',').map(Number);
    const p = mapPoint(scene, img, wx, wy);
    if (!p) return;
    const fw = ((parseFloat(scene.dataset.flame) || 5) / 100) * p.dw;
    // pavio da foto (base, curva e espessura) medido a partir da ponta, em larguras de chama
    const rel = (attr) => {
      if (!scene.dataset[attr]) return null;
      const [x, y] = scene.dataset[attr].split(',').map(Number);
      const q = mapPoint(scene, img, x, y);
      return [((q.x - p.x) / 100) * scene.clientWidth / fw, ((q.y - p.y) / 100) * scene.clientHeight / fw];
    };
    const wick = {
      base: rel('wickBase') || [0, 0.3],
      bend: rel('wickBend'),
      w: ((parseFloat(scene.dataset.wickW) || 1) / 100) * p.dw / fw,
    };
    scene.style.setProperty('--wx', `${p.x}%`);
    scene.style.setProperty('--wy', `${p.y}%`);
    scene.style.setProperty('--fw', `${fw}px`);
    scene.flame.layout(p.x, p.y, fw, wick);
  }
  function setBurning(scene, on) {
    if (on) {
      layoutScene(scene);
      scene.classList.add('is-burning');
      scene.flame.light();
    } else if (scene.classList.contains('is-burning')) {
      scene.classList.remove('is-burning');
      scene.flame.snuff();
    }
  }
  // no toque, a área do pavio e da chama também acende e apaga
  function nearWick(scene, x, y) {
    layoutScene(scene);
    const r = scene.getBoundingClientRect();
    const fw = parseFloat(scene.style.getPropertyValue('--fw')) || 16;
    const wx = r.left + (parseFloat(scene.style.getPropertyValue('--wx')) / 100) * r.width;
    const wy = r.top + (parseFloat(scene.style.getPropertyValue('--wy')) / 100) * r.height;
    return Math.hypot(x - wx, (y - (wy - fw)) * 0.7) < Math.max(30, fw * 1.8);
  }
  function lightButton(label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-btn g-light';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `${ICON.flame}<span>${label}</span>`;
    return b;
  }
  function setLightButton(btn, on) {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Apagar a vela' : 'Acender a vela');
    $('span', btn).textContent = on ? 'Apagar' : 'Acender a vela';
  }

  const layoutAll = () => {
    $$('.flame').forEach(placeFlame);
    scenes.forEach(layoutScene);
  };
  $$('img').forEach((img) => { if (!img.complete) img.addEventListener('load', layoutAll, { once: true }); });
  layoutAll();

  /* ==========================================================
     HERO · a luz acompanha quem visita
     ========================================================== */
  const hero = $('.hero');
  const heroMedia = $('.hero__media');
  const heroImg = $('.hero__img--base');
  const heroFlame = $('.flame--hero');
  let igniteAt = 0;

  function ignite() {
    if (body.classList.contains('is-lit')) return;
    setTimeout(() => body.classList.add('is-lit'), 60);
    igniteAt = performance.now();
  }
  if (heroImg.complete) ignite();
  else {
    heroImg.addEventListener('load', ignite, { once: true });
    setTimeout(ignite, 1600);
  }

  if (!reduced) {
    let heroRect = hero.getBoundingClientRect();
    let mediaRect = heroMedia.getBoundingClientRect();
    let pointerActive = false;
    let releaseTimer = null;
    let tx = 0, ty = 0, cx = -999, cy = -999;
    let tiltX = 0, tiltY = 0, hasTilt = false;
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

    const follow = (clientX, clientY) => {
      tx = clientX - heroRect.left;
      ty = clientY - heroRect.top;
      clearTimeout(releaseTimer);
      if (!pointerActive) {
        pointerActive = true;
        hero.classList.add('has-pointer');
        if (cx < -900) { cx = tx; cy = ty; }
      }
      if (lastX !== null) travelled += Math.hypot(clientX - lastX, clientY - lastY);
      lastX = clientX; lastY = clientY;
      if (travelled > 160) hero.classList.add('hint-done');
    };
    const release = (delay) => {
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => {
        pointerActive = false;
        lastX = null;
        hero.classList.remove('has-pointer');
      }, delay);
    };

    hero.addEventListener('pointermove', (e) => follow(e.clientX, e.clientY), { passive: true });
    hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') release(0); });

    // no toque: tocar leva a luz até o dedo e arrastar para o lado a conduz;
    // arrastar na vertical é rolagem (o navegador cancela o toque) e a luz volta para a vela
    const ripple = document.createElement('span');
    ripple.className = 'hero__ripple';
    ripple.setAttribute('aria-hidden', 'true');
    hero.appendChild(ripple);
    hero.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || e.target.closest('a, button')) return;
      measure();
      follow(e.clientX, e.clientY);
      ripple.style.left = `${e.clientX - heroRect.left}px`;
      ripple.style.top = `${e.clientY - heroRect.top}px`;
      ripple.classList.remove('is-on');
      void ripple.offsetWidth;
      ripple.classList.add('is-on');
      hero.classList.add('hint-done');
      buzz(6);
    });
    hero.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') release(1800); });
    hero.addEventListener('pointercancel', (e) => { if (e.pointerType === 'touch') release(250); });

    // inclinar o celular move a luz (onde o navegador permite sem pedir autorização)
    if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma === null || e.beta === null) return;
        hasTilt = true;
        tiltX = clamp(e.gamma / 30, -1, 1);
        tiltY = clamp((e.beta - 45) / 30, -1, 1);
      }, { passive: true });
    }

    const frame = (now) => {
      if (!heroVisible || document.hidden) { running = false; return; }
      const t = now / 1000;
      const c = candleCenter();
      if (cx < -900) { cx = c.x; cy = c.y; }

      let gx, gy;
      if (pointerActive) { gx = tx; gy = ty; }
      else {
        const drift = hasTilt ? 0.08 : 0.22;
        gx = c.x + Math.sin(t * 0.45) * mediaRect.width * drift + tiltX * mediaRect.width * 0.32;
        gy = c.y + Math.cos(t * 0.33) * mediaRect.height * drift * 0.7 + tiltY * mediaRect.height * 0.22;
      }
      const ease = pointerActive ? 0.09 : 0.035;
      cx += (gx - cx) * ease;
      cy += (gy - cy) * ease;

      const flicker = 1 + 0.035 * Math.sin(t * 13.1) + 0.025 * Math.sin(t * 7.3 + 1.3) + 0.02 * Math.sin(t * 23.7 + 0.4);
      const grow = igniteAt ? smooth(0, 2600, now - igniteAt) : 0;
      const base = Math.min(window.innerWidth, window.innerHeight) * (mqMobile.matches ? 0.42 : 0.3);
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
     TÍTULOS · palavras sobem uma a uma
     ========================================================== */
  $$('.h2, .h3, .product__name').forEach((el) => {
    if (el.children.length) return;
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((w, i) => {
      const outer = document.createElement('span');
      outer.className = 'word';
      const inner = document.createElement('span');
      inner.textContent = w;
      inner.style.setProperty('--i', i);
      outer.appendChild(inner);
      el.appendChild(outer);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.classList.add('split');
  });

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
    if (rect.bottom < -50 || rect.top > window.innerHeight + 50) return;
    const total = rect.height - window.innerHeight;
    const p = clamp(-rect.top / total, 0, 1);
    const lit = Math.round(smooth(0.02, 0.52, p) * words.length);
    words.forEach((w, i) => w.classList.toggle('is-on', i < lit));
    dawn = smooth(0.56, 0.8, p);
    manifesto.style.setProperty('--dawn', dawn.toFixed(3));
    manifesto.style.setProperty('--fade', smooth(0.6, 0.78, p).toFixed(3));
  }

  /* ---------- Hero se aproxima ao rolar ---------- */
  let lastHp = -1;
  function updateHeroDepth() {
    if (reduced) return;
    const hp = clamp(window.scrollY / hero.offsetHeight, 0, 1);
    if (Math.abs(hp - lastHp) < 0.002) return;
    lastHp = hp;
    hero.style.setProperty('--hp', hp.toFixed(3));
  }

  /* ---------- Brasa de progresso ---------- */
  const progress = $('.progress');
  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const sp = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    progress.style.setProperty('--sp', sp.toFixed(4));
    progress.classList.toggle('is-on', window.scrollY > hero.offsetHeight * 0.6);
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
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      root.style.overflow = 'hidden';
      nav.classList.remove('is-hidden');
    } else {
      menu.classList.remove('is-open');
      root.style.overflow = '';
      setTimeout(() => { if (toggle.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 500);
    }
    updateNav();
  }
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); } });
  mqMobile.addEventListener('change', () => { if (!mqMobile.matches && toggle.getAttribute('aria-expanded') === 'true') setMenu(false); });

  /* ---------- Botão flutuante e barra da encomenda ---------- */
  const floatWa = $('.float-wa');
  const contact = $('#contato');
  const orderSection = $('#encomende');
  const orderBar = $('.order-bar');
  const previewCard = $('.preview-card');
  function updateFloat() {
    const vh = window.innerHeight;
    const pastHero = window.scrollY > hero.offsetHeight * 0.85;
    const inContact = contact.getBoundingClientRect().top < vh * 0.7;
    const o = orderSection.getBoundingClientRect();
    const inOrder = o.top < vh * 0.6 && o.bottom > vh * 0.4;
    floatWa.classList.toggle('is-visible', pastHero && !inContact && !inOrder);

    // no celular, a encomenda ganha uma barra com o resumo enquanto a prévia não está na tela
    const pr = previewCard.getBoundingClientRect();
    const previewOnScreen = pr.top < vh - 90 && pr.bottom > 90;
    const formOnScreen = o.top < vh * 0.55 && o.bottom > vh * 0.75;
    orderBar.classList.toggle('is-visible', mqMobile.matches && formOnScreen && !previewOnScreen);
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
    const span = mqMobile.matches ? r.height : window.innerHeight * 0.45;
    const p = reduced ? 1 : clamp((window.innerHeight * 0.8 - r.top) / span, 0, 1);
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
      updateHeroDepth();
      updateManifesto();
      updateNav();
      updateFloat();
      updateProcess();
      updateSeal();
      updateProgress();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measureProcess(); layoutAll(); onScroll(); });
  window.addEventListener('load', () => { measureProcess(); layoutAll(); onScroll(); });
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

  /* ---------- Toque: o item que passa pelo centro da tela ganha o destaque que no computador vem do cursor ---------- */
  if (touchUI.matches && 'IntersectionObserver' in window) {
    const focusIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('is-focus', e.isIntersecting));
    }, { rootMargin: '-45% 0px -45% 0px' });
    $$('.aroma, .case, .channel, .occasion .link-arrow').forEach((el) => focusIo.observe(el));
  }

  /* ==========================================================
     LIGHTBOX
     ========================================================== */
  const lightbox = document.createElement('dialog');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('aria-label', 'Fotos ampliadas');
  lightbox.innerHTML = `
    <div class="lightbox__bar">
      <p class="lightbox__title"></p>
      <p class="lightbox__count" aria-live="polite"></p>
      <button type="button" class="lightbox__close" aria-label="Fechar">×</button>
    </div>
    <div class="lightbox__track"></div>
    <button type="button" class="lightbox__arrow lightbox__arrow--prev" aria-label="Foto anterior">←</button>
    <button type="button" class="lightbox__arrow lightbox__arrow--next" aria-label="Próxima foto">→</button>`;
  body.appendChild(lightbox);
  const lbTrack = $('.lightbox__track', lightbox);
  const lbCount = $('.lightbox__count', lightbox);
  const lbTitle = $('.lightbox__title', lightbox);
  let lbTotal = 0, lbReturn = null;

  const largest = (img) => {
    const set = img.getAttribute('srcset');
    if (!set) return img.currentSrc || img.src;
    const items = set.split(',').map((s) => s.trim().split(/\s+/));
    items.sort((a, b) => parseInt(b[1], 10) - parseInt(a[1], 10));
    return items[0][0];
  };
  const lbIndex = () => Math.round(lbTrack.scrollLeft / Math.max(1, lbTrack.clientWidth));
  const lbUpdate = () => { lbCount.textContent = `${lbIndex() + 1} / ${lbTotal}`; };
  const lbGo = (i, smoothScroll = true) => {
    lbTrack.scrollTo({ left: clamp(i, 0, lbTotal - 1) * lbTrack.clientWidth, behavior: smoothScroll && !reduced ? 'smooth' : 'auto' });
  };

  function openLightbox(imgs, index, title, trigger) {
    lbTrack.innerHTML = '';
    imgs.forEach((img) => {
      const slide = document.createElement('figure');
      slide.className = 'lightbox__slide';
      const big = document.createElement('img');
      big.src = largest(img);
      big.alt = img.alt;
      big.decoding = 'async';
      slide.appendChild(big);
      lbTrack.appendChild(slide);
    });
    lbTotal = imgs.length;
    lbTitle.textContent = title || '';
    lbReturn = trigger || null;
    lightbox.showModal();
    root.style.overflow = 'hidden';
    requestAnimationFrame(() => { lbGo(index, false); lbUpdate(); });
  }
  lbTrack.addEventListener('scroll', lbUpdate, { passive: true });
  $('.lightbox__close', lightbox).addEventListener('click', () => lightbox.close());
  $('.lightbox__arrow--prev', lightbox).addEventListener('click', () => lbGo(lbIndex() - 1));
  $('.lightbox__arrow--next', lightbox).addEventListener('click', () => lbGo(lbIndex() + 1));
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { lbGo(lbIndex() - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { lbGo(lbIndex() + 1); e.preventDefault(); }
  });
  lbTrack.addEventListener('click', (e) => { if (e.target.classList.contains('lightbox__slide')) lightbox.close(); });
  lightbox.addEventListener('close', () => {
    root.style.overflow = '';
    lightbox.classList.remove('is-dragging', 'is-leaving');
    lightbox.style.setProperty('--drag', '0px');
    lightbox.style.setProperty('--dragp', '0');
    if (lbReturn) lbReturn.focus({ preventScroll: true });
  });

  // celular: arrastar a foto para baixo fecha, como nas galerias do telefone
  let drag = null;
  lbTrack.addEventListener('touchstart', (e) => {
    drag = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, dy: 0, dir: null, t: performance.now() } : null;
  }, { passive: true });
  lbTrack.addEventListener('touchmove', (e) => {
    if (!drag || e.touches.length !== 1) { drag = null; return; }
    const dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
    if (!drag.dir) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.dir = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
    }
    if (drag.dir !== 'y') return;
    drag.dy = Math.max(0, dy);
    lightbox.classList.add('is-dragging');
    lightbox.style.setProperty('--drag', `${drag.dy}px`);
    lightbox.style.setProperty('--dragp', Math.min(1, drag.dy / 320).toFixed(3));
  }, { passive: true });
  const endDrag = () => {
    if (!drag || drag.dir !== 'y') { drag = null; return; }
    const speed = drag.dy / Math.max(1, performance.now() - drag.t);
    lightbox.classList.remove('is-dragging');
    if (drag.dy > 110 || (drag.dy > 40 && speed > 0.5)) {
      lightbox.classList.add('is-leaving');
      lightbox.style.setProperty('--drag', `${drag.dy + 80}px`);
      setTimeout(() => lightbox.close(), reduced ? 0 : 220);
    } else {
      lightbox.style.setProperty('--drag', '0px');
      lightbox.style.setProperty('--dragp', '0');
    }
    drag = null;
  };
  lbTrack.addEventListener('touchend', endDrag);
  lbTrack.addEventListener('touchcancel', endDrag);

  /* ==========================================================
     GALERIAS
     ========================================================== */
  $$('[data-gallery]').forEach((g) => {
    const stage = $('.gallery__stage', g);
    const shots = $$('.shot', g);
    const thumbs = $$('.thumb', g);
    const title = $('.product__name', g.closest('.product'))?.textContent.trim() || '';
    let index = 0;

    // as fotos empilhadas carregam todas quando a galeria se aproxima da tela
    new IntersectionObserver(([en], obs) => {
      if (!en.isIntersecting) return;
      shots.forEach((s) => { $('img', s).loading = 'eager'; });
      obs.disconnect();
    }, { rootMargin: '800px 0px' }).observe(g);

    // moldura com os controles por cima da foto
    const frame = document.createElement('div');
    frame.className = 'gallery__frame';
    stage.parentNode.insertBefore(frame, stage);
    frame.appendChild(stage);

    const zoom = document.createElement('button');
    zoom.type = 'button';
    zoom.className = 'g-btn g-zoom';
    zoom.setAttribute('aria-label', `Ampliar fotos da vela ${title}`);
    zoom.innerHTML = ICON.expand;
    frame.appendChild(zoom);

    if (shots.length > 1) {
      const prev = document.createElement('button');
      prev.type = 'button'; prev.className = 'g-btn g-arrow g-prev'; prev.setAttribute('aria-label', 'Foto anterior'); prev.innerHTML = ICON.prev;
      const next = document.createElement('button');
      next.type = 'button'; next.className = 'g-btn g-arrow g-next'; next.setAttribute('aria-label', 'Próxima foto'); next.innerHTML = ICON.next;
      frame.append(prev, next);
      prev.addEventListener('click', () => go(index - 1));
      next.addEventListener('click', () => go(index + 1));
    }

    const setActive = (n, silent) => {
      index = (n + shots.length) % shots.length;
      shots.forEach((s, k) => s.classList.toggle('is-active', k === index));
      thumbs.forEach((t, k) => {
        t.classList.toggle('is-active', k === index);
        t.setAttribute('aria-pressed', String(k === index));
      });
      if (lightBtn) lightBtn.hidden = !shots[index].hasAttribute('data-wick');
      if (!silent) g.dispatchEvent(new CustomEvent('gallery:change', { detail: { shot: shots[index] } }));
    };
    const go = (n, silent) => {
      const target = (n + shots.length) % shots.length;
      if (mqMobile.matches) {
        stage.scrollTo({ left: target * stage.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
        if (silent) setActive(target, true);
      } else {
        setActive(target, silent);
      }
    };
    g.galleryGo = go;
    thumbs.forEach((t, k) => t.addEventListener('click', () => go(k)));

    // celular: o índice acompanha o deslizar nativo
    let scrollTick = false;
    stage.addEventListener('scroll', () => {
      if (!mqMobile.matches || scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        const n = Math.round(stage.scrollLeft / Math.max(1, stage.clientWidth));
        if (n !== index) setActive(n);
        scrollTick = false;
      });
    }, { passive: true });
    mqMobile.addEventListener('change', () => {
      if (mqMobile.matches) stage.scrollLeft = index * stage.clientWidth;
      else stage.scrollLeft = 0;
      layoutAll();
    });

    // computador e tablet: arrastar troca a foto, clique amplia
    let startX = null, startY = null, swiped = false;
    stage.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; swiped = false; });
    stage.addEventListener('pointerup', (e) => {
      if (startX === null || mqMobile.matches) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { go(index + (dx < 0 ? 1 : -1)); swiped = true; }
      startX = null;
    });
    const openHere = () => openLightbox(shots.map((s) => $('img', s)), index, title, zoom);
    stage.addEventListener('click', (e) => {
      if (swiped) return;
      const shot = shots[index];
      if (toggleLight && touchUI.matches && shot.hasAttribute('data-wick') && nearWick(shot, e.clientX, e.clientY)) toggleLight();
      else openHere();
    });
    zoom.addEventListener('click', openHere);
    frame.addEventListener('keydown', (e) => {
      if (e.target.closest('.thumb, .g-btn') === null) return;
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === 'ArrowRight') go(index + 1);
    });

    // acender a vela (só nas galerias com velas apagadas)
    let lightBtn = null, toggleLight = null;
    const wickShots = shots.filter((s) => s.hasAttribute('data-wick'));
    if (wickShots.length) {
      lightBtn = lightButton('Acender a vela');
      setLightButton(lightBtn, false);
      frame.appendChild(lightBtn);
      let lit = false;
      toggleLight = () => {
        lit = !lit;
        setLightButton(lightBtn, lit);
        wickShots.forEach((s) => setBurning(s, lit));
        buzz(lit ? [6, 30, 12] : 8);
      };
      lightBtn.addEventListener('click', toggleLight);
      // um convite discreto na primeira vez que a galeria aparece (no toque, o pavio também pulsa)
      new IntersectionObserver(([en], obs) => {
        if (!en.isIntersecting) return;
        setTimeout(() => {
          const shot = shots[index];
          lightBtn.classList.add('is-hinting');
          if (shot.hasAttribute('data-wick')) { layoutScene(shot); shot.classList.add('is-hinting'); }
          setTimeout(() => { lightBtn.classList.remove('is-hinting'); shot.classList.remove('is-hinting'); }, 4000);
        }, 1200);
        obs.disconnect();
      }, { threshold: 0.6 }).observe(frame);
    }

    // celular: uma espiadinha na primeira vez mostra que dá para deslizar entre as fotos
    if (shots.length > 1 && !reduced) {
      new IntersectionObserver(([en], obs) => {
        if (!en.isIntersecting || !mqMobile.matches || !touchUI.matches) return;
        obs.disconnect();
        setTimeout(() => {
          if (stage.scrollLeft > 4) return;
          const done = (e) => {
            if (e.animationName !== 'peek') return;
            stage.classList.remove('is-peeking');
            stage.removeEventListener('animationend', done);
          };
          stage.addEventListener('animationend', done);
          stage.classList.add('is-peeking');
        }, 700);
      }, { threshold: 0.7 }).observe(stage);
    }
    setActive(0, true);
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
    setSize('pequena', true);
  }

  /* ==========================================================
     CARTA DE AROMAS
     ========================================================== */
  const aromasSection = $('#aromas');
  const families = $$('.family');
  let hovering = false;
  families.forEach((fam) => {
    const key = fam.dataset.familyKey;
    fam.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; aromasSection.dataset.family = key; } });
    fam.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hovering = false; });
    fam.addEventListener('focusin', () => { aromasSection.dataset.family = key; });
  });
  // ao rolar, a família no centro da tela tinge o ambiente (essencial no celular)
  if ('IntersectionObserver' in window) {
    const famIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !hovering) aromasSection.dataset.family = e.target.dataset.familyKey;
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    families.forEach((f) => famIo.observe(f));
  }

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
      buzz(8);
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
  const orderWaLinks = $$('[data-order-wa]');
  const orderMail = $('[data-order-mail]');
  const orderSum = $('[data-order-sum]');
  const qty = $('#qty');
  let currentModel = null;
  let lastText = '';
  let labelLine = '';

  function composeMessage() {
    const data = new FormData(form);
    const model = data.get('model') || '';
    const aroma = data.get('aroma') || '';
    const occasion = data.get('occasion') || '';
    const n = clamp(parseInt(data.get('qty'), 10) || 1, 1, 9999);
    const custom = form.elements.custom.checked;
    const notes = (data.get('details') || '').trim();

    const lines = ['Olá, Ma&Ma!'];
    let s;
    if (model) s = `Gostaria de encomendar ${n === 1 ? 'uma vela' : `${n} velas`} ${model}`;
    else s = n === 1 ? 'Gostaria de ajuda para escolher a vela ideal' : `Gostaria de ajuda para escolher ${n} velas`;
    if (aroma === 'sob encomenda') s += ' com um aroma criado sob encomenda';
    else if (aroma) s += ` com aroma ${aroma}`;
    s += occasion ? `, ${occasion}.` : '.';
    lines.push(s);
    if (!aroma) lines.push('Ainda estou escolhendo o aroma.');
    if (custom && labelLine) lines.push(labelLine);
    else if (custom) lines.push(n === 1 ? 'Quero personalizar a vela com nome, data ou mensagem.' : 'Quero personalizar as velas com nome, data ou mensagem.');
    if (notes) lines.push(`Sobre o momento: ${notes}`);

    const occLabel = $('input[name="occasion"]:checked + span', form)?.textContent || '';
    const summary = [model || 'Vela a escolher', aroma === 'sob encomenda' ? 'Outro aroma' : (aroma || 'Aroma a escolher'), occLabel]
      .concat(n > 1 ? [`${n} un.`] : [])
      .join(' · ');
    return { text: lines.join('\n'), model, summary };
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
    const { text, model, summary } = composeMessage();
    previewMsg.textContent = text;
    if (lastText && text !== lastText && !reduced) {
      previewMsg.classList.remove('is-updated');
      void previewMsg.offsetWidth;
      previewMsg.classList.add('is-updated');
    }
    lastText = text;
    orderWaLinks.forEach((a) => { a.href = waLink(text); });
    orderMail.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Encomenda Ma&Ma Atelier')}&body=${encodeURIComponent(text)}`;
    orderSum.textContent = summary;
    updatePreviewImage(model);
  }

  form.addEventListener('input', updateOrder);
  form.addEventListener('change', (e) => { if (e.target.type === 'radio') buzz(6); updateOrder(); });
  form.addEventListener('submit', (e) => e.preventDefault());

  $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
    qty.value = clamp((parseInt(qty.value, 10) || 1) + Number(b.dataset.step), 1, 9999);
    buzz(6);
    updateOrder();
  }));
  qty.addEventListener('blur', () => { qty.value = clamp(parseInt(qty.value, 10) || 1, 1, 9999); updateOrder(); });
  orderSum.addEventListener('click', () => previewCard.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }));

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

  /* ==========================================================
     PRÉVIA DA PERSONALIZAÇÃO
     ========================================================== */
  const labelForm = $('#label-form');
  if (labelForm) {
    const outs = {};
    $$('[data-label-out]').forEach((el) => { outs[el.dataset.labelOut] = el; });
    const labelEl = $('.label');
    const fields = ['names', 'date', 'phrase'];

    const renderLabel = () => {
      fields.forEach((f) => {
        const input = labelForm.elements[f];
        const value = input.value.trim() || input.placeholder;
        outs[f].textContent = value;
      });
      const len = outs.names.textContent.length;
      labelEl.style.setProperty('--names-size', `${clamp(172 / (0.8 * Math.max(len, 1)), 5.4, 8.4)}cqw`);
    };
    let labelUsed = false;
    const buildLabelLine = () => {
      const v = Object.fromEntries(fields.map((f) => [f, labelForm.elements[f].value.trim()]));
      const parts = [];
      if (v.names) parts.push(`nomes ${v.names}`);
      if (v.date) parts.push(`data ${v.date}`);
      if (v.phrase) parts.push(`frase "${v.phrase}"`);
      labelLine = parts.length ? `Quero personalizar com ${parts.join(', ')}.` : '';
    };
    labelForm.addEventListener('input', () => {
      renderLabel();
      // depois de levada para a encomenda, a mensagem acompanha cada ajuste
      if (labelUsed) { buildLabelLine(); updateOrder(); }
    });
    labelForm.addEventListener('submit', (e) => e.preventDefault());
    renderLabel();

    $('[data-label-use]').addEventListener('click', () => {
      labelUsed = true;
      form.elements.custom.checked = true;
      buildLabelLine();
      buzz(10);
      updateOrder();
    });

    // a vela da prévia também acende
    const labelPhoto = $('.label-photo');
    const lb = lightButton('Acender a vela');
    setLightButton(lb, false);
    labelPhoto.appendChild(lb);
    let labelLit = false;
    const toggleLabelLight = () => {
      labelLit = !labelLit;
      setLightButton(lb, labelLit);
      setBurning(labelPhoto, labelLit);
      buzz(labelLit ? [6, 30, 12] : 8);
    };
    lb.addEventListener('click', toggleLabelLight);
    labelPhoto.addEventListener('click', (e) => {
      if (e.target === lb || lb.contains(e.target)) return;
      if (touchUI.matches && nearWick(labelPhoto, e.clientX, e.clientY)) toggleLabelLight();
    });
  }
})();
