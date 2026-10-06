/* 演出：紙吹雪・フラッシュ・バイブ */
(function (BS) {
  'use strict';

  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PALETTES = {
    N: ['#ffd21f', '#ff0033', '#ffffff', '#ffb3c1'],
    R: ['#ffd21f', '#2d8cf0', '#ffffff', '#7cc4ff', '#ff0033'],
    SR: ['#a33cf0', '#ffd21f', '#ff5fa2', '#ffffff', '#7cc4ff'],
    SSR: ['#ffd21f', '#ffe892', '#e0a800', '#ffffff', '#ff0033'],
    UR: ['#ff4d6d', '#ff9f1c', '#ffe94a', '#4ade80', '#38bdf8', '#6366f1', '#c084fc'],
  };
  const AMOUNT = { N: 40, R: 70, SR: 110, SSR: 170, UR: 240 };

  let canvas = null;
  let ctx = null;
  let parts = [];
  let raf = 0;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);
  }

  function spawn(tier, origin) {
    const colors = PALETTES[tier] || PALETTES.N;
    let n = AMOUNT[tier] || 40;
    if (reduceMotion()) n = Math.round(n / 4);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const ox = origin ? origin.x : W / 2;
    const oy = origin ? origin.y : H * 0.35;
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      const sp = 6 + Math.random() * 9 * (tier === 'UR' || tier === 'SSR' ? 1.3 : 1);
      parts.push({
        x: ox, y: oy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        w: 6 + Math.random() * 7, h: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() < 0.18 ? 'banana' : (Math.random() < 0.3 ? 'circle' : 'rect'),
        life: 0, max: 140 + Math.random() * 80,
      });
    }
    // 上から降ってくる分（SSR 以上）
    if (tier === 'SSR' || tier === 'UR') {
      for (let i = 0; i < n / 2; i += 1) {
        parts.push({
          x: Math.random() * W, y: -20 - Math.random() * H * 0.5,
          vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
          w: 6 + Math.random() * 7, h: 4 + Math.random() * 6,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: Math.random() < 0.25 ? 'banana' : 'rect', life: 0, max: 260,
        });
      }
    }
  }

  function drawBanana(p) {
    const s = p.w * 0.9;
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.1);
    ctx.quadraticCurveTo(0, s * 1.1, s, -s * 0.4);
    ctx.quadraticCurveTo(s * 0.2, s * 0.45, -s, -s * 0.1);
    ctx.fill();
  }

  function loop() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    parts = parts.filter((p) => p.life < p.max && p.y < window.innerHeight + 40);
    parts.forEach((p) => {
      p.life += 1;
      p.vy += 0.22;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 'banana') {
        drawBanana(p);
      } else {
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.scale(1, Math.cos(p.life * 0.15));
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
      }
      ctx.restore();
    });
    if (parts.length) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  function confetti(tier, origin) {
    if (!tier || tier === 'miss') return;
    ensureCanvas();
    spawn(tier, origin);
    if (tier === 'UR' && !reduceMotion()) {
      setTimeout(() => spawn('UR', { x: window.innerWidth * 0.2, y: window.innerHeight * 0.4 }), 350);
      setTimeout(() => spawn('UR', { x: window.innerWidth * 0.8, y: window.innerHeight * 0.4 }), 700);
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function flash(kind) {
    if (reduceMotion()) return;
    const d = document.createElement('div');
    d.className = `fx-flash fx-flash--${kind || 'white'}`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  function shake(el) {
    if (!el || reduceMotion()) return;
    el.classList.remove('fx-shake');
    void el.offsetWidth; // アニメーションを再始動
    el.classList.add('fx-shake');
  }

  let lastVib = 0;
  function vibrate(pattern, throttleMs) {
    if (!BS.store || !BS.store.state.settings.vibrate || !navigator.vibrate) return;
    const now = Date.now();
    if (throttleMs && now - lastVib < throttleMs) return;
    lastVib = now;
    try { navigator.vibrate(pattern); } catch (e) { /* 無視 */ }
  }

  function clear() {
    parts = [];
  }

  BS.fx = { confetti, flash, shake, vibrate, clear, reduceMotion };
})(window.BS = window.BS || {});
