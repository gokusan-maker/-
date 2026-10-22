/* =========================================================================
 * 武将英語 ― アプリ本体
 * ========================================================================= */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $('#view');
  const overlay = $('#overlay');
  const W_BY_ID = Object.fromEntries(WARLORDS.map(w => [w.id, w]));
  const V_BY_ID = Object.fromEntries(VOCAB.map(v => [v.id, v]));

  /* ===================== 定数 ===================== */
  const RARITY = {
    UR: { rate: 3, maxLv: 60, color: '#c77dff', label: 'UR' },
    SSR: { rate: 9, maxLv: 50, color: '#ffd34d', label: 'SSR' },
    SR: { rate: 28, maxLv: 40, color: '#dfe4ea', label: 'SR' },
    R: { rate: 60, maxLv: 30, color: '#e0a070', label: 'R' }
  };
  const RANK = { UR: 4, SSR: 3, SR: 2, R: 1 };
  const MAX_BREAK = 5;
  const PITY = 80;
  const COST_1 = 100, COST_10 = 900;
  const QUESTIONS = 10;
  const DAILY_BONUS = 100;
  const STORE_KEY = 'busho-eigo-v1';

  /* ===================== 状態 ===================== */
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const fresh = () => ({
    v: 1, koban: 900, owned: {}, deployed: null, pity: 0, totalPulls: 0,
    words: {}, lastLogin: null, streak: 0, todayCount: 0, todayDate: today(),
    stats: { battles: 0, wins: 0, correct: 0, answered: 0 },
    settings: { sound: true, voice: true, autoSpeak: true }
  });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}); }
  catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 保存不可環境 */ } };

  /* ===================== サウンド ===================== */
  let actx;
  function tone(freqs, dur = .12, type = 'triangle', gap = .08, vol = .18) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime;
      freqs.forEach((fq, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; o.frequency.value = fq;
        g.gain.setValueAtTime(0, t0 + i * gap);
        g.gain.linearRampToValueAtTime(vol, t0 + i * gap + .01);
        g.gain.exponentialRampToValueAtTime(.001, t0 + i * gap + dur);
        o.connect(g).connect(actx.destination);
        o.start(t0 + i * gap); o.stop(t0 + i * gap + dur + .05);
      });
    } catch (e) { /* 音声非対応 */ }
  }
  const sfx = {
    ok: () => tone([660, 990], .18, 'triangle', .07),
    ng: () => tone([180, 140], .25, 'sawtooth', .1, .1),
    tap: () => tone([520], .05, 'sine', 0, .08),
    lvup: () => tone([523, 659, 784, 1046, 1318], .25, 'triangle', .09),
    seal: () => tone([220, 330, 440, 660, 880, 1320], .3, 'sine', .07, .14),
    ur: () => tone([784, 988, 1175, 1568, 1976, 2349], .5, 'triangle', .1, .16),
    taiko: () => tone([90, 70], .3, 'sine', .12, .35)
  };

  /* ===================== 音声読み上げ ===================== */
  function speak(text, rate = .92) {
    if (!S.settings.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[\[\]]/g, ''));
      u.lang = 'en-US'; u.rate = rate;
      const voices = speechSynthesis.getVoices();
      const v = voices.find(v => /en-(US|GB)/.test(v.lang) && /Samantha|Google|Daniel|Karen|Natural/i.test(v.name)) || voices.find(v => v.lang && v.lang.startsWith('en'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* 読み上げ非対応 */ }
  }
  const canSpeak = () => 'speechSynthesis' in window;

  /* ===================== ユーティリティ ===================== */
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n.toLocaleString('ja-JP');
  function toast(msg, ms = 2000) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
  }
  function updateWallet() { $('#koban').textContent = fmt(S.koban); }

  /* ===================== 武将の成長 ===================== */
  const maxLv = (w, o) => RARITY[w.rarity].maxLv + (o ? o.brk : 0) * 5;
  const needExp = lv => 40 + lv * 20;
  function statsOf(w, o) {
    const lv = o ? o.lv : 1;
    const k = .55 + lv * .0075 + (o ? o.brk : 0) * .02;
    return { bu: Math.round(w.stats.bu * k), chi: Math.round(w.stats.chi * k), tou: Math.round(w.stats.tou * k) };
  }
  const power = (w, o) => { const s = statsOf(w, o); return s.bu + s.chi + s.tou; };
  function addExp(id, amount) {
    const o = S.owned[id], w = W_BY_ID[id];
    let ups = 0;
    o.exp += amount;
    while (o.lv < maxLv(w, o) && o.exp >= needExp(o.lv)) { o.exp -= needExp(o.lv); o.lv++; ups++; }
    if (o.lv >= maxLv(w, o)) o.exp = Math.min(o.exp, needExp(o.lv));
    return ups;
  }
  function deployedSkill() {
    const w = S.deployed && W_BY_ID[S.deployed];
    return w ? w.skill : { type: 'none', value: 0 };
  }

  /* ===================== カード描画 ===================== */
  const artCache = {};
  function art(w, sil) {
    const key = w.id + (sil ? ':s' : '');
    if (!artCache[key]) artCache[key] = Portrait.render(JSON.parse(JSON.stringify(w)), { silhouette: sil });
    return artCache[key];
  }
  function monSvg(w, color = '#f3d27a') {
    return `<svg viewBox="-22 -22 44 44" class="mon-badge"><circle r="21" fill="rgba(0,0,0,.55)" stroke="${color}" stroke-width="1"/>${Portrait.mon(w.mon, 0, 0, 15, color, '#000')}</svg>`;
  }
  function cardHtml(w, opt = {}) {
    const o = S.owned[w.id];
    const locked = opt.locked;
    const stars = o ? '★'.repeat(o.brk) + '<span style="opacity:.25">' + '★'.repeat(MAX_BREAK - o.brk) + '</span>' : '';
    return `<div class="card r-${w.rarity} ${locked ? 'locked' : ''} ${opt.big ? 'big' : ''}" data-id="${w.id}">
      <div class="art">${art(w, locked)}</div>
      <div class="frame"></div>
      <div class="rar">${w.rarity}</div>
      ${!locked ? monSvg(w) : ''}
      ${opt.isNew ? '<div class="new-badge">NEW</div>' : ''}
      ${opt.deployed ? '<div class="deployed-tag">出陣中</div>' : ''}
      ${locked ? '<div class="q">？</div>' : ''}
      <div class="plate">
        <div class="title">${locked ? '' : esc(w.title)}</div>
        <div class="name">${locked ? '？？？' : esc(w.name)}</div>
        ${!locked && o && !opt.noMeta ? `<div class="meta"><span class="stars">${stars}</span><span class="lv">Lv.${o.lv}</span></div>` : ''}
      </div>
    </div>`;
  }

  /* ===================== ルーティング ===================== */
  let current = 'home';
  function go(tab) {
    current = tab;
    if (window.speechSynthesis) speechSynthesis.cancel();
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    ({ home: renderHome, battle: renderBattleSelect, gacha: renderGacha, roster: renderRoster, words: renderWords })[tab]();
    window.scrollTo(0, 0);
    updateWallet();
  }
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => { sfx.tap(); go(b.dataset.tab); }));
  $('#btn-settings').addEventListener('click', openSettings);

  /* ===================== ログインボーナス ===================== */
  function dailyCheck() {
    const t = today();
    if (S.todayDate !== t) { S.todayDate = t; S.todayCount = 0; }
    if (S.lastLogin === t) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    S.streak = S.lastLogin === yd ? S.streak + 1 : 1;
    const first = !S.lastLogin;
    S.lastLogin = t;
    if (!first) {
      const bonus = DAILY_BONUS + Math.min(S.streak - 1, 6) * 20;
      S.koban += bonus;
      setTimeout(() => toast(`登城の褒美：小判 ${bonus} 枚（${S.streak}日連続）`, 3000), 400);
    }
    save();
  }

  /* ===================== 本陣 ===================== */
  function renderHome() {
    const w = S.deployed && W_BY_ID[S.deployed];
    if (!w) {
      view.innerHTML = `<div class="panel empty">
        <div class="big">天下統一の旅へ、ようこそ</div>
        <p class="sub">英語を学ぶほど、配下の武将が強くなる。<br>まずは「召喚」で最初の武将を迎えましょう。</p>
        <div class="gacha-hero mt" style="aspect-ratio:16/10"><div class="cards-fan">${fanCards()}</div></div>
        <button class="btn gold block mt" id="go-gacha">武将を召喚する（小判${COST_10}枚で10連）</button>
      </div>`;
      $('#go-gacha').onclick = () => go('gacha');
      return;
    }
    const o = S.owned[w.id];
    const st = statsOf(w, o);
    const atMax = o.lv >= maxLv(w, o);
    const mastered = Object.values(S.words).filter(x => x.s >= 3).length;
    view.innerHTML = `
      <div class="hero">
        <div>${cardHtml(w)}</div>
        <div class="info">
          <div><span class="chip">${esc(w.clan)}</span> <span class="chip">出陣中</span></div>
          <div>
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <b style="font-family:var(--en);font-size:24px">Lv.${o.lv}<small style="font-size:13px;color:var(--muted)"> / ${maxLv(w, o)}</small></b>
              <span class="sub">${atMax ? '限界' : `${o.exp}/${needExp(o.lv)}`}</span>
            </div>
            <div class="bar mt" style="margin-top:6px"><i style="width:${atMax ? 100 : o.exp / needExp(o.lv) * 100}%"></i></div>
          </div>
          <div>
            <div class="stat-row"><span>武力</span><b>${st.bu}</b></div>
            <div class="stat-row"><span>知略</span><b>${st.chi}</b></div>
            <div class="stat-row"><span>統率</span><b>${st.tou}</b></div>
          </div>
          <div class="skill-box"><div class="sk-name">【${esc(w.skill.name)}】</div>${esc(w.skill.desc)}</div>
        </div>
      </div>
      <div class="panel mt">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <div style="flex:1"><div class="quote">“${esc(w.quote.en)}”</div><div class="quote-ja">${esc(w.quote.ja)}</div></div>
          ${canSpeak() ? '<button class="speak" id="sp-quote" aria-label="読み上げ">🔊</button>' : ''}
        </div>
      </div>
      <div class="panel mt">
        <div class="daily">
          <div><b>${S.streak}</b><span>連続登城</span></div>
          <div><b>${S.todayCount}</b><span>本日の解答</span></div>
          <div><b>${mastered}</b><span>習得語</span></div>
        </div>
        <button class="btn block mt" id="go-battle">⚔ 合戦へ出陣（英語を学ぶ）</button>
        <div class="row mt">
          <button class="btn ghost" id="go-roster">武将を替える</button>
          <button class="btn ghost" id="go-gacha2">召喚する</button>
        </div>
      </div>`;
    $('#go-battle').onclick = () => go('battle');
    $('#go-roster').onclick = () => go('roster');
    $('#go-gacha2').onclick = () => go('gacha');
    const sq = $('#sp-quote'); if (sq) sq.onclick = () => speak(w.quote.en);
    $('.hero .card').onclick = () => openDetail(w.id);
  }
  function fanCards() {
    const pick = ['shingen', 'nobunaga', 'masamune'].map(id => W_BY_ID[id]);
    return pick.map((w, i) => `<div style="position:absolute;width:30%;transform:translateX(${(i - 1) * 62}%) rotate(${(i - 1) * 10}deg) translateY(${i === 1 ? -4 : 6}%);z-index:${i === 1 ? 2 : 1}">${cardHtml(w, { noMeta: true })}</div>`).join('');
  }

  /* ===================== 合戦（学習） ===================== */
  let battleCfg = { cat: 'all' };
  function catProgress(cat) {
    const list = VOCAB.filter(v => cat === 'all' || v.cat === cat);
    const m = list.filter(v => (S.words[v.id] || {}).s >= 3).length;
    return `${m}/${list.length} 習得`;
  }
  function weakWords() { return VOCAB.filter(v => { const r = S.words[v.id]; return r && r.w > 0 && r.s < 2; }); }
  function renderBattleSelect() {
    if (!S.deployed) {
      view.innerHTML = `<div class="panel empty"><div class="big">出陣する武将がいません</div><p class="sub">まずは召喚で武将を迎えましょう。</p><button class="btn gold block" id="g">召喚へ</button></div>`;
      $('#g').onclick = () => go('gacha');
      return;
    }
    const w = W_BY_ID[S.deployed];
    const weak = weakWords().length;
    view.innerHTML = `
      <div class="h2">戦場を選べ</div>
      <p class="sub" style="margin-top:-4px">全${QUESTIONS}問。正解するたびに敵軍を討ち、<b style="color:var(--gold2)">${esc(w.name)}</b>が経験を積む。</p>
      <div class="cat-grid mt">
        <button class="cat ${battleCfg.cat === 'all' ? 'sel' : ''}" data-cat="all"><div class="ci">🏯</div><div class="cn">総力戦</div><div class="cd">全分野から出題</div><div class="cp">${catProgress('all')}</div></button>
        ${VOCAB_CATEGORIES.map(c => `<button class="cat ${battleCfg.cat === c.id ? 'sel' : ''}" data-cat="${c.id}"><div class="ci">${c.icon}</div><div class="cn">${esc(c.name)}</div><div class="cd">${esc(c.desc)}</div><div class="cp">${catProgress(c.id)}</div></button>`).join('')}
        <button class="cat ${battleCfg.cat === 'weak' ? 'sel' : ''}" data-cat="weak" ${weak < 4 ? 'disabled style="opacity:.45"' : ''}><div class="ci">🔥</div><div class="cn">雪辱戦</div><div class="cd">間違えた語を復習</div><div class="cp">${weak}語</div></button>
      </div>
      <div class="panel mt">
        <div class="skill-box"><div class="sk-name">出陣武将の特技【${esc(w.skill.name)}】</div>${esc(w.skill.desc)}</div>
        <button class="btn block mt" id="start">⚔ 出陣！</button>
      </div>`;
    $$('.cat').forEach(b => b.onclick = () => { battleCfg.cat = b.dataset.cat; sfx.tap(); renderBattleSelect(); });
    $('#start').onclick = () => { sfx.taiko(); startBattle(battleCfg.cat); };
  }

  function pickWords(cat, n) {
    let pool = cat === 'all' ? VOCAB : cat === 'weak' ? weakWords() : VOCAB.filter(v => v.cat === cat);
    // 習熟度が低い語ほど出やすい
    const weighted = pool.map(v => {
      const r = S.words[v.id] || { s: 0, w: 0, c: 0 };
      const wgt = (r.s >= 3 ? .35 : 1) + r.w * .5 + (r.c === 0 ? .6 : 0);
      return { v, k: Math.random() * wgt };
    }).sort((a, b) => b.k - a.k).map(x => x.v);
    const out = weighted.slice(0, n);
    while (out.length < n && pool.length) out.push(pool[Math.floor(Math.random() * pool.length)]);
    return out;
  }
  const blankOf = v => (v.ex.match(/\[(.+?)\]/) || [, v.en])[1];

  function makeQuestion(v) {
    const types = ['en2ja', 'ja2en', 'fill'];
    if (canSpeak() && S.settings.voice) types.push('listen');
    const type = types[Math.floor(Math.random() * types.length)];
    const same = shuffle(VOCAB.filter(x => x.cat === v.cat && x.id !== v.id));
    const others = same.slice(0, 3);
    let choices, answer;
    if (type === 'en2ja' || type === 'listen') { answer = v.ja; choices = others.map(x => x.ja); }
    else if (type === 'ja2en') { answer = v.en; choices = others.map(x => x.en); }
    else { answer = blankOf(v); choices = others.map(blankOf); }
    return { v, type, answer, choices: shuffle([answer, ...choices]) };
  }

  let B = null;
  function startBattle(cat) {
    const words = pickWords(cat, QUESTIONS);
    const sk = deployedSkill();
    B = {
      cat, qs: words.map(makeQuestion), i: 0, combo: 0, maxCombo: 0, results: [],
      exp: 0, koban: 0, guard: sk.type === 'guard' ? sk.value : 0, hints: sk.type === 'hint' ? sk.value : 0, answered: false
    };
    renderQuestion();
  }

  function renderQuestion() {
    const q = B.qs[B.i];
    const w = W_BY_ID[S.deployed];
    const hp = 100 - (B.results.filter(r => r).length / QUESTIONS) * 100;
    const label = { en2ja: '英 → 和　意味を選べ', ja2en: '和 → 英　英語を選べ', fill: '穴埋め　空欄を埋めよ', listen: '聴解　聞こえた語の意味を選べ' }[q.type];
    let prompt = '';
    if (q.type === 'en2ja') prompt = `<div class="qtext">${esc(q.v.en)} ${canSpeak() ? '<button class="speak" data-say="1">🔊</button>' : ''}</div>`;
    else if (q.type === 'ja2en') prompt = `<div class="qtext ja">${esc(q.v.ja)}</div>`;
    else if (q.type === 'fill') prompt = `<div class="qtext sentence">${esc(q.v.ex).replace(/\[(.+?)\]/, '<span class="blank">&nbsp;</span>')}</div><div class="qhint">${esc(q.v.exJa)}</div>`;
    else prompt = `<button class="listen-btn" data-say="1" aria-label="もう一度聞く">🔊</button><div class="qhint" style="text-align:center">タップでもう一度</div>`;
    const enChoices = q.type === 'ja2en' || q.type === 'fill';
    view.innerHTML = `
      <div class="battle-head">
        <div class="mini">${cardHtml(w, { noMeta: true })}</div>
        <div class="enemy">
          <div class="enemy-label"><span>敵軍 第${B.i + 1}陣 / ${QUESTIONS}</span><span>兵力 ${Math.round(hp)}%</span></div>
          <div class="bar red"><i style="width:${hp}%"></i></div>
          <div class="progress-dots">${B.qs.map((_, k) => `<i class="${k < B.results.length ? (B.results[k] ? 'ok' : 'ng') : k === B.i ? 'cur' : ''}"></i>`).join('')}</div>
        </div>
        <div class="combo">${B.combo > 1 ? B.combo + '連' : ''}<small>${B.guard ? `守り×${B.guard}` : ''}</small></div>
      </div>
      <div class="panel qbox" id="qbox">
        <div class="qtype">${label}</div>
        ${prompt}
        <div class="choices">${q.choices.map((c, k) => `<button class="choice ${enChoices ? 'en' : ''}" data-k="${k}">${esc(c)}</button>`).join('')}</div>
        <div id="after"></div>
      </div>
      <div class="tools">
        ${B.hints ? `<button class="btn ghost" id="hint">策を講じる（誤答を1つ消す・残${B.hints}）</button>` : ''}
        <button class="btn ghost" id="retreat" style="flex:0 0 auto">撤退</button>
      </div>`;
    $$('[data-say]').forEach(b => b.onclick = () => speak(q.v.en));
    if (q.type === 'listen' || (q.type === 'en2ja' && S.settings.autoSpeak)) setTimeout(() => speak(q.v.en), 250);
    $$('.choice').forEach(b => b.onclick = () => answer(+b.dataset.k));
    const hb = $('#hint');
    if (hb) hb.onclick = () => {
      const wrong = $$('.choice').filter(b => !b.classList.contains('removed') && q.choices[+b.dataset.k] !== q.answer);
      if (!wrong.length || B.answered) return;
      wrong[Math.floor(Math.random() * wrong.length)].classList.add('removed');
      B.hints--; hb.remove(); sfx.tap();
    };
    $('#retreat').onclick = () => { if (confirm('撤退しますか？（この合戦の報酬は得られません）')) { B = null; go('battle'); } };
  }

  function answer(k) {
    if (B.answered) return;
    B.answered = true;
    const q = B.qs[B.i];
    const ok = q.choices[k] === q.answer;
    const sk = deployedSkill();
    const box = $('#qbox');
    $$('.choice').forEach(b => {
      b.disabled = true;
      if (q.choices[+b.dataset.k] === q.answer) b.classList.add('correct');
      else if (+b.dataset.k === k) b.classList.add('wrong');
    });
    const rec = S.words[q.v.id] || (S.words[q.v.id] = { c: 0, w: 0, s: 0 });
    S.stats.answered++; S.todayCount++;
    let gained = 0;
    if (ok) {
      rec.c++; rec.s++;
      B.combo++; B.maxCombo = Math.max(B.maxCombo, B.combo);
      const comboBonus = Math.min(B.combo - 1, 9) * 2 * (1 + (sk.type === 'combo' ? sk.value : 0));
      gained = Math.round((10 + comboBonus) * (1 + (sk.type === 'exp' ? sk.value : 0)));
      B.exp += gained;
      B.koban += Math.round(6 * (1 + (sk.type === 'koban' ? sk.value : 0)));
      S.stats.correct++;
      sfx.ok();
      box.insertAdjacentHTML('beforeend', '<div class="slash"></div><div class="verdict ok">見事！</div>');
    } else {
      rec.w++; rec.s = 0;
      if (B.guard > 0 && B.combo > 0) { B.guard--; toast('特技発動！連撃を守った'); }
      else B.combo = 0;
      sfx.ng();
      box.classList.add('shake');
      box.insertAdjacentHTML('beforeend', '<div class="verdict ng">無念…</div>');
    }
    B.results.push(ok);
    save();
    const ex = esc(q.v.ex).replace(/\[(.+?)\]/, '<b>$1</b>');
    $('#after').innerHTML = `<div class="explain">
      <div style="display:flex;align-items:center;gap:8px"><span class="term">${esc(q.v.en)}</span>${canSpeak() ? '<button class="speak" id="sp1">🔊</button>' : ''}<span style="flex:1"></span>${ok ? `<span class="chip">+${gained} EXP</span>` : ''}</div>
      <div style="font-size:14px;margin-top:2px">${esc(q.v.ja)}</div>
      <div class="ex">${ex} ${canSpeak() ? '<button class="speak" id="sp2" style="vertical-align:middle">🔊</button>' : ''}</div>
      <div class="exja">${esc(q.v.exJa)}</div>
      <button class="btn block mt" id="next">${B.i + 1 < QUESTIONS ? '次の陣へ ▶' : '戦果を見る ▶'}</button>
    </div>`;
    const s1 = $('#sp1'); if (s1) s1.onclick = () => speak(q.v.en);
    const s2 = $('#sp2'); if (s2) s2.onclick = () => speak(q.v.ex, .88);
    if (S.settings.autoSpeak && q.type !== 'listen' && q.type !== 'en2ja') speak(q.v.en);
    $('#next').onclick = () => {
      B.i++; B.answered = false;
      if (B.i < QUESTIONS) renderQuestion(); else finishBattle();
    };
    $('#next').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function finishBattle() {
    const correct = B.results.filter(Boolean).length;
    const win = correct >= 6;
    const perfect = correct === QUESTIONS;
    const sk = deployedSkill();
    let exp = B.exp + (win ? 30 : 10) + (perfect ? 50 : 0);
    let koban = B.koban + (win ? 40 : 10) + (perfect ? 60 : 0);
    if (sk.type === 'koban') koban = Math.round(koban * (1 + sk.value * .5));
    const w = W_BY_ID[S.deployed];
    const o = S.owned[w.id];
    const beforeLv = o.lv;
    const ups = addExp(w.id, exp);
    S.koban += koban;
    S.stats.battles++; if (win) S.stats.wins++;
    save();
    const misses = B.qs.filter((q, i) => !B.results[i]);
    const atMax = o.lv >= maxLv(w, o);
    view.innerHTML = `<div class="panel result">
      <div class="sub">${esc(w.name)}の戦果</div>
      <div class="big-word ${win ? 'win' : 'lose'}">${perfect ? '完全勝利' : win ? '勝利' : '敗退'}</div>
      <div class="sub">${correct} / ${QUESTIONS} 問正解　最大${B.maxCombo}連撃</div>
      <div class="reward-grid">
        <div><b>+${exp}</b><span>経験値</span></div>
        <div><b>+${koban}</b><span>小判</span></div>
        <div><b>${o.lv}</b><span>レベル</span></div>
      </div>
      <div style="max-width:220px;margin:0 auto">${cardHtml(w)}</div>
      <div class="bar mt"><i id="xpbar" style="width:0%"></i></div>
      <div id="lvmsg" class="mt"></div>
      ${misses.length ? `<div class="miss-list mt"><div class="h2" style="font-size:16px">討ち漏らした語</div><ul>${misses.map(q => `<li>${canSpeak() ? `<button class="speak" data-say="${esc(q.v.en)}">🔊</button>` : ''}<span class="en">${esc(q.v.en)}</span><span class="sub">${esc(q.v.ja)}</span></li>`).join('')}</ul></div>` : ''}
      <div class="row mt"><button class="btn" id="again">再び出陣</button><button class="btn ghost" id="home">本陣へ</button></div>
    </div>`;
    setTimeout(() => { const b = $('#xpbar'); if (b) b.style.width = (atMax ? 100 : o.exp / needExp(o.lv) * 100) + '%'; }, 100);
    if (ups) {
      setTimeout(() => {
        sfx.lvup();
        $('#lvmsg').innerHTML = `<div class="levelup">レベルアップ！ Lv.${beforeLv} → Lv.${o.lv}</div>${atMax ? '<div class="sub">レベル上限に到達。同じ武将を召喚して限界突破しよう。</div>' : ''}`;
      }, 700);
    } else sfx.taiko();
    $$('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say));
    $('#again').onclick = () => startBattle(B.cat);
    $('#home').onclick = () => go('home');
    updateWallet();
  }

  /* ===================== 召喚（ガチャ） ===================== */
  function renderGacha() {
    const showcase = ['masamune', 'kenshin', 'nobunaga', 'shingen', 'hideyoshi'].map(id => W_BY_ID[id]);
    view.innerHTML = `
      <div class="gacha-hero">
        <div class="cards-fan">${showcase.map((w, i) => `<div class="card-wrap" style="position:absolute;width:27%;transform:translateX(${(i - 2) * 58}%) rotate(${(i - 2) * 7}deg) translateY(${Math.abs(i - 2) * 6 - 6}%);z-index:${5 - Math.abs(i - 2)}">${cardHtml(w, { noMeta: true })}</div>`).join('')}</div>
        <div class="label"><h3>天下人召喚</h3><div class="sub">UR武将 出現率 ${RARITY.UR.rate}%</div></div>
      </div>
      <div class="panel mt">
        <div class="row">
          <button class="btn ghost" id="pull1" ${S.koban < COST_1 ? 'disabled' : ''}>1回召喚<br><small>小判 ${COST_1}</small></button>
          <button class="btn gold" id="pull10" ${S.koban < COST_10 ? 'disabled' : ''}>10連召喚<br><small>小判 ${COST_10}・SR以上1枚確定</small></button>
        </div>
        <div class="rates">${Object.keys(RARITY).map(r => `<div><b>${r}</b>${RARITY[r].rate}%</div>`).join('')}</div>
        <div class="pity">UR確定まで あと <b style="color:var(--gold2)">${PITY - S.pity}</b> 回</div>
      </div>
      <div class="panel mt">
        <div class="h2" style="font-size:16px">小判の集め方</div>
        <div class="sub">・合戦で1問正解ごとに小判（武将の特技で増加）<br>・合戦の勝利・完全勝利ボーナス<br>・毎日の登城（連続ログインで増額）<br>・同じ武将が出たら「限界突破」の素材に</div>
      </div>`;
    $('#pull1').onclick = () => pull(1);
    $('#pull10').onclick = () => pull(10);
  }

  function rollRarity(forceMin) {
    S.pity++;
    if (S.pity >= PITY) { S.pity = 0; return 'UR'; }
    let r = Math.random() * 100, acc = 0, res = 'R';
    for (const k of ['UR', 'SSR', 'SR', 'R']) { acc += RARITY[k].rate; if (r < acc) { res = k; break; } }
    if (forceMin && RANK[res] < RANK[forceMin]) res = forceMin;
    if (res === 'UR') S.pity = 0;
    return res;
  }
  function pull(n) {
    const cost = n === 10 ? COST_10 : COST_1;
    if (S.koban < cost) return toast('小判が足りません');
    S.koban -= cost;
    const out = [];
    for (let i = 0; i < n; i++) {
      const needSR = n === 10 && i === n - 1 && !out.some(x => RANK[x.rarity] >= 2);
      const rar = rollRarity(needSR ? 'SR' : null);
      const pool = WARLORDS.filter(w => w.rarity === rar);
      const w = pool[Math.floor(Math.random() * pool.length)];
      const isNew = !S.owned[w.id] && !out.some(x => x.id === w.id);
      out.push({ id: w.id, rarity: rar, isNew });
    }
    S.totalPulls += n;
    // 付与
    out.forEach(r => {
      if (!S.owned[r.id]) S.owned[r.id] = { lv: 1, exp: 0, brk: 0, dupes: 0 };
      else S.owned[r.id].dupes++;
    });
    if (!S.deployed) S.deployed = out.slice().sort((a, b) => RANK[b.rarity] - RANK[a.rarity])[0].id;
    save(); updateWallet();
    playSummon(out);
  }

  function playSummon(out) {
    const best = out.reduce((m, r) => RANK[r.rarity] > RANK[m] ? r.rarity : m, 'R');
    const firstMon = W_BY_ID[out[0].id].mon;
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<div class="seal-stage">
      <div class="seal" id="seal"><div class="wax"><svg viewBox="-22 -22 44 44">${Portrait.mon(best === 'UR' ? 'kiri' : firstMon, 0, 0, 17, '#ffd9c8', '#a0140e')}</svg></div></div>
      <div class="seal-hint">― 封を解け ―</div></div>`;
    sfx.seal();
    let step = 0;
    const seal = $('#seal');
    setTimeout(() => seal && seal.classList.add('glow-' + best), 700);
    overlay.onclick = () => {
      if (step++) return;
      const flash = document.createElement('div');
      flash.className = 'flash';
      flash.style.background = best === 'UR' ? 'radial-gradient(circle, #fff, #c77dff 40%, #7cffcb)' : best === 'SSR' ? 'radial-gradient(circle,#fff,#ffd34d)' : '#fff';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 900);
      best === 'UR' ? sfx.ur() : sfx.seal();
      const bigs = out.filter(r => RANK[r.rarity] >= 3 || out.length === 1);
      revealSequence(bigs, () => showResults(out));
    };
  }
  function revealSequence(list, done) {
    if (!list.length) return done();
    const r = list[0];
    const w = W_BY_ID[r.id];
    if (RANK[r.rarity] >= 3) (r.rarity === 'UR' ? sfx.ur : sfx.lvup)();
    overlay.innerHTML = `<div class="reveal">
      ${RANK[r.rarity] >= 3 ? '<div class="rays"></div>' : ''}
      <div class="announce">${r.isNew ? '新たな武将が馳せ参じた！' : '同じ武将が再び参陣！（限界突破の素材）'}</div>
      ${cardHtml(w, { big: true, isNew: r.isNew, noMeta: true })}
      <div class="quote mt">“${esc(w.quote.en)}”</div><div class="quote-ja">${esc(w.quote.ja)}</div>
      <div class="sub mt">タップで次へ</div></div>`;
    setTimeout(() => speak(w.quote.en), 600);
    overlay.onclick = () => { sfx.tap(); revealSequence(list.slice(1), done); };
  }
  function showResults(out) {
    if (out.length === 1) { closeOverlay(); renderGacha(); return; }
    overlay.innerHTML = `<div class="results">
      <div class="h2" style="justify-content:center">召喚結果</div>
      <div class="results-grid">${out.map((r, i) => `<div style="animation-delay:${i * .08}s" class="rg">${cardHtml(W_BY_ID[r.id], { isNew: r.isNew, noMeta: true })}</div>`).join('')}</div>
      <div class="row mt"><button class="btn gold" id="again10" ${S.koban < COST_10 ? 'disabled' : ''}>もう一度10連</button><button class="btn ghost" id="closeR">閉じる</button></div></div>`;
    $$('.results-grid .card').forEach((c, i) => c.style.animationDelay = (i * .08) + 's');
    overlay.onclick = null;
    $('#closeR').onclick = () => { closeOverlay(); go(current === 'home' ? 'home' : 'gacha'); };
    $('#again10').onclick = () => pull(10);
  }
  function closeOverlay() { overlay.classList.add('hidden'); overlay.innerHTML = ''; overlay.onclick = null; if (window.speechSynthesis) speechSynthesis.cancel(); }

  /* ===================== 武将帳 ===================== */
  let rosterFilter = 'all';
  function renderRoster() {
    const ownedN = Object.keys(S.owned).length;
    const list = WARLORDS.filter(w => rosterFilter === 'all' || w.rarity === rosterFilter)
      .sort((a, b) => (!!S.owned[b.id] - !!S.owned[a.id]) || RANK[b.rarity] - RANK[a.rarity]);
    view.innerHTML = `
      <div class="h2">武将帳 <span class="sub" style="font-family:var(--gothic);letter-spacing:0">${ownedN} / ${WARLORDS.length} 名</span></div>
      <div class="filter">${['all', 'UR', 'SSR', 'SR', 'R'].map(f => `<button data-f="${f}" class="${rosterFilter === f ? 'on' : ''}">${f === 'all' ? 'すべて' : f}</button>`).join('')}</div>
      <div class="roster-grid">${list.map(w => cardHtml(w, { locked: !S.owned[w.id], deployed: S.deployed === w.id })).join('')}</div>`;
    $$('.filter button').forEach(b => b.onclick = () => { rosterFilter = b.dataset.f; renderRoster(); });
    $$('.roster-grid .card').forEach(c => c.onclick = () => { if (S.owned[c.dataset.id]) openDetail(c.dataset.id); else toast('未召喚の武将です'); });
  }

  function openDetail(id) {
    const w = W_BY_ID[id], o = S.owned[id];
    const st = statsOf(w, o);
    const atMax = o.lv >= maxLv(w, o);
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<div class="modal panel">
      <button class="close" id="xclose" aria-label="閉じる">✕</button>
      ${cardHtml(w, { big: true })}
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:baseline">
        <div><div style="font-family:var(--en);font-size:16px;color:var(--muted)">${esc(w.nameEn)}</div><span class="chip">${esc(w.clan)}</span></div>
        <b style="font-family:var(--en);font-size:24px">Lv.${o.lv}<small style="font-size:13px;color:var(--muted)"> / ${maxLv(w, o)}</small></b>
      </div>
      <div class="bar" style="margin-top:6px"><i style="width:${atMax ? 100 : o.exp / needExp(o.lv) * 100}%"></i></div>
      <div class="stats3"><div><b>${st.bu}</b><span>武力</span></div><div><b>${st.chi}</b><span>知略</span></div><div><b>${st.tou}</b><span>統率</span></div></div>
      <div class="skill-box"><div class="sk-name">特技【${esc(w.skill.name)}】</div>${esc(w.skill.desc)}</div>
      <div style="display:flex;gap:10px;align-items:flex-start;margin-top:12px">
        <div style="flex:1"><div class="quote">“${esc(w.quote.en)}”</div><div class="quote-ja">${esc(w.quote.ja)}</div></div>
        ${canSpeak() ? '<button class="speak" id="spq">🔊</button>' : ''}
      </div>
      <div class="sub mt">限界突破 ${'★'.repeat(o.brk)}${'☆'.repeat(MAX_BREAK - o.brk)}　素材（同武将）: ${o.dupes}枚</div>
      <div class="row mt">
        <button class="btn" id="deploy" ${S.deployed === id ? 'disabled' : ''}>${S.deployed === id ? '出陣中' : '出陣させる'}</button>
        <button class="btn gold" id="brk" ${o.dupes < 1 || o.brk >= MAX_BREAK ? 'disabled' : ''}>限界突破</button>
      </div>
    </div>`;
    $('#xclose').onclick = closeOverlay;
    overlay.onclick = e => { if (e.target === overlay) closeOverlay(); };
    const spq = $('#spq'); if (spq) spq.onclick = () => speak(w.quote.en);
    $('#deploy').onclick = () => { S.deployed = id; save(); sfx.taiko(); toast(`${w.name}を出陣させた`); closeOverlay(); go(current); };
    $('#brk').onclick = () => {
      o.dupes--; o.brk++; save(); sfx.lvup();
      toast(`限界突破！ レベル上限が ${maxLv(w, o)} に`);
      delete artCache[id];
      openDetail(id);
      if (current === 'roster') renderRoster();
    };
  }

  /* ===================== 単語帳 ===================== */
  let wordsCat = 'biz';
  function renderWords() {
    const list = VOCAB.filter(v => wordsCat === 'weak' ? weakWords().includes(v) : v.cat === wordsCat);
    const total = VOCAB.length, mastered = VOCAB.filter(v => (S.words[v.id] || {}).s >= 3).length;
    view.innerHTML = `
      <div class="h2">単語帳</div>
      <div class="panel">
        <div style="display:flex;justify-content:space-between" class="sub"><span>習得（3連続正解）</span><b style="color:var(--gold2)">${mastered} / ${total}</b></div>
        <div class="bar" style="margin-top:6px"><i style="width:${mastered / total * 100}%"></i></div>
        <div class="sub" style="margin-top:8px">正解率 ${S.stats.answered ? Math.round(S.stats.correct / S.stats.answered * 100) : 0}%　合戦 ${S.stats.battles}回（勝利 ${S.stats.wins}）</div>
      </div>
      <div class="tabs-inline mt">${VOCAB_CATEGORIES.map(c => `<button data-c="${c.id}" class="${wordsCat === c.id ? 'on' : ''}">${c.icon} ${esc(c.name)}</button>`).join('')}<button data-c="weak" class="${wordsCat === 'weak' ? 'on' : ''}">🔥 苦手</button></div>
      <div class="panel">${list.length ? list.map(v => {
        const r = S.words[v.id] || { s: 0, c: 0, w: 0 };
        return `<div class="word-item">
          ${canSpeak() ? `<button class="speak" data-say="${esc(v.en)}">🔊</button>` : ''}
          <div class="w"><div class="en">${esc(v.en)}</div><div class="ja">${esc(v.ja)}</div></div>
          <div class="mastery" title="習熟度">${[0, 1, 2].map(i => `<i class="${r.s > i ? 'on' : ''}"></i>`).join('')}</div>
        </div>`;
      }).join('') : '<div class="sub" style="text-align:center;padding:20px">まだありません</div>'}</div>`;
    $$('.tabs-inline button').forEach(b => b.onclick = () => { wordsCat = b.dataset.c; renderWords(); });
    $$('[data-say]').forEach(b => b.onclick = () => speak(b.dataset.say));
  }

  /* ===================== 設定 ===================== */
  function openSettings() {
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<div class="modal panel">
      <button class="close" id="xclose">✕</button>
      <div class="h2">設定</div>
      <label class="switch"><span>効果音</span><input type="checkbox" id="s-sound" ${S.settings.sound ? 'checked' : ''}></label>
      <label class="switch"><span>英語の読み上げ</span><input type="checkbox" id="s-voice" ${S.settings.voice ? 'checked' : ''}></label>
      <label class="switch"><span>解答時に自動で発音</span><input type="checkbox" id="s-auto" ${S.settings.autoSpeak ? 'checked' : ''}></label>
      <div class="sub mt">累計召喚 ${S.totalPulls}回 ／ 解答 ${S.stats.answered}問</div>
      <button class="btn ghost block mt" id="reset">データを初期化</button>
    </div>`;
    $('#xclose').onclick = closeOverlay;
    overlay.onclick = e => { if (e.target === overlay) closeOverlay(); };
    $('#s-sound').onchange = e => { S.settings.sound = e.target.checked; save(); };
    $('#s-voice').onchange = e => { S.settings.voice = e.target.checked; save(); };
    $('#s-auto').onchange = e => { S.settings.autoSpeak = e.target.checked; save(); };
    $('#reset').onclick = () => {
      if (!confirm('すべての武将・進捗が消えます。本当に初期化しますか？')) return;
      S = fresh(); save(); closeOverlay(); go('home');
    };
  }

  /* ===================== 起動 ===================== */
  if (window.speechSynthesis) speechSynthesis.getVoices();
  dailyCheck();
  go('home');
})();
