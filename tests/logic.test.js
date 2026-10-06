/* 抽選ロジック・保存処理のテスト（node --test で実行） */
const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.window = globalThis;
require('../assets/js/bananas.js');
require('../assets/js/cards.js');
require('../assets/js/storage.js');

const BS = globalThis.BS;
const N = 20000;

// 再現性のある乱数（mulberry32）
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const counts = (arr) => arr.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {});

test('バナナ定義：13種類・ID重複なし・必要な項目がある', () => {
  assert.equal(BS.BANANAS.length, 13);
  const ids = new Set(BS.BANANAS.map((b) => b.id));
  assert.equal(ids.size, 13);
  BS.BANANAS.forEach((b) => {
    assert.ok(BS.RARITY[b.rarity], `${b.id} のレアリティ`);
    assert.ok(b.name && b.desc && b.voice && b.sound, `${b.id} の項目`);
    assert.equal(b.points === 0, b.rarity === 'miss', `${b.id} のポイントとハズレ`);
    assert.match(BS.bananaSVG(b.id), /^<svg[\s\S]*<\/svg>$/);
  });
});

test('提供割合：すべて実在するバナナで、合計がおよそ100', () => {
  Object.entries(BS.ODDS).forEach(([name, odds]) => {
    Object.keys(odds).forEach((id) => assert.ok(BS.bananaById(id), `${name}: ${id}`));
    const sum = Object.values(odds).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 100) < 0.01, `${name} 合計 ${sum}`);
  });
});

test('single：結果とポイントが一致し、デイリー・ジャンボはハズレなし', () => {
  const rng = seeded(1);
  ['trial', 'daily', 'jumbo'].forEach((id) => {
    const card = BS.cardById(id);
    for (let i = 0; i < N; i += 1) {
      const o = BS.drawCard(card, rng);
      assert.equal(o.cells.length, 1);
      assert.equal(o.prize.bananaId, o.cells[0]);
      assert.equal(o.prize.points, BS.bananaById(o.cells[0]).points);
      assert.ok(['silver', 'gold', 'rainbow'].includes(o.coating));
      if (id !== 'trial') assert.ok(o.prize.points > 0, `${id} はハズレなし`);
      if (id === 'daily') assert.ok(BS.rarityOrder(o.prize.tier) >= BS.rarityOrder('R'));
      if (o.coating !== (card.baseCoating || 'silver')) {
        assert.ok(BS.rarityOrder(o.prize.tier) >= BS.rarityOrder('SSR'), '確定演出は SSR 以上のときだけ');
      }
    }
  });
});

test('single：出現率が提供割合に近い', () => {
  const rng = seeded(2);
  const card = BS.cardById('trial');
  const got = counts(Array.from({ length: N }, () => BS.drawCard(card, rng).cells[0]));
  BS.oddsPercent(card.odds).forEach(({ id, pct }) => {
    const actual = ((got[id] || 0) / N) * 100;
    assert.ok(Math.abs(actual - pct) < Math.max(0.6, pct * 0.15), `${id}: 期待 ${pct.toFixed(2)}% 実際 ${actual.toFixed(2)}%`);
  });
});

test('slot：3つそろえば当たり（×10）、そろわなければ0pt', () => {
  const rng = seeded(3);
  const card = BS.cardById('slot');
  let wins = 0;
  let reach = 0;
  for (let i = 0; i < N; i += 1) {
    const o = BS.drawCard(card, rng);
    assert.equal(o.cells.length, 3);
    const c = counts(o.cells);
    const max = Math.max(...Object.values(c));
    if (o.prize.points > 0) {
      wins += 1;
      assert.equal(max, 3);
      assert.equal(o.prize.points, BS.bananaById(o.cells[0]).points * 10);
      assert.deepEqual(o.winCells, [0, 1, 2]);
    } else {
      assert.ok(max < 3, 'ハズレなのに3つそろっている');
      assert.equal(o.prize.tier, 'miss');
      if (max === 2) reach += 1;
    }
  }
  assert.ok(Math.abs(wins / N - card.winRate) < 0.01, `当たり率 ${wins / N}`);
  assert.ok(reach / N >= card.reachRate - 0.01, `リーチ率 ${reach / N}`);
});

test('match3：当たりはちょうど1種類が3つ、ハズレはどれも2つまで', () => {
  const rng = seeded(4);
  const card = BS.cardById('match3');
  let wins = 0;
  for (let i = 0; i < N; i += 1) {
    const o = BS.drawCard(card, rng);
    assert.equal(o.cells.length, 6);
    const c = counts(o.cells);
    const triples = Object.keys(c).filter((k) => c[k] >= 3);
    if (o.prize.points > 0) {
      wins += 1;
      assert.deepEqual(triples, [o.prize.bananaId]);
      assert.equal(c[o.prize.bananaId], 3);
      assert.equal(o.prize.points, BS.bananaById(o.prize.bananaId).points * 3);
      assert.equal(o.winCells.length, 3);
      o.winCells.forEach((idx) => assert.equal(o.cells[idx], o.prize.bananaId));
    } else {
      assert.equal(triples.length, 0);
      assert.ok(Object.values(c).some((n) => n === 2), '惜しいペアが入っている');
    }
  }
  assert.ok(Math.abs(wins / N - card.winRate) < 0.015, `当たり率 ${wins / N}`);
});

test('pick：9マス、えらんだ3マスの合計ポイントになる', () => {
  const rng = seeded(5);
  const card = BS.cardById('pick');
  for (let i = 0; i < 2000; i += 1) {
    const o = BS.drawCard(card, rng);
    assert.equal(o.cells.length, 9);
    assert.equal(o.prize, null);
    const chosen = [0, 4, 8];
    const prize = BS.evaluatePick(o.cells, chosen);
    const sum = chosen.reduce((s, k) => s + BS.bananaById(o.cells[k]).points, 0);
    assert.equal(prize.points, sum);
    assert.deepEqual(prize.picked, chosen.map((k) => o.cells[k]));
    assert.equal(prize.tier === 'miss', sum === 0);
  }
});

test('storage：ポイントの増減・1日1回の制限・図鑑と履歴', () => {
  const store = BS.store;
  store.reset();
  const s = store.state;
  assert.equal(s.points, store.START_POINTS);

  const jumbo = BS.cardById('jumbo');
  assert.deepEqual(store.canPlay(jumbo), { ok: false, reason: 'points' });

  const daily = BS.cardById('daily');
  assert.equal(store.canPlay(daily).ok, true);
  const o = BS.drawCard(daily, seeded(6));
  store.startCard(daily, o);
  assert.equal(store.canPlay(daily).resume, true, '引きかけは「つづきから」');
  const r = store.finish(daily, o.prize);
  assert.equal(r.isNew, true);
  assert.deepEqual(store.canPlay(daily), { ok: false, reason: 'limit' });
  assert.equal(s.points, store.START_POINTS + o.prize.points);
  assert.equal(s.collection[o.prize.bananaId], 1);
  assert.equal(s.history.length, 1);

  // 日付が変わると回数が戻る
  s.daily.daily.date = '2000-01-01';
  assert.equal(store.canPlay(daily).ok, true);

  const slot = BS.cardById('slot');
  const before = s.points;
  const o2 = BS.drawCard(slot, seeded(7));
  store.startCard(slot, o2);
  assert.equal(s.points, before - slot.cost);
  store.finish(slot, o2.prize);
  assert.equal(s.points, before - slot.cost + o2.prize.points);
  assert.equal(s.stats.plays, 2);
});
