/* バナナ図鑑データとイラスト（SVG を JS で生成） */
(function (BS) {
  'use strict';

  // レアリティ定義（order が大きいほどレア）
  const RARITY = {
    miss: { label: 'ハズレ', order: 0, color: '#8a8f98' },
    N: { label: 'N', order: 1, color: '#7c8a99' },
    R: { label: 'R', order: 2, color: '#2d8cf0' },
    SR: { label: 'SR', order: 3, color: '#a33cf0' },
    SSR: { label: 'SSR', order: 4, color: '#e0a800' },
    UR: { label: 'UR', order: 5, color: '#ff3b8d' },
  };

  const BANANAS = [
    {
      id: 'peel', name: 'バナナの皮', rarity: 'miss', points: 0, sound: 'buzzer',
      voice: 'ざんねん。皮だけでした',
      desc: '中身はだれかが食べちゃった…。ちなみに「バナナの皮はどれくらい滑るのか」を測った日本の研究は、2014年にイグノーベル賞（物理学賞）を受賞しています。',
    },
    {
      id: 'black', name: '熟しすぎバナナ', rarity: 'miss', points: 0, sound: 'sadTrombone',
      voice: 'ざんねん。熟しすぎちゃった',
      desc: '熟しすぎて真っ黒…。でも甘さは最高潮！ そのまま食べるより、バナナブレッドやスムージーにするとおいしく変身します。',
    },
    {
      id: 'green', name: '青いバナナ', rarity: 'N', points: 1, sound: 'pop',
      voice: 'あたり。青いバナナ',
      desc: 'まだ青いバナナ。日本に輸入されるバナナは、検疫の関係でほとんどが青い状態で届き、国内の「室（むろ）」でエチレンガスを使って黄色く追熟させてから出荷されます。',
    },
    {
      id: 'normal', name: 'ふつうのバナナ', rarity: 'N', points: 3, sound: 'pico',
      voice: 'あたり。ふつうのバナナ',
      desc: 'いちばん見慣れたバナナ。日本で売られているバナナの多くは「キャベンディッシュ」という品種で、輸入先はフィリピンが大半を占めます。',
    },
    {
      id: 'monkey', name: 'モンキーバナナ', rarity: 'R', points: 5, sound: 'monkey',
      voice: 'あたり。モンキーバナナ',
      desc: '長さ10cm前後の小さなバナナ。皮が薄くて甘みが強いのが特徴で、「セニョリータ」などの品種がこう呼ばれています。',
    },
    {
      id: 'sugar', name: 'シュガースポットバナナ', rarity: 'R', points: 10, sound: 'chime',
      voice: 'あたり。シュガースポット',
      desc: '皮に出る茶色い斑点「シュガースポット」は食べごろのサイン。でんぷんが糖に変わって、いちばん甘い状態です。',
    },
    {
      id: 'choco', name: 'チョコバナナ', rarity: 'SR', points: 20, sound: 'matsuri',
      voice: '大あたり。チョコバナナ',
      desc: 'お祭りの屋台の定番！ 地域によってはジャンケンに勝つともう1本もらえる屋台もあるとか。',
    },
    {
      id: 'red', name: '赤いバナナ', rarity: 'SR', points: 30, sound: 'fanfareSmall',
      voice: '大あたり。赤いバナナ',
      desc: '皮が赤紫色の「モラード」という品種。果肉はほんのりオレンジ色で、ねっとり濃厚な甘さがあります。',
    },
    {
      id: 'bluejava', name: 'ブルージャバ', rarity: 'SR', points: 40, sound: 'ice',
      voice: '大あたり。ブルージャバ',
      desc: '皮が青みがかった銀色の品種。食感と風味がバニラアイスのようだと言われ、「アイスクリームバナナ」とも呼ばれます。',
    },
    {
      id: 'bunch', name: 'バナナの房', rarity: 'SR', points: 50, sound: 'bunch',
      voice: '大あたり。バナナの房',
      desc: 'バナナの1本1本を「フィンガー（指）」、ひとまとまりの房を「ハンド（手）」と呼びます。まさにバナナの手！',
    },
    {
      id: 'gold', name: '金のバナナ', rarity: 'SSR', points: 300, sound: 'kirarin',
      voice: 'ちょう大あたり。金のバナナ',
      desc: '伝説の黄金バナナ。キラキラ光るその姿を見た人には幸運が訪れるといわれています。',
    },
    {
      id: 'king', name: 'キングバナナ', rarity: 'SSR', points: 500, sound: 'royal',
      voice: 'ちょう大あたり。キングバナナ',
      desc: 'バナナ界の王様。ちなみにバナナは「木」ではなく、高さ数メートルにもなる巨大な「草（多年草）」の仲間です。',
    },
    {
      id: 'rainbow', name: '虹色バナナ', rarity: 'UR', points: 1000, sound: 'rainbow',
      voice: 'きせきの大あたり。虹色バナナ',
      desc: 'めったに出会えない奇跡の虹色バナナ！ ちなみに植物学的には、バナナはイチゴよりもずっと「ベリー（液果）」らしい果物です。',
    },
  ];

  const byId = {};
  BANANAS.forEach((b) => { byId[b.id] = b; });

  /* ---------- SVG パーツ ---------- */

  // バナナ本体（右上がヘタ、左下が先端）
  const BODY = 'M131 34 C156 100 106 150 32 118 C23 115 23 105 31 104 C70 101 100 74 114 36 C116 29 129 27 131 34 Z';

  let uid = 0;

  function grad(id, stops, x2, y2) {
    const s = stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)) * 100}%" stop-color="${c}"/>`).join('');
    return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2 == null ? 1 : x2}" y2="${y2 == null ? 1 : y2}">${s}</linearGradient>`;
  }

  function star(cx, cy, r, fill, op) {
    return `<path d="M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r} Z" fill="${fill}"${op ? ` opacity="${op}"` : ''}/>`;
  }

  function stem(color) {
    return `<path d="M115 37 L117 17 Q122 10 128 15 L131 35 Z" fill="${color || '#7d8f2e'}" stroke="#4a3b1a" stroke-width="3.5" stroke-linejoin="round"/>`;
  }

  function tip(color) {
    return `<ellipse cx="29" cy="110" rx="5.5" ry="4.5" fill="${color || '#4a3b1a'}"/>`;
  }

  function body(fill, stroke) {
    return `<path d="${BODY}" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>`;
  }

  function shine(op) {
    return `<path d="M46 110 C82 106 108 82 116 50" fill="none" stroke="#fff" stroke-opacity="${op == null ? 0.55 : op}" stroke-width="6" stroke-linecap="round"/>`;
  }

  function ridge(color) {
    return `<path d="M40 113 C92 118 128 92 129 44" fill="none" stroke="${color}" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>`;
  }

  // 顔（バナナの胴体に沿うよう少し回転させる）
  function face(kind) {
    const ink = '#3a2410';
    let eyes = '';
    let mouth = '';
    let extra = '';
    switch (kind) {
      case 'happy':
        eyes = `<path d="M-15 -2 q5 -7 10 0 M5 -2 q5 -7 10 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
        mouth = `<path d="M-7 5 q7 10 14 0 z" fill="#c2412d" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
        break;
      case 'sleepy':
        eyes = `<path d="M-15 -1 h9 M6 -1 h9" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
        mouth = `<ellipse cx="0" cy="8" rx="3" ry="2.4" fill="${ink}"/>`;
        extra = `<text x="18" y="-10" font-size="11" font-weight="700" fill="#4E7F1C" font-family="sans-serif">z</text>`;
        break;
      case 'dizzy':
        eyes = `<path d="M-15 -6 l8 8 M-7 -6 l-8 8 M6 -6 l8 8 M14 -6 l-8 8" stroke="#e8d8c0" stroke-width="2.6" stroke-linecap="round"/>`;
        mouth = `<path d="M-7 11 q7 -7 14 0" fill="none" stroke="#e8d8c0" stroke-width="2.6" stroke-linecap="round"/>`;
        break;
      case 'wow':
        eyes = star(-10, -2, 6.5, ink) + star(10, -2, 6.5, ink) + star(-10, -2, 2.4, '#fff') + star(10, -2, 2.4, '#fff');
        mouth = `<ellipse cx="0" cy="10" rx="5" ry="5.5" fill="#c2412d" stroke="${ink}" stroke-width="2.5"/>`;
        break;
      case 'proud':
        eyes = `<path d="M-15 -1 q5 -6 10 0 M5 -1 q5 -6 10 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
        mouth = `<path d="M-13 7 q6 -6 13 -1 q7 -5 13 1 q-6 4 -13 0 q-7 4 -13 0z" fill="${ink}"/>`;
        break;
      default: // smile
        eyes = `<ellipse cx="-10" cy="-2" rx="3.4" ry="4.4" fill="${ink}"/><ellipse cx="10" cy="-2" rx="3.4" ry="4.4" fill="${ink}"/>` +
          `<circle cx="-9" cy="-4" r="1.3" fill="#fff"/><circle cx="11" cy="-4" r="1.3" fill="#fff"/>`;
        mouth = `<path d="M-6 6 q6 7 12 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
    }
    const cheeks = kind === 'dizzy' ? '' : '<ellipse cx="-19" cy="6" rx="5" ry="3" fill="#ff7a7a" opacity=".55"/><ellipse cx="19" cy="6" rx="5" ry="3" fill="#ff7a7a" opacity=".55"/>';
    return `<g transform="translate(98 94) rotate(-38)">${cheeks}${eyes}${mouth}${extra}</g>`;
  }

  // 通常体型のバナナ（色違い用）
  function basic(o) {
    return (o.defs ? `<defs>${o.defs}</defs>` : '') +
      (o.back || '') +
      stem(o.stem) + body(o.fill, o.stroke) + ridge(o.ridge || o.stroke) + (o.spots || '') + shine(o.shine) + tip(o.tip) +
      face(o.face) + (o.front || '');
  }

  function sugarSpots(color) {
    const pts = [[60, 112, 3.2], [78, 106, 2.4], [96, 112, 3], [112, 98, 2.6], [124, 80, 3.4], [120, 60, 2.2], [104, 120, 2.2], [128, 94, 2], [72, 118, 2]];
    return pts.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="${color}" opacity=".85"/>`).join('');
  }

  const ART = {
    normal(u) {
      return basic({ defs: grad(`g${u}`, ['#FFF07A', '#FFD21F', '#F2B705']), fill: `url(#g${u})`, stroke: '#C98A00', face: 'smile' });
    },
    green(u) {
      return basic({ defs: grad(`g${u}`, ['#D8F08A', '#9ACD3C', '#6FA82C']), fill: `url(#g${u})`, stroke: '#4E7F1C', stem: '#5f7f22', tip: '#3d5a16', face: 'sleepy' });
    },
    black(u) {
      const stink = '<path d="M60 70 q-6 -8 0 -16 q6 -8 0 -16 M78 60 q-6 -8 0 -16 q6 -8 0 -16" fill="none" stroke="#8a9a5b" stroke-width="3" stroke-linecap="round" opacity=".8"/>';
      return basic({ defs: grad(`g${u}`, ['#7a5a36', '#4d3420', '#2e1e10']), fill: `url(#g${u})`, stroke: '#1d120a', stem: '#3a2a14', ridge: '#000', spots: sugarSpots('#1a0f06'), shine: 0.18, face: 'dizzy', back: stink });
    },
    sugar(u) {
      return basic({ defs: grad(`g${u}`, ['#FFE979', '#FFC928', '#E9A800']), fill: `url(#g${u})`, stroke: '#B57B00', spots: sugarSpots('#7a4a12'), face: 'happy' });
    },
    red(u) {
      return basic({ defs: grad(`g${u}`, ['#F07A8A', '#C93A55', '#8E2440']), fill: `url(#g${u})`, stroke: '#5E1428', stem: '#6b3a2a', face: 'smile', shine: 0.4 });
    },
    bluejava(u) {
      const flakes = star(30, 40, 9, '#bfe3f7') + star(146, 128, 7, '#bfe3f7') + star(48, 140, 5, '#d8f0ff') + star(144, 18, 5, '#d8f0ff');
      return basic({ defs: grad(`g${u}`, ['#F2FAFF', '#BFDDEE', '#86B3CE']), fill: `url(#g${u})`, stroke: '#4F7F9E', stem: '#6d8f8a', face: 'happy', back: flakes, shine: 0.8 });
    },
    gold(u) {
      const glow = `<radialGradient id="r${u}"><stop offset="0%" stop-color="#FFF3B0" stop-opacity=".95"/><stop offset="100%" stop-color="#FFE066" stop-opacity="0"/></radialGradient>`;
      const sparkles = star(28, 38, 11, '#FFD84A') + star(146, 124, 9, '#FFE680') + star(52, 142, 6, '#FFF3B0') + star(148, 54, 6, '#FFF3B0') + star(86, 22, 5, '#FFE680');
      return basic({
        defs: grad(`g${u}`, ['#FFF8C4', '#FFD23F', '#E3A000', '#FFE27A']) + glow,
        fill: `url(#g${u})`, stroke: '#A86F00', stem: '#B8860B', tip: '#8a5a00', face: 'happy',
        back: `<circle cx="84" cy="86" r="74" fill="url(#r${u})"/>`, front: sparkles, shine: 0.9,
      });
    },
    king(u) {
      const crown = `<g transform="translate(70 4) rotate(-14)">
        <path d="M0 38 L-2 6 L14 22 L26 0 L38 22 L54 6 L52 38 Z" fill="url(#c${u})" stroke="#9a6400" stroke-width="3" stroke-linejoin="round"/>
        <rect x="-1" y="34" width="54" height="9" rx="3" fill="#E3A000" stroke="#9a6400" stroke-width="3"/>
        <circle cx="26" cy="22" r="4.5" fill="#e8284f"/><circle cx="10" cy="28" r="3" fill="#2d8cf0"/><circle cx="42" cy="28" r="3" fill="#2fbf71"/>
        <circle cx="-2" cy="5" r="3.5" fill="#FFE27A" stroke="#9a6400" stroke-width="2"/><circle cx="26" cy="-1" r="3.5" fill="#FFE27A" stroke="#9a6400" stroke-width="2"/><circle cx="54" cy="5" r="3.5" fill="#FFE27A" stroke="#9a6400" stroke-width="2"/>
      </g>`;
      const sparkles = star(30, 70, 8, '#FFD84A') + star(146, 130, 7, '#FFE680') + star(40, 140, 5, '#FFF3B0');
      return basic({
        defs: grad(`g${u}`, ['#FFF07A', '#FFC400', '#F29F05']) + grad(`c${u}`, ['#FFF3A0', '#FFC928', '#E09B00'], 0, 1),
        fill: `url(#g${u})`, stroke: '#B06D00', face: 'proud', back: sparkles, front: crown,
      });
    },
    rainbow(u) {
      const sparkles = star(26, 36, 11, '#ff5fa2') + star(146, 122, 9, '#4cc9ff') + star(50, 142, 7, '#ffd84a') + star(146, 50, 7, '#7cff9e') + star(88, 18, 6, '#b48cff');
      return basic({
        defs: grad(`g${u}`, ['#ff4d6d', '#ff9f1c', '#ffe94a', '#4ade80', '#38bdf8', '#6366f1', '#c084fc']),
        fill: `url(#g${u})`, stroke: '#4b2aa8', stem: '#7a5cff', tip: '#3b1f8a', face: 'wow', front: sparkles, shine: 0.75, ridge: '#fff',
      });
    },
    monkey(u) {
      const one = (t, f) => `<g transform="${t}">${stem()}${body(`url(#g${u})`, '#C98A00')}${shine()}${tip()}${face(f)}</g>`;
      return `<defs>${grad(`g${u}`, ['#FFF07A', '#FFD21F', '#F2B705'])}</defs>` +
        one('translate(-4 30) scale(.66)', 'smile') + one('translate(52 22) scale(.66)', 'happy');
    },
    bunch(u) {
      const one = (a, f) => `<g transform="translate(84 40) rotate(${a}) scale(.62) translate(-124 -34)">${body(`url(#g${u})`, '#C98A00')}${ridge('#C98A00')}${shine()}${tip()}${f ? face('happy') : ''}</g>`;
      const crown = '<path d="M74 44 L80 12 Q86 6 92 12 L96 44 Z" fill="#6f8a26" stroke="#4a3b1a" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="85" cy="44" rx="16" ry="7" fill="#7d8f2e" stroke="#4a3b1a" stroke-width="3.5"/>';
      return `<defs>${grad(`g${u}`, ['#FFF07A', '#FFD21F', '#F2B705'])}</defs>` +
        one(46, false) + one(22, false) + one(-2, false) + one(-26, true) + crown;
    },
    choco(u) {
      const sprinkles = [[66, 88, 20, '#ff5fa2'], [92, 82, -30, '#4cc9ff'], [78, 102, 60, '#ffe94a'], [98, 104, 10, '#7cff9e'], [70, 118, -40, '#fff'], [92, 124, 45, '#ff5fa2'], [80, 76, -60, '#ffe94a'], [84, 134, 15, '#4cc9ff'], [62, 102, 80, '#fff']]
        .map(([x, y, r, c]) => `<rect x="${x - 4}" y="${y - 1.6}" width="8" height="3.2" rx="1.6" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join('');
      return `<defs>${grad(`g${u}`, ['#FFF9DD', '#FBE7A8'], 1, 0)}${grad(`c${u}`, ['#8a5530', '#5a3218', '#3d200e'], 1, 0)}</defs>
        <rect x="76" y="128" width="9" height="30" rx="3" fill="#e8c992" stroke="#a8814a" stroke-width="2.5"/>
        <path d="M80 10 C102 10 108 40 106 80 C104 118 100 138 80 140 C60 138 56 118 54 80 C52 40 58 10 80 10 Z" fill="url(#g${u})" stroke="#c9a65a" stroke-width="3.5"/>
        <path d="M54 66 C60 72 66 62 72 68 C78 74 84 62 90 68 C96 74 102 64 106 68 C106 104 104 138 80 140 C58 140 54 112 54 66 Z" fill="url(#c${u})" stroke="#2e170a" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M62 78 C61 98 63 116 70 128" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="4" stroke-linecap="round"/>
        ${sprinkles}
        <g transform="translate(80 40)">
          <ellipse cx="-17" cy="6" rx="5" ry="3" fill="#ff7a7a" opacity=".6"/><ellipse cx="17" cy="6" rx="5" ry="3" fill="#ff7a7a" opacity=".6"/>
          <path d="M-14 -2 q5 -7 10 0 M4 -2 q5 -7 10 0" fill="none" stroke="#3a2410" stroke-width="3" stroke-linecap="round"/>
          <path d="M-6 5 q6 9 12 0 z" fill="#c2412d" stroke="#3a2410" stroke-width="2.5" stroke-linejoin="round"/>
        </g>`;
    },
    peel(u) {
      const flap = (a) => `<g transform="rotate(${a} 80 92)">
        <path d="M80 92 C66 72 66 42 80 22 C94 42 94 72 80 92 Z" fill="url(#g${u})" stroke="#B57B00" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M80 86 C72 70 72 48 80 34 C88 48 88 70 80 86 Z" fill="#FFF6D6"/>
      </g>`;
      return `<defs>${grad(`g${u}`, ['#FFE979', '#FFC928', '#E9A800'])}</defs>
        <ellipse cx="80" cy="132" rx="54" ry="9" fill="#000" opacity=".12"/>
        ${flap(-112)}${flap(112)}${flap(-14)}${flap(16)}
        <ellipse cx="80" cy="92" rx="15" ry="11" fill="#E9A800" stroke="#B57B00" stroke-width="3.5"/>
        <path d="M74 82 L76 64 Q80 58 85 63 L87 82 Z" fill="#7d8f2e" stroke="#4a3b1a" stroke-width="3" stroke-linejoin="round"/>
        <text x="112" y="40" font-size="20" font-weight="800" fill="#8a8f98" font-family="sans-serif">…</text>`;
    },
  };

  /**
   * バナナの SVG 文字列を返す
   * @param {string} id バナナID
   * @param {object} [opt] { size, cls, title }
   */
  function svg(id, opt) {
    const o = opt || {};
    uid += 1;
    const u = `b${uid}`;
    const art = ART[id] ? ART[id](u) : ART.normal(u);
    const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
    const label = o.title ? `<title>${o.title}</title>` : '';
    return `<svg class="banana-svg ${o.cls || ''}" viewBox="0 0 160 160"${size} role="img" aria-label="${o.title || (byId[id] ? byId[id].name : 'バナナ')}" xmlns="http://www.w3.org/2000/svg">${label}${art}</svg>`;
  }

  BS.RARITY = RARITY;
  BS.BANANAS = BANANAS;
  BS.bananaById = (id) => byId[id];
  BS.bananaSVG = svg;
  BS.rarityOrder = (r) => (RARITY[r] ? RARITY[r].order : 0);
})(window.BS = window.BS || {});
