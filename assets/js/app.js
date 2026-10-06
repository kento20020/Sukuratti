/* 画面とルーティング */
(function (BS) {
  'use strict';

  const store = BS.store;
  const sound = BS.sound;
  const fx = BS.fx;

  const view = document.getElementById('view');
  const sheetRoot = document.getElementById('sheetRoot');
  const toastEl = document.getElementById('toast');
  const liveEl = document.getElementById('live');
  const pointsValue = document.getElementById('pointsValue');
  const pointsPill = document.getElementById('pointsPill');
  const soundBtn = document.getElementById('soundBtn');
  const backBtn = document.getElementById('backBtn');
  const topbarTitle = document.getElementById('topbarTitle');
  const brand = document.getElementById('brand');
  const tabbar = document.getElementById('tabbar');

  const TIER_TITLE = {
    miss: 'ざんねん…',
    N: 'あたり！',
    R: 'あたり！',
    SR: '大あたり！',
    SSR: '超大あたり！！',
    UR: '奇跡の大あたり！！！',
  };

  const SOUND_LABELS = {
    buzzer: 'ハズレ（ブッブー）', sadTrombone: 'ハズレ（しょんぼり）', pop: '青いバナナ（ポンッ）', pico: 'ふつうのバナナ（ピコン）',
    monkey: 'モンキー（ウキキッ）', chime: 'シュガースポット（キラキラ）', matsuri: 'チョコバナナ（お祭り）', fanfareSmall: '赤いバナナ（パッパッパーン）',
    ice: 'ブルージャバ（ひんやり）', bunch: 'バナナの房（ポンポン）', kirarin: '金のバナナ（キラリーン）', royal: 'キング（ファンファーレ）',
    rainbow: '虹色（大ファンファーレ）', reach: 'リーチ！', tease: '確定演出（キュイーン）', drumroll: 'ドラムロール', reveal: 'オープン（ジャン！）',
    coin: 'ポイント（チャリン）', cell: 'マスがひらく', newItem: '図鑑に登録', lock: 'ロック', tap: 'タップ',
  };

  let cleanupFn = null;
  let displayedPoints = 0;

  /* ---------- ユーティリティ ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const fmt = (n) => Number(n).toLocaleString('ja-JP');
  const banana = (id) => BS.bananaById(id);

  function announce(text) {
    liveEl.textContent = '';
    setTimeout(() => { liveEl.textContent = text; }, 30);
  }

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2200);
  }

  function costLabel(card) {
    if (card.cost === 0) return card.perDay ? `1日${card.perDay}回 無料` : '無料';
    return `${fmt(card.cost)}pt`;
  }

  // ヘッダーのポイント表示（増減をカウントアニメーション）
  function updatePoints(animate) {
    const target = store.state.points;
    if (!animate || fx.reduceMotion()) {
      displayedPoints = target;
      pointsValue.textContent = fmt(target);
      return;
    }
    const from = displayedPoints;
    const t0 = performance.now();
    const dur = 700;
    pointsPill.classList.add('is-bump');
    setTimeout(() => pointsPill.classList.remove('is-bump'), 600);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      pointsValue.textContent = fmt(v);
      if (k < 1) requestAnimationFrame(step);
      else displayedPoints = target;
    };
    requestAnimationFrame(step);
  }

  function applySettings() {
    const s = store.state.settings;
    sound.setEnabled(s.sound);
    sound.setVoice(s.voice);
    sound.setVolume(s.volume);
    soundBtn.setAttribute('aria-pressed', s.sound ? 'true' : 'false');
    soundBtn.classList.toggle('is-off', !s.sound);
  }

  function collectionCount() {
    return BS.BANANAS.filter((b) => store.state.collection[b.id]).length;
  }

  /* ---------- ルーティング ---------- */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/');
    return { name: parts[0] || 'home', arg: parts[1] };
  }

  function route() {
    if (cleanupFn) { cleanupFn(); cleanupFn = null; }
    closeSheet(true);
    fx.clear();
    // カウントアップ途中で画面を移動しても表示をずらさない
    if (displayedPoints !== store.state.points) updatePoints(false);
    const r = parseHash();
    const isCard = r.name === 'card';
    document.body.classList.toggle('is-card', isCard);
    backBtn.hidden = !isCard;
    brand.hidden = isCard;
    topbarTitle.hidden = !isCard;
    tabbar.querySelectorAll('a').forEach((a) => {
      a.classList.toggle('is-active', a.dataset.tab === r.name);
      if (a.dataset.tab === r.name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    switch (r.name) {
      case 'card': renderCard(r.arg); break;
      case 'zukan': renderZukan(); break;
      case 'history': renderHistory(); break;
      case 'settings': renderSettings(); break;
      default: renderHome();
    }
    window.scrollTo(0, 0);
  }

  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  /* ---------- ホーム ---------- */
  function miniBoard(card) {
    const n = { single: 1, slot: 3, match3: 6, pick: 9 }[card.layout] || 1;
    let cells = '';
    for (let i = 0; i < n; i += 1) cells += '<span class="mini-cell"></span>';
    return `<div class="mini-board mini-${card.layout}${card.size ? ` mini-${card.size}` : ''}">${cells}</div>`;
  }

  function tileState(card) {
    const st = store.canPlay(card);
    if (st.resume) return { cls: 'is-resume', badge: '<span class="badge badge-resume">つづきから</span>', ok: true };
    if (!st.ok && st.reason === 'limit') return { cls: 'is-disabled', badge: '<span class="badge badge-muted">また明日</span>', ok: false, reason: st.reason };
    if (!st.ok && st.reason === 'points') return { cls: 'is-disabled', badge: '<span class="badge badge-muted">ポイント不足</span>', ok: false, reason: st.reason };
    if (card.perDay) return { cls: '', badge: `<span class="badge badge-hot">残り${card.perDay - store.usedToday(card.id)}回</span>`, ok: true };
    return { cls: '', badge: '', ok: true };
  }

  function renderHome() {
    const s = store.state;
    const daily = BS.cardById('daily');
    const dailyOk = store.canPlay(daily).ok;
    const found = collectionCount();
    const tiles = BS.CARDS.map((card) => {
      const t = tileState(card);
      return `<li>
        <a class="card-tile theme-${card.theme} ${t.cls}" href="#/card/${card.id}" data-card="${card.id}" ${t.ok ? '' : 'aria-disabled="true"'}>
          <div class="tile-thumb">${miniBoard(card)}<span class="tile-thumb-banana">${BS.bananaSVG(card.id === 'jumbo' ? 'gold' : card.id === 'daily' ? 'sugar' : 'normal')}</span></div>
          <div class="tile-body">
            <div class="tile-name">${esc(card.name)}</div>
            <div class="tile-catch">${esc(card.catch)}</div>
            <div class="tile-badges"><span class="badge ${card.cost ? 'badge-cost' : 'badge-free'}">${costLabel(card)}</span>${t.badge}</div>
          </div>
          <span class="tile-arrow" aria-hidden="true">›</span>
        </a>
      </li>`;
    }).join('');

    view.innerHTML = `
      <section class="hero">
        <div class="hero-card">
          <div class="hero-row">
            <div>
              <div class="hero-label">保有バナナポイント</div>
              <div class="hero-points"><span class="num">${fmt(s.points)}</span><span class="unit">pt</span></div>
            </div>
            <div class="hero-mascot">${BS.bananaSVG('normal')}</div>
          </div>
          <div class="hero-meta">
            <a href="#/zukan" class="hero-chip">図鑑 <b>${found}</b>/${BS.BANANAS.length}</a>
            <a href="#/history" class="hero-chip">あそんだ回数 <b>${fmt(s.stats.plays)}</b></a>
          </div>
        </div>
      </section>

      <a class="daily-banner ${dailyOk ? '' : 'is-done'}" href="#/card/daily" data-card="daily" ${dailyOk ? '' : 'aria-disabled="true"'}>
        <div class="daily-text">
          <span class="daily-kicker">${dailyOk ? '本日のチャンス' : '本日分は終了'}</span>
          <strong>${dailyOk ? 'きょうのバナナくじ' : 'また明日きてね'}</strong>
          <span>${dailyOk ? 'R以上確定！ 1日1回無料' : '毎日0時に回数が戻ります'}</span>
        </div>
        <div class="daily-icon">${BS.bananaSVG(dailyOk ? 'sugar' : 'green')}</div>
      </a>

      <section class="section">
        <h2 class="section-title">スクラッチをえらぶ</h2>
        <ul class="card-list">${tiles}</ul>
      </section>

      <section class="section howto">
        <h2 class="section-title">あそびかた</h2>
        <ol class="howto-list">
          <li><span class="howto-num">1</span><div><b>スクラッチをえらぶ</b><p>無料のものからジャンボまで6種類。</p></div></li>
          <li><span class="howto-num">2</span><div><b>指やマウスでこする</b><p>銀色の面をけずるとバナナが出てくるよ。音も鳴るよ！</p></div></li>
          <li><span class="howto-num">3</span><div><b>ポイントゲット＆図鑑あつめ</b><p>全${BS.BANANAS.length}種類のバナナをコンプリートしよう。</p></div></li>
        </ol>
      </section>

      <p class="footnote">※ポイントは遊び用の架空のものです。現金・電子マネー・実在の決済サービスとは一切関係ありません。データはこのブラウザ内にだけ保存されます。</p>
    `;

    view.querySelectorAll('[data-card]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (el.getAttribute('aria-disabled') === 'true') {
          e.preventDefault();
          const st = store.canPlay(BS.cardById(el.dataset.card));
          toast(st.reason === 'limit' ? '今日はもう引きました。また明日！' : 'ポイントが足りません。おためしくじで貯めよう！');
          sound.play('lock');
          fx.shake(el);
        } else {
          sound.play('tap');
        }
      });
    });
  }

  /* ---------- スクラッチ画面 ---------- */
  function cellContent(id, big) {
    const b = banana(id);
    const pts = b.points > 0 ? `+${fmt(b.points)}pt` : 'ハズレ';
    return `<div class="cell-content rarity-${b.rarity}">
      <div class="cell-banana">${BS.bananaSVG(id)}</div>
      <div class="cell-name">${esc(b.name)}</div>
      ${big ? `<div class="cell-points">${pts}</div>` : `<div class="cell-points small">${pts}</div>`}
    </div>`;
  }

  function statusText(card, ctx) {
    switch (card.layout) {
      case 'slot': return '3つのマスを削って、同じバナナを3つそろえよう！';
      case 'match3': return '6マスを全部削ろう！ 同じバナナ3つで当たり';
      case 'pick': return `好きなマスを${card.picks}つえらんで削ってね（のこり${card.picks - ctx.chosen.length}マス）`;
      default: return card.size === 'jumbo' ? '金色の面をこすって、豪華バナナを当てよう！' : '銀色のところを指でこすってね！';
    }
  }

  function renderCard(cardId) {
    const card = BS.cardById(cardId);
    if (!card) { go('#/'); return; }
    const st = store.canPlay(card);
    if (!st.ok) {
      toast(st.reason === 'limit' ? '今日はもう引きました。また明日！' : 'ポイントが足りません。おためしくじで貯めよう！');
      go('#/');
      return;
    }

    // 抽選（つづきの場合は保存済みの結果を使う）
    let pending = store.state.pending[card.id];
    if (!pending) {
      const outcome = BS.drawCard(card);
      outcome.serial = String(Math.floor(BS.rng() * 900000) + 100000);
      store.startCard(card, outcome);
      pending = store.state.pending[card.id];
      updatePoints(true);
    }
    const outcome = pending.outcome;
    const ctx = {
      card, outcome, areas: [], chosen: pending.chosen.slice(), revealed: new Set(pending.revealed), finished: false,
      reachShown: false, drumShown: false, timers: [],
    };

    topbarTitle.textContent = card.name;
    const big = card.layout === 'single';
    const cells = outcome.cells.map((id, i) => `<div class="cell" data-i="${i}" tabindex="0" role="button" aria-label="マス${i + 1}を削る">${cellContent(id, big)}</div>`).join('');
    const premium = outcome.coating !== (card.baseCoating || 'silver');

    view.innerHTML = `
      <section class="play theme-${card.theme}">
        <div class="play-glow" aria-hidden="true"></div>
        <div class="ticket ticket--${card.layout}${card.size ? ` ticket--${card.size}` : ''}" id="ticket">
          <div class="ticket-head">
            <span class="ticket-kicker">BANANA SCRATCH CHANCE</span>
            <h2 class="ticket-title">${esc(card.name)}</h2>
            <p class="ticket-rule">${esc(card.rule)}</p>
          </div>
          ${premium ? `<div class="premium-badge coating-${outcome.coating}">${outcome.coating === 'rainbow' ? '虹色の予感…！？' : '金色に光ってる…！？'}</div>` : ''}
          <div class="board board--${card.layout}${card.size ? ` board--${card.size}` : ''}" id="board">${cells}</div>
          <div class="ticket-foot">
            <button type="button" class="link-btn" id="oddsBtn">提供割合</button>
            <span class="serial">No.${esc(outcome.serial || '000000')}</span>
          </div>
        </div>
        <p class="play-status" id="playStatus">${esc(statusText(card, ctx))}</p>
        <div class="play-actions">
          <button type="button" class="btn btn-white" id="autoBtn">${card.layout === 'pick' ? 'おまかせで削る' : 'まとめて削る'}</button>
        </div>
      </section>
    `;

    const board = document.getElementById('board');
    const statusEl = document.getElementById('playStatus');
    const autoBtn = document.getElementById('autoBtn');
    const setStatus = (t, cls) => {
      statusEl.textContent = t;
      statusEl.className = `play-status${cls ? ` ${cls}` : ''}`;
    };

    // 指ヒント
    const hint = document.createElement('div');
    hint.className = 'hint-hand';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span class="hint-finger">👆</span><span class="hint-bubble">こすってね！</span>';
    if (!ctx.revealed.size && !ctx.chosen.length) board.appendChild(hint);
    const hideHint = () => hint.classList.add('is-hidden');

    const label = card.layout === 'single' ? (card.size === 'jumbo' ? 'GOLDEN SCRATCH' : 'けずってね') : '？';
    const sub = card.layout === 'single' ? 'SCRATCH HERE' : '';

    const cellEls = Array.from(board.querySelectorAll('.cell'));
    cellEls.forEach((el, i) => {
      const area = new BS.ScratchArea(el, {
        coating: outcome.coating,
        label,
        sub,
        threshold: card.layout === 'single' ? 0.55 : 0.45,
        brush: card.layout === 'single' ? 0.075 : 0.12,
        canStart: () => {
          if (ctx.finished) return false;
          if (card.layout !== 'pick') return true;
          if (ctx.chosen.includes(i)) return true;
          if (ctx.chosen.length < card.picks) return true;
          sound.play('lock');
          fx.shake(el);
          toast(`えらべるのは${card.picks}マスまで！`);
          return false;
        },
        onStart: () => {
          sound.unlock();
          hideHint();
          if (card.layout === 'pick' && !ctx.chosen.includes(i)) {
            ctx.chosen.push(i);
            el.classList.add('is-chosen');
            store.updatePending(card.id, { chosen: ctx.chosen.slice() });
            const left = card.picks - ctx.chosen.length;
            if (left > 0) setStatus(`のこり${left}マスえらべます`);
            else {
              setStatus('3マスえらんだよ！ 最後まで削ってね');
              ctx.areas.forEach((a, j) => { if (!ctx.chosen.includes(j)) a.setLocked(true); });
            }
          }
        },
        onMove: (a, speed) => {
          if (speed < 0) { sound.scratchStop(); return; }
          sound.scratchStart();
          sound.scratchSet(speed);
          fx.vibrate(6, 70);
        },
        onProgress: (a, p) => {
          if (card.size === 'jumbo' && !ctx.drumShown && p > 0.22) {
            ctx.drumShown = true;
            sound.play('drumroll');
            el.classList.add('is-tension');
          }
        },
        onReveal: (a, silent) => onCellReveal(ctx, i, silent),
      });
      ctx.areas.push(area);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sound.unlock();
          area.autoScratch(600);
        }
      });
    });

    // つづきから：削り済みマスとロック状態を復元
    if (ctx.chosen.length) {
      ctx.chosen.forEach((i) => cellEls[i].classList.add('is-chosen'));
      if (ctx.chosen.length >= (card.picks || 99)) ctx.areas.forEach((a, j) => { if (!ctx.chosen.includes(j)) a.setLocked(true); });
      setStatus(statusText(card, ctx));
    }
    Array.from(ctx.revealed).forEach((i) => ctx.areas[i].reveal(true));

    function onCellReveal(c, i, silent) {
      if (!c.revealed.has(i)) {
        c.revealed.add(i);
        store.updatePending(card.id, { revealed: Array.from(c.revealed) });
      }
      if (!silent && card.layout !== 'single') {
        sound.play('cell');
        fx.vibrate(15);
      }
      afterReveal(c, silent);
    }

    function afterReveal(c) {
      if (c.finished || c.closing) return;
      const L = card.layout;
      const n = outcome.cells.length;
      if (L === 'single') { finishCard(c); return; }
      if (L === 'pick') {
        const done = c.chosen.length >= card.picks && c.chosen.every((i) => c.revealed.has(i));
        if (done) {
          // 選ばなかったマスも見せる
          c.closing = true;
          c.areas.forEach((a, j) => {
            if (!c.chosen.includes(j)) {
              cellEls[j].classList.add('is-missed');
              a.setLocked(false);
              a.reveal(true);
            }
          });
          finishCard(c);
        } else {
          const left = c.chosen.filter((i) => !c.revealed.has(i)).length + (card.picks - c.chosen.length);
          setStatus(`のこり${left}マス`);
        }
        return;
      }
      const opened = c.revealed.size;
      if (L === 'slot' && opened === 2 && !c.reachShown) {
        const ids = Array.from(c.revealed).map((i) => outcome.cells[i]);
        if (ids[0] === ids[1]) {
          c.reachShown = true;
          setStatus('リーチ！！ 最後のマスは…？', 'is-reach');
          board.classList.add('is-reach');
          sound.play('reach');
          fx.vibrate([40, 40, 40]);
          announce('リーチ');
        }
      }
      if (opened >= n) finishCard(c);
      else if (!c.reachShown) setStatus(`あと${n - opened}マス`);
    }

    function finishCard(c) {
      if (c.finished) return;
      c.finished = true;
      sound.scratchStop();
      autoBtn.disabled = true;
      board.classList.remove('is-reach');
      const prize = card.layout === 'pick' ? BS.evaluatePick(outcome.cells, c.chosen) : outcome.prize;
      const res = store.finish(card, prize);
      // 当たりマスを光らせる
      const winCells = card.layout === 'pick' ? c.chosen.filter((i) => banana(outcome.cells[i]).points > 0) : outcome.winCells;
      winCells.forEach((i) => cellEls[i].classList.add('is-win'));
      if (prize.points > 0) document.getElementById('ticket').classList.add(`is-win-${prize.tier}`);
      setStatus(prize.points > 0 ? `${TIER_TITLE[prize.tier]} +${fmt(prize.points)}pt` : 'ざんねん…またチャレンジしてね', prize.points > 0 ? 'is-win' : 'is-miss');
      c.timers.push(setTimeout(() => showResult(card, prize, res), card.layout === 'single' ? 450 : 750));
    }

    // まとめて削る / おまかせ
    autoBtn.addEventListener('click', async () => {
      sound.unlock();
      hideHint();
      autoBtn.disabled = true;
      if (card.layout === 'pick') {
        const pool = ctx.areas.map((a, i) => i).filter((i) => !ctx.chosen.includes(i));
        while (ctx.chosen.length < card.picks && pool.length) {
          const k = Math.floor(BS.rng() * pool.length);
          const i = pool.splice(k, 1)[0];
          await ctx.areas[i].autoScratch(500);
        }
        for (const i of ctx.chosen.slice()) {
          if (!ctx.areas[i].revealed) await ctx.areas[i].autoScratch(500);
        }
      } else {
        for (const a of ctx.areas) {
          if (!a.revealed) await a.autoScratch(card.layout === 'single' ? 900 : 420);
        }
      }
    });

    document.getElementById('oddsBtn').addEventListener('click', () => openOdds(card));

    // 確定演出
    if (premium && !ctx.revealed.size) {
      ctx.timers.push(setTimeout(() => {
        sound.play('tease');
        fx.flash(outcome.coating === 'rainbow' ? 'rainbow' : 'gold');
      }, 350));
    }

    cleanupFn = () => {
      ctx.timers.forEach(clearTimeout);
      ctx.areas.forEach((a) => a.destroy());
      sound.scratchStop();
    };
  }

  /* ---------- 結果シート ---------- */
  function showResult(card, prize, res) {
    const b = banana(prize.bananaId);
    const tier = prize.tier;
    const win = prize.points > 0;
    const again = store.canPlay(card);
    const againLabel = card.cost ? `もう1回（${fmt(card.cost)}pt）` : 'もう1回引く';

    let picked = '';
    if (prize.picked) {
      picked = `<ul class="result-picked">${prize.picked.map((id) => {
        const x = banana(id);
        return `<li class="rarity-${x.rarity}">${BS.bananaSVG(id)}<span>${esc(x.name)}</span><b>${x.points ? `+${x.points}` : '0'}pt</b></li>`;
      }).join('')}</ul>`;
    }
    const mult = prize.multiplier > 1 ? `<div class="result-mult">${esc(b.name)} ${fmt(b.points)}pt × ${prize.multiplier} ${card.layout === 'slot' ? 'スロットボーナス' : 'そろいボーナス'}</div>` : '';
    const newBadge = res.isNew ? '<span class="new-badge">NEW!</span>' : '';
    let desc = `<p class="result-desc">${esc(b.desc)}</p>`;
    if (!win && card.layout === 'pick') desc = '<p class="result-desc">次はいいマスをえらべますように！</p>';
    else if (!win && card.layout !== 'single') desc = '<p class="result-desc">次こそ、そろえよう！</p>';
    const title = win ? TIER_TITLE[tier] : TIER_TITLE.miss;

    const html = `
      <div class="sheet result tier-${tier}" role="dialog" aria-modal="true" aria-labelledby="resultTitle">
        <div class="result-rays" aria-hidden="true"></div>
        <div class="result-inner">
          <div class="result-head">
            <span class="tier-badge tier-${tier}">${win ? BS.RARITY[tier].label : 'ハズレ'}</span>
            <h2 id="resultTitle" class="result-title">${title}</h2>
          </div>
          <div class="result-banana">${BS.bananaSVG(prize.bananaId)}</div>
          <div class="result-name">${prize.picked ? '' : esc(b.name)} ${prize.picked ? '' : newBadge}</div>
          ${picked}
          <div class="result-points ${win ? '' : 'is-zero'}">${win ? '+' : ''}<span id="resultCount">${win ? 0 : 0}</span><small>pt</small></div>
          ${mult}
          ${res.newIds.length && prize.picked ? `<div class="result-new">図鑑に ${res.newIds.length}種類 登録！</div>` : ''}
          ${desc}
          <div class="result-actions">
            <button type="button" class="btn btn-primary" data-act="again" ${again.ok ? '' : 'disabled'}>${again.ok ? againLabel : (again.reason === 'limit' ? 'また明日引けます' : 'ポイント不足')}</button>
            <div class="btn-row">
              <button type="button" class="btn btn-ghost" data-act="share">シェア</button>
              <button type="button" class="btn btn-ghost" data-act="zukan">図鑑</button>
              <button type="button" class="btn btn-ghost" data-act="home">ホーム</button>
            </div>
          </div>
        </div>
      </div>`;
    const sheet = openSheet(html, { cls: `result-backdrop tier-${tier}`, onClose: null });

    // 音・演出
    if (BS.rarityOrder(tier) >= BS.rarityOrder('SSR')) sound.play('reveal');
    setTimeout(() => sound.play(b.sound), BS.rarityOrder(tier) >= BS.rarityOrder('SSR') ? 180 : 0);
    const voice = win ? (prize.multiplier > 1 ? `${b.voice}。ポイント${prize.multiplier}倍` : (prize.picked ? `あたり。合計${prize.points}ポイント` : b.voice)) : (prize.picked ? 'ざんねん' : b.voice);
    sound.speak(voice, 500);
    announce(`${title} ${prize.picked ? '' : b.name} ${fmt(prize.points)}ポイント`);
    if (win) {
      const r = sheet.querySelector('.result-banana').getBoundingClientRect();
      fx.confetti(tier, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      if (tier === 'UR') fx.flash('rainbow');
      else if (tier === 'SSR') fx.flash('gold');
      fx.vibrate(tier === 'UR' || tier === 'SSR' ? [80, 60, 80, 60, 200] : [50]);
      if (res.isNew || (prize.picked && res.newIds.length)) setTimeout(() => sound.play('newItem'), 1100);
    } else {
      fx.shake(sheet.querySelector('.result-banana'));
      fx.vibrate([30, 60, 30]);
    }

    // ポイントのカウントアップ
    const countEl = sheet.querySelector('#resultCount');
    if (win) {
      const dur = Math.min(1400, 400 + prize.points * 2);
      const t0 = performance.now() + 350;
      let lastTick = 0;
      const step = (now) => {
        const k = Math.max(0, Math.min(1, (now - t0) / dur));
        const v = Math.round(prize.points * (1 - Math.pow(1 - k, 3)));
        countEl.textContent = fmt(v);
        if (k > 0 && now - lastTick > 90 && k < 1) { lastTick = now; sound.play('tap'); }
        if (k < 1 && sheet.isConnected) requestAnimationFrame(step);
        else if (sheet.isConnected) { sound.play('coin'); updatePoints(true); }
      };
      requestAnimationFrame(step);
    } else {
      updatePoints(false);
    }

    sheet.querySelector('[data-act="again"]').addEventListener('click', () => { sound.play('tap'); closeSheet(); go(`#/card/${card.id}`); });
    sheet.querySelector('[data-act="home"]').addEventListener('click', () => { closeSheet(); go('#/'); });
    sheet.querySelector('[data-act="zukan"]').addEventListener('click', () => { closeSheet(); go('#/zukan'); });
    sheet.querySelector('[data-act="share"]').addEventListener('click', () => share(card, prize));
  }

  function share(card, prize) {
    const b = banana(prize.bananaId);
    const text = prize.points > 0
      ? `バナナスクラッチ「${card.name}」で${prize.picked ? '' : `${b.name}（${BS.RARITY[prize.tier].label}）が出て`} +${prize.points}pt ゲット！🍌`
      : `バナナスクラッチ「${card.name}」はざんねん…次こそ！🍌`;
    const url = location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ title: 'バナナスクラッチチャンス', text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text} ${url}`).then(() => toast('コピーしました！'), () => toast('コピーできませんでした'));
    } else {
      toast(text);
    }
  }

  /* ---------- シート（モーダル） ---------- */
  let sheetState = null;

  function openSheet(inner, opt) {
    closeSheet(true);
    const back = document.createElement('div');
    back.className = `sheet-backdrop ${(opt && opt.cls) || ''}`;
    back.innerHTML = inner;
    sheetRoot.appendChild(back);
    const prevFocus = document.activeElement;
    const sheet = back.querySelector('.sheet');
    requestAnimationFrame(() => back.classList.add('is-open'));
    back.addEventListener('click', (e) => { if (e.target === back) closeSheet(); });
    const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    sheetState = { back, onKey, prevFocus };
    // スクリーンリーダー向けにシートへフォーカスを移す（ボタンに枠が出ないようシート自体に）
    sheet.setAttribute('tabindex', '-1');
    setTimeout(() => sheet.focus({ preventScroll: true }), 60);
    return sheet;
  }

  function closeSheet(immediate) {
    if (!sheetState) return;
    const { back, onKey, prevFocus } = sheetState;
    sheetState = null;
    document.removeEventListener('keydown', onKey);
    if (immediate) back.remove();
    else {
      back.classList.remove('is-open');
      setTimeout(() => back.remove(), 260);
    }
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  }

  function closeBtn() {
    return '<button type="button" class="sheet-close" data-close aria-label="閉じる">×</button>';
  }

  function bindClose(sheet) {
    sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet()));
  }

  // 提供割合
  function openOdds(card) {
    const row = (o) => {
      const b = banana(o.id);
      return `<tr><td class="odds-ic">${BS.bananaSVG(o.id)}</td><td>${esc(b.name)}</td><td><span class="mini-rarity rarity-${b.rarity}">${BS.RARITY[b.rarity].label}</span></td><td class="num">${b.points}pt</td><td class="num">${o.pct < 1 ? o.pct.toFixed(2) : o.pct.toFixed(1)}%</td></tr>`;
    };
    let body = '';
    if (card.layout === 'slot' || card.layout === 'match3') {
      body = `<p class="odds-lead">当たり（${card.layout === 'slot' ? '3つそろう' : '同じバナナが3つ'}）確率：<b>${Math.round(card.winRate * 100)}%</b>　／　当たり時のポイント：<b>×${card.multiplier}</b>${card.layout === 'slot' ? `<br>リーチはずれ確率：${Math.round(card.reachRate * 100)}%` : ''}</p>
        <h3 class="odds-sub">当たりのときにそろうバナナ</h3>
        <table class="odds-table">${BS.oddsPercent(card.winOdds).map(row).join('')}</table>`;
    } else if (card.layout === 'pick') {
      body = `<p class="odds-lead">9マスそれぞれに、下の割合でバナナが入っています。えらんだ${card.picks}マスの合計ポイントがもらえます。</p>
        <table class="odds-table">${BS.oddsPercent(card.odds).map(row).join('')}</table>`;
    } else {
      body = `<table class="odds-table">${BS.oddsPercent(card.odds).map(row).join('')}</table>`;
    }
    const sheet = openSheet(`<div class="sheet odds" role="dialog" aria-modal="true" aria-labelledby="oddsTitle">${closeBtn()}
      <h2 id="oddsTitle" class="sheet-title">提供割合：${esc(card.name)}</h2>${body}
      <p class="odds-note">※抽選はブラウザ内の乱数（crypto.getRandomValues）で行っています。</p></div>`);
    bindClose(sheet);
  }

  /* ---------- 図鑑 ---------- */
  function renderZukan() {
    const col = store.state.collection;
    const found = collectionCount();
    const pct = Math.round((found / BS.BANANAS.length) * 100);
    const items = BS.BANANAS.map((b) => {
      const has = !!col[b.id];
      return `<li><button type="button" class="zukan-item rarity-${b.rarity} ${has ? '' : 'is-locked'}" data-id="${b.id}" aria-label="${has ? esc(b.name) : '未発見のバナナ'}">
        <span class="zukan-rarity">${BS.RARITY[b.rarity].label}</span>
        <span class="zukan-pic">${BS.bananaSVG(b.id)}</span>
        <span class="zukan-name">${has ? esc(b.name) : '？？？'}</span>
        <span class="zukan-count">${has ? `×${fmt(col[b.id])}` : '未発見'}</span>
      </button></li>`;
    }).join('');
    view.innerHTML = `
      <section class="page">
        <div class="page-head">
          <h1 class="page-title">バナナ図鑑</h1>
          <p class="page-sub"><b>${found}</b> / ${BS.BANANAS.length} 種類 発見（${pct}%）</p>
          <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
          ${found === BS.BANANAS.length ? '<p class="complete">🎉 コンプリートおめでとう！</p>' : ''}
        </div>
        <ul class="zukan-grid">${items}</ul>
        <p class="footnote">見つけたバナナをタップすると、くわしい説明と「当たり音」が聞けます。</p>
      </section>`;
    view.querySelectorAll('.zukan-item').forEach((el) => el.addEventListener('click', () => openBananaDetail(el.dataset.id)));
  }

  function openBananaDetail(id) {
    const b = banana(id);
    const has = !!store.state.collection[id];
    let inner;
    if (has) {
      inner = `<div class="sheet detail rarity-${b.rarity}" role="dialog" aria-modal="true" aria-labelledby="detailTitle">${closeBtn()}
        <div class="detail-pic">${BS.bananaSVG(id)}</div>
        <span class="tier-badge tier-${b.rarity}">${BS.RARITY[b.rarity].label}</span>
        <h2 id="detailTitle" class="detail-name">${esc(b.name)}</h2>
        <p class="detail-meta">${b.points}pt ・ これまでに ${fmt(store.state.collection[id])} 回</p>
        <p class="detail-desc">${esc(b.desc)}</p>
        <button type="button" class="btn btn-primary" data-sound>♪ 当たり音をきく</button>
      </div>`;
    } else {
      const best = BS.CARDS.filter((c) => c.odds && c.odds[id]).sort((a, c) => (c.odds[id] / sumOdds(c.odds)) - (a.odds[id] / sumOdds(a.odds)))[0];
      inner = `<div class="sheet detail is-locked" role="dialog" aria-modal="true" aria-labelledby="detailTitle">${closeBtn()}
        <div class="detail-pic">${BS.bananaSVG(id)}</div>
        <span class="tier-badge tier-${b.rarity}">${BS.RARITY[b.rarity].label}</span>
        <h2 id="detailTitle" class="detail-name">？？？</h2>
        <p class="detail-desc">まだ見つかっていないバナナです。${best ? `「${esc(best.name)}」で出やすいかも…？` : ''}</p>
      </div>`;
    }
    const sheet = openSheet(inner);
    bindClose(sheet);
    const sb = sheet.querySelector('[data-sound]');
    if (sb) sb.addEventListener('click', () => { sound.unlock(); sound.play(b.sound); sound.speak(b.name); });
  }

  function sumOdds(o) {
    return Object.keys(o).reduce((s, k) => s + o[k], 0);
  }

  /* ---------- 履歴 ---------- */
  function renderHistory() {
    const s = store.state;
    const best = s.stats.best && s.stats.best.points > 0 ? banana(s.stats.best.bananaId) : null;
    const list = s.history.map((h) => {
      const b = banana(h.bananaId);
      const c = BS.cardById(h.cardId);
      const d = new Date(h.t);
      const time = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<li class="hist-item ${h.points > 0 ? '' : 'is-miss'}">
        <span class="hist-ic">${BS.bananaSVG(h.bananaId)}</span>
        <span class="hist-body"><b>${h.points > 0 ? esc(b.name) : 'ハズレ'}</b><small>${esc(c ? c.name : '')} ・ ${time}</small></span>
        <span class="hist-pts">${h.points > 0 ? `+${fmt(h.points)}` : '0'}<small>pt</small></span>
      </li>`;
    }).join('');
    view.innerHTML = `
      <section class="page">
        <div class="page-head"><h1 class="page-title">あそんだ履歴</h1></div>
        <div class="stats">
          <div class="stat"><span>あそんだ回数</span><b>${fmt(s.stats.plays)}</b></div>
          <div class="stat"><span>もらったpt</span><b>${fmt(s.stats.earned)}</b></div>
          <div class="stat"><span>つかったpt</span><b>${fmt(s.stats.spent)}</b></div>
          <div class="stat stat-best"><span>最高記録</span><b>${best ? `${esc(best.name)}<small> +${fmt(s.stats.best.points)}pt</small>` : '—'}</b></div>
        </div>
        ${list ? `<ul class="hist-list">${list}</ul>` : '<div class="empty">まだ履歴がありません。<br><a href="#/card/trial" class="btn btn-primary">おためしくじを引く</a></div>'}
      </section>`;
  }

  /* ---------- 設定 ---------- */
  function renderSettings() {
    const s = store.state.settings;
    const hasVoice = 'speechSynthesis' in window;
    const chip = (n) => `<button type="button" class="chip" data-sfx="${n}">${esc(SOUND_LABELS[n] || n)}</button>`;
    const bananaSounds = BS.BANANAS.map((b) => b.sound);
    const tests = BS.BANANAS.map((b) => chip(b.sound)).join('');
    const sysTests = Object.keys(SOUND_LABELS).filter((n) => sound.names.includes(n) && !bananaSounds.includes(n)).map(chip).join('');
    view.innerHTML = `
      <section class="page">
        <div class="page-head"><h1 class="page-title">設定</h1></div>
        <div class="setting-group">
          <label class="setting"><span><b>サウンド</b><small>削る音・当たり音・ハズレ音</small></span><input type="checkbox" class="switch" id="setSound" ${s.sound ? 'checked' : ''}></label>
          <label class="setting"><span><b>音量</b></span><input type="range" min="0" max="1" step="0.05" id="setVolume" value="${s.volume}"></label>
          <label class="setting"><span><b>読み上げボイス</b><small>${hasVoice ? '結果を声で読み上げます（日本語音声がある端末のみ）' : 'このブラウザは読み上げに対応していません'}</small></span><input type="checkbox" class="switch" id="setVoice" ${s.voice ? 'checked' : ''} ${hasVoice ? '' : 'disabled'}></label>
          <label class="setting"><span><b>バイブレーション</b><small>対応端末のみ（Android など）</small></span><input type="checkbox" class="switch" id="setVibrate" ${s.vibrate ? 'checked' : ''}></label>
        </div>

        <h2 class="section-title">サウンドルーム</h2>
        <p class="page-sub">鳴る音を全部ためせます。</p>
        <h3 class="chips-title">バナナごとの当たり音・ハズレ音</h3>
        <div class="chips">${tests}</div>
        <h3 class="chips-title">演出の音</h3>
        <div class="chips">${sysTests}</div>

        <h2 class="section-title">データ</h2>
        <div class="setting-group">
          <div class="setting"><span><b>保存先</b><small>${store.persistent ? 'このブラウザ（localStorage）' : '保存できない環境のため、閉じるとリセットされます'}</small></span></div>
          <div class="setting"><span><b>データをリセット</b><small>ポイント・図鑑・履歴を最初の状態（${store.START_POINTS}pt）に戻します</small></span><button type="button" class="btn btn-danger btn-sm" id="resetBtn">リセット</button></div>
        </div>
        <p class="footnote">バナナスクラッチチャンスは、ブラウザだけで動く非公式のファンメイド作品です。ポイントは架空のもので、実在の決済サービス等とは関係ありません。</p>
      </section>`;

    const bind = (id, key, after) => {
      const el = document.getElementById(id);
      el.addEventListener('change', () => {
        store.state.settings[key] = el.type === 'range' ? Number(el.value) : el.checked;
        store.save();
        applySettings();
        if (after) after(el);
      });
    };
    bind('setSound', 'sound', (el) => { if (el.checked) { sound.unlock(); sound.play('pico'); } });
    bind('setVolume', 'volume', () => { sound.unlock(); sound.play('tap'); });
    bind('setVoice', 'voice', (el) => {
      if (el.checked) {
        if (!sound.hasJaVoice()) toast('日本語の音声が見つかりませんでした');
        sound.speak('ボイスをオンにしました');
      }
    });
    bind('setVibrate', 'vibrate', (el) => { if (el.checked) fx.vibrate(60); });
    view.querySelectorAll('[data-sfx]').forEach((b) => b.addEventListener('click', () => {
      sound.unlock();
      if (!store.state.settings.sound) { toast('サウンドがOFFになっています'); return; }
      sound.play(b.dataset.sfx);
    }));
    document.getElementById('resetBtn').addEventListener('click', () => {
      if (window.confirm('ポイント・図鑑・履歴をすべてリセットしますか？')) {
        store.reset();
        applySettings();
        updatePoints(false);
        toast('リセットしました');
        renderSettings();
      }
    });
  }

  /* ---------- 起動 ---------- */
  function init() {
    store.load();
    applySettings();
    updatePoints(false);

    soundBtn.addEventListener('click', () => {
      store.state.settings.sound = !store.state.settings.sound;
      store.save();
      applySettings();
      if (store.state.settings.sound) { sound.unlock(); sound.play('pico'); }
      toast(store.state.settings.sound ? 'サウンド ON' : 'サウンド OFF');
      const sw = document.getElementById('setSound');
      if (sw) sw.checked = store.state.settings.sound;
    });
    backBtn.addEventListener('click', () => go('#/'));
    pointsPill.addEventListener('click', () => go('#/history'));

    // 最初の操作で音を有効化（iOS 対策）
    const unlockOnce = () => { sound.unlock(); };
    document.addEventListener('pointerdown', unlockOnce, { passive: true });
    document.addEventListener('keydown', unlockOnce);

    document.addEventListener('visibilitychange', () => { if (document.hidden) sound.scratchStop(); });
    window.addEventListener('hashchange', route);
    route();
  }

  init();
})(window.BS = window.BS || {});
