/* 効果音エンジン：音声ファイルを使わず Web Audio API で合成する */
(function (BS) {
  'use strict';

  const NOTE = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
  // 'A4' → 440
  function f(name) {
    const m = /^([A-G]#?)(\d)$/.exec(name);
    if (!m) return Number(name) || 440;
    const semis = NOTE[m[1]] + (Number(m[2]) - 4) * 12;
    return 440 * Math.pow(2, semis / 12);
  }

  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let scratchNode = null;
  let enabled = true;
  let volume = 0.7;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(comp);
      comp.connect(ctx.destination);
      // 1秒分のホワイトノイズ
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // iOS 等のため、最初のタップで AudioContext を有効化
  function unlock() {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    o.connect(g); g.connect(master);
    o.start(); o.stop(c.currentTime + 0.01);
  }

  /**
   * 単音
   * t: 開始までの秒, d: 長さ, v: 音量, type: 波形, to: 終了周波数(グライド),
   * vib: [速さHz, 深さHz], lp: ローパス周波数, a: アタック秒
   */
  function tone(freq, t, d, o) {
    if (!enabled || !ensure()) return;
    const opt = o || {};
    const now = ctx.currentTime + (t || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (opt.to) osc.frequency.exponentialRampToValueAtTime(opt.to, now + (opt.glide || d));
    if (opt.detune) osc.detune.value = opt.detune;
    let out = osc;
    if (opt.lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = opt.lp;
      osc.connect(fl);
      out = fl;
    }
    if (opt.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opt.vib[0];
      lg.gain.value = opt.vib[1];
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(now); lfo.stop(now + d + 0.1);
    }
    const v = (opt.v == null ? 0.3 : opt.v);
    const a = opt.a || 0.008;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(v, now + a);
    if (opt.sustain) {
      g.gain.setValueAtTime(v, now + d * 0.7);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    out.connect(g); g.connect(master);
    osc.start(now);
    osc.stop(now + d + 0.05);
  }

  // ノイズ（打楽器・シャリシャリ用）
  function noise(t, d, o) {
    if (!enabled || !ensure()) return;
    const opt = o || {};
    const now = ctx.currentTime + (t || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = opt.filter || 'bandpass';
    fl.frequency.value = opt.freq || 3000;
    fl.Q.value = opt.q || 1;
    const g = ctx.createGain();
    const v = opt.v == null ? 0.3 : opt.v;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(v, now + (opt.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(now, Math.random() * 0.5);
    src.stop(now + d + 0.05);
  }

  // 和太鼓・ティンパニ風
  function drum(t, o) {
    const opt = o || {};
    tone(opt.f || 140, t, opt.d || 0.35, { to: opt.to || 50, v: opt.v || 0.6, glide: 0.18 });
    noise(t, 0.05, { freq: 800, q: 0.7, v: 0.2 });
  }

  function bell(freq, t, d, v) {
    tone(freq, t, d, { type: 'sine', v: v || 0.18 });
    tone(freq * 2.76, t, d * 0.5, { type: 'sine', v: (v || 0.18) * 0.35 });
    tone(freq * 5.4, t, d * 0.25, { type: 'sine', v: (v || 0.18) * 0.15 });
  }

  function brass(freq, t, d, v) {
    tone(freq, t, d, { type: 'sawtooth', lp: 2200, v: v || 0.16, a: 0.02, sustain: true });
    tone(freq * 1.005, t, d, { type: 'square', lp: 1600, v: (v || 0.16) * 0.4, a: 0.02, sustain: true });
  }

  function chord(names, t, d, kind, v) {
    names.forEach((n) => {
      if (kind === 'brass') brass(f(n), t, d, v);
      else tone(f(n), t, d, { type: kind || 'triangle', v: v || 0.12, sustain: true });
    });
  }

  /* ---------- 効果音パターン ---------- */
  const SFX = {
    // UI
    tap() { tone(1200, 0, 0.04, { v: 0.12, to: 900 }); },
    coin() { tone(f('B6'), 0, 0.08, { type: 'square', v: 0.08 }); tone(f('E7'), 0.07, 0.3, { type: 'square', v: 0.08 }); },
    cell() { tone(520, 0, 0.12, { to: 1040, v: 0.22, glide: 0.06 }); tone(1560, 0.04, 0.12, { v: 0.08 }); },
    reveal() { noise(0, 0.35, { filter: 'highpass', freq: 3500, v: 0.25 }); drum(0, { f: 110, to: 45, v: 0.5 }); },
    reach() {
      for (let i = 0; i < 6; i += 1) tone(i % 2 ? 1175 : 880, i * 0.11, 0.1, { type: 'square', v: 0.12 });
      tone(f('E6'), 0.7, 0.3, { type: 'square', v: 0.1, vib: [12, 30] });
    },
    tease() {
      tone(300, 0, 0.7, { type: 'sawtooth', to: 1800, lp: 3000, v: 0.14, vib: [18, 25], glide: 0.6 });
      bell(f('E7'), 0.62, 0.6, 0.1);
    },
    drumroll() {
      for (let i = 0; i < 26; i += 1) noise(i * 0.04, 0.05, { freq: 1800, q: 0.8, v: 0.06 + i * 0.008 });
    },
    lock() { tone(220, 0, 0.12, { type: 'square', v: 0.08, lp: 900 }); },
    newItem() { [f('C6'), f('E6'), f('G6'), f('C7')].forEach((fr, i) => bell(fr, i * 0.06, 0.5, 0.1)); },

    // ハズレ：ブッブー
    buzzer() {
      tone(140, 0, 0.16, { type: 'square', v: 0.16, lp: 1200 });
      tone(147, 0, 0.16, { type: 'square', v: 0.16, lp: 1200 });
      tone(140, 0.22, 0.6, { type: 'square', v: 0.16, lp: 1200, sustain: true });
      tone(147, 0.22, 0.6, { type: 'square', v: 0.16, lp: 1200, sustain: true });
    },
    // ハズレ：しょんぼりトロンボーン
    sadTrombone() {
      const n = ['G3', 'F#3', 'F3'];
      n.forEach((x, i) => tone(f(x), i * 0.38, 0.34, { type: 'sawtooth', lp: 1000, v: 0.18, a: 0.03, sustain: true }));
      tone(f('E3'), 1.14, 1.1, { type: 'sawtooth', lp: 1000, v: 0.18, a: 0.03, sustain: true, vib: [5.5, 6] });
    },
    // N：ポンッ
    pop() { tone(500, 0, 0.1, { to: 1200, v: 0.3, glide: 0.06 }); tone(900, 0.1, 0.12, { v: 0.15 }); },
    // N：ピコン
    pico() { tone(f('C6'), 0, 0.08, { type: 'square', v: 0.12 }); tone(f('G6'), 0.08, 0.22, { type: 'square', v: 0.12 }); },
    // R：ウキキッ
    monkey() {
      [0, 0.1, 0.2].forEach((t) => tone(700, t, 0.08, { type: 'triangle', to: 1700, v: 0.25, glide: 0.07 }));
      tone(900, 0.34, 0.22, { type: 'triangle', to: 2100, v: 0.25, glide: 0.12, vib: [25, 60] });
    },
    // R：キラキラ和音
    chime() {
      ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => tone(f(n), i * 0.08, 0.7, { type: 'triangle', v: 0.16 }));
      bell(f('G6'), 0.42, 0.8, 0.08);
    },
    // SR：お祭り（和太鼓＋笛）
    matsuri() {
      drum(0); drum(0.24); noise(0.48, 0.06, { freq: 2500, q: 2, v: 0.35 }); drum(0.62); drum(0.86, { f: 160 });
      ['A5', 'C6', 'D6', 'E6', 'D6'].forEach((n, i) => tone(f(n), 0.3 + i * 0.16, 0.18, { type: 'sine', v: 0.12, vib: [6, 8] }));
    },
    // SR：パッパッパーン
    fanfareSmall() {
      brass(f('C5'), 0, 0.1); brass(f('C5'), 0.13, 0.1); brass(f('C5'), 0.26, 0.1);
      chord(['C5', 'E5', 'G5'], 0.4, 0.6, 'brass', 0.1);
    },
    // SR：ひんやりベル
    ice() {
      ['E6', 'B6', 'G#6', 'E7', 'B6', 'F#7', 'E7', 'B7'].forEach((n, i) => bell(f(n), i * 0.065, 0.55, 0.1));
      noise(0, 0.6, { filter: 'highpass', freq: 7000, v: 0.05 });
    },
    // SR：房（ポンポンポン…チャリーン）
    bunch() {
      ['C6', 'D6', 'E6', 'G6', 'C7'].forEach((n, i) => tone(f(n), i * 0.08, 0.16, { type: 'triangle', v: 0.2 }));
      SFX.coin.call(null);
      tone(f('E7'), 0.45, 0.4, { type: 'square', v: 0.07 });
    },
    // SSR：キラリーン＋ファンファーレ
    kirarin() {
      tone(800, 0, 0.45, { to: 3200, v: 0.12, glide: 0.4 });
      [0.1, 0.18, 0.26, 0.34].forEach((t, i) => bell(f(['E6', 'G6', 'B6', 'E7'][i]), t, 0.5, 0.1));
      chord(['C5', 'E5', 'G5', 'C6'], 0.5, 0.9, 'brass', 0.09);
      bell(f('C7'), 0.55, 1.0, 0.1);
    },
    // SSR：王様のファンファーレ
    royal() {
      drum(0, { f: 90, to: 40, v: 0.6 });
      const seq = [['G4', 0, 0.12], ['C5', 0.14, 0.12], ['E5', 0.28, 0.12], ['G5', 0.42, 0.32], ['E5', 0.78, 0.12], ['G5', 0.92, 0.7]];
      seq.forEach(([n, t, d]) => brass(f(n), t, d, 0.15));
      chord(['C4', 'G4', 'C5'], 0.92, 0.7, 'brass', 0.07);
      drum(0.92, { f: 90, to: 40, v: 0.6 }); drum(1.1, { f: 70, to: 35, v: 0.5 });
    },
    // UR：虹色アルペジオ＋大ファンファーレ
    rainbow() {
      const up = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7'];
      up.forEach((n, i) => tone(f(n), i * 0.045, 0.3, { type: 'triangle', v: 0.13 }));
      noise(0.45, 1.4, { filter: 'highpass', freq: 6000, v: 0.08, a: 0.3 });
      drum(0.5, { f: 100, to: 40, v: 0.6 });
      chord(['C4', 'E4', 'G4', 'B4', 'D5'], 0.5, 1.4, 'brass', 0.07);
      ['E7', 'G7', 'C7', 'B6', 'D7', 'G7'].forEach((n, i) => bell(f(n), 0.6 + i * 0.12, 0.6, 0.07));
      chord(['C5', 'E5', 'G5', 'C6'], 1.25, 0.9, 'triangle', 0.08);
    },
  };

  function play(name) {
    if (!enabled || !SFX[name]) return;
    try { SFX[name](); } catch (e) { console.warn('sound error:', name, e); } // 音が鳴らなくても続行
  }

  /* ---------- こする音（連続ノイズ） ---------- */
  function scratchStart() {
    if (!enabled || !ensure() || scratchNode) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = 'bandpass';
    fl.frequency.value = 2600;
    fl.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start();
    scratchNode = { src, g, fl };
  }

  // intensity: 0〜1（指の速さ）
  function scratchSet(intensity) {
    if (!scratchNode) return;
    const now = ctx.currentTime;
    const v = Math.min(0.32, 0.03 + intensity * 0.3);
    scratchNode.g.gain.cancelScheduledValues(now);
    scratchNode.g.gain.setTargetAtTime(v, now, 0.015);
    scratchNode.fl.frequency.setTargetAtTime(2000 + intensity * 2500, now, 0.03);
    // 動きが止まったら自然に小さくなる
    scratchNode.g.gain.setTargetAtTime(0.0001, now + 0.08, 0.05);
  }

  function scratchStop() {
    if (!scratchNode) return;
    const n = scratchNode;
    scratchNode = null;
    const now = ctx.currentTime;
    n.g.gain.cancelScheduledValues(now);
    n.g.gain.setTargetAtTime(0.0001, now, 0.03);
    n.src.stop(now + 0.2);
  }

  /* ---------- 読み上げ（対応ブラウザのみ） ---------- */
  let voiceEnabled = false;
  function jaVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = window.speechSynthesis.getVoices();
    return vs.find((v) => /^ja/i.test(v.lang)) || null;
  }
  function speak(text, delay) {
    if (!voiceEnabled || !enabled || !('speechSynthesis' in window)) return;
    const v = jaVoice();
    if (!v) return;
    setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.voice = v;
        u.lang = 'ja-JP';
        u.rate = 1.05;
        u.pitch = 1.3;
        window.speechSynthesis.speak(u);
      } catch (e) { /* 無視 */ }
    }, delay || 0);
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }

  BS.sound = {
    play,
    unlock,
    scratchStart,
    scratchSet,
    scratchStop,
    speak,
    names: Object.keys(SFX),
    hasJaVoice: () => !!jaVoice(),
    setEnabled(v) { enabled = !!v; if (!enabled) scratchStop(); },
    setVoice(v) { voiceEnabled = !!v; },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = volume;
    },
    get enabled() { return enabled; },
  };
})(window.BS = window.BS || {});
