/* =========================================================================
 * 社会暗記ドリル ― アプリ本体
 * モード：4択クイズ／一問一答カード／書いて答える／タイムアタック／
 *         年代ならべかえ／今日の復習／苦手復習 ＋ 拡張モード（白地図など）
 * 拡張モードは window.SHAKAI_EXT に登録した関数が App を受け取って追加する。
 * ========================================================================= */
(function () {
  'use strict';

  const { FIELDS, UNITS, EVENTS, POOLS } = window.SHAKAI;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $('#view');

  const ALL = UNITS.flatMap(u => u.items);
  const ITEM = Object.fromEntries(ALL.map(it => [it.id, it]));
  const UNIT = Object.fromEntries(UNITS.map(u => [u.id, u]));
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.id, f]));
  const MASTER = 2;                       // 連続正解でこの回数に達したら「覚えた」
  const INTERVALS = [1, 1, 3, 7, 14, 30]; // 復習ボックスごとの次回までの日数
  const SORT_ROUNDS = 5;                  // 年代ならべかえの出題数
  const TA_SECONDS = 60;                  // タイムアタックの制限時間
  const REVIEW_MAX = 20;                  // 今日の復習・苦手復習の最大出題数
  const STORE_KEY = 'shakai-drill-v1';            // 最初のユーザーの記録（以前からのキー）
  const PROFILE_KEY = 'shakai-drill-profiles';    // ユーザーの一覧
  const USER_ICONS = ['🙂', '🐱', '🐶', '🐰', '🐻', '🦊', '🐼', '🐸', '🐧', '🦁'];

  // 選択肢グループごとの答えの一覧（4択の誤答に使う）
  const GROUP = {};
  ALL.forEach(it => { (GROUP[it.g] = GROUP[it.g] || new Set()).add(it.a); });
  Object.entries(POOLS).forEach(([g, list]) => list.forEach(a => (GROUP[g] = GROUP[g] || new Set()).add(a)));

  /* ===================== 日付 ===================== */
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => ymd(new Date());
  const addDays = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return ymd(d); };

  /* ===================== 状態の保存 ===================== */
  const fresh = () => ({
    v: 2, items: {}, days: {}, lastDay: null, streak: 0,
    sort: { played: 0, perfect: 0 },
    best: {},
    ext: {},
    pref: { units: UNITS.map(u => u.id), count: 10 },
    settings: { sound: true, big: false, goal: 20 }
  });
  // きょうだいなどで使い分けられるよう、ユーザーごとに記録を分けて保存する
  const keyOf = id => id === 'p1' ? STORE_KEY : `${STORE_KEY}:${id}`;
  let P;
  try { P = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { P = null; }
  if (!P || !Array.isArray(P.list) || !P.list.length) P = { list: [{ id: 'p1', name: 'わたし', icon: '🙂' }], cur: 'p1' };
  if (!P.list.some(u => u.id === P.cur)) P.cur = P.list[0].id;
  const saveProfiles = () => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(P)); } catch (e) { /* 保存できない環境 */ } };
  const curUser = () => P.list.find(u => u.id === P.cur);

  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  // 保存データの形をととのえる（こわれた項目は初期値にもどす）
  function sanitize(raw) {
    const def = fresh();
    const st = Object.assign(def, isObj(raw) ? raw : {});
    ['items', 'days', 'best', 'ext', 'sort', 'pref', 'settings'].forEach(k => { if (!isObj(st[k])) st[k] = fresh()[k]; });
    st.settings = Object.assign(fresh().settings, st.settings);
    st.sort = Object.assign(fresh().sort, st.sort);
    if (!Array.isArray(st.pref.units)) st.pref = fresh().pref;
    if (!Array.isArray(st.badges)) st.badges = [];
    Object.keys(st.items).forEach(k => { if (!isObj(st.items[k])) delete st.items[k]; });
    return st;
  }
  function load(id) {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(keyOf(id)) || 'null'); } catch (e) { raw = null; }
    const st = sanitize(raw);
    // v1 → v2：復習ボックスがない記録は連続正解数から作る
    Object.values(st.items).forEach(r => {
      if (r.box === undefined) { r.box = Math.min(r.s, INTERVALS.length - 1); r.due = today(); }
    });
    st.v = 2;
    return st;
  }
  let S = load(P.cur);
  const save = () => { try { localStorage.setItem(keyOf(P.cur), JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ } };

  const isMastered = id => (S.items[id] || {}).s >= MASTER;
  const isWeak = id => { const r = S.items[id]; return !!r && r.w > 0 && r.s < MASTER; };
  const isDue = id => { const r = S.items[id]; return !!r && r.due <= today(); };

  function touchDay(n = 1) {
    const t = today();
    if (S.lastDay !== t) {
      S.streak = S.lastDay === addDays(-1) ? S.streak + 1 : 1;
      S.lastDay = t;
      S.bestStreak = Math.max(S.bestStreak || 0, S.streak);
    }
    const before = S.days[t] || 0;
    S.days[t] = before + n;
    const goal = S.settings.goal;
    if (goal && before < goal && S.days[t] >= goal) {
      setTimeout(() => { toast(`🎉 今日の目標 ${goal}問 達成！`); sound.done(); }, 400);
    }
  }
  const blank = () => ({ c: 0, w: 0, s: 0, box: 0, due: today() });
  function applyResult(r, ok) {
    if (ok) {
      r.c++; r.s++;
      r.box = Math.min((r.box || 0) + 1, INTERVALS.length - 1);
    } else {
      r.w++; r.s = 0; r.box = 0;
    }
    r.due = addDays(INTERVALS[r.box]);
  }
  function record(id, ok) {
    applyResult(S.items[id] || (S.items[id] = blank()), ok);
    touchDay();
    save();
  }

  /* ===================== バッジ ===================== */
  const solved = () => Object.values(S.days).reduce((a, b) => a + b, 0);
  const masteredN = () => ALL.filter(it => isMastered(it.id)).length;
  const ext = id => S.ext[id] || {};
  const examMax = () => Math.max(-1, ...((ext('exam').history || []).map(x => x.score)));
  const BADGES = [
    { id: 'first', icon: '🌱', name: 'はじめの一歩', desc: '1問とく', test: () => solved() >= 1 },
    { id: 'q100', icon: '📗', name: '100問とっぱ', desc: '合計100問とく', test: () => solved() >= 100 },
    { id: 'q500', icon: '📘', name: '500問とっぱ', desc: '合計500問とく', test: () => solved() >= 500 },
    { id: 'q1000', icon: '📙', name: '1000問とっぱ', desc: '合計1000問とく', test: () => solved() >= 1000 },
    { id: 'q3000', icon: '🏆', name: '3000問とっぱ', desc: '合計3000問とく', test: () => solved() >= 3000 },
    { id: 's3', icon: '🔥', name: '3日つづけた', desc: '3日連続で学習する', test: () => (S.bestStreak || S.streak) >= 3 },
    { id: 's7', icon: '🔥', name: '1週間つづけた', desc: '7日連続で学習する', test: () => (S.bestStreak || S.streak) >= 7 },
    { id: 's30', icon: '👑', name: '1か月つづけた', desc: '30日連続で学習する', test: () => (S.bestStreak || S.streak) >= 30 },
    { id: 'goal', icon: '🎉', name: '目標たっせい', desc: '1日の目標問題数をとく', test: () => S.settings.goal > 0 && Object.values(S.days).some(n => n >= S.settings.goal) },
    { id: 'm50', icon: '⭐', name: '50問おぼえた', desc: '50問を「覚えた」にする', test: () => masteredN() >= 50 },
    { id: 'm200', icon: '🌟', name: '200問おぼえた', desc: '200問を「覚えた」にする', test: () => masteredN() >= 200 },
    { id: 'mall', icon: '💫', name: 'ぜんぶおぼえた', desc: 'すべての問題を「覚えた」にする', test: () => masteredN() >= ALL.length },
    { id: 'unit', icon: '🎓', name: '単元マスター', desc: '1つの単元の問題をすべて覚える', test: () => UNITS.some(u => u.items.every(it => isMastered(it.id))) },
    { id: 'tryall', icon: '🧭', name: 'ぜんぶの単元に挑戦', desc: 'すべての単元で1問以上とく', test: () => UNITS.every(u => u.items.some(it => S.items[it.id])) },
    { id: 'sort', icon: '⏳', name: '年代パーフェクト', desc: '年代ならべかえで全問正解', test: () => S.sort.perfect >= 1 },
    { id: 'ta20', icon: '⚡', name: 'スピードスター', desc: 'タイムアタックで20問正解', test: () => (S.best.ta || 0) >= 20 },
    { id: 'exam80', icon: '📋', name: '実力テスト80点', desc: '実力テストで80点以上', test: () => examMax() >= 80 },
    { id: 'exam100', icon: '💯', name: '実力テスト満点', desc: '実力テストで100点', test: () => examMax() >= 100 },
    { id: 'map', icon: '🗾', name: '白地図の名人', desc: '「ぜんぶ見つけよう」を3種類クリア', test: () => Object.keys(ext('map').chal || {}).length >= 3 },
    { id: 'sym', icon: '📍', name: '地図記号の名人', desc: '地図記号クイズで10問全問正解', test: () => Object.values(ext('symbols').best || {}).some(v => v >= 10) }
  ];
  function checkBadges() {
    const got = new Set(S.badges || []);
    const newly = BADGES.filter(b => !got.has(b.id) && b.test());
    if (!newly.length) return;
    S.badges = [...got, ...newly.map(b => b.id)];
    save();
    newly.forEach((b, k) => setTimeout(() => { toast(`🏅 バッジ獲得：${b.icon} ${b.name}`); sound.done(); }, 700 + k * 2000));
  }

  /* ===================== 効果音 ===================== */
  let actx;
  function tone(freqs, dur = .12, gap = .09, type = 'sine', vol = .15) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime;
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + i * gap);
        g.gain.linearRampToValueAtTime(vol, t0 + i * gap + .01);
        g.gain.exponentialRampToValueAtTime(.001, t0 + i * gap + dur);
        o.connect(g).connect(actx.destination);
        o.start(t0 + i * gap); o.stop(t0 + i * gap + dur + .05);
      });
    } catch (e) { /* 音が出せない環境 */ }
  }
  const sound = {
    ok: () => tone([880, 1320], .15),
    ng: () => tone([220, 180], .2, .12, 'triangle'),
    done: () => tone([660, 880, 990, 1320], .18, .1)
  };

  /* ===================== ユーティリティ ===================== */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.add('hidden'), 1800);
  }
  function choicesFor(it) {
    const wrong = it.ch ? it.ch : [...(GROUP[it.g] || [])].filter(a => a !== it.a);
    return shuffle([it.a, ...shuffle(wrong).slice(0, 3)]);
  }
  // 記述の答え合わせ用：全角/半角・空白・中点のゆれをそろえる
  const norm = s => String(s).normalize('NFKC').replace(/[\s・･,、。.]/g, '').replace(/ヶ/g, 'ケ').toLowerCase();
  const SUFFIX = /(都|道|府|県|市|区|町|村|地方|時代|天皇|条約)$/;
  const READ = window.SHAKAI_READINGS || {};
  const kana = s => s.replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  // 答えにふりがなを付けたHTML（読みがないときは答えだけ）
  const withReading = a => READ[a] ? `${esc(a)}<span class="yomi">（${esc(READ[a])}）</span>` : esc(a);
  function isTypedCorrect(input, answer) {
    const a = norm(answer), x = norm(input);
    if (!x) return false;
    if (x === a) return true;
    // 「青森」→「青森県」のように、最後の「県」「市」などを省いた答えも正解にする
    const base = a.replace(SUFFIX, '');
    return (base.length >= 2 && x === base) || isReadingMatch(input, answer);
  }
  // ひらがな（カタカナ）で読みを書いた答え
  function isReadingMatch(input, answer) {
    const r = READ[answer];
    return !!r && kana(norm(input)) === kana(norm(r));
  }
  function renderStreak() {
    const u = curUser();
    $('#who').textContent = P.list.length > 1 ? `${u.icon} ${u.name}` : '';
    $('#streak').innerHTML = S.streak && S.lastDay >= addDays(-1) ? `🔥 <b>${S.streak}</b>日連続` : '';
  }
  function applySettings() {
    document.documentElement.classList.toggle('big', !!S.settings.big);
  }
  let keyHandler = null;
  const onKey = fn => { keyHandler = fn; };
  document.addEventListener('keydown', e => {
    if (!keyHandler || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches('input, textarea') && e.key !== 'Enter') return;
    keyHandler(e);
  });
  let timer = null;
  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  /* ===================== 拡張モードの登録 ===================== */
  const EXT_MODES = [];
  const App = {
    view, $, $$, esc, shuffle, toast, sound, onKey, today, touchDay, save,
    get state() { return S; },
    extState(id) { return S.ext[id] || (S.ext[id] = {}); },
    registerMode(m) { EXT_MODES.push(m); },
    goHome: () => renderHome(),
    showResult: (opts) => renderResult(opts),
    header: (i, n) => qheader(i, n),
    bindQuit: (hasProgress, onQuit) => bindQuit(hasProgress, onQuit),
    // 問題データと出題の部品（拡張モードから使う）
    ALL, ITEM, UNIT, FIELD,
    record: (id, ok) => record(id, ok),
    choicesFor: it => choicesFor(it),
    isMastered: id => isMastered(id),
    isWeak: id => isWeak(id),
    reading: a => READ[a] || '',
    withReading: a => withReading(a),
    startSession: (mode, items, title) => startSession(mode, items, title),
    questionCard: it => questionCard(it),
    feedback: (ok, a, e) => feedback(ok, a, e),
    stopTimer: () => stopTimer(),
    startChrono: kind => { chronoKind = kind; startSort(); }
  };

  /* ===================== おすすめ単元 ===================== */
  // 苦手が多い単元 → まだ挑戦していない単元 → 覚えた割合が低い単元 の順にすすめる
  function recommend() {
    const rows = UNITS.map(u => ({
      u,
      weak: u.items.filter(it => isWeak(it.id)).length,
      tried: u.items.filter(it => S.items[it.id]).length,
      rate: u.items.filter(it => isMastered(it.id)).length / u.items.length
    })).filter(x => x.rate < 1);
    if (!rows.length) return null;
    const weak = rows.filter(x => x.weak >= 3).sort((a, b) => b.weak - a.weak)[0];
    if (weak) return { u: weak.u, why: `苦手な問題が${weak.weak}問あります` };
    const untried = rows.filter(x => x.tried === 0);
    if (untried.length) return { u: untried[new Date().getDate() % untried.length].u, why: 'まだ挑戦していない単元です' };
    const low = rows.sort((a, b) => a.rate - b.rate)[0];
    return { u: low.u, why: `覚えた割合が${Math.round(low.rate * 100)}%の単元です` };
  }
  function startRecommended(u) {
    // 苦手 → まだ覚えていない問題 の順に10問
    const order = it => isWeak(it.id) ? 0 : isMastered(it.id) ? 2 : 1;
    const items = shuffle(u.items).sort((a, b) => order(a) - order(b)).slice(0, 10);
    startSession('quiz', items, `おすすめ：${u.name}`);
  }

  /* ===================== ホーム ===================== */
  function renderHome() {
    onKey(null); stopTimer();
    renderStreak();
    checkBadges();
    const answered = ALL.filter(it => S.items[it.id]);
    const c = answered.reduce((n, it) => n + S.items[it.id].c, 0);
    const w = answered.reduce((n, it) => n + S.items[it.id].w, 0);
    const mastered = ALL.filter(it => isMastered(it.id)).length;
    const weak = ALL.filter(it => isWeak(it.id)).length;
    const due = ALL.filter(it => isDue(it.id)).length;
    const rec = recommend();

    const mode = (id, ico, ttl, dsc, extra = '') =>
      `<button class="mode" data-mode="${id}" ${extra}><span class="ico">${ico}</span><span class="ttl">${ttl}</span><span class="dsc">${dsc}</span></button>`;

    view.innerHTML = `
      <div class="stats">
        <div class="card stat"><div class="num">${S.days[today()] || 0}${S.settings.goal ? `<small class="of">/${S.settings.goal}</small>` : ''}</div>
          <div class="lbl">${S.settings.goal && (S.days[today()] || 0) >= S.settings.goal ? '🎉 目標達成' : '今日といた数'}</div>
          ${S.settings.goal ? `<div class="bar goal"><i style="width:${Math.min(100, (S.days[today()] || 0) / S.settings.goal * 100)}%"></i></div>` : ''}</div>
        <div class="card stat"><div class="num">${c + w ? Math.round(c / (c + w) * 100) : '–'}<small>${c + w ? '%' : ''}</small></div><div class="lbl">正答率</div></div>
        <div class="card stat"><div class="num">${mastered}<small class="of">/${ALL.length}</small></div><div class="lbl">覚えた問題</div></div>
      </div>

      ${due ? `<button class="card due-banner" data-mode="due">
        <span class="due-ico">📅</span>
        <span><b>今日の復習 ${due}問</b><br><span class="muted">忘れかけたころにもう一度。記憶が長持ちします</span></span>
        <span class="due-go">はじめる ›</span></button>` : ''}

      ${rec ? `<button class="card rec-banner" data-mode="rec">
        <span class="due-ico">${rec.u.icon}</span>
        <span><span class="muted">📌 きょうのおすすめ</span><br><b>${esc(rec.u.name)}</b><br><span class="muted">${rec.why}</span></span>
        <span class="due-go">10問 ›</span></button>` : ''}

      <h2>問題を解く</h2>
      <div class="modes">
        ${mode('quiz', '📝', '4択クイズ', '4つの中から答えをえらぶ')}
        ${mode('flash', '🃏', '一問一答', 'ノートに書いてから答え合わせ')}
        ${mode('write', '✏️', '書いて答える', '答えを入力して正確に覚える')}
        ${mode('ta', '⏱', 'タイムアタック', `${TA_SECONDS}秒で何問とけるか${S.best.ta ? `（最高 ${S.best.ta}問）` : ''}`)}
        ${mode('weak', '🎯', '苦手復習', weak ? `まちがえた問題 ${weak}問` : 'まちがえた問題はまだありません', weak ? '' : 'disabled')}
        ${mode('sort', '⏳', '年代・年号', 'できごとを古い順にならべる・年号4択')}
      </div>

      ${[['practice', 'もっと練習する'], ['material', '地図・資料で覚える'], ['tool', 'しらべる']].map(([sec, ttl]) => {
        const ms = EXT_MODES.filter(m => (m.section || 'material') === sec);
        return ms.length ? `<h2>${ttl}</h2><div class="modes">${ms.map(m => mode('x:' + m.id, m.icon, m.name, typeof m.desc === 'function' ? m.desc() : m.desc)).join('')}</div>` : '';
      }).join('')}

      ${FIELDS.map(f => `
        <h2><span class="tag ${f.id}">${f.name}</span></h2>
        <div class="units">
          ${UNITS.filter(u => u.field === f.id).map(u => {
            const m = u.items.filter(it => isMastered(it.id)).length;
            const p = Math.round(m / u.items.length * 100);
            return `<button class="card unit" data-unit="${u.id}">
              <span class="uico">${u.icon}</span>
              <span><span class="uname">${esc(u.name)}</span>
                <span class="umeta"> ・ ${u.items.length}問</span>
                <div class="bar"><i style="width:${p}%"></i></div></span>
              <span class="pct">${p}%</span>
            </button>`;
          }).join('')}
        </div>`).join('')}

      <p class="muted" style="margin-top:20px">単元をタップすると、その単元だけの4択クイズが始まります。<br>
      同じ問題に${MASTER}回連続で正解すると「覚えた」になります。正解した問題は1日後・3日後・1週間後…と間をあけて「今日の復習」に出てきます。</p>
    `;

    $$('[data-mode]').forEach(b => b.onclick = () => {
      const m = b.dataset.mode;
      if (m.startsWith('x:')) return EXT_MODES.find(x => x.id === m.slice(2)).start(App);
      ({
        quiz: () => renderSetup('quiz'),
        flash: () => renderSetup('flash'),
        write: () => renderSetup('write'),
        ta: () => renderSetup('ta'),
        weak: startWeak,
        due: startDue,
        rec: () => startRecommended(rec.u),
        sort: startSort
      })[m]();
    });
    $$('.unit').forEach(b => b.onclick = () => startSession('quiz', UNIT[b.dataset.unit].items, UNIT[b.dataset.unit].name));
    window.scrollTo(0, 0);
  }

  /* ===================== 出題設定 ===================== */
  const MODE_TITLE = { quiz: '📝 4択クイズ', flash: '🃏 一問一答', write: '✏️ 書いて答える', ta: '⏱ タイムアタック' };
  function renderSetup(mode) {
    onKey(null);
    const sel = new Set(S.pref.units.filter(id => UNIT[id]));
    if (!sel.size) UNITS.forEach(u => sel.add(u.id));
    let count = S.pref.count;
    let only = 'all';   // all | new（まだ覚えていない問題だけ）

    const draw = () => {
      const pool = UNITS.filter(u => sel.has(u.id)).flatMap(u => u.items)
        .filter(it => only === 'all' || !isMastered(it.id));
      const n = mode === 'ta' ? pool.length : (count && count < pool.length ? count : pool.length);
      view.innerHTML = `
        <h2 style="margin-top:4px">${MODE_TITLE[mode]} ― 出題範囲</h2>
        ${FIELDS.map(f => {
          const us = UNITS.filter(u => u.field === f.id);
          const allOn = us.every(u => sel.has(u.id));
          return `<div class="card field-group">
            <div class="field-head"><span class="tag ${f.id}">${f.name}</span>
              <button class="linkbtn" data-field="${f.id}">${allOn ? 'すべて外す' : 'すべてえらぶ'}</button></div>
            ${us.map(u => `<label class="check"><input type="checkbox" data-u="${u.id}" ${sel.has(u.id) ? 'checked' : ''}>
              ${u.icon} ${esc(u.name)}<span class="cnt">${u.items.length}問</span></label>`).join('')}
          </div>`;
        }).join('')}

        ${mode === 'ta' ? `<p class="muted">${TA_SECONDS}秒の間に4択問題をできるだけ多く正解しよう。まちがえても次の問題に進みます。</p>` : `
        <h2>問題数</h2>
        <div class="seg" id="count">
          ${[10, 20, 30, 0].map(k => `<button data-n="${k}" class="${count === k ? 'on' : ''}">${k ? k + '問' : 'ぜんぶ'}</button>`).join('')}
        </div>`}
        <h2>出題する問題</h2>
        <div class="seg" id="only">
          <button data-o="all" class="${only === 'all' ? 'on' : ''}">すべて</button>
          <button data-o="new" class="${only === 'new' ? 'on' : ''}">まだ覚えていない問題</button>
        </div>

        <div class="sticky-foot">
          <div class="row">
            <button class="btn sub" id="back" style="flex:0 0 auto">もどる</button>
            <button class="btn" id="start" ${pool.length >= (mode === 'ta' ? 4 : 1) ? '' : 'disabled'}>スタート${mode === 'ta' ? '' : `（${n}問）`}</button>
          </div>
        </div>`;

      $$('input[data-u]').forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.u) : sel.delete(c.dataset.u); draw(); });
      $$('[data-field]').forEach(b => b.onclick = () => {
        const us = UNITS.filter(u => u.field === b.dataset.field);
        const allOn = us.every(u => sel.has(u.id));
        us.forEach(u => allOn ? sel.delete(u.id) : sel.add(u.id));
        draw();
      });
      $$('#count button').forEach(b => b.onclick = () => { count = +b.dataset.n; draw(); });
      $$('#only button').forEach(b => b.onclick = () => { only = b.dataset.o; draw(); });
      $('#back').onclick = renderHome;
      $('#start').onclick = () => {
        S.pref = { units: [...sel], count }; save();
        if (mode === 'ta') return startTimeAttack(pool);
        const picked = shuffle(pool).slice(0, count || pool.length);
        startSession(mode, picked, MODE_TITLE[mode].slice(2).trim());
      };
    };
    draw();
    window.scrollTo(0, 0);
  }

  function startWeak() {
    const weak = shuffle(ALL.filter(it => isWeak(it.id))).slice(0, REVIEW_MAX);
    if (!weak.length) return toast('苦手な問題はありません');
    startSession('quiz', weak, '苦手復習');
  }
  function startDue() {
    // 期限が古いものから優先して出題する
    const due = ALL.filter(it => isDue(it.id))
      .sort((a, b) => S.items[a.id].due.localeCompare(S.items[b.id].due) || Math.random() - .5)
      .slice(0, REVIEW_MAX);
    if (!due.length) return toast('今日の復習はおわりました');
    startSession('quiz', due, '今日の復習');
  }

  /* ===================== 出題（共通部品） ===================== */
  function qheader(i, n) {
    return `<div class="qhead">
      <button class="quit" aria-label="やめる">×</button>
      <div class="bar"><i style="width:${i / n * 100}%"></i></div>
      <span class="count">${i + 1}/${n}</span>
    </div>`;
  }
  function bindQuit(hasProgress, onQuit) {
    $('.quit').onclick = () => {
      if (!hasProgress()) return renderHome();
      if (confirm('とちゅうでやめますか？（ここまでの記録は保存されます）')) onQuit();
    };
  }
  function questionCard(it) {
    const u = UNIT[it.unit];
    return `<div class="card question">
      <span class="tag ${u.field}">${FIELD[u.field].name}</span> <span class="muted">${esc(u.name)}</span>
      <p class="qt">${esc(it.q)}</p>
    </div>`;
  }
  function feedback(ok, answer, exp) {
    return `<div class="card feedback ${ok ? '' : 'ng'}">
      <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
      <div class="ans">${ok ? (READ[answer] ? withReading(answer) : '') : `正解：${withReading(answer)}`}</div>
      ${exp ? `<div class="exp">${esc(exp)}</div>` : ''}
    </div>`;
  }

  /* ===================== 出題（4択・一問一答・記述） ===================== */
  function startSession(mode, items, title) {
    const sess = { mode, title, items: shuffle(items), i: 0, log: [] };
    show(sess);
  }
  const sessionResult = sess => renderResult({
    title: sess.title,
    log: sess.log.map(l => ({ q: ITEM[l.id].q, a: ITEM[l.id].a, ok: l.ok, pick: l.pick, id: l.id })),
    retry: wrongLog => startSession(sess.mode, wrongLog.map(l => ITEM[l.id]), sess.title.replace(/（やり直し）$/, '') + '（やり直し）')
  });
  function show(sess) {
    ({ quiz: renderQuiz, flash: renderFlash, write: renderWrite })[sess.mode](sess);
    bindQuit(() => sess.log.length > 0, () => sessionResult(sess));
    window.scrollTo(0, 0);
  }
  function next(sess) {
    sess.i++;
    if (sess.i >= sess.items.length) sessionResult(sess);
    else show(sess);
  }
  function showNext(sess, ok, it) {
    $('#fb').innerHTML = feedback(ok, it.a, it.e) +
      `<div class="next-wrap"><button class="btn block" id="next">${sess.i + 1 < sess.items.length ? '次の問題へ' : '結果を見る'}</button></div>`;
    $('#next').onclick = () => next(sess);
    $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderQuiz(sess) {
    const it = sess.items[sess.i];
    const opts = choicesFor(it);
    view.innerHTML = `${qheader(sess.i, sess.items.length)}${questionCard(it)}
      <div class="choices">
        ${opts.map((o, k) => `<button class="choice" data-k="${k}"><span class="no">${k + 1}</span><span>${esc(o)}</span></button>`).join('')}
      </div>
      <button class="linkbtn idk" id="idk">わからない（答えを見る）</button>
      <div id="fb" role="status" aria-live="polite"></div>`;
    let done = false;
    const answer = k => {
      if (done) return;
      done = true;
      $('#idk').style.visibility = 'hidden';
      // k = -1 は「わからない」。あてずっぽうで正解するより、苦手として復習に回す
      const pick = k < 0 ? '（わからない）' : opts[k], ok = pick === it.a;
      record(it.id, ok);
      ok ? sound.ok() : sound.ng();
      sess.log.push({ id: it.id, ok, pick });
      $$('.choice').forEach((b, j) => {
        b.disabled = true;
        if (opts[j] === it.a) b.classList.add('correct');
        else if (j === k) b.classList.add('wrong');
      });
      showNext(sess, ok, it);
    };
    $$('.choice').forEach(b => b.onclick = () => answer(+b.dataset.k));
    $('#idk').onclick = () => answer(-1);
    onKey(e => {
      if (!done && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
      else if (!done && e.key === '0') answer(-1);
      else if (done && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(sess); }
    });
  }

  function renderFlash(sess) {
    const it = sess.items[sess.i];
    view.innerHTML = `${qheader(sess.i, sess.items.length)}${questionCard(it)}
      <div id="area">
        <p class="hint">答えをノートに漢字で書いてから、答えを見よう</p>
        <button class="btn block" id="reveal">答えを見る</button>
      </div>`;
    let shown = false;
    const judge = ok => {
      record(it.id, ok);
      sess.log.push({ id: it.id, ok });
      next(sess);
    };
    const reveal = () => {
      shown = true;
      $('#area').innerHTML = `<div class="card flash-ans">
          <div class="muted">答え</div>
          <div class="big">${esc(it.a)}</div>
          ${READ[it.a] ? `<div class="yomi">${esc(READ[it.a])}</div>` : ''}
          ${it.e ? `<div class="exp">${esc(it.e)}</div>` : ''}
        </div>
        <p class="hint">漢字まで正しく書けたら「できた」</p>
        <div class="row">
          <button class="btn ng" id="ng">❌ まちがえた</button>
          <button class="btn ok" id="ok">⭕ できた</button>
        </div>`;
      $('#ok').onclick = () => judge(true);
      $('#ng').onclick = () => judge(false);
    };
    $('#reveal').onclick = reveal;
    onKey(e => {
      if (!shown && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); reveal(); }
      else if (shown && (e.key === 'o' || e.key === 'ArrowRight')) judge(true);
      else if (shown && (e.key === 'x' || e.key === 'ArrowLeft')) judge(false);
    });
  }

  function renderWrite(sess) {
    const it = sess.items[sess.i];
    view.innerHTML = `${qheader(sess.i, sess.items.length)}${questionCard(it)}
      <form id="wform" class="write-form" autocomplete="off">
        <input id="win" class="write-in" type="text" placeholder="答えを入力（漢字で）" enterkeyhint="done" autocapitalize="off" spellcheck="false">
        <div class="row">
          <button type="button" class="btn sub" id="giveup" style="flex:0 0 auto">わからない</button>
          <button type="submit" class="btn">答え合わせ</button>
        </div>
      </form>
      <div id="fb" role="status" aria-live="polite"></div>`;
    const input = $('#win');
    setTimeout(() => input.focus({ preventScroll: true }), 50);
    let done = false;
    const judge = (typed) => {
      if (done) return;
      done = true;
      const ok = typed !== null && isTypedCorrect(typed, it.a);
      const before = S.items[it.id] ? { ...S.items[it.id] } : null;   // 「正解にする」で元にもどすため
      record(it.id, ok);
      ok ? sound.ok() : sound.ng();
      if (ok && norm(typed) !== norm(it.a) && isReadingMatch(typed, it.a)) toast(`ひらがなでも正解。本番では漢字で「${it.a}」と書こう`);
      const entry = { id: it.id, ok, pick: typed === null ? '（わからない）' : typed };
      sess.log.push(entry);
      input.disabled = true;
      input.classList.add(ok ? 'is-ok' : 'is-ng');
      $('#wform .row').remove();
      showNext(sess, ok, it);
      if (!ok && typed) {
        // 変換ミスや別の正しい書き方を自分で正解にできる
        const fix = document.createElement('button');
        fix.className = 'linkbtn fix'; fix.textContent = '自分の答えも正しい（正解にする）';
        fix.onclick = () => {
          S.items[it.id] = before ? { ...before } : blank();
          applyResult(S.items[it.id], true); save();
          entry.ok = true;
          $('#fb .feedback').outerHTML = feedback(true, it.a, it.e);
          input.classList.replace('is-ng', 'is-ok');
          fix.remove();
        };
        $('#fb .feedback').after(fix);
      }
    };
    $('#wform').onsubmit = e => { e.preventDefault(); if (input.value.trim()) judge(input.value); else input.focus(); };
    $('#giveup').onclick = () => judge(null);
    onKey(e => { if (done && e.key === 'Enter') { e.preventDefault(); next(sess); } });
  }

  /* ===================== タイムアタック ===================== */
  function startTimeAttack(pool) {
    const st = { left: TA_SECONDS, score: 0, log: [], queue: shuffle(pool), qi: 0 };
    const end = () => {
      st.over = true;
      stopTimer(); onKey(null);
      const best = S.best.ta || 0;
      if (st.score > best) S.best.ta = st.score;
      save();
      sound.done();
      renderResult({
        title: 'タイムアタック',
        log: st.log,
        unit: '問正解',
        scoreOverride: st.score,
        msg: st.score > best ? `🏆 自己ベスト更新！（これまで ${best}問）` : `自己ベストは ${S.best.ta}問`,
        again: () => startTimeAttack(pool)
      });
    };
    const ask = () => {
      if (st.qi >= st.queue.length) { st.queue = shuffle(pool); st.qi = 0; }
      const it = st.queue[st.qi++];
      const opts = choicesFor(it);
      view.innerHTML = `
        <div class="qhead">
          <button class="quit" aria-label="やめる">×</button>
          <div class="bar ta"><i id="tbar" style="width:${st.left / TA_SECONDS * 100}%"></i></div>
          <span class="count" id="tleft">${st.left}秒</span>
        </div>
        <div class="ta-score">正解 <b>${st.score}</b>問</div>
        ${questionCard(it)}
        <div class="choices">
          ${opts.map((o, k) => `<button class="choice" data-k="${k}"><span class="no">${k + 1}</span><span>${esc(o)}</span></button>`).join('')}
        </div>`;
      $('.quit').onclick = () => { if (confirm('タイムアタックをやめますか？')) { st.over = true; stopTimer(); renderHome(); } };
      let done = false;
      const answer = k => {
        if (done) return;
        done = true;
        const ok = opts[k] === it.a;
        record(it.id, ok);
        if (ok) { st.score++; sound.ok(); } else sound.ng();
        st.log.push({ q: it.q, a: it.a, ok, pick: opts[k], id: it.id });
        $$('.choice').forEach((b, j) => {
          b.disabled = true;
          if (opts[j] === it.a) b.classList.add('correct'); else if (j === k) b.classList.add('wrong');
        });
        setTimeout(() => { if (!st.over && timer) ask(); }, ok ? 350 : 900);
      };
      $$('.choice').forEach(b => b.onclick = () => answer(+b.dataset.k));
      onKey(e => { if (/^[1-4]$/.test(e.key)) answer(+e.key - 1); });
    };
    stopTimer();
    const t0 = Date.now();
    timer = setInterval(() => {
      st.left = Math.max(0, TA_SECONDS - Math.floor((Date.now() - t0) / 1000));
      const tl = $('#tleft'), tb = $('#tbar');
      if (tl) tl.textContent = st.left + '秒';
      if (tb) tb.style.width = (st.left / TA_SECONDS * 100) + '%';
      if (st.left <= 0) end();
    }, 200);
    ask();
  }

  /* ===================== 結果 ===================== */
  function renderResult(opts) {
    onKey(null); stopTimer();
    renderStreak();
    checkBadges();
    const log = opts.log;
    const n = log.length, ok = log.filter(l => l.ok).length;
    const r = n ? ok / n : 0;
    const msg = opts.msg || (r === 1 ? '全問正解！すばらしい！🎉' : r >= .8 ? 'よくできました！あと少しで満点！' : r >= .5 ? 'その調子！まちがえた問題を復習しよう' : 'くり返しが大切。もう一度チャレンジ！');
    if (n && r === 1 && !opts.msg) sound.done();
    const wrong = log.filter(l => !l.ok);
    const score = opts.scoreOverride !== undefined ? opts.scoreOverride : ok;
    view.innerHTML = `
      <div class="card result-top">
        <div class="muted">${esc(opts.title)} の結果</div>
        <div class="score">${score}<small> ${opts.unit ? opts.unit : `/ ${n}問`}</small></div>
        <div class="msg">${msg}</div>
      </div>
      <div class="row" style="margin-top:14px">
        ${opts.again ? '<button class="btn" id="again">もう一度</button>' : ''}
        ${opts.retry && wrong.length ? `<button class="btn" id="retry">まちがえた${wrong.length}問をやり直す</button>` : ''}
        <button class="btn sub" id="home">ホームへ</button>
      </div>
      ${n ? `<h2>ふりかえり</h2>
      <div class="review">
        ${log.map(l => `<div class="card rv"><span class="mk ${l.ok ? 'o' : 'x'}">${l.ok ? '○' : '×'}</span>
            <div>${l.qHtml || esc(l.q)}<br><span class="a">→ ${esc(l.a)}</span>
            ${!l.ok && l.pick ? `<div class="yours">あなたの答え：${esc(l.pick)}</div>` : ''}</div></div>`).join('')}
      </div>` : ''}`;
    $('#home').onclick = renderHome;
    if (opts.again) $('#again').onclick = opts.again;
    if (opts.retry && wrong.length) $('#retry').onclick = () => opts.retry(wrong);
    window.scrollTo(0, 0);
  }

  /* ===================== 年代ならべかえ ===================== */
  const ERAS = [
    { id: 'all', name: 'すべての時代', from: 0, to: 9999 },
    { id: 'ancient', name: '古代（〜平安）', from: 0, to: 1184 },
    { id: 'medieval', name: '中世（鎌倉〜安土桃山）', from: 1185, to: 1602 },
    { id: 'early', name: '近世（江戸）', from: 1603, to: 1867 },
    { id: 'modern', name: '近代・現代（明治〜）', from: 1868, to: 9999 }
  ];
  function makeSortRound(eraId = 'all') {
    // 年がかぶらない4つのできごとを選ぶ
    const era = ERAS.find(e => e.id === eraId) || ERAS[0];
    const picked = [];
    for (const ev of shuffle(EVENTS.filter(e => e.y >= era.from && e.y <= era.to))) {
      if (picked.every(p => p.y !== ev.y)) picked.push(ev);
      if (picked.length === 4) break;
    }
    return picked;
  }
  let chronoKind = 'sort';   // sort（ならべかえ）| nengo（年号4択）
  function startSort() {
    onKey(null);
    view.innerHTML = `
      <h2 style="margin-top:4px">⏳ 年代・年号</h2>
      <div class="seg" id="ckind">
        <button data-k="sort" class="${chronoKind === 'sort' ? 'on' : ''}">ならべかえ</button>
        <button data-k="nengo" class="${chronoKind === 'nengo' ? 'on' : ''}">年号4択</button>
      </div>
      <p class="muted">${chronoKind === 'sort'
        ? `4つのできごとを古い順にタップしてならべます（${SORT_ROUNDS}問）。`
        : `できごとの年、または年のできごとを4つの中からえらびます（${NENGO_ROUNDS}問）。`}時代をえらんでください。</p>
      <div class="units">
        ${ERAS.map(e => {
          const n = EVENTS.filter(x => x.y >= e.from && x.y <= e.to).length;
          return `<button class="card unit era" data-era="${e.id}"><span class="uico">⏳</span>
            <span><span class="uname">${e.name}</span><span class="umeta"> ・ できごと${n}件</span></span><span class="pct">›</span></button>`;
        }).join('')}
      </div>
      <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
    $$('#ckind button').forEach(b => b.onclick = () => { chronoKind = b.dataset.k; startSort(); });
    $$('[data-era]').forEach(b => b.onclick = () => (chronoKind === 'sort' ? playSort : playNengo)(b.dataset.era));
    $('#home').onclick = renderHome;
    window.scrollTo(0, 0);
  }
  // 年号4択：近い年のできごとを誤答にして、まぎらわしくする
  const NENGO_ROUNDS = 10;
  function playNengo(eraId) {
    const era = ERAS.find(e => e.id === eraId) || ERAS[0];
    const pool = EVENTS.filter(e => e.y >= era.from && e.y <= era.to);
    const qs = shuffle(pool).slice(0, NENGO_ROUNDS);
    const log = [];
    let i = 0;
    const near = ev => {
      const seen = new Set([ev.y]);
      const cand = EVENTS.filter(e => !seen.has(e.y) && (seen.add(e.y), true))
        .sort((a, b) => Math.abs(a.y - ev.y) - Math.abs(b.y - ev.y)).slice(0, 7);
      return shuffle(cand).slice(0, 3);
    };
    const finish = () => renderResult({ title: '年号4択', log, again: () => playNengo(eraId) });
    const ask = () => {
      const ev = qs[i];
      const byYear = i % 2 === 0;   // 交互に「何年？」「何があった？」を出す
      const opts = shuffle([ev, ...near(ev)]);
      const text = byYear ? `「${ev.t}」${/[るすつくぶむう]$/.test(ev.t) ? 'のは' : 'は'}何年？` : `${ev.y}年のできごとは？`;
      view.innerHTML = `${qheader(i, qs.length)}
        <div class="card question"><span class="tag his">歴史</span> <span class="muted">年号4択</span>
          <p class="qt">${esc(text)}</p></div>
        <div class="choices">
          ${opts.map((o, k) => `<button class="choice" data-k="${k}"><span class="no">${k + 1}</span><span>${byYear ? o.y + '年' : esc(o.t)}</span></button>`).join('')}
        </div>
        <div id="fb" role="status" aria-live="polite"></div>`;
      bindQuit(() => log.length > 0, finish);
      let done = false;
      const answer = k => {
        if (done) return;
        done = true;
        const ok = opts[k] === ev;
        ok ? sound.ok() : sound.ng();
        touchDay(); save();
        $$('.choice').forEach((b, j) => {
          b.disabled = true;
          if (opts[j] === ev) b.classList.add('correct'); else if (j === k) b.classList.add('wrong');
        });
        log.push({ q: text, a: byYear ? ev.y + '年' : ev.t, ok, pick: byYear ? opts[k].y + '年' : opts[k].t });
        $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
            <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
            ${ev.goro ? `<div class="goro">💡 ${esc(ev.goro)}</div>` : ''}
            <div class="exp">${opts.slice().sort((a, b) => a.y - b.y).map(o => `${o.y}年　${esc(o.t)}`).join('<br>')}</div>
          </div>
          <div class="next-wrap"><button class="btn block" id="next">${i + 1 < qs.length ? '次の問題へ' : '結果を見る'}</button></div>`;
        $('#next').onclick = () => { i++; i < qs.length ? ask() : finish(); };
        $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      $$('.choice').forEach(b => b.onclick = () => answer(+b.dataset.k));
      onKey(e => {
        if (!done && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
        else if (done && e.key === 'Enter') { e.preventDefault(); $('#next').click(); }
      });
      window.scrollTo(0, 0);
    };
    ask();
  }
  function playSort(era) {
    renderSort({ round: 0, score: 0, era, set: makeSortRound(era), log: [] });
  }
  function renderSort(st) {
    const order = [];   // 選んだ順のインデックス
    let checked = false;
    const correctOrder = st.set.map((e, k) => k).sort((a, b) => st.set[a].y - st.set[b].y);
    const draw = () => {
      view.innerHTML = `
        ${qheader(st.round, SORT_ROUNDS)}
        <div class="card question"><span class="tag his">歴史</span> <span class="muted">年代ならべかえ</span>
          <p class="qt">古いものから順にタップしよう</p></div>
        <div class="events">
          ${st.set.map((e, k) => {
            const pos = order.indexOf(k);
            let cls = pos >= 0 ? 'picked' : '';
            if (checked) cls += order[correctOrder.indexOf(k)] === k ? ' correct' : ' wrong';
            return `<button class="event ${cls}" data-k="${k}" ${checked ? 'disabled' : ''}>
              <span class="ord">${pos >= 0 ? pos + 1 : ''}</span><span>${esc(e.t)}</span>
              ${checked ? `<span class="yr">${e.y}年</span>` : ''}</button>`;
          }).join('')}
        </div>
        <div id="fb" role="status" aria-live="polite"></div>
        <div class="next-wrap">
          ${checked
            ? `<button class="btn block" id="next">${st.round + 1 < SORT_ROUNDS ? '次の問題へ' : '結果を見る'}</button>`
            : `<div class="row"><button class="btn sub" id="undo" ${order.length ? '' : 'disabled'} style="flex:0 0 auto">1つもどす</button>
               <button class="btn" id="check" ${order.length === 4 ? '' : 'disabled'}>答え合わせ</button></div>`}
        </div>`;
      bindQuit(() => st.round > 0 || checked, finish);
      if (checked) {
        const ok = correctOrder.every((k, p) => order[p] === k);
        $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
          <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
          <div class="exp">正しい順：${correctOrder.map(k => `${esc(st.set[k].t)}（${st.set[k].y}年）`).join(' → ')}</div></div>`;
        $('#next').onclick = () => {
          st.round++;
          if (st.round >= SORT_ROUNDS) return finish();
          st.set = makeSortRound(st.era);
          renderSort(st);
        };
      } else {
        $$('.event').forEach(b => b.onclick = () => {
          const k = +b.dataset.k, p = order.indexOf(k);
          if (p >= 0) order.splice(p, 1); else if (order.length < 4) order.push(k);
          draw();
        });
        $('#undo').onclick = () => { order.pop(); draw(); };
        $('#check').onclick = () => {
          checked = true;
          const ok = correctOrder.every((k, p) => order[p] === k);
          if (ok) { st.score++; sound.ok(); } else sound.ng();
          st.log.push({
            q: order.map(k => st.set[k].t).join(' → '),
            a: correctOrder.map(k => `${st.set[k].t}（${st.set[k].y}）`).join(' → '),
            ok
          });
          touchDay(); save(); renderStreak();
          draw();
        };
      }
    };
    const finish = () => {
      S.sort.played++;
      if (st.score === SORT_ROUNDS) S.sort.perfect++;
      save();
      renderResult({
        title: '年代ならべかえ',
        log: st.log.map(l => ({ q: 'あなたの順：' + l.q, a: l.a, ok: l.ok })),
        msg: st.score === SORT_ROUNDS ? 'パーフェクト！年代はバッチリ！🎉' : `年号はゴロ合わせで覚えるのもおすすめ！（これまで ${S.sort.played}回・パーフェクト ${S.sort.perfect}回）`,
        again: () => playSort(st.era)
      });
    };
    onKey(e => {
      if (!checked && /^[1-4]$/.test(e.key)) $(`.event[data-k="${+e.key - 1}"]`).click();
      else if (!checked && e.key === 'Backspace') $('#undo').click();
      else if (e.key === 'Enter') { e.preventDefault(); const b = checked ? $('#next') : $('#check'); if (b && !b.disabled) b.click(); }
    });
    draw();
    window.scrollTo(0, 0);
  }

  /* ===================== 学習の記録 ===================== */
  function renderStats() {
    onKey(null); stopTimer();
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = addDays(-i); days.push({ d, n: S.days[d] || 0 }); }
    const maxN = Math.max(10, ...days.map(x => x.n));
    const total = Object.values(S.days).reduce((a, b) => a + b, 0);
    const studyDays = Object.keys(S.days).length;
    const weakList = ALL.filter(it => isWeak(it.id))
      .sort((a, b) => S.items[b.id].w - S.items[a.id].w).slice(0, 10);
    const wd = ['日', '月', '火', '水', '木', '金', '土'];

    view.innerHTML = `
      <h2 style="margin-top:4px">📊 学習の記録</h2>
      <div class="stats">
        <div class="card stat"><div class="num">${total}</div><div class="lbl">これまでといた数</div></div>
        <div class="card stat"><div class="num">${studyDays}</div><div class="lbl">学習した日数</div></div>
        <div class="card stat"><div class="num">${S.streak && S.lastDay >= addDays(-1) ? S.streak : 0}</div><div class="lbl">連続学習日数</div></div>
      </div>

      <h2>バッジ（${(S.badges || []).length}/${BADGES.length}）</h2>
      <div class="badges">
        ${BADGES.map(b => {
          const got = (S.badges || []).includes(b.id);
          return `<div class="card badge ${got ? 'got' : ''}" title="${esc(b.desc)}"><span class="bi">${got ? b.icon : '🔒'}</span>
            <b>${esc(b.name)}</b><span class="muted">${esc(b.desc)}</span></div>`;
        }).join('')}
      </div>

      <h2>最近2週間</h2>
      <div class="card chart">
        ${days.map(x => {
          const dt = new Date(x.d + 'T00:00:00');
          return `<div class="col" title="${x.d}：${x.n}問">
            <span class="cn">${x.n || ''}</span>
            <i style="height:${x.n / maxN * 100}%"></i>
            <span class="cd ${dt.getDay() === 0 ? 'sun' : dt.getDay() === 6 ? 'sat' : ''}">${dt.getDate()}<br>${wd[dt.getDay()]}</span>
          </div>`;
        }).join('')}
      </div>

      <h2>単元ごとの成績</h2>
      <div class="card table-wrap">
        <table class="utable">
          <thead><tr><th>単元</th><th>正答率</th><th>覚えた</th></tr></thead>
          <tbody>
          ${UNITS.map(u => {
            const rs = u.items.map(it => S.items[it.id]).filter(Boolean);
            const c = rs.reduce((n, r) => n + r.c, 0), w = rs.reduce((n, r) => n + r.w, 0);
            const m = u.items.filter(it => isMastered(it.id)).length;
            return `<tr><td><span class="dot ${u.field}"></span>${esc(u.name)}</td>
              <td>${c + w ? Math.round(c / (c + w) * 100) + '%' : '–'}</td>
              <td>${m}/${u.items.length}</td></tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>

      <h2>よくまちがえる問題</h2>
      ${weakList.length ? `<div class="review">${weakList.map(it => `<div class="card rv"><span class="mk x">${S.items[it.id].w}</span>
        <div>${esc(it.q)}<br><span class="a">→ ${esc(it.a)}</span></div></div>`).join('')}</div>`
        : '<p class="muted">まちがえた問題はまだありません。</p>'}

      <div class="row no-print" style="margin-top:20px">
        <button class="btn sub" id="print">📄 プリントをつくる</button>
        <button class="btn sub" id="printstats">🖨 この記録を印刷</button>
      </div>
      <div class="row no-print" style="margin-top:10px"><button class="btn sub" id="home">ホームへ</button></div>`;
    $('#printstats').onclick = () => window.print();
    $('#home').onclick = renderHome;
    $('#print').onclick = renderPrint;
    window.scrollTo(0, 0);
  }

  /* ===================== 印刷用プリント ===================== */
  function renderPrint() {
    onKey(null); stopTimer();
    const weak = ALL.filter(it => isWeak(it.id));
    let src = weak.length ? 'weak' : UNITS[0].id;
    let count = 20;
    let seed = shuffle(ALL.map(it => it.id));   // 並び順（「問題を入れかえる」で変わる）
    const pick = () => {
      const items = src === 'weak' ? weak : UNIT[src].items;
      const order = Object.fromEntries(seed.map((id, k) => [id, k]));
      return items.slice().sort((a, b) => order[a.id] - order[b.id]).slice(0, count || items.length);
    };
    const draw = () => {
      const items = pick();
      const title = src === 'weak' ? '苦手な問題' : UNIT[src].name;
      view.innerHTML = `
        <div class="no-print">
          <h2 style="margin-top:4px">📄 プリントをつくる</h2>
          <p class="muted">問題用紙と解答を印刷できます。紙に書いて覚えたいときに使ってください。</p>
          <div class="card setting col">
            <label><b>出題する問題</b><br>
              <select id="src" class="select">
                ${weak.length ? `<option value="weak" ${src === 'weak' ? 'selected' : ''}>苦手な問題（${weak.length}問）</option>` : ''}
                ${FIELDS.map(f => `<optgroup label="${f.name}">${UNITS.filter(u => u.field === f.id).map(u =>
                  `<option value="${u.id}" ${src === u.id ? 'selected' : ''}>${esc(u.name)}（${u.items.length}問）</option>`).join('')}</optgroup>`).join('')}
              </select></label>
            <div class="seg" id="pcount">${[10, 20, 30, 0].map(k => `<button data-n="${k}" class="${count === k ? 'on' : ''}">${k ? k + '問' : 'ぜんぶ'}</button>`).join('')}</div>
            <div class="row">
              <button class="btn sub" id="shuffle">問題を入れかえる</button>
              <button class="btn" id="doprint">🖨 印刷する</button>
            </div>
          </div>
          <h2>プレビュー</h2>
        </div>
        <div class="sheet">
          <div class="sheet-head">
            <div><b>社会 暗記プリント</b>　${esc(title)}</div>
            <div class="sheet-name">　　月　　日　名前<span></span>　　　／${items.length}</div>
          </div>
          <ol class="sheet-list">
            ${items.map(it => `<li><span class="sq">${esc(it.q)}</span><span class="sline"></span></li>`).join('')}
          </ol>
          <div class="sheet-answers">
            <div class="sheet-head"><b>解答</b>　${esc(title)}</div>
            <ol class="ans-list">${items.map(it => `<li>${esc(it.a)}</li>`).join('')}</ol>
          </div>
        </div>
        <div class="row no-print" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $('#src').onchange = e => { src = e.target.value; draw(); };
      $$('#pcount button').forEach(b => b.onclick = () => { count = +b.dataset.n; draw(); });
      $('#shuffle').onclick = () => { seed = shuffle(seed); draw(); };
      $('#doprint').onclick = () => window.print();
      $('#home').onclick = renderHome;
    };
    draw();
    window.scrollTo(0, 0);
  }

  /* ===================== 設定 ===================== */
  function renderSettings() {
    onKey(null); stopTimer();
    const sw = (key, label, desc) => `<label class="card setting">
        <span><b>${label}</b><br><span class="muted">${desc}</span></span>
        <input type="checkbox" class="toggle" data-key="${key}" ${S.settings[key] ? 'checked' : ''}></label>`;
    view.innerHTML = `
      <h2 style="margin-top:4px">⚙ 設定</h2>
      <h2>ユーザー</h2>
      <p class="muted">きょうだいなどで使うときは、ユーザーを分けると学習記録が別々に保存されます。</p>
      <div class="users">
        ${P.list.map(u => `<div class="card user ${u.id === P.cur ? 'cur' : ''}">
          <button class="user-main" data-switch="${u.id}"><span class="ui">${u.icon}</span><b>${esc(u.name)}</b>${u.id === P.cur ? '<span class="tag geo">使用中</span>' : ''}</button>
          <button class="linkbtn" data-rename="${u.id}">名前</button>
          ${P.list.length > 1 ? `<button class="linkbtn" data-del="${u.id}">削除</button>` : ''}
        </div>`).join('')}
        ${P.list.length < 6 ? '<button class="btn sub" id="adduser">＋ ユーザーを追加</button>' : ''}
      </div>
      <h2>表示と音</h2>
      ${sw('sound', '効果音', '正解・不正解のときに音を鳴らす')}
      ${sw('big', '文字を大きくする', '問題や選択肢を大きく表示する')}
      <div class="card setting col">
        <span><b>1日の目標</b><br><span class="muted">1日にとく問題数の目標。達成するとお知らせします。</span></span>
        <div class="seg" id="goal">${[0, 10, 20, 30, 50].map(g => `<button data-g="${g}" class="${S.settings.goal === g ? 'on' : ''}">${g ? g + '問' : 'なし'}</button>`).join('')}</div>
      </div>

      <h2>データ</h2>
      <div class="card setting col">
        <span><b>学習記録のバックアップ</b><br><span class="muted">記録はこの端末のブラウザに保存されています。別の端末に移すときは書き出したファイルを読みこんでください。</span></span>
        <div class="row">
          <button class="btn sub" id="export">書き出す</button>
          <button class="btn sub" id="import">読みこむ</button>
        </div>
        <input type="file" id="file" accept="application/json,.json" class="hidden">
      </div>
      <button class="danger" id="reset">学習記録をすべてリセット</button>
      <div class="row" style="margin-top:20px"><button class="btn sub" id="home">ホームへ</button></div>`;
    $$('.toggle').forEach(t => t.onchange = () => { S.settings[t.dataset.key] = t.checked; save(); applySettings(); if (t.dataset.key === 'sound' && t.checked) sound.ok(); });
    $$('#goal button').forEach(b => b.onclick = () => {
      S.settings.goal = +b.dataset.g; save();
      $$('#goal button').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#home').onclick = renderHome;
    $$('[data-switch]').forEach(b => b.onclick = () => switchUser(b.dataset.switch));
    $$('[data-rename]').forEach(b => b.onclick = () => {
      const u = P.list.find(x => x.id === b.dataset.rename);
      const name = (prompt('名前を入力してください', u.name) || '').trim().slice(0, 10);
      if (name) { u.name = name; saveProfiles(); renderStreak(); renderSettings(); }
    });
    $$('[data-del]').forEach(b => b.onclick = () => {
      const u = P.list.find(x => x.id === b.dataset.del);
      if (!confirm(`「${u.name}」と、その学習記録をすべて削除します。よろしいですか？`)) return;
      try { localStorage.removeItem(keyOf(u.id)); } catch (e) { /* 保存できない環境 */ }
      P.list = P.list.filter(x => x !== u);
      if (P.cur === u.id) { P.cur = P.list[0].id; S = load(P.cur); applySettings(); }
      saveProfiles(); renderStreak(); renderSettings();
    });
    const add = $('#adduser');
    if (add) add.onclick = () => {
      const name = (prompt('新しいユーザーの名前', '') || '').trim().slice(0, 10);
      if (!name) return;
      let n = 2;
      while (P.list.some(x => x.id === 'p' + n)) n++;
      const icon = USER_ICONS.find(i => !P.list.some(x => x.icon === i)) || '🙂';
      P.list.push({ id: 'p' + n, name, icon });
      saveProfiles();
      switchUser('p' + n);
    };
    $('#export').onclick = () => {
      const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `shakai-drill-${today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('#import').onclick = () => $('#file').click();
    $('#file').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!isObj(data) || !isObj(data.items)) throw new Error('bad');
        if (!confirm('いまの記録を、読みこんだファイルの記録で置きかえます。よろしいですか？')) return;
        // 保存してから読みなおし、古い形式の移行や形のチェックを通す
        localStorage.setItem(keyOf(P.cur), JSON.stringify(data));
        S = load(P.cur); save();
        applySettings(); toast('記録を読みこみました'); renderHome();
      } catch (err) { toast('ファイルを読みこめませんでした'); }
    };
    $('#reset').onclick = () => {
      if (confirm('これまでの学習記録をすべて消去します。よろしいですか？')) {
        const settings = S.settings;
        S = fresh(); S.settings = settings; save(); renderHome(); toast('記録をリセットしました');
      }
    };
    window.scrollTo(0, 0);
  }

  function switchUser(id) {
    if (id === P.cur) return;
    P.cur = id; saveProfiles();
    S = load(id); save();
    applySettings();
    const u = curUser();
    toast(`${u.icon} ${u.name} に切りかえました`);
    renderHome();
  }

  /* ===================== 起動 ===================== */
  const leaveOk = () => !view.querySelector('.qhead') || confirm('ホームにもどりますか？');
  $('#btn-home').onclick = () => { if (leaveOk()) renderHome(); };
  $('#btn-stats').onclick = () => { if (leaveOk()) renderStats(); };
  $('#btn-settings').onclick = () => { if (leaveOk()) renderSettings(); };
  (window.SHAKAI_EXT || []).forEach(f => f(App));
  applySettings();
  save();
  renderHome();

  // ホーム画面に追加したときにオフラインでも使えるようにする（http/https のときだけ）
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 登録できなくても通常どおり動く */ });
  }

  // テスト用に一部の関数を公開
  window.__shakai = { isTypedCorrect, norm, choicesFor, idOf: q => (ALL.find(it => it.q === q) || {}).id };
})();
