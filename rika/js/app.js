/* =========================================================================
 * 理科暗記ドリル ― アプリ本体
 * ========================================================================= */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $('#view');
  const sheet = $('#sheet');
  const U_BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]));
  const F_BY_ID = Object.fromEntries(FIELDS.map(f => [f.id, f]));
  const Q_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

  /* ===================== 定数 ===================== */
  const MASTER = 2;          // 連続正解でこの数に達したら「おぼえた」
  const STORE_KEY = 'rika-anki-v1';

  /* ===================== 状態 ===================== */
  const dayStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => dayStr(new Date());
  const fresh = () => ({ v: 1, q: {}, days: {}, lastDay: null, streak: 0, settings: { sound: true, count: 10 } });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}); }
  catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 保存不可環境 */ } };

  const rec = id => S.q[id] || (S.q[id] = { c: 0, w: 0, s: 0, last: null });
  const isMastered = id => S.q[id] && S.q[id].s >= MASTER;
  const isWeak = id => S.q[id] && S.q[id].last === 'ng';
  const weakList = () => QUESTIONS.filter(q => isWeak(q.id));

  function record(id, ok) {
    const r = rec(id);
    if (ok) { r.c++; r.s++; r.last = 'ok'; } else { r.w++; r.s = 0; r.last = 'ng'; }
    const t = today();
    if (S.lastDay !== t) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      S.streak = S.lastDay === dayStr(y) ? S.streak + 1 : 1;
      S.lastDay = t;
    }
    S.days[t] = (S.days[t] || 0) + 1;
    save();
  }
  const streakNow = () => {
    if (!S.lastDay) return 0;
    const y = new Date(); y.setDate(y.getDate() - 1);
    return S.lastDay === today() || S.lastDay === dayStr(y) ? S.streak : 0;
  };

  /* ===================== サウンド ===================== */
  let actx;
  function tone(freqs, dur = .12, type = 'sine', gap = .08, vol = .16) {
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
    ok: () => tone([784, 1175], .16, 'triangle', .08),
    ng: () => tone([220, 175], .22, 'square', .1, .07),
    tap: () => tone([600], .04, 'sine', 0, .06),
    done: () => tone([523, 659, 784, 1046], .22, 'triangle', .09)
  };

  /* ===================== ユーティリティ ===================== */
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  function toast(msg, ms = 1800) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
  }

  // まだ覚えていない問題・まちがえた問題ほど出やすくする重みづけ抽選
  function weight(id) {
    const r = S.q[id];
    if (!r) return 3;
    if (r.last === 'ng') return 5;
    if (r.s >= MASTER) return 1;
    return 3 - r.s;
  }
  function pick(pool, n) {
    const items = pool.map(q => ({ q, k: Math.pow(Math.random(), 1 / weight(q.id)) }));
    return items.sort((a, b) => b.k - a.k).slice(0, n).map(x => x.q);
  }

  function unitStats(unitId) {
    const qs = QUESTIONS.filter(q => !unitId || q.unit === unitId);
    let c = 0, w = 0, m = 0, weak = 0;
    qs.forEach(q => {
      const r = S.q[q.id];
      if (!r) return;
      c += r.c; w += r.w;
      if (r.s >= MASTER) m++;
      if (r.last === 'ng') weak++;
    });
    return { total: qs.length, mastered: m, weak, rate: pct(c, c + w), answered: c + w };
  }

  /* ===================== ルーティング ===================== */
  let current = 'home';
  let session = null;
  function go(tab) {
    current = tab;
    session = null;
    closeSheet();
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.body.classList.remove('in-quiz');
    ({ home: renderHome, weak: renderWeak, record: renderRecord })[tab]();
    window.scrollTo(0, 0);
  }
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => { sfx.tap(); go(b.dataset.tab); }));

  /* ===================== ホーム ===================== */
  function bar(v, color) {
    return `<div class="bar"><span style="width:${v}%;background:${color}"></span></div>`;
  }
  function renderHome() {
    const all = unitStats();
    const todayN = S.days[today()] || 0;
    const weakN = weakList().length;
    view.innerHTML = `
      <section class="summary">
        <div class="stat"><b>${todayN}</b><small>今日といた数</small></div>
        <div class="stat"><b>${streakNow()}<i>日</i></b><small>連続学習</small></div>
        <div class="stat"><b>${all.mastered}<i>/${all.total}</i></b><small>おぼえた問題</small></div>
      </section>
      <div class="overall">${bar(pct(all.mastered, all.total), 'var(--accent)')}<span>習得率 ${pct(all.mastered, all.total)}%</span></div>

      <section class="quick">
        <button class="btn primary" id="go-mix"><span class="ico">🎲</span>全分野ミックス<small>${S.settings.count}問・4択</small></button>
        <button class="btn warn" id="go-weak" ${weakN ? '' : 'disabled'}><span class="ico">🔁</span>苦手を復習<small>${weakN}問</small></button>
      </section>

      ${FIELDS.map(f => `
        <h2 class="field-h" style="--fc:${f.color}">${esc(f.name)}</h2>
        <div class="units">
          ${UNITS.filter(u => u.field === f.id).map(u => {
            const st = unitStats(u.id);
            return `<button class="unit" data-unit="${u.id}" style="--fc:${f.color}">
              <span class="u-ico">${u.icon}</span>
              <span class="u-body">
                <span class="u-name">${esc(u.name)}</span>
                ${bar(pct(st.mastered, st.total), f.color)}
                <span class="u-meta">おぼえた ${st.mastered}/${st.total}${st.weak ? `<em>苦手 ${st.weak}</em>` : ''}</span>
              </span>
            </button>`;
          }).join('')}
        </div>`).join('')}
      <p class="foot">全${QUESTIONS.length}問 ・ ${MASTER}回続けて正解すると「おぼえた」になります</p>`;
    $('#go-mix').onclick = () => startQuiz({ title: '全分野ミックス', pool: QUESTIONS, n: S.settings.count });
    $('#go-weak').onclick = () => startWeak();
    $$('.unit').forEach(b => b.onclick = () => { sfx.tap(); openUnit(b.dataset.unit); });
  }

  /* ===================== 単元メニュー ===================== */
  function openUnit(unitId) {
    const u = U_BY_ID[unitId], f = F_BY_ID[u.field];
    const pool = QUESTIONS.filter(q => q.unit === unitId);
    const st = unitStats(unitId);
    const weak = pool.filter(q => isWeak(q.id));
    openSheet(`
      <div class="sheet-head" style="--fc:${f.color}">
        <span class="u-ico big">${u.icon}</span>
        <div><small>${esc(f.name)}</small><h3>${esc(u.name)}</h3>
        <p class="muted">全${st.total}問 ・ おぼえた ${st.mastered} ・ 正答率 ${st.answered ? st.rate + '%' : '－'}</p></div>
      </div>
      <div class="seg" role="radiogroup" aria-label="問題数">
        ${[5, 10, 20].map(n => `<button data-n="${n}" class="${S.settings.count === n ? 'on' : ''}">${n}問</button>`).join('')}
      </div>
      <div class="modes">
        <button class="mode" id="m-quiz"><span class="ico">✏️</span><b>4択テスト</b><small>選択肢から正解を選ぶ</small></button>
        <button class="mode" id="m-card"><span class="ico">🃏</span><b>一問一答カード</b><small>答えを思い出してからめくる</small></button>
        <button class="mode" id="m-all"><span class="ico">📋</span><b>全問チャレンジ</b><small>この単元の${st.total}問すべて</small></button>
        <button class="mode" id="m-weak" ${weak.length ? '' : 'disabled'}><span class="ico">🔁</span><b>苦手だけ</b><small>${weak.length ? weak.length + '問' : 'まだありません'}</small></button>
        <button class="mode" id="m-list"><span class="ico">📖</span><b>問題と答えを見る</b><small>まずは読んで覚える</small></button>
      </div>`);
    $$('.seg button', sheet).forEach(b => b.onclick = () => {
      S.settings.count = +b.dataset.n; save();
      $$('.seg button', sheet).forEach(x => x.classList.toggle('on', x === b));
    });
    const title = u.name;
    $('#m-quiz').onclick = () => startQuiz({ title, pool, n: S.settings.count });
    $('#m-card').onclick = () => startCards({ title, pool, n: S.settings.count });
    $('#m-all').onclick = () => startQuiz({ title: title + '（全問）', pool, n: pool.length });
    $('#m-weak').onclick = () => startQuiz({ title: title + '（苦手）', pool: weak, n: weak.length });
    $('#m-list').onclick = () => renderList(unitId);
  }
  function openSheet(html) {
    sheet.innerHTML = `<div class="sheet-panel"><button class="close" aria-label="閉じる">×</button>${html}</div>`;
    sheet.classList.remove('hidden');
    $('.close', sheet).onclick = closeSheet;
  }
  function closeSheet() { sheet.classList.add('hidden'); sheet.innerHTML = ''; }
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });

  /* ===================== 問題一覧（読んで覚える） ===================== */
  function renderList(unitId) {
    closeSheet();
    const u = U_BY_ID[unitId];
    const pool = QUESTIONS.filter(q => q.unit === unitId);
    view.innerHTML = `
      <div class="page-h"><button class="back" id="back">‹ もどる</button><h2>${u.icon} ${esc(u.name)}</h2></div>
      <label class="hide-toggle"><input type="checkbox" id="hide"> 答えをかくす（タップで表示）</label>
      <ol class="qlist">${pool.map(q => `
        <li class="${isMastered(q.id) ? 'mastered' : ''} ${isWeak(q.id) ? 'weak' : ''}">
          <p class="lq">${esc(q.q)}</p>
          <p class="la"><span>${esc(q.a)}</span></p>
          <p class="le">${esc(q.e)}</p>
        </li>`).join('')}</ol>
      <button class="btn primary block" id="to-quiz">この単元をテストする</button>`;
    $('#back').onclick = () => { go('home'); openUnit(unitId); };
    $('#hide').onchange = e => view.classList.toggle('hide-ans', e.target.checked);
    $$('.qlist li').forEach(li => li.onclick = () => li.classList.toggle('peek'));
    $('#to-quiz').onclick = () => startQuiz({ title: u.name, pool, n: S.settings.count });
    window.scrollTo(0, 0);
  }

  /* ===================== 4択テスト ===================== */
  function startQuiz({ title, pool, n }) {
    closeSheet();
    const list = pick(pool, Math.min(n, pool.length));
    if (!list.length) { toast('出題できる問題がありません'); return; }
    session = { kind: 'quiz', title, list, i: 0, results: [], answered: false };
    document.body.classList.add('in-quiz');
    renderQuestion();
  }
  function startWeak() {
    const weak = weakList();
    if (!weak.length) { toast('苦手な問題はありません'); return; }
    startQuiz({ title: '苦手を復習', pool: weak, n: Math.min(weak.length, 20) });
  }
  function quizHead() {
    const s = session;
    return `<div class="quiz-top">
      <button class="back" id="quit">× やめる</button>
      <span class="qt-title">${esc(s.title)}</span>
      <span class="qt-count">${s.i + 1} / ${s.list.length}</span>
    </div>
    <div class="progress"><span style="width:${pct(s.i, s.list.length)}%"></span></div>`;
  }
  function bindQuit() {
    $('#quit').onclick = () => {
      if (session.results.length && !confirm('とちゅうでやめますか？（ここまでの結果は記録されています）')) return;
      go(current);
    };
  }
  function renderQuestion() {
    const s = session, q = s.list[s.i], u = U_BY_ID[q.unit], f = F_BY_ID[u.field];
    s.answered = false;
    s.choices = shuffle([q.a, ...q.d]);
    view.innerHTML = `${quizHead()}
      <div class="qcard" style="--fc:${f.color}">
        <span class="tag">${u.icon} ${esc(u.name)}</span>
        <p class="qtext">${esc(q.q)}</p>
      </div>
      <div class="choices">${s.choices.map((c, k) => `
        <button class="choice" data-k="${k}"><span class="num">${k + 1}</span><span class="ctext">${esc(c)}</span></button>`).join('')}
      </div>
      <div id="feedback"></div>`;
    bindQuit();
    $$('.choice').forEach(b => b.onclick = () => answer(+b.dataset.k));
    window.scrollTo(0, 0);
  }
  function answer(k) {
    const s = session;
    if (!s || s.kind !== 'quiz' || s.answered) return;
    s.answered = true;
    const q = s.list[s.i];
    const ok = s.choices[k] === q.a;
    record(q.id, ok);
    s.results.push({ id: q.id, ok });
    ok ? sfx.ok() : sfx.ng();
    $$('.choice').forEach((b, j) => {
      b.disabled = true;
      if (s.choices[j] === q.a) b.classList.add('correct');
      else if (j === k) b.classList.add('wrong');
    });
    const last = s.i + 1 >= s.list.length;
    $('#feedback').innerHTML = `
      <div class="fb ${ok ? 'ok' : 'ng'}">
        <div class="fb-h">${ok ? '⭕ 正解！' : '❌ ざんねん'}${ok && isMastered(q.id) ? '<span class="badge">おぼえた！</span>' : ''}</div>
        ${ok ? '' : `<p class="fb-a">正解：<b>${esc(q.a)}</b></p>`}
        <p class="fb-e">${esc(q.e)}</p>
      </div>
      <button class="btn primary block" id="next">${last ? '結果を見る' : '次の問題へ'} <kbd>Enter</kbd></button>`;
    $('#next').onclick = next;
    $('#next').focus({ preventScroll: true });
    $('#feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function next() {
    const s = session;
    if (!s || (s.kind === 'quiz' && !s.answered)) return;
    s.i++;
    if (s.i >= s.list.length) return renderResult();
    s.kind === 'quiz' ? renderQuestion() : renderCard();
  }

  /* ===================== 一問一答カード ===================== */
  function startCards({ title, pool, n }) {
    closeSheet();
    const list = pick(pool, Math.min(n, pool.length));
    session = { kind: 'card', title, list, i: 0, results: [], flipped: false };
    document.body.classList.add('in-quiz');
    renderCard();
  }
  function renderCard() {
    const s = session, q = s.list[s.i], u = U_BY_ID[q.unit], f = F_BY_ID[u.field];
    s.flipped = false;
    view.innerHTML = `${quizHead()}
      <div class="flash" id="flash" style="--fc:${f.color}" tabindex="0">
        <div class="flash-inner">
          <div class="face front">
            <span class="tag">${u.icon} ${esc(u.name)}</span>
            <p class="qtext">${esc(q.q)}</p>
            <p class="hint">答えを思いうかべてから<br>タップしてめくろう <kbd>Space</kbd></p>
          </div>
          <div class="face back">
            <span class="tag">答え</span>
            <p class="bq">${esc(q.q)}</p>
            <p class="atext">${esc(q.a)}</p>
            <p class="fb-e">${esc(q.e)}</p>
          </div>
        </div>
      </div>
      <div class="judge hidden" id="judge">
        <p>思い出せた？</p>
        <div class="judge-btns">
          <button class="btn ng" id="j-ng">× まだ <kbd>2</kbd></button>
          <button class="btn ok" id="j-ok">○ できた <kbd>1</kbd></button>
        </div>
      </div>`;
    bindQuit();
    $('#flash').onclick = flip;
    $('#j-ok').onclick = () => judge(true);
    $('#j-ng').onclick = () => judge(false);
    window.scrollTo(0, 0);
  }
  function flip() {
    const s = session;
    if (!s || s.kind !== 'card' || s.flipped) return;
    s.flipped = true; sfx.tap();
    $('#flash').classList.add('flipped');
    $('#judge').classList.remove('hidden');
  }
  function judge(ok) {
    const s = session;
    if (!s || !s.flipped) return;
    const q = s.list[s.i];
    record(q.id, ok);
    s.results.push({ id: q.id, ok });
    ok ? sfx.ok() : sfx.ng();
    next();
  }

  /* ===================== 結果 ===================== */
  function renderResult() {
    const s = session;
    const ok = s.results.filter(r => r.ok).length, n = s.results.length;
    const p = pct(ok, n);
    const msg = p === 100 ? 'パーフェクト！🎉' : p >= 80 ? 'よくできました！' : p >= 50 ? 'あと少し！苦手を復習しよう' : 'くり返して覚えよう！';
    const wrong = s.results.filter(r => !r.ok).map(r => Q_BY_ID[r.id]);
    sfx.done();
    document.body.classList.remove('in-quiz');
    const again = { title: s.title, pool: s.list, n: s.list.length };
    const kind = s.kind;
    view.innerHTML = `
      <div class="result">
        <p class="r-title">${esc(s.title)}</p>
        <div class="score" style="--p:${p}"><b>${ok}</b><span>/ ${n}</span></div>
        <p class="r-msg">${msg}</p>
      </div>
      ${wrong.length ? `<h2 class="sec-h">まちがえた問題</h2>
      <ol class="qlist">${wrong.map(q => `<li class="weak"><p class="lq">${esc(q.q)}</p><p class="la"><span>${esc(q.a)}</span></p><p class="le">${esc(q.e)}</p></li>`).join('')}</ol>` : ''}
      <div class="r-btns">
        ${wrong.length ? '<button class="btn warn block" id="r-wrong">まちがえた問題をもう一度</button>' : ''}
        <button class="btn primary block" id="r-again">同じ問題でもう一度</button>
        <button class="btn block" id="r-home">ホームへ</button>
      </div>`;
    session = null;
    const start = kind === 'card' ? startCards : startQuiz;
    if (wrong.length) $('#r-wrong').onclick = () => start({ title: '復習', pool: wrong, n: wrong.length });
    $('#r-again').onclick = () => start(again);
    $('#r-home').onclick = () => go('home');
    window.scrollTo(0, 0);
  }

  /* ===================== 苦手 ===================== */
  function renderWeak() {
    const weak = weakList();
    if (!weak.length) {
      view.innerHTML = `<div class="empty"><div class="big">🎉</div><p>苦手な問題はありません。<br>まちがえた問題がここに集まります。</p>
        <button class="btn primary" id="w-mix">ミックス問題にちょうせん</button></div>`;
      $('#w-mix').onclick = () => startQuiz({ title: '全分野ミックス', pool: QUESTIONS, n: S.settings.count });
      return;
    }
    const byUnit = UNITS.map(u => ({ u, qs: weak.filter(q => q.unit === u.id) })).filter(x => x.qs.length);
    view.innerHTML = `
      <div class="page-h"><h2>🔁 苦手な問題 <small>${weak.length}問</small></h2></div>
      <p class="muted">最後にまちがえた問題です。正解するとリストから消えます。</p>
      <div class="quick">
        <button class="btn warn" id="w-quiz"><span class="ico">✏️</span>4択で復習<small>${Math.min(weak.length, 20)}問</small></button>
        <button class="btn" id="w-card"><span class="ico">🃏</span>カードで復習<small>${Math.min(weak.length, 20)}問</small></button>
      </div>
      ${byUnit.map(({ u, qs }) => `<h3 class="sec-h">${u.icon} ${esc(u.name)}（${qs.length}）</h3>
        <ol class="qlist">${qs.map(q => `<li class="weak"><p class="lq">${esc(q.q)}</p><p class="la"><span>${esc(q.a)}</span></p><p class="le">${esc(q.e)}</p></li>`).join('')}</ol>`).join('')}`;
    $('#w-quiz').onclick = startWeak;
    $('#w-card').onclick = () => startCards({ title: '苦手を復習', pool: weak, n: Math.min(weak.length, 20) });
  }

  /* ===================== 記録 ===================== */
  function renderRecord() {
    const all = unitStats();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = dayStr(d);
      days.push({ key, n: S.days[key] || 0, label: `${d.getMonth() + 1}/${d.getDate()}`, wd: '日月火水木金土'[d.getDay()] });
    }
    const maxN = Math.max(10, ...days.map(d => d.n));
    view.innerHTML = `
      <div class="page-h"><h2>📊 学習の記録</h2></div>
      <section class="summary">
        <div class="stat"><b>${all.answered}</b><small>のべ解答数</small></div>
        <div class="stat"><b>${all.answered ? all.rate : '－'}<i>%</i></b><small>正答率</small></div>
        <div class="stat"><b>${streakNow()}<i>日</i></b><small>連続学習</small></div>
      </section>
      <h3 class="sec-h">最近2週間の解答数</h3>
      <div class="chart" role="img" aria-label="最近14日間の解答数">
        ${days.map(d => `<div class="col ${d.key === today() ? 'today' : ''}" title="${d.label}：${d.n}問">
          <span class="v">${d.n || ''}</span><span class="b" style="height:${d.n / maxN * 100}%"></span><span class="l">${d.wd}</span></div>`).join('')}
      </div>
      <h3 class="sec-h">単元ごとの成績</h3>
      <table class="tbl">
        <thead><tr><th>単元</th><th>おぼえた</th><th>正答率</th></tr></thead>
        <tbody>${UNITS.map(u => {
          const st = unitStats(u.id), f = F_BY_ID[u.field];
          return `<tr data-unit="${u.id}"><td><span class="dot" style="background:${f.color}"></span>${u.icon} ${esc(u.name)}</td>
            <td>${st.mastered}/${st.total}</td><td class="${st.answered && st.rate < 60 ? 'low' : ''}">${st.answered ? st.rate + '%' : '－'}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <div class="settings">
        <label><input type="checkbox" id="snd" ${S.settings.sound ? 'checked' : ''}> 効果音</label>
        <button class="btn small danger" id="reset">記録をリセット</button>
      </div>`;
    $$('.tbl tbody tr').forEach(tr => tr.onclick = () => { go('home'); openUnit(tr.dataset.unit); });
    $('#snd').onchange = e => { S.settings.sound = e.target.checked; save(); };
    $('#reset').onclick = () => {
      if (!confirm('すべての学習記録を消去します。よろしいですか？')) return;
      S = fresh(); save(); toast('記録をリセットしました'); renderRecord();
    };
  }

  /* ===================== キーボード操作 ===================== */
  document.addEventListener('keydown', e => {
    if (!session || e.metaKey || e.ctrlKey || e.altKey) return;
    if (session.kind === 'quiz') {
      if (!session.answered && /^[1-4]$/.test(e.key)) { e.preventDefault(); answer(+e.key - 1); }
      else if (session.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
    } else if (session.kind === 'card') {
      if (!session.flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flip(); }
      else if (session.flipped && e.key === '1') judge(true);
      else if (session.flipped && e.key === '2') judge(false);
    }
  });

  go('home');
})();
