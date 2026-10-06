/* スクラッチ面（Canvas）コンポーネント */
(function (BS) {
  'use strict';

  const COATINGS = {
    silver: { stops: ['#c9cdd3', '#f3f4f6', '#b4b9c1', '#e6e8ec', '#c2c6cd'], ink: 'rgba(110,116,126,.9)', mark: 'rgba(120,126,136,.16)', stripe: 'rgba(255,255,255,.28)' },
    gold: { stops: ['#f7d774', '#fff4bf', '#e7b52a', '#ffe892', '#d39a12'], ink: 'rgba(130,84,0,.9)', mark: 'rgba(150,100,0,.2)', stripe: 'rgba(255,255,255,.35)' },
    rainbow: { stops: ['#ff8fab', '#ffd36e', '#a8f0a0', '#8fd3ff', '#c9a7ff', '#ff9ed2'], ink: 'rgba(255,255,255,.95)', mark: 'rgba(255,255,255,.3)', stripe: 'rgba(255,255,255,.35)' },
  };

  function ScratchArea(host, opts) {
    this.host = host;
    this.o = Object.assign({
      coating: 'silver', label: 'けずってね', sub: '', threshold: 0.55, brush: 0.11,
      onStart: null, onMove: null, onProgress: null, onReveal: null, canStart: null,
    }, opts || {});
    this.revealed = false;
    this.started = false;
    this.locked = false;
    this.drawing = false;
    this.last = null;
    this.lastT = 0;
    this.cleared = 0;

    const c = document.createElement('canvas');
    c.className = 'scratch-canvas';
    c.setAttribute('aria-hidden', 'true');
    host.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');

    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    c.addEventListener('pointerdown', this._down);
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerup', this._up);
    c.addEventListener('pointercancel', this._up);
    c.addEventListener('lostpointercapture', this._up);

    this._setup();
  }

  ScratchArea.prototype._setup = function () {
    const r = this.host.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) {
      // まだレイアウトされていない場合は少し待つ
      requestAnimationFrame(() => this._setup());
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = Math.round(r.width * dpr);
    this.h = Math.round(r.height * dpr);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    // 削った割合の判定用グリッド
    this.cols = 24;
    this.rows = Math.max(6, Math.round(24 * (this.h / this.w)));
    this.grid = new Uint8Array(this.cols * this.rows);
    this.cleared = 0;
    this.brushR = Math.max(10 * dpr, Math.min(this.w, this.h) * this.o.brush * 1.6, this.w * this.o.brush * 0.5);
    this._paint();
  };

  // 削る面を描く
  ScratchArea.prototype._paint = function () {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const theme = COATINGS[this.o.coating] || COATINGS.silver;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);

    const g = ctx.createLinearGradient(0, 0, w, h);
    theme.stops.forEach((s, i) => g.addColorStop(i / (theme.stops.length - 1), s));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 斜めのストライプ
    ctx.save();
    ctx.strokeStyle = theme.stripe;
    ctx.lineWidth = Math.max(2, w / 90);
    const step = Math.max(10, w / 18);
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
    }
    ctx.restore();

    // 小さなバナナ模様
    ctx.save();
    ctx.fillStyle = theme.mark;
    const unit = Math.max(26, Math.min(w, h) / 4.2);
    let row = 0;
    for (let y = unit * 0.5; y < h + unit; y += unit * 0.9) {
      for (let x = (row % 2 ? unit * 0.5 : 0); x < w + unit; x += unit) {
        this._miniBanana(ctx, x, y, unit * 0.32);
      }
      row += 1;
    }
    ctx.restore();

    // 枠線
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = Math.max(2, w / 120);
    ctx.setLineDash([Math.max(6, w / 40), Math.max(4, w / 60)]);
    const inset = Math.max(5, Math.min(w, h) * 0.05);
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    ctx.restore();

    // ラベル
    if (this.o.label) {
      const fs = Math.max(12, Math.min(w / (this.o.label.length * 1.15), h / 4.5));
      ctx.save();
      ctx.font = `800 ${fs}px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillText(this.o.label, w / 2 + fs * 0.06, h / 2 + fs * 0.08 - (this.o.sub ? fs * 0.35 : 0));
      ctx.fillStyle = theme.ink;
      ctx.fillText(this.o.label, w / 2, h / 2 - (this.o.sub ? fs * 0.35 : 0));
      if (this.o.sub) {
        ctx.font = `700 ${fs * 0.42}px "M PLUS Rounded 1c", sans-serif`;
        ctx.fillText(this.o.sub, w / 2, h / 2 + fs * 0.6);
      }
      ctx.restore();
    }
  };

  ScratchArea.prototype._miniBanana = function (ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.1);
    ctx.quadraticCurveTo(0, s * 1.1, s, -s * 0.4);
    ctx.quadraticCurveTo(s * 0.2, s * 0.45, -s, -s * 0.1);
    ctx.fill();
    ctx.restore();
  };

  ScratchArea.prototype._pos = function (e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.w,
      y: ((e.clientY - r.top) / r.height) * this.h,
      cx: e.clientX,
      cy: e.clientY,
    };
  };

  ScratchArea.prototype._down = function (e) {
    if (this.revealed || this.locked || !this.grid) return;
    if (this.o.canStart && !this.o.canStart(this)) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* 無視 */ }
    this.drawing = true;
    if (!this.started) {
      this.started = true;
      if (this.o.onStart) this.o.onStart(this);
    }
    const p = this._pos(e);
    this.last = p;
    this.lastT = performance.now();
    this._line(p, p);
    if (this.o.onMove) this.o.onMove(this, 0.3, p);
  };

  ScratchArea.prototype._move = function (e) {
    if (!this.drawing || this.revealed) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    let p = this.last;
    events.forEach((ev) => {
      const np = this._pos(ev);
      this._line(p, np);
      p = np;
    });
    const now = performance.now();
    const dt = Math.max(1, now - this.lastT);
    const dist = Math.hypot(p.cx - this.last.cx, p.cy - this.last.cy);
    const speed = Math.min(1, dist / dt / 1.6);
    this.last = p;
    this.lastT = now;
    if (this.o.onMove) this.o.onMove(this, speed, p);
  };

  ScratchArea.prototype._up = function () {
    if (!this.drawing) return;
    this.drawing = false;
    if (this.o.onMove) this.o.onMove(this, -1, null);
  };

  // 2点間を削る
  ScratchArea.prototype._line = function (a, b) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.brushR * 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y + 0.01);
    ctx.stroke();
    this._mark(a, b);
  };

  // グリッド上で削れたセルを記録
  ScratchArea.prototype._mark = function (a, b) {
    const cw = this.w / this.cols;
    const ch = this.h / this.rows;
    const r = this.brushR;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / (r * 0.5)));
    let changed = false;
    for (let s = 0; s <= steps; s += 1) {
      const px = a.x + ((b.x - a.x) * s) / steps;
      const py = a.y + ((b.y - a.y) * s) / steps;
      const c0 = Math.max(0, Math.floor((px - r) / cw));
      const c1 = Math.min(this.cols - 1, Math.floor((px + r) / cw));
      const r0 = Math.max(0, Math.floor((py - r) / ch));
      const r1 = Math.min(this.rows - 1, Math.floor((py + r) / ch));
      for (let row = r0; row <= r1; row += 1) {
        for (let col = c0; col <= c1; col += 1) {
          const idx = row * this.cols + col;
          if (this.grid[idx]) continue;
          const cx = (col + 0.5) * cw;
          const cy = (row + 0.5) * ch;
          if ((cx - px) * (cx - px) + (cy - py) * (cy - py) <= r * r) {
            this.grid[idx] = 1;
            this.cleared += 1;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      const p = this.progress();
      if (this.o.onProgress) this.o.onProgress(this, p);
      if (p >= this.o.threshold) this.reveal();
    }
  };

  ScratchArea.prototype.progress = function () {
    return this.grid ? this.cleared / this.grid.length : 0;
  };

  // 残りを一気に消して結果を見せる
  ScratchArea.prototype.reveal = function (silent) {
    if (this.revealed) return;
    this.revealed = true;
    this.drawing = false;
    this.host.classList.add('is-revealed');
    this.canvas.classList.add('is-clearing');
    setTimeout(() => { if (this.canvas.parentNode) this.canvas.style.display = 'none'; }, 450);
    if (this.o.onMove) this.o.onMove(this, -1, null);
    if (this.o.onReveal) this.o.onReveal(this, !!silent);
  };

  // ボタン操作用：ジグザグに自動で削る
  ScratchArea.prototype.autoScratch = function (duration) {
    if (this.revealed || this.locked || this.auto || !this.grid) return Promise.resolve();
    if (this.o.canStart && !this.o.canStart(this)) return Promise.resolve();
    this.auto = true;
    if (!this.started) {
      this.started = true;
      if (this.o.onStart) this.o.onStart(this);
    }
    const dur = duration || 700;
    const w = this.w;
    const h = this.h;
    const lines = Math.max(3, Math.ceil(h / (this.brushR * 1.6)));
    const pts = [];
    for (let i = 0; i <= lines; i += 1) {
      const y = (h * (i + 0.5)) / (lines + 1);
      pts.push(i % 2 ? { x: w * 0.92, y } : { x: w * 0.08, y });
      pts.push(i % 2 ? { x: w * 0.08, y: y + h / (lines + 1) / 2 } : { x: w * 0.92, y: y + h / (lines + 1) / 2 });
    }
    const t0 = performance.now();
    let drawn = 0;
    return new Promise((resolve) => {
      const tick = (now) => {
        if (this.revealed) { this.auto = false; resolve(); return; }
        const k = Math.min(1, (now - t0) / dur);
        const target = Math.floor(k * (pts.length - 1));
        while (drawn < target) {
          this._line(pts[drawn], pts[drawn + 1]);
          drawn += 1;
          if (this.revealed) break;
        }
        if (this.o.onMove) this.o.onMove(this, 0.7, null);
        if (k < 1 && !this.revealed) {
          requestAnimationFrame(tick);
        } else {
          this.auto = false;
          this.reveal();
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  };

  ScratchArea.prototype.setLocked = function (v) {
    this.locked = !!v;
    this.host.classList.toggle('is-locked', this.locked);
  };

  ScratchArea.prototype.destroy = function () {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down);
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up);
    c.removeEventListener('pointercancel', this._up);
    c.removeEventListener('lostpointercapture', this._up);
    this.revealed = true;
  };

  BS.ScratchArea = ScratchArea;
})(window.BS = window.BS || {});
