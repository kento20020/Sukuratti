/* 保存データ（localStorage。使えない環境ではメモリ上だけで動く） */
(function (BS) {
  'use strict';

  const KEY = 'bananaScratch.v1';
  const START_POINTS = 50;
  const HISTORY_MAX = 60;

  function today(d) {
    const x = d || new Date();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${x.getFullYear()}-${m}-${day}`;
  }

  function fresh() {
    return {
      points: START_POINTS,
      collection: {}, // { bananaId: 回数 }
      history: [], // 新しい順
      daily: {}, // { cardId: { date, used } }
      pending: {}, // { cardId: { outcome, revealed: [], chosen: [] } }
      stats: { plays: 0, earned: 0, spent: 0, best: null },
      settings: { sound: true, voice: false, vibrate: true, volume: 0.7 },
    };
  }

  let state = fresh();
  let persistent = true;

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const base = fresh();
        state = Object.assign(base, saved);
        state.settings = Object.assign(fresh().settings, saved.settings || {});
        state.stats = Object.assign(fresh().stats, saved.stats || {});
      }
    } catch (e) {
      persistent = false;
    }
    return state;
  }

  function save() {
    if (!persistent) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      persistent = false;
    }
  }

  function reset() {
    state = fresh();
    save();
    return state;
  }

  /* ---------- 1日あたりの回数 ---------- */
  function usedToday(cardId) {
    const d = state.daily[cardId];
    return d && d.date === today() ? d.used : 0;
  }

  function markUsed(cardId) {
    const t = today();
    const d = state.daily[cardId];
    state.daily[cardId] = { date: t, used: d && d.date === t ? d.used + 1 : 1 };
  }

  /**
   * カードを引けるか
   * @returns {{ok: boolean, reason?: string}}
   */
  function canPlay(card) {
    if (state.pending[card.id]) return { ok: true, resume: true };
    if (card.perDay && usedToday(card.id) >= card.perDay) return { ok: false, reason: 'limit' };
    if (card.cost > state.points) return { ok: false, reason: 'points' };
    return { ok: true };
  }

  /* ---------- 結果の反映 ---------- */
  function startCard(card, outcome) {
    state.points -= card.cost;
    state.stats.spent += card.cost;
    if (card.perDay) markUsed(card.id);
    state.pending[card.id] = { outcome, revealed: [], chosen: [] };
    save();
  }

  function updatePending(cardId, patch) {
    const p = state.pending[cardId];
    if (!p) return;
    Object.assign(p, patch);
    save();
  }

  /**
   * 結果を確定してポイント・図鑑・履歴に反映
   * @returns {{isNew: boolean, newIds: string[]}}
   */
  function finish(card, prize) {
    delete state.pending[card.id];
    state.points += prize.points;
    state.stats.plays += 1;
    state.stats.earned += prize.points;
    if (!state.stats.best || prize.points > state.stats.best.points) {
      state.stats.best = { bananaId: prize.bananaId, points: prize.points, cardId: card.id };
    }
    const ids = prize.picked ? prize.picked : [prize.bananaId];
    const newIds = [];
    ids.forEach((id) => {
      if (!state.collection[id]) newIds.push(id);
      state.collection[id] = (state.collection[id] || 0) + 1;
    });
    state.history.unshift({
      t: Date.now(), cardId: card.id, bananaId: prize.bananaId, points: prize.points, tier: prize.tier, cost: card.cost,
    });
    if (state.history.length > HISTORY_MAX) state.history.length = HISTORY_MAX;
    save();
    return { isNew: newIds.includes(prize.bananaId), newIds: Array.from(new Set(newIds)) };
  }

  BS.store = {
    load,
    save,
    reset,
    today,
    usedToday,
    canPlay,
    startCard,
    updatePending,
    finish,
    get state() { return state; },
    get persistent() { return persistent; },
    START_POINTS,
  };
})(window.BS = window.BS || {});
