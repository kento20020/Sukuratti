/* スクラッチカードの種類と抽選ロジック */
(function (BS) {
  'use strict';

  // 暗号学的乱数（使えない環境では Math.random）
  function defaultRng() {
    try {
      const a = new Uint32Array(1);
      (window.crypto || window.msCrypto).getRandomValues(a);
      return a[0] / 4294967296;
    } catch (e) {
      return Math.random();
    }
  }

  // 重み付き抽選 odds = { bananaId: weight }
  function pickWeighted(odds, rng, exclude) {
    const entries = Object.keys(odds).filter((k) => !(exclude && exclude.includes(k)) && odds[k] > 0);
    const total = entries.reduce((s, k) => s + odds[k], 0);
    let r = rng() * total;
    for (let i = 0; i < entries.length; i += 1) {
      r -= odds[entries[i]];
      if (r < 0) return entries[i];
    }
    return entries[entries.length - 1];
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- 提供割合（重み） ---------- */
  const ODDS = {
    trial: { peel: 22, black: 13, green: 22, normal: 20, monkey: 9, sugar: 7, choco: 2.5, red: 1.8, bluejava: 1.2, bunch: 0.9, gold: 0.4, king: 0.15, rainbow: 0.05 },
    daily: { monkey: 35, sugar: 30, choco: 12, red: 9, bluejava: 7, bunch: 4.5, gold: 1.8, king: 0.5, rainbow: 0.2 },
    jumbo: { sugar: 15, choco: 18, red: 17, bluejava: 14, bunch: 14, gold: 13, king: 6, rainbow: 3 },
    slotWin: { green: 30, normal: 30, monkey: 15, sugar: 10, choco: 5, red: 4, bluejava: 3, bunch: 2, gold: 0.7, king: 0.2, rainbow: 0.1 },
    matchWin: { green: 18, normal: 22, monkey: 18, sugar: 15, choco: 9, red: 7, bluejava: 5, bunch: 3.5, gold: 1.8, king: 0.5, rainbow: 0.2 },
    pick: { peel: 18, black: 10, green: 18, normal: 20, monkey: 11, sugar: 9, choco: 4, red: 3, bluejava: 2.5, bunch: 2, gold: 1.6, king: 0.6, rainbow: 0.3 },
  };

  /* ---------- カード定義 ---------- */
  const CARDS = [
    {
      id: 'trial', name: 'おためしバナナくじ', short: 'おためし', catch: '何度でも無料！ まずはここから',
      cost: 0, perDay: 0, layout: 'single', theme: 'red', odds: ODDS.trial,
      rule: '銀色のところをこすると、バナナが1本出てきます。出たバナナのポイントがもらえます。',
    },
    {
      id: 'daily', name: 'きょうのバナナくじ', short: 'デイリー', catch: '1日1回無料・R以上確定！',
      cost: 0, perDay: 1, layout: 'single', theme: 'sunrise', odds: ODDS.daily,
      rule: '1日1回だけ引ける特別なくじ。ハズレなし、R以上のバナナが必ず出ます。毎日0時に回数が戻ります。',
    },
    {
      id: 'slot', name: 'バナナスロット', short: 'スロット', catch: '3つそろえばポイント10倍！',
      cost: 5, perDay: 0, layout: 'slot', theme: 'neon', winRate: 0.1, reachRate: 0.3, winOdds: ODDS.slotWin, fillOdds: ODDS.trial, multiplier: 10,
      rule: '3つのマスを削ろう。3つとも同じバナナならそのバナナのポイント×10！ 2つそろうと「リーチ」！',
    },
    {
      id: 'match3', name: '6マスそろえてバナナ', short: '6マス', catch: '同じバナナが3つでポイント3倍',
      cost: 10, perDay: 0, layout: 'match3', theme: 'green', winRate: 0.32, winOdds: ODDS.matchWin, fillOdds: ODDS.trial, multiplier: 3,
      rule: '6つのマスを全部削ろう。同じバナナが3つ出たら、そのバナナのポイント×3がもらえます。',
    },
    {
      id: 'pick', name: 'えらんで3つ！バナナハント', short: 'ハント', catch: '9マス中3マスだけ削れる運だめし',
      cost: 20, perDay: 0, layout: 'pick', theme: 'blue', picks: 3, odds: ODDS.pick,
      rule: '9つのマスから好きな3マスだけ削れます。削った3マスのポイントの合計がもらえます。',
    },
    {
      id: 'jumbo', name: 'ゴールデンジャンボ', short: 'ジャンボ', catch: 'SSR以上の確率が大幅アップ！',
      cost: 100, perDay: 0, layout: 'single', theme: 'gold', size: 'jumbo', baseCoating: 'gold', odds: ODDS.jumbo,
      rule: '大きな金色のスクラッチ。ハズレなし！ 金のバナナ・キングバナナ・虹色バナナが出やすい豪華版です。',
    },
  ];

  const cardById = {};
  CARDS.forEach((c) => { cardById[c.id] = c; });

  /* ---------- 判定ヘルパー ---------- */

  // ポイントからの演出ランク
  function tierFromPoints(p) {
    if (p <= 0) return 'miss';
    if (p < 10) return 'N';
    if (p < 30) return 'R';
    if (p < 150) return 'SR';
    if (p < 800) return 'SSR';
    return 'UR';
  }

  function maxTier(a, b) {
    return BS.rarityOrder(a) >= BS.rarityOrder(b) ? a : b;
  }

  // 結果オブジェクトを組み立てる
  function makePrize(bananaId, points, multiplier) {
    const b = BS.bananaById(bananaId);
    const tier = points > 0 ? maxTier(b.rarity, tierFromPoints(points)) : 'miss';
    return { bananaId, points, multiplier: multiplier || 1, tier };
  }

  // 確定演出（削る面の色）
  function chooseCoating(card, tier, rng) {
    const base = card.baseCoating || 'silver';
    if (tier === 'UR') {
      const r = rng();
      if (r < 0.5) return 'rainbow';
      if (r < 0.8) return 'gold';
      return base;
    }
    if (tier === 'SSR' && base === 'silver' && rng() < 0.35) return 'gold';
    return base;
  }

  // 同じバナナが max 個以下になるように埋める
  function fillCells(n, odds, rng, counts, max) {
    const out = [];
    let guard = 0;
    while (out.length < n && guard < 1000) {
      guard += 1;
      const full = Object.keys(counts).filter((k) => counts[k] >= max);
      const id = pickWeighted(odds, rng, full);
      if (!id || (counts[id] || 0) >= max) continue;
      counts[id] = (counts[id] || 0) + 1;
      out.push(id);
    }
    return out;
  }

  /* ---------- 抽選 ---------- */

  function drawSingle(card, rng) {
    const id = pickWeighted(card.odds, rng);
    const prize = makePrize(id, BS.bananaById(id).points, 1);
    return { cells: [id], prize, winCells: prize.points > 0 ? [0] : [] };
  }

  function drawSlot(card, rng) {
    const r = rng();
    let cells;
    let prize;
    if (r < card.winRate) {
      const id = pickWeighted(card.winOdds, rng);
      cells = [id, id, id];
      prize = makePrize(id, BS.bananaById(id).points * card.multiplier, card.multiplier);
      return { cells, prize, winCells: [0, 1, 2] };
    }
    if (r < card.winRate + card.reachRate) {
      // リーチはずれ：2つだけそろう
      const id = pickWeighted(card.winOdds, rng);
      const other = pickWeighted(card.fillOdds, rng, [id]);
      cells = shuffle([id, id, other], rng);
    } else {
      const counts = {};
      cells = fillCells(3, card.fillOdds, rng, counts, 1);
    }
    const lose = cells.find((c) => BS.bananaById(c).points === 0) || 'peel';
    prize = makePrize(lose, 0, 1);
    return { cells, prize, winCells: [] };
  }

  function drawMatch3(card, rng) {
    let cells;
    if (rng() < card.winRate) {
      const id = pickWeighted(card.winOdds, rng);
      const counts = { [id]: 3 };
      const rest = fillCells(3, card.fillOdds, rng, counts, 2);
      cells = shuffle([id, id, id].concat(rest), rng);
      const prize = makePrize(id, BS.bananaById(id).points * card.multiplier, card.multiplier);
      const winCells = cells.map((c, i) => (c === id ? i : -1)).filter((i) => i >= 0);
      return { cells, prize, winCells };
    }
    // はずれ：どのバナナも2個まで。惜しさを出すため最低1ペアは入れる
    const pairId = pickWeighted(card.winOdds, rng);
    const counts = { [pairId]: 2 };
    const rest = fillCells(4, card.fillOdds, rng, counts, 2);
    cells = shuffle([pairId, pairId].concat(rest), rng);
    const lose = cells.find((c) => BS.bananaById(c).points === 0) || 'peel';
    return { cells, prize: makePrize(lose, 0, 1), winCells: [] };
  }

  function drawPick(card, rng) {
    const cells = [];
    for (let i = 0; i < 9; i += 1) cells.push(pickWeighted(card.odds, rng));
    return { cells, prize: null, winCells: [] };
  }

  // えらんで削るタイプの結果計算
  function evaluatePick(cells, chosen) {
    const ids = chosen.map((i) => cells[i]);
    const points = ids.reduce((s, id) => s + BS.bananaById(id).points, 0);
    // いちばんレアなバナナを代表にする
    let best = ids[0];
    ids.forEach((id) => {
      const a = BS.bananaById(id);
      const b = BS.bananaById(best);
      if (BS.rarityOrder(a.rarity) > BS.rarityOrder(b.rarity) || (a.rarity === b.rarity && a.points > b.points)) best = id;
    });
    const prize = makePrize(best, points, 1);
    prize.picked = ids;
    return prize;
  }

  /**
   * カードを1枚抽選する
   * @returns {{cardId, cells, prize, winCells, coating}}
   */
  function draw(cardOrId, rngIn) {
    const rng = rngIn || defaultRng;
    const card = typeof cardOrId === 'string' ? cardById[cardOrId] : cardOrId;
    let res;
    switch (card.layout) {
      case 'slot': res = drawSlot(card, rng); break;
      case 'match3': res = drawMatch3(card, rng); break;
      case 'pick': res = drawPick(card, rng); break;
      default: res = drawSingle(card, rng);
    }
    res.cardId = card.id;
    res.coating = res.prize ? chooseCoating(card, res.prize.tier, rng) : (card.baseCoating || 'silver');
    return res;
  }

  // 提供割合を % に変換（表示用）
  function oddsPercent(odds) {
    const total = Object.keys(odds).reduce((s, k) => s + odds[k], 0);
    return Object.keys(odds).map((k) => ({ id: k, pct: (odds[k] / total) * 100 }));
  }

  BS.CARDS = CARDS;
  BS.ODDS = ODDS;
  BS.cardById = (id) => cardById[id];
  BS.drawCard = draw;
  BS.evaluatePick = evaluatePick;
  BS.oddsPercent = oddsPercent;
  BS.tierFromPoints = tierFromPoints;
  BS.rng = defaultRng;
  BS._internal = { pickWeighted, shuffle, fillCells };
})(window.BS = window.BS || {});
