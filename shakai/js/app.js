/* =========================================================================
 * 社会暗記ドリル ― アプリ本体
 * モード：4択クイズ／一問一答カード／年代ならべかえ／苦手復習
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
  const MASTER = 2;          // 連続正解でこの回数に達したら「覚えた」
  const SORT_ROUNDS = 5;     // 年代ならべかえの出題数
  const STORE_KEY = 'shakai-drill-v1';

  // 選択肢グループごとの答えの一覧（4択の誤答に使う）
  const GROUP = {};
  ALL.forEach(it => { (GROUP[it.g] = GROUP[it.g] || new Set()).add(it.a); });
  Object.entries(POOLS).forEach(([g, list]) => list.forEach(a => (GROUP[g] = GROUP[g] || new Set()).add(a)));

  /* ===================== 状態の保存 ===================== */
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const fresh = () => ({
    v: 1, items: {}, days: {}, lastDay: null, streak: 0,
    sort: { played: 0, perfect: 0 },
    pref: { units: UNITS.map(u => u.id), count: 10 }
  });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}); }
  catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ } };

  const rec = id => S.items[id] || (S.items[id] = { c: 0, w: 0, s: 0 });
  const isMastered = id => (S.items[id] || {}).s >= MASTER;
  const isWeak = id => { const r = S.items[id]; return !!r && r.w > 0 && r.s < MASTER; };

  function touchDay() {
    const t = today();
    if (S.lastDay !== t) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      S.streak = S.lastDay === ys ? S.streak + 1 : 1;
      S.lastDay = t;
    }
    S.days[t] = (S.days[t] || 0) + 1;
  }
  function record(id, ok) {
    const r = rec(id);
    if (ok) { r.c++; r.s++; } else { r.w++; r.s = 0; }
    touchDay();
    save();
  }

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
  function renderStreak() {
    $('#streak').innerHTML = S.streak && S.lastDay ? `🔥 <b>${S.streak}</b>日連続` : '';
  }
  let keyHandler = null;
  const onKey = fn => { keyHandler = fn; };
  document.addEventListener('keydown', e => { if (keyHandler && !e.repeat && !e.metaKey && !e.ctrlKey) keyHandler(e); });

  /* ===================== ホーム ===================== */
  function renderHome() {
    onKey(null);
    renderStreak();
    const answered = ALL.filter(it => S.items[it.id]);
    const c = answered.reduce((n, it) => n + S.items[it.id].c, 0);
    const w = answered.reduce((n, it) => n + S.items[it.id].w, 0);
    const mastered = ALL.filter(it => isMastered(it.id)).length;
    const weak = ALL.filter(it => isWeak(it.id)).length;

    view.innerHTML = `
      <div class="stats">
        <div class="card stat"><div class="num">${S.days[today()] || 0}</div><div class="lbl">今日といた数</div></div>
        <div class="card stat"><div class="num">${c + w ? Math.round(c / (c + w) * 100) : '–'}<small>${c + w ? '%' : ''}</small></div><div class="lbl">正答率</div></div>
        <div class="card stat"><div class="num">${mastered}<small style="font-size:13px;color:var(--muted)">/${ALL.length}</small></div><div class="lbl">覚えた問題</div></div>
      </div>

      <h2>モードをえらぶ</h2>
      <div class="modes">
        <button class="mode" data-mode="quiz"><span class="ico">📝</span><span class="ttl">4択クイズ</span><span class="dsc">4つの中から答えをえらぶ</span></button>
        <button class="mode" data-mode="flash"><span class="ico">🃏</span><span class="ttl">一問一答</span><span class="dsc">紙に漢字で書いてから答え合わせ</span></button>
        <button class="mode" data-mode="sort"><span class="ico">⏳</span><span class="ttl">年代ならべかえ</span><span class="dsc">できごとを古い順にならべる</span></button>
        <button class="mode" data-mode="weak" ${weak ? '' : 'disabled'}>${weak ? `<span class="badge">${weak}</span>` : ''}<span class="ico">🎯</span><span class="ttl">苦手復習</span><span class="dsc">${weak ? 'まちがえた問題だけ出題' : 'まちがえた問題はまだありません'}</span></button>
      </div>

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

      <p class="muted" style="margin-top:20px">単元をタップすると、その単元だけの4択クイズが始まります。<br>同じ問題に${MASTER}回連続で正解すると「覚えた」になります。</p>
      <button class="danger" id="reset">学習記録をリセット</button>
    `;

    $$('.mode').forEach(b => b.onclick = () => {
      const m = b.dataset.mode;
      if (m === 'sort') startSort();
      else if (m === 'weak') startWeak();
      else renderSetup(m);
    });
    $$('.unit').forEach(b => b.onclick = () => startSession('quiz', UNIT[b.dataset.unit].items, UNIT[b.dataset.unit].name));
    $('#reset').onclick = () => {
      if (confirm('これまでの学習記録をすべて消去します。よろしいですか？')) {
        S = fresh(); save(); renderHome(); toast('記録をリセットしました');
      }
    };
    window.scrollTo(0, 0);
  }

  /* ===================== 出題設定 ===================== */
  function renderSetup(mode) {
    onKey(null);
    const sel = new Set(S.pref.units.filter(id => UNIT[id]));
    let count = S.pref.count;
    let only = 'all';   // all | new（まだ覚えていない問題だけ）

    const draw = () => {
      const pool = UNITS.filter(u => sel.has(u.id)).flatMap(u => u.items)
        .filter(it => only === 'all' || !isMastered(it.id));
      view.innerHTML = `
        <h2 style="margin-top:4px">${mode === 'flash' ? '🃏 一問一答' : '📝 4択クイズ'} ― 出題範囲</h2>
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

        <h2>問題数</h2>
        <div class="seg" id="count">
          ${[10, 20, 30, 0].map(n => `<button data-n="${n}" class="${count === n ? 'on' : ''}">${n ? n + '問' : 'ぜんぶ'}</button>`).join('')}
        </div>
        <h2>出題する問題</h2>
        <div class="seg" id="only">
          <button data-o="all" class="${only === 'all' ? 'on' : ''}">すべて</button>
          <button data-o="new" class="${only === 'new' ? 'on' : ''}">まだ覚えていない問題</button>
        </div>

        <div class="sticky-foot">
          <div class="row">
            <button class="btn sub" id="back" style="flex:0 0 auto">もどる</button>
            <button class="btn" id="start" ${pool.length ? '' : 'disabled'}>スタート（${count && count < pool.length ? count : pool.length}問）</button>
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
        const picked = shuffle(pool).slice(0, count || pool.length);
        startSession(mode, picked, mode === 'flash' ? '一問一答' : '4択クイズ');
      };
    };
    draw();
    window.scrollTo(0, 0);
  }

  function startWeak() {
    const weak = shuffle(ALL.filter(it => isWeak(it.id))).slice(0, 20);
    if (!weak.length) return toast('苦手な問題はありません');
    startSession('quiz', weak, '苦手復習');
  }

  /* ===================== 出題（4択・一問一答） ===================== */
  function startSession(mode, items, title) {
    const sess = { mode, title, items: shuffle(items), i: 0, log: [] };
    if (mode === 'flash') renderFlash(sess); else renderQuiz(sess);
  }

  function header(sess) {
    const n = sess.items.length;
    return `<div class="qhead">
      <button class="quit" aria-label="やめる">×</button>
      <div class="bar"><i style="width:${sess.i / n * 100}%"></i></div>
      <span class="count">${sess.i + 1}/${n}</span>
    </div>`;
  }
  function bindQuit(sess) {
    $('.quit').onclick = () => {
      if (!sess.log.length || confirm('とちゅうでやめますか？（ここまでの記録は保存されます）')) {
        sess.log.length ? renderResult(sess) : renderHome();
      }
    };
  }
  function questionCard(it) {
    const u = UNIT[it.unit];
    return `<div class="card question">
      <span class="tag ${u.field}">${FIELD[u.field].name}</span> <span class="muted">${esc(u.name)}</span>
      <p class="qt">${esc(it.q)}</p>
    </div>`;
  }
  function next(sess) {
    sess.i++;
    if (sess.i >= sess.items.length) renderResult(sess);
    else (sess.mode === 'flash' ? renderFlash : renderQuiz)(sess);
  }

  function renderQuiz(sess) {
    const it = sess.items[sess.i];
    const opts = choicesFor(it);
    view.innerHTML = `${header(sess)}${questionCard(it)}
      <div class="choices">
        ${opts.map((o, k) => `<button class="choice" data-k="${k}"><span class="no">${k + 1}</span><span>${esc(o)}</span></button>`).join('')}
      </div>
      <div id="fb"></div>`;
    bindQuit(sess);
    let done = false;
    const answer = k => {
      if (done) return;
      done = true;
      const pick = opts[k], ok = pick === it.a;
      record(it.id, ok);
      sess.log.push({ id: it.id, ok, pick });
      $$('.choice').forEach((b, j) => {
        b.disabled = true;
        if (opts[j] === it.a) b.classList.add('correct');
        else if (j === k) b.classList.add('wrong');
      });
      $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
          <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
          ${ok ? '' : `<div class="ans">正解：${esc(it.a)}</div>`}
          ${it.e ? `<div class="exp">${esc(it.e)}</div>` : ''}
        </div>
        <div class="next-wrap"><button class="btn block" id="next">${sess.i + 1 < sess.items.length ? '次の問題へ' : '結果を見る'}</button></div>`;
      $('#next').onclick = () => next(sess);
      $('#next').focus({ preventScroll: true });
      $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    $$('.choice').forEach(b => b.onclick = () => answer(+b.dataset.k));
    onKey(e => {
      if (!done && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
      else if (done && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(sess); }
    });
    window.scrollTo(0, 0);
  }

  function renderFlash(sess) {
    const it = sess.items[sess.i];
    view.innerHTML = `${header(sess)}${questionCard(it)}
      <div id="area">
        <p class="hint">答えをノートに漢字で書いてから、答えを見よう</p>
        <button class="btn block" id="reveal">答えを見る</button>
      </div>`;
    bindQuit(sess);
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
    window.scrollTo(0, 0);
  }

  /* ===================== 結果 ===================== */
  function renderResult(sess) {
    onKey(null);
    renderStreak();
    const n = sess.log.length, ok = sess.log.filter(l => l.ok).length;
    const r = n ? ok / n : 0;
    const msg = r === 1 ? '全問正解！すばらしい！🎉' : r >= .8 ? 'よくできました！あと少しで満点！' : r >= .5 ? 'その調子！まちがえた問題を復習しよう' : 'くり返しが大切。もう一度チャレンジ！';
    const wrong = sess.log.filter(l => !l.ok).map(l => ITEM[l.id]);
    view.innerHTML = `
      <div class="card result-top">
        <div class="muted">${esc(sess.title)} の結果</div>
        <div class="score">${ok}<small> / ${n}問</small></div>
        <div class="msg">${msg}</div>
      </div>
      <div class="row" style="margin-top:14px">
        ${wrong.length ? `<button class="btn" id="retry">まちがえた${wrong.length}問をやり直す</button>` : ''}
        <button class="btn sub" id="home">ホームへ</button>
      </div>
      <h2>ふりかえり</h2>
      <div class="review">
        ${sess.log.map(l => {
          const it = ITEM[l.id];
          return `<div class="card rv"><span class="mk ${l.ok ? 'o' : 'x'}">${l.ok ? '○' : '×'}</span>
            <div>${esc(it.q)}<br><span class="a">→ ${esc(it.a)}</span>
            ${!l.ok && l.pick ? `<div class="yours">あなたの答え：${esc(l.pick)}</div>` : ''}</div></div>`;
        }).join('')}
      </div>`;
    $('#home').onclick = renderHome;
    if (wrong.length) $('#retry').onclick = () => startSession(sess.mode, wrong, sess.title + '（やり直し）');
    window.scrollTo(0, 0);
  }

  /* ===================== 年代ならべかえ ===================== */
  function makeSortRound() {
    // 年がかぶらない4つのできごとを選ぶ
    const picked = [];
    for (const ev of shuffle(EVENTS)) {
      if (picked.every(p => p.y !== ev.y)) picked.push(ev);
      if (picked.length === 4) break;
    }
    return picked;
  }
  function startSort() {
    renderSort({ round: 0, score: 0, set: makeSortRound() });
  }
  function renderSort(st) {
    const order = [];   // 選んだ順のインデックス
    let checked = false;
    const draw = () => {
      const correctOrder = st.set.map((e, k) => k).sort((a, b) => st.set[a].y - st.set[b].y);
      view.innerHTML = `
        <div class="qhead">
          <button class="quit" aria-label="やめる">×</button>
          <div class="bar"><i style="width:${st.round / SORT_ROUNDS * 100}%"></i></div>
          <span class="count">${st.round + 1}/${SORT_ROUNDS}</span>
        </div>
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
        <div id="fb"></div>
        <div class="next-wrap">
          ${checked
            ? `<button class="btn block" id="next">${st.round + 1 < SORT_ROUNDS ? '次の問題へ' : '結果を見る'}</button>`
            : `<div class="row"><button class="btn sub" id="undo" ${order.length ? '' : 'disabled'} style="flex:0 0 auto">1つもどす</button>
               <button class="btn" id="check" ${order.length === 4 ? '' : 'disabled'}>答え合わせ</button></div>`}
        </div>`;
      $('.quit').onclick = () => { if (confirm('とちゅうでやめますか？')) renderHome(); };
      if (checked) {
        const ok = correctOrder.every((k, p) => order[p] === k);
        $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
          <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
          <div class="exp">正しい順：${correctOrder.map(k => `${esc(st.set[k].t)}（${st.set[k].y}年）`).join(' → ')}</div></div>`;
        $('#next').onclick = () => {
          st.round++;
          if (st.round >= SORT_ROUNDS) return renderSortResult(st);
          st.set = makeSortRound();
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
          if (ok) st.score++;
          touchDay(); save(); renderStreak();
          draw();
        };
      }
    };
    onKey(e => {
      if (!checked && /^[1-4]$/.test(e.key)) $(`.event[data-k="${+e.key - 1}"]`).click();
      else if (!checked && e.key === 'Backspace') $('#undo').click();
      else if (e.key === 'Enter') { e.preventDefault(); (checked ? $('#next') : $('#check')).click(); }
    });
    draw();
    window.scrollTo(0, 0);
  }
  function renderSortResult(st) {
    onKey(null);
    S.sort.played++;
    if (st.score === SORT_ROUNDS) S.sort.perfect++;
    save();
    view.innerHTML = `
      <div class="card result-top">
        <div class="muted">年代ならべかえ の結果</div>
        <div class="score">${st.score}<small> / ${SORT_ROUNDS}問</small></div>
        <div class="msg">${st.score === SORT_ROUNDS ? 'パーフェクト！年代はバッチリ！🎉' : '年号はゴロ合わせで覚えるのもおすすめ！'}</div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn" id="again">もう一度</button>
        <button class="btn sub" id="home">ホームへ</button>
      </div>
      <p class="muted" style="margin-top:16px">これまでのプレイ：${S.sort.played}回（パーフェクト ${S.sort.perfect}回）</p>`;
    $('#again').onclick = startSort;
    $('#home').onclick = renderHome;
  }

  $('#btn-home').onclick = () => {
    if (view.querySelector('.qhead') && !confirm('ホームにもどりますか？')) return;
    renderHome();
  };
  renderHome();
})();
