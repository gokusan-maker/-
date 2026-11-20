/* =========================================================================
 * 相棒モンスター「ハニー」
 * 問題をとくとXP（経験値）とコインがもらえ、ハニーが育つ。
 *   タマゴ → ちびハニ（Lv2）→ ハニまる（Lv5）
 *   → Lv15 でいちばん勉強した分野で進化（地理：タビハニ／歴史：ショウグンハニ／公民：ギチョウハニ）
 *   → ハニワオー（Lv30）→ コフンノカミ（Lv50）
 * コインでおやつ・きせかえ・へやを買える。記録はユーザーごとに保存される。
 * ========================================================================= */
(function () {
  'use strict';

  /* ===================== 育ち方 ===================== */
  const XP_CORRECT = 10;   // 正解
  const XP_WRONG = 2;      // まちがえても少しもらえる
  const XP_OTHER = 4;      // 地図・グラフなどの問題（正誤を区別しないもの）
  const COIN_CORRECT = 2;
  const COIN_GOAL = 30;    // 1日の目標達成
  const COIN_BADGE = 20;   // バッジ獲得
  const COIN_LEVEL = 10;   // レベルアップ
  const MAX_LEVEL = 99;

  const xpToNext = lv => 20 + (lv - 1) * 10;
  function levelInfo(total) {
    let level = 1, rest = Math.max(0, Math.floor(total));
    while (level < MAX_LEVEL && rest >= xpToNext(level)) { rest -= xpToNext(level); level++; }
    return { level, into: rest, need: xpToNext(level) };
  }

  const BRANCHES = {
    geo: { name: 'タビハニ', title: 'たんけん家', field: '地理', color: '#2f9e6e' },
    his: { name: 'ショウグンハニ', title: 'ぶしょう', field: '歴史', color: '#d9622b' },
    civ: { name: 'ギチョウハニ', title: 'ぎちょう', field: '公民', color: '#3a6fd8' }
  };
  const STAGES = [
    { id: 'egg', min: 1, name: 'ふしぎなタマゴ' },
    { id: 'baby', min: 2, name: 'ちびハニ' },
    { id: 'kid', min: 5, name: 'ハニまる' },
    { id: 'adult', min: 15, name: null },   // 進化先の名前
    { id: 'legend', min: 30, name: 'ハニワオー' },
    { id: 'myth', min: 50, name: 'コフンノカミ' }
  ];
  const stageOf = lv => STAGES.filter(s => lv >= s.min).pop();
  const formName = (stage, branch) => stage.id === 'adult' ? BRANCHES[branch || 'geo'].name : stage.name;
  // 図鑑にのる姿（タマゴ・ちび・まる・進化3種・オー・カミ）
  const FORMS = [
    { key: 'egg', name: 'ふしぎなタマゴ', how: 'さいしょの姿' },
    { key: 'baby', name: 'ちびハニ', how: 'Lv2で生まれる' },
    { key: 'kid', name: 'ハニまる', how: 'Lv5で進化' },
    { key: 'adult-geo', name: 'タビハニ', how: 'Lv15・地理をいちばん勉強' },
    { key: 'adult-his', name: 'ショウグンハニ', how: 'Lv15・歴史をいちばん勉強' },
    { key: 'adult-civ', name: 'ギチョウハニ', how: 'Lv15・公民をいちばん勉強' },
    { key: 'legend', name: 'ハニワオー', how: 'Lv30で進化' },
    { key: 'myth', name: 'コフンノカミ', how: 'Lv50で進化' }
  ];
  const formKey = (stage, branch) => stage.id === 'adult' ? `adult-${branch || 'geo'}` : stage.id;

  /* ===================== ショップ ===================== */
  const FOODS = [
    { id: 'onigiri', name: 'おにぎり', icon: '🍙', price: 20, xp: 25 },
    { id: 'dango', name: 'みたらしだんご', icon: '🍡', price: 40, xp: 60 },
    { id: 'kashiwa', name: 'かしわもち', icon: '🌿', price: 80, xp: 130 }
  ];
  const WEARS = [
    { id: 'hachimaki', slot: 'head', name: 'はちまき', icon: '🎗', price: 60 },
    { id: 'mugiwara', slot: 'head', name: 'むぎわらぼうし', icon: '👒', price: 90 },
    { id: 'eboshi', slot: 'head', name: 'えぼし', icon: '🎩', price: 120 },
    { id: 'crown', slot: 'head', name: 'おうかん', icon: '👑', price: 200 },
    { id: 'glasses', slot: 'face', name: 'まるメガネ', icon: '👓', price: 80 },
    { id: 'sunglass', slot: 'face', name: 'サングラス', icon: '🕶', price: 120 },
    { id: 'bell', slot: 'neck', name: 'すず', icon: '🔔', price: 50 },
    { id: 'bowtie', slot: 'neck', name: 'ちょうネクタイ', icon: '🎀', price: 70 },
    { id: 'muffler', slot: 'neck', name: 'マフラー', icon: '🧣', price: 90 }
  ];
  const ROOMS = [
    { id: 'field', name: 'はらっぱ', price: 0 },
    { id: 'kofun', name: 'こふんの丘', price: 100 },
    { id: 'castle', name: 'おしろ', price: 150 },
    { id: 'worldmap', name: 'せかいちず', price: 150 },
    { id: 'night', name: 'よぞら', price: 200 }
  ];
  const SLOT_NAME = { head: 'あたま', face: 'かお', neck: 'くび' };

  /* ===================== 絵（SVG） ===================== */
  let uid = 0;
  const CLAY = '#d39466', CLAY_D = '#a5683f', CLAY_L = '#f0c299';

  function roomBg(id, w = 300, h = 220) {
    const g = `<defs><linearGradient id="sky${uid}" x1="0" y1="0" x2="0" y2="1">`;
    if (id === 'night') {
      const stars = Array.from({ length: 22 }, (_, k) => `<circle cx="${(k * 53) % w}" cy="${(k * 37) % (h * .55)}" r="${k % 3 ? 1 : 1.8}" fill="#fff" opacity="${.5 + (k % 4) / 8}"/>`).join('');
      return `${g}<stop offset="0" stop-color="#18224a"/><stop offset="1" stop-color="#3b3f7a"/></linearGradient></defs>
        <rect width="${w}" height="${h}" fill="url(#sky${uid})"/>${stars}<circle cx="${w - 50}" cy="40" r="18" fill="#fff6c8"/><circle cx="${w - 43}" cy="35" r="16" fill="#18224a" opacity=".9"/>
        <path d="M0 ${h * .78} Q${w * .3} ${h * .7} ${w * .6} ${h * .76} T${w} ${h * .74} V${h} H0Z" fill="#26304f"/>`;
    }
    const sky = id === 'castle' ? ['#ffd9b3', '#ffeedd'] : ['#9fd3f2', '#e3f4fb'];
    let scene = '';
    if (id === 'kofun') {
      scene = `<path d="M${w * .1} ${h * .76} Q${w * .1} ${h * .5} ${w * .32} ${h * .5} L${w * .4} ${h * .55} L${w * .5} ${h * .47} Q${w * .66} ${h * .45} ${w * .7} ${h * .76}Z" fill="#7fb36a"/>
        <path d="M${w * .06} ${h * .78} Q${w * .1} ${h * .46} ${w * .32} ${h * .46}" fill="none" stroke="#6aa0d8" stroke-width="5" opacity=".7"/>`;
    } else if (id === 'castle') {
      scene = `<g fill="#f5f1e8" stroke="#555" stroke-width="1.5"><rect x="${w * .62}" y="${h * .42}" width="${w * .22}" height="${h * .34}"/><rect x="${w * .66}" y="${h * .28}" width="${w * .14}" height="${h * .14}"/></g>
        <g fill="#3f4a5a"><path d="M${w * .58} ${h * .44} L${w * .73} ${h * .34} L${w * .88} ${h * .44}Z"/><path d="M${w * .63} ${h * .3} L${w * .73} ${h * .2} L${w * .83} ${h * .3}Z"/></g>
        <rect x="${w * .56}" y="${h * .74}" width="${w * .34}" height="${h * .04}" fill="#8c8c8c"/>`;
    } else if (id === 'worldmap') {
      scene = `<g fill="#bfe3b4" opacity=".9"><path d="M30 60 q20 -20 50 -8 q15 18 -5 34 q-25 10 -45 -6z"/><path d="M110 50 q40 -18 80 0 q12 22 -14 30 q-30 6 -40 26 q-20 -6 -26 -26z"/>
        <path d="M200 90 q30 -6 40 12 q-6 22 -30 18 q-16 -8 -10 -30z"/><path d="M60 110 q14 -4 18 14 q-4 24 -16 30 q-10 -20 -2 -44z"/></g>
        <g stroke="#7fb2d8" stroke-width=".8" opacity=".6">${[1, 2, 3, 4, 5].map(k => `<line x1="0" x2="${w}" y1="${k * 32}" y2="${k * 32}"/>`).join('')}</g>`;
    }
    return `${g}<stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#sky${uid})"/>
      ${id === 'worldmap' ? '' : `<circle cx="50" cy="40" r="16" fill="#fff3b0" opacity=".9"/>`}
      ${scene}
      <path d="M0 ${h * .76} Q${w * .5} ${h * .68} ${w} ${h * .76} V${h} H0Z" fill="${id === 'castle' ? '#c9b48a' : '#8fcf7d'}"/>`;
  }

  // ハニー本体。cx, base は足もとの中心。sz は大きさの倍率
  function haniwa(m, opts = {}) {
    const lv = levelInfo(m.xp).level;
    const st = opts.stage || stageOf(lv);
    const branch = opts.branch !== undefined ? opts.branch : m.branch;
    const id = ++uid;
    const sleeping = !!opts.sleeping, eating = !!opts.eating;
    if (st.id === 'egg') {
      const crack = opts.crack;
      return `<g class="mon-egg">
        <defs><radialGradient id="eg${id}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fffaf0"/><stop offset=".6" stop-color="${CLAY_L}"/><stop offset="1" stop-color="${CLAY}"/></radialGradient></defs>
        <ellipse cx="0" cy="-2" rx="34" ry="5" fill="#000" opacity=".15"/>
        <path d="M0 -92 C 30 -92 42 -40 40 -24 C 38 -6 22 0 0 0 C -22 0 -38 -6 -40 -24 C -42 -40 -30 -92 0 -92Z" fill="url(#eg${id})" stroke="${CLAY_D}" stroke-width="2"/>
        <g fill="${CLAY_D}" opacity=".55"><circle cx="-12" cy="-58" r="6"/><circle cx="14" cy="-38" r="8"/><circle cx="-16" cy="-24" r="4"/><circle cx="10" cy="-70" r="4"/></g>
        ${crack ? `<path d="M-20 -50 l8 6 l6 -8 l8 7 l7 -6 l9 5" fill="none" stroke="#5a3a20" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
      </g>`;
    }
    const scale = { baby: .72, kid: .9, adult: 1, legend: 1.06, myth: 1.1 }[st.id];
    const armUp = st.id !== 'baby';
    const gold = st.id === 'legend' || st.id === 'myth';
    // 胴体（下が少し広がる円柱）
    const body = `M-30 -8 C -32 -50 -30 -96 -24 -110 C -16 -124 16 -124 24 -110 C 30 -96 32 -50 30 -8 Q 0 2 -30 -8Z`;
    const eyeY = -88, eyeDX = 11;
    const eyes = sleeping
      ? `<path d="M${-eyeDX - 6} ${eyeY} q6 5 12 0 M${eyeDX - 6} ${eyeY} q6 5 12 0" stroke="#3a2414" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<g class="mon-eyes"><ellipse cx="${-eyeDX}" cy="${eyeY}" rx="6.5" ry="9" fill="#3a2414"/><ellipse cx="${eyeDX}" cy="${eyeY}" rx="6.5" ry="9" fill="#3a2414"/>
          <circle cx="${-eyeDX + 2}" cy="${eyeY - 4}" r="2.3" fill="#fff"/><circle cx="${eyeDX + 2}" cy="${eyeY - 4}" r="2.3" fill="#fff"/></g>`;
    const mouth = eating
      ? `<ellipse class="mon-chew" cx="0" cy="-66" rx="7" ry="5" fill="#3a2414"/>`
      : `<ellipse cx="0" cy="-67" rx="${st.id === 'baby' ? 4 : 5.5}" ry="${st.id === 'baby' ? 5 : 6.5}" fill="#3a2414"/>`;
    const cheeks = `<ellipse cx="-20" cy="-74" rx="6" ry="3.5" fill="#f08a7a" opacity=".55"/><ellipse cx="20" cy="-74" rx="6" ry="3.5" fill="#f08a7a" opacity=".55"/>`;
    const arms = `<path d="M-28 -66 C -44 -64 -48 -50 -46 -40" stroke="url(#cl${id})" stroke-width="13" fill="none" stroke-linecap="round"/>
      ${armUp ? `<path d="M28 -70 C 44 -76 50 -92 48 -108" stroke="url(#cl${id})" stroke-width="13" fill="none" stroke-linecap="round"/>`
        : `<path d="M28 -66 C 44 -64 48 -50 46 -40" stroke="url(#cl${id})" stroke-width="13" fill="none" stroke-linecap="round"/>`}`;
    const pattern = gold
      ? `<path d="M-26 -40 Q 0 -32 26 -40 M-27 -28 Q 0 -20 27 -28" stroke="#f4c542" stroke-width="3" fill="none"/>`
      : `<path d="M-26 -36 Q 0 -30 26 -36" stroke="${CLAY_D}" stroke-width="2" fill="none" opacity=".6"/>`;

    // 進化した分野のしるし（頭にきせかえがあるときは、きせかえを優先）
    const head = WEAR_ART.head[(m.wear || {}).head];
    let mark = '';
    if (['adult', 'legend', 'myth'].includes(st.id)) {
      if (branch === 'geo') {
        mark = (head ? '' : `<path d="M-38 -116 Q 0 -128 38 -116 Q 30 -108 -30 -108Z" fill="#7a5a3a"/><path d="M-22 -114 Q -20 -140 0 -140 Q 20 -140 22 -114Z" fill="#9a7650"/><rect x="-22" y="-120" width="44" height="5" fill="#5a3a20"/>`)
          + `<g transform="translate(-40 -42) rotate(-15)"><rect x="-9" y="-12" width="18" height="24" rx="3" fill="#f5e6c8" stroke="#a07a40" stroke-width="1.5"/><path d="M-5 -5 h10 M-5 0 h10 M-5 5 h6" stroke="#2f9e6e" stroke-width="1.5"/></g>`;
      } else if (branch === 'his') {
        mark = head ? '' : `<path d="M-30 -104 Q -30 -134 0 -134 Q 30 -134 30 -104 L 36 -98 L -36 -98Z" fill="#3a3f4a" stroke="#1d2027" stroke-width="1.5"/>
          <path d="M-36 -98 L -42 -88 M36 -98 L 42 -88" stroke="#3a3f4a" stroke-width="6" stroke-linecap="round"/>
          <path d="M-20 -134 Q 0 -146 -26 -164 M20 -134 Q 0 -146 26 -164" stroke="#f4c542" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      } else {
        mark = `<path d="M-8 -54 L 0 -46 L 8 -54 L 4 -30 L -4 -30Z" fill="#3a6fd8"/><circle cx="-16" cy="-52" r="5" fill="#f4c542" stroke="#b8901a" stroke-width="1.5"/>
          ${head ? '' : `<path d="M-26 -112 Q 0 -130 26 -112 Q 0 -118 -26 -112Z" fill="#2a2f3a"/><rect x="-18" y="-128" width="36" height="16" rx="3" fill="#2a2f3a"/>`}`;
      }
    }
    const wear = ['neck', 'face', 'head'].map(slot => (WEAR_ART[slot][(m.wear || {})[slot]] || '')).join('');
    const aura = st.id === 'legend'
      ? `<ellipse class="mon-aura" cx="0" cy="-60" rx="62" ry="72" fill="none" stroke="#f4c542" stroke-width="4" opacity=".55"/>`
      : st.id === 'myth'
        ? `<defs><radialGradient id="au${id}"><stop offset=".55" stop-color="#fff6c8" stop-opacity="0"/><stop offset="1" stop-color="#ffd86b" stop-opacity=".75"/></radialGradient></defs>
           <ellipse class="mon-aura" cx="0" cy="-62" rx="72" ry="80" fill="url(#au${id})"/>
           <ellipse cx="0" cy="-150" rx="22" ry="6" fill="none" stroke="#f4c542" stroke-width="4"/>` : '';
    return `<g class="mon-body" transform="scale(${scale})">
      <defs>
        <linearGradient id="cl${id}" x1="0" x2="1"><stop offset="0" stop-color="${CLAY_D}"/><stop offset=".45" stop-color="${CLAY_L}"/><stop offset="1" stop-color="${CLAY_D}"/></linearGradient>
        <radialGradient id="bd${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${CLAY_L}"/><stop offset=".55" stop-color="${CLAY}"/><stop offset="1" stop-color="${CLAY_D}"/></radialGradient>
      </defs>
      ${aura}
      <ellipse cx="0" cy="-2" rx="36" ry="6" fill="#000" opacity=".15"/>
      <g class="mon-breathe">
        ${arms}
        <path d="${body}" fill="url(#bd${id})" stroke="${CLAY_D}" stroke-width="2"/>
        ${pattern}${eyes}${cheeks}${mouth}${mark}${wear}
      </g>
      ${sleeping ? `<text x="34" y="-120" font-size="18" fill="#6c707a" class="mon-zzz">Z z</text>` : ''}
    </g>`;
  }
  const WEAR_ART = {
    head: {
      hachimaki: `<path d="M-26 -108 Q 0 -102 26 -108 L 26 -100 Q 0 -94 -26 -100Z" fill="#fff" stroke="#d6463b" stroke-width="2"/><circle cx="0" cy="-102" r="4" fill="#d6463b"/><path d="M26 -104 l14 -6 M26 -102 l14 4" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
      mugiwara: `<ellipse cx="0" cy="-114" rx="42" ry="8" fill="#f2cf5b" stroke="#c9a23a" stroke-width="1.5"/><path d="M-20 -114 Q -18 -138 0 -138 Q 18 -138 20 -114Z" fill="#f2cf5b" stroke="#c9a23a" stroke-width="1.5"/><rect x="-20" y="-120" width="40" height="5" fill="#d6463b"/>`,
      eboshi: `<path d="M-18 -112 Q -20 -150 6 -158 Q 20 -150 18 -112Z" fill="#1d2027"/><path d="M-22 -112 h44" stroke="#1d2027" stroke-width="4"/>`,
      crown: `<path d="M-22 -112 L -22 -134 L -11 -122 L 0 -138 L 11 -122 L 22 -134 L 22 -112Z" fill="#f4c542" stroke="#b8901a" stroke-width="2"/><circle cx="0" cy="-124" r="3.5" fill="#e2574c"/>`
    },
    face: {
      glasses: `<g fill="none" stroke="#2a2f3a" stroke-width="2.5"><circle cx="-11" cy="-88" r="10"/><circle cx="11" cy="-88" r="10"/><path d="M-1 -88 h2"/></g>`,
      sunglass: `<path d="M-23 -94 h46 v6 q-2 10 -12 10 q-9 0 -10 -9 h-2 q-1 9 -10 9 q-10 0 -12 -10z" fill="#1d2027"/>`
    },
    neck: {
      bell: `<path d="M-24 -56 Q 0 -48 24 -56" stroke="#d6463b" stroke-width="5" fill="none"/><circle cx="0" cy="-48" r="7" fill="#f4c542" stroke="#b8901a" stroke-width="1.5"/>`,
      bowtie: `<path d="M0 -54 L -14 -62 L -14 -46Z M0 -54 L 14 -62 L 14 -46Z" fill="#e2574c"/><circle cx="0" cy="-54" r="3.5" fill="#b8302a"/>`,
      muffler: `<path d="M-28 -60 Q 0 -50 28 -60 L 28 -50 Q 0 -40 -28 -50Z" fill="#3a6fd8"/><rect x="10" y="-52" width="10" height="26" rx="3" fill="#3a6fd8"/>`
    }
  };

  /* ===================== 状態 ===================== */
  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc, sound, toast } = App;

    // ハニーの記録（ユーザーごとの記録の中に保存）
    function M() {
      const m = App.extState('monster');
      if (typeof m.xp !== 'number') {
        Object.assign(m, { xp: 0, coins: 50, src: { geo: 0, his: 0, civ: 0 }, name: 'ハニー', wear: {}, owned: ['field'], room: 'field', seen: ['egg'], fed: 0, born: App.today() });
      }
      m.src = m.src || { geo: 0, his: 0, civ: 0 };
      m.wear = m.wear || {};
      m.owned = m.owned || ['field'];
      m.seen = m.seen || ['egg'];
      return m;
    }
    const night = () => { const h = new Date().getHours(); return h >= 22 || h < 6; };
    const lovedDays = () => Object.keys(App.state.days || {}).length;
    const hearts = () => Math.min(5, 1 + Math.floor(lovedDays() / 4));

    // 相棒の声（小さいうちはひらがな多め）
    const VOICE = {
      streak3: ['3もん れんぞく！すごい！', 'そのちょうし！', 'いいかんじ〜！'],
      streak5: ['5問連続正解！天才かも！', 'ノリノリだね！', 'もう止まらない！'],
      streak10: ['10問連続！ハニーもびっくり！', '社会博士だ〜！'],
      wrong3: ['だいじょうぶ、まちがえて覚えよう', 'ゆっくりいこう', 'つぎはきっとできるよ'],
      hello: ['今日もいっしょにがんばろう！', 'おかえり！待ってたよ', '社会、たのしいね！', 'きょうは何を勉強する？'],
      night: ['むにゃむにゃ…', 'Zzz…', 'おやすみ…'],
      pet: ['えへへ', 'くすぐったい！', 'うれしい！', 'もっとなでて〜'],
      eat: ['もぐもぐ…おいしい！', 'ごちそうさま！', 'げんきでた！']
    };
    const pick = a => a[Math.floor(Math.random() * a.length)];

    function bubble(text) {
      const m = M();
      const el = document.createElement('div');
      el.className = 'mon-bubble';
      el.innerHTML = `<svg viewBox="-60 -150 120 160" class="mon-mini">${haniwa(m)}</svg><span>${esc(text)}</span>`;
      document.body.appendChild(el);
      setTimeout(() => el.classList.add('out'), 2200);
      setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 2700);
    }

    // レベルアップ・進化の演出
    function celebrate(m, before, after) {
      const s0 = stageOf(before), s1 = stageOf(after);
      const evolved = s0 !== s1;
      if (evolved && s1.id === 'adult' && !m.branch) {
        const src = m.src;
        m.branch = ['geo', 'his', 'civ'].sort((a, b) => (src[b] || 0) - (src[a] || 0))[0];
      }
      const key = formKey(s1, m.branch);
      if (!m.seen.includes(key)) m.seen.push(key);
      App.save();
      // ふつうのレベルアップは、勉強のじゃまをしないよう吹き出しだけ
      if (!evolved) { bubble(`レベルアップ！ Lv${after}（🪙+${COIN_LEVEL * (after - before)}）`); sound.done(); return; }
      const ov = document.createElement('div');
      ov.className = 'mon-overlay' + (evolved ? ' evolve' : '');
      ov.innerHTML = `<div class="mon-pop">
          <div class="mon-pop-title">${s0.id === 'egg' ? '🐣 タマゴがかえった！' : '✨ 進化した！'}</div>
          <svg viewBox="-90 -175 180 185" class="mon-pop-art">${haniwa(m)}</svg>
          <div class="mon-pop-name">${esc(m.name)}　<b>Lv${after}</b></div>
          <div class="mon-pop-form">${esc(formName(s1, m.branch))}${s1.id === 'adult' ? `（${BRANCHES[m.branch].title}）` : ''}になった！</div>
          <div class="muted">🪙 +${COIN_LEVEL * (after - before)}</div>
          <button class="btn" id="mon-ok">やったね！</button></div>`;
      document.body.appendChild(ov);
      sound.done();
      // どこをタップしても閉じる。数秒たつと自動で閉じる
      const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); };
      ov.onclick = close;
      setTimeout(close, 4500);
    }

    function gain(xp, field, coins) {
      const m = M();
      const before = levelInfo(m.xp).level;
      m.xp += xp;
      if (field && m.src[field] !== undefined) m.src[field] += xp;
      m.coins += coins;
      const after = levelInfo(m.xp).level;
      if (after > before) {
        m.coins += COIN_LEVEL * (after - before);
        setTimeout(() => celebrate(m, before, after), 500);
      }
      App.save();
    }

    // 問題をといたときの声かけ用に、連続正解・連続ミスを数える
    let streak = 0, miss = 0;
    App.on('study', ({ n, ok, field }) => {
      if (ok === null) { gain(XP_OTHER * n, null, n); return; }
      gain(ok ? XP_CORRECT : XP_WRONG, field, ok ? COIN_CORRECT : 0);
      if (ok) {
        streak++; miss = 0;
        if (streak === 3) bubble(pick(VOICE.streak3));
        else if (streak === 5) bubble(pick(VOICE.streak5));
        else if (streak === 10) bubble(pick(VOICE.streak10));
      } else {
        streak = 0; miss++;
        if (miss === 3) { bubble(pick(VOICE.wrong3)); miss = 0; }
      }
    });
    App.on('goal', () => { gain(0, null, COIN_GOAL); setTimeout(() => bubble(`目標たっせい！ コイン+${COIN_GOAL}`), 2400); });
    App.on('badge', () => gain(0, null, COIN_BADGE));

    /* ===================== ホームのカード ===================== */
    App.registerHomeCard({
      html: () => {
        const m = M(), li = levelInfo(m.xp), st = stageOf(li.level);
        return `<button class="card mon-card" id="mon-card">
          <svg viewBox="-70 -165 140 172" class="mon-card-art">${haniwa(m, { sleeping: night(), crack: st.id === 'egg' && li.into >= li.need * .6 })}</svg>
          <span class="mon-card-info">
            <span class="mon-card-name"><b>${esc(m.name)}</b> <span class="muted">${esc(formName(st, m.branch))}</span></span>
            <span class="mon-card-lv">Lv${li.level}<span class="bar"><i style="width:${li.into / li.need * 100}%"></i></span></span>
            <span class="mon-card-say">${esc(night() ? pick(VOICE.night) : pick(VOICE.hello))}</span>
          </span>
          <span class="mon-coin">🪙 ${m.coins}</span>
        </button>`;
      },
      bind: () => { const c = $('#mon-card'); if (c) c.onclick = open; }
    });

    /* ===================== ハニーの部屋 ===================== */
    let tab = 'food';
    function open() {
      App.onKey(null); App.stopTimer();
      const m = M(), li = levelInfo(m.xp), st = stageOf(li.level);
      const next = STAGES.find(s => s.min > li.level);
      view.innerHTML = `
        <div class="card mon-room">
          <svg viewBox="0 0 300 220" class="mon-scene" id="mon-scene">
            ${roomBg(m.room)}
            <g transform="translate(150 196)" class="mon-tap">${haniwa(m, { sleeping: night(), crack: st.id === 'egg' && li.into >= li.need * .6 })}</g>
          </svg>
          <div class="mon-say" id="mon-say">${esc(night() ? pick(VOICE.night) : pick(VOICE.hello))}</div>
        </div>
        <div class="card mon-status">
          <div class="mon-st-head"><b class="mon-name">${esc(m.name)}</b><button class="linkbtn" id="mon-rename">名前をかえる</button><span class="mon-coin">🪙 ${m.coins}</span></div>
          <div class="muted">${esc(formName(st, m.branch))}${st.id === 'adult' || st.id === 'legend' || st.id === 'myth' ? `（${BRANCHES[m.branch || 'geo'].title}）` : ''}　なつき度 ${'❤'.repeat(hearts())}${'♡'.repeat(5 - hearts())}</div>
          <div class="mon-lv">Lv${li.level}<span class="bar"><i style="width:${li.into / li.need * 100}%"></i></span><small>${li.into}/${li.need}</small></div>
          <div class="muted">${next ? `Lv${next.min}で${next.id === 'adult' ? '進化（いちばん勉強した分野で姿がかわる）' : `「${next.name}」に進化`}` : 'さいごの姿まで育ったよ！'}</div>
          <div class="mon-src">${['geo', 'his', 'civ'].map(k => `<span><span class="dot ${k}"></span>${BRANCHES[k].field} ${m.src[k] || 0}XP</span>`).join('')}</div>
          <p class="muted" style="margin:6px 0 0">正解で XP+${XP_CORRECT}・🪙+${COIN_CORRECT}、1日の目標で 🪙+${COIN_GOAL}、バッジで 🪙+${COIN_BADGE}</p>
        </div>
        <div class="seg mon-tabs">
          ${[['food', '🍙 おやつ'], ['wear', '🎀 きせかえ'], ['room', '🏠 へや'], ['book', '📖 ずかん']].map(([k, t]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}
        </div>
        <div id="mon-shop">${shop(m)}</div>
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; open(); });
      $('#home').onclick = App.goHome;
      $('#mon-rename').onclick = () => {
        const n = (prompt('ハニーの名前', m.name) || '').trim().slice(0, 8);
        if (n) { m.name = n; App.save(); open(); }
      };
      $('.mon-tap').onclick = () => {
        const g = $('.mon-tap');
        g.classList.remove('jump'); void g.getBBox(); g.classList.add('jump');
        $('#mon-say').textContent = night() ? pick(VOICE.night) : pick(VOICE.pet);
        sound.ok();
      };
      bindShop(m);
      window.scrollTo(0, 0);
    }

    function shop(m) {
      if (tab === 'food') {
        return `<div class="mon-items">${FOODS.map(f => `<button class="card mon-item" data-food="${f.id}" ${m.coins < f.price ? 'disabled' : ''}>
          <span class="mi-ico">${f.icon}</span><b>${f.name}</b><span class="muted">XP +${f.xp}</span><span class="mi-price">🪙 ${f.price}</span></button>`).join('')}</div>`;
      }
      if (tab === 'wear') {
        return Object.keys(SLOT_NAME).map(slot => `<h2>${SLOT_NAME[slot]}</h2><div class="mon-items">${WEARS.filter(w => w.slot === slot).map(w => {
          const own = m.owned.includes(w.id), on = m.wear[slot] === w.id;
          return `<button class="card mon-item ${on ? 'on' : ''}" data-wear="${w.id}" ${!own && m.coins < w.price ? 'disabled' : ''}>
            <span class="mi-ico">${w.icon}</span><b>${w.name}</b><span class="mi-price">${on ? 'つけている' : own ? 'つける' : `🪙 ${w.price}`}</span></button>`;
        }).join('')}</div>`).join('');
      }
      if (tab === 'room') {
        return `<div class="mon-items">${ROOMS.map(r => {
          const own = m.owned.includes(r.id), on = m.room === r.id;
          return `<button class="card mon-item room ${on ? 'on' : ''}" data-room="${r.id}" ${!own && m.coins < r.price ? 'disabled' : ''}>
            <svg viewBox="0 0 300 220" class="mi-room">${roomBg(r.id)}</svg><b>${r.name}</b><span class="mi-price">${on ? 'いまのへや' : own ? 'かえる' : `🪙 ${r.price}`}</span></button>`;
        }).join('')}</div>`;
      }
      return `<p class="muted">出会った姿 ${m.seen.length}/${FORMS.length}。Lv15の進化は、それまでにいちばんXPをためた分野で決まります。</p>
        <div class="mon-book">${FORMS.map(f => {
          const seen = m.seen.includes(f.key);
          const [sid, br] = f.key.split('-');
          const art = haniwa({ xp: 0, wear: {} }, { stage: STAGES.find(s => s.id === sid), branch: br || null });
          return `<div class="card mon-form ${seen ? '' : 'unseen'}"><svg viewBox="-80 -175 160 182">${art}</svg>
            <b>${seen ? f.name : '？？？'}</b><span class="muted">${f.how}</span></div>`;
        }).join('')}</div>`;
    }

    function bindShop(m) {
      $$('[data-food]').forEach(b => b.onclick = () => {
        const f = FOODS.find(x => x.id === b.dataset.food);
        if (m.coins < f.price) return;
        m.coins -= f.price; m.fed = (m.fed || 0) + 1;
        App.save();
        const before = levelInfo(m.xp).level;
        gain(f.xp, null, 0);
        if (levelInfo(m.xp).level === before) {
          open();
          const g = $('.mon-tap');
          g.innerHTML = haniwa(m, { eating: true });
          $('#mon-say').textContent = pick(VOICE.eat);
          setTimeout(() => { const t = $('.mon-tap'); if (t) t.innerHTML = haniwa(m); }, 1600);
        } else open();
      });
      $$('[data-wear]').forEach(b => b.onclick = () => {
        const w = WEARS.find(x => x.id === b.dataset.wear);
        if (!m.owned.includes(w.id)) {
          if (m.coins < w.price || !confirm(`${w.name}を 🪙${w.price} で買いますか？`)) return;
          m.coins -= w.price; m.owned.push(w.id);
        }
        m.wear[w.slot] = m.wear[w.slot] === w.id ? undefined : w.id;   // もう一度おすと外す
        App.save(); open();
      });
      $$('[data-room]').forEach(b => b.onclick = () => {
        const r = ROOMS.find(x => x.id === b.dataset.room);
        if (!m.owned.includes(r.id)) {
          if (m.coins < r.price || !confirm(`${r.name}を 🪙${r.price} で買いますか？`)) return;
          m.coins -= r.price; m.owned.push(r.id);
        }
        m.room = r.id; App.save(); open();
      });
    }

    App.openMonster = open;
  });

  window.SHAKAI_MONSTER = { levelInfo, stageOf, xpToNext, STAGES, FORMS, FOODS, WEARS, ROOMS };
})();
