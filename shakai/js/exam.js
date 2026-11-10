/* =========================================================================
 * 実力テスト
 * 地理・歴史・公民から配分して出題する、本番形式のテスト。
 * 解答中は正解を表示せず、問題を行き来して見直してから提出する。
 * 提出すると100点満点で採点し、分野別の得点と過去の成績を表示する。
 * ========================================================================= */
(function () {
  'use strict';

  const COURSES = [
    { id: 'mini', name: 'ミニテスト', n: 15, min: 8, desc: '15問・8分' },
    { id: 'std', name: '標準テスト', n: 30, min: 15, desc: '30問・15分' },
    { id: 'full', name: 'ロングテスト', n: 50, min: 25, desc: '50問・25分' }
  ];
  const RATIO = { geo: .4, his: .4, civ: .2 };   // 分野ごとの出題の割合
  const HISTORY_MAX = 30;

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc, shuffle, sound } = App;
    const { FIELDS, UNITS } = window.SHAKAI;
    const st = () => { const s = App.extState('exam'); s.history = s.history || []; return s; };
    let timer = null;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    // 分野の割合を守りつつ、単元がかたよらないように順番に1問ずつ取る
    function compose(n) {
      const out = [];
      FIELDS.forEach(f => {
        const k = Math.round(n * RATIO[f.id]);
        const pools = UNITS.filter(u => u.field === f.id).map(u => shuffle(u.items));
        let i = 0;
        while (out.filter(it => App.UNIT[it.unit].field === f.id).length < k && pools.some(p => p.length)) {
          const p = pools[i++ % pools.length];
          if (p.length) out.push(p.pop());
        }
      });
      return out.slice(0, n);
    }

    function menu() {
      stop(); App.onKey(null); App.stopTimer();
      const h = st().history;
      const last = h.slice(-10);
      view.innerHTML = `
        <h2 style="margin-top:4px">📋 実力テスト</h2>
        <p class="muted">地理4割・歴史4割・公民2割で出題します。解答中は正解が表示されません。問題を行き来して見直し、最後に提出してください。</p>
        <div class="units">
          ${COURSES.map(c => {
            const mine = h.filter(x => x.course === c.id);
            const best = mine.length ? Math.max(...mine.map(x => x.score)) : null;
            return `<button class="card unit" data-c="${c.id}"><span class="uico">📋</span>
              <span><span class="uname">${c.name}</span><span class="umeta"> ・ ${c.desc}</span>
              ${best !== null ? `<div class="umeta">最高 ${best}点（${mine.length}回）</div>` : ''}</span><span class="pct">›</span></button>`;
          }).join('')}
        </div>
        ${last.length ? `<h2>最近の成績</h2>
        <div class="card exam-chart">
          ${last.map(x => `<div class="col" title="${x.date} ${x.score}点">
            <span class="cn">${x.score}</span><i style="height:${x.score}%"></i>
            <span class="cd">${x.date.slice(5).replace('-', '/')}</span></div>`).join('')}
        </div>
        <div class="card table-wrap"><table class="utable">
          <thead><tr><th>日付</th><th>テスト</th><th>得点</th>${FIELDS.map(f => `<th>${f.name}</th>`).join('')}</tr></thead>
          <tbody>${h.slice(-10).reverse().map(x => `<tr><td>${x.date.slice(5).replace('-', '/')}</td>
            <td>${(COURSES.find(c => c.id === x.course) || {}).name || ''}</td><td><b>${x.score}</b></td>
            ${FIELDS.map(f => `<td>${x.fields[f.id] ? `${x.fields[f.id][0]}/${x.fields[f.id][1]}` : '–'}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>` : ''}
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $$('[data-c]').forEach(b => b.onclick = () => start(COURSES.find(c => c.id === b.dataset.c)));
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    function start(course) {
      const items = compose(course.n);
      const ex = {
        course, items,
        opts: items.map(it => App.choicesFor(it)),
        ans: items.map(() => null),
        i: 0,
        end: Date.now() + course.min * 60 * 1000
      };
      stop();
      timer = setInterval(() => {
        const left = Math.max(0, ex.end - Date.now());
        const el = $('#exam-time');
        if (!el) { stop(); return; }   // ホームなど別の画面に移ったら中止
        el.textContent = fmt(left);
        el.classList.toggle('warn', left < 60 * 1000);
        if (left <= 0) { stop(); App.toast('時間になりました。採点します'); grade(ex); }
      }, 250);
      show(ex);
    }

    const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

    function show(ex) {
      const it = ex.items[ex.i], opts = ex.opts[ex.i];
      const answered = ex.ans.filter(a => a !== null).length;
      view.innerHTML = `
        <div class="qhead">
          <button class="quit" aria-label="やめる">×</button>
          <div class="bar"><i style="width:${answered / ex.items.length * 100}%"></i></div>
          <span class="count exam-time" id="exam-time">${fmt(ex.end - Date.now())}</span>
        </div>
        <div class="exam-meta"><b>第${ex.i + 1}問</b> / ${ex.items.length}問　<span class="muted">解答ずみ ${answered}問</span></div>
        ${App.questionCard(it)}
        <div class="choices">
          ${opts.map((o, k) => `<button class="choice ${ex.ans[ex.i] === k ? 'picked' : ''}" data-k="${k}"><span class="no">${k + 1}</span><span>${esc(o)}</span></button>`).join('')}
        </div>
        <div class="row exam-nav">
          <button class="btn sub" id="prev" ${ex.i ? '' : 'disabled'}>‹ 前へ</button>
          <button class="btn sub" id="nextq" ${ex.i + 1 < ex.items.length ? '' : 'disabled'}>次へ ›</button>
        </div>
        <div class="palette">${ex.items.map((x, k) => `<button class="pal ${ex.ans[k] !== null ? 'done' : ''} ${k === ex.i ? 'cur' : ''}" data-j="${k}">${k + 1}</button>`).join('')}</div>
        <button class="btn block" id="submit">提出して採点する</button>`;
      $('.quit').onclick = () => { if (confirm('テストを中止しますか？（採点されません）')) { ex.over = true; stop(); menu(); } };
      const go = j => { ex.i = Math.max(0, Math.min(ex.items.length - 1, j)); show(ex); };
      $$('.choice').forEach(b => b.onclick = () => {
        ex.ans[ex.i] = +b.dataset.k;
        // 選んだら自動で次の未解答の問題へ進む
        const next = ex.ans.findIndex((a, k) => a === null && k > ex.i);
        // 採点後や別の画面に移ったあとは動かさない
        setTimeout(() => { if (!ex.over && $('#exam-time')) go(next >= 0 ? next : ex.i); }, 180);
        $$('.choice').forEach(c => c.classList.toggle('picked', c === b));
      });
      $('#prev').onclick = () => go(ex.i - 1);
      $('#nextq').onclick = () => go(ex.i + 1);
      $$('.pal').forEach(b => b.onclick = () => go(+b.dataset.j));
      $('#submit').onclick = () => {
        const rest = ex.ans.filter(a => a === null).length;
        if (rest && !confirm(`まだ${rest}問答えていません。提出しますか？`)) return;
        stop(); grade(ex);
      };
      App.onKey(e => {
        if (/^[1-4]$/.test(e.key)) $(`.choice[data-k="${+e.key - 1}"]`).click();
        else if (e.key === 'ArrowLeft') go(ex.i - 1);
        else if (e.key === 'ArrowRight') go(ex.i + 1);
      });
      window.scrollTo(0, 0);
    }

    function grade(ex) {
      if (ex.over) return;   // 二重に採点しない
      ex.over = true;
      App.onKey(null);
      const res = ex.items.map((it, k) => {
        const pick = ex.ans[k] === null ? null : ex.opts[k][ex.ans[k]];
        return { it, pick, ok: pick === it.a };
      });
      res.forEach(r => App.record(r.it.id, r.ok));
      const ok = res.filter(r => r.ok).length;
      const score = Math.round(ok / res.length * 100);
      const fields = {};
      FIELDS.forEach(f => {
        const rs = res.filter(r => App.UNIT[r.it.unit].field === f.id);
        if (rs.length) fields[f.id] = [rs.filter(r => r.ok).length, rs.length];
      });
      const s = st();
      const prev = s.history.filter(x => x.course === ex.course.id).slice(-1)[0];
      s.history.push({ date: App.today(), course: ex.course.id, score, fields });
      if (s.history.length > HISTORY_MAX) s.history.splice(0, s.history.length - HISTORY_MAX);
      App.save();
      sound.done();

      // 単元ごとのまちがいの数（多い順）
      const missByUnit = {};
      res.filter(r => !r.ok).forEach(r => { missByUnit[r.it.unit] = (missByUnit[r.it.unit] || 0) + 1; });
      const weakUnits = Object.entries(missByUnit).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const wrong = res.filter(r => !r.ok);

      view.innerHTML = `
        <div class="card result-top">
          <div class="muted">${ex.course.name} の結果</div>
          <div class="score">${score}<small> 点</small></div>
          <div class="msg">${ok} / ${res.length}問 正解
            ${prev ? `<br><span class="${score >= prev.score ? 'up' : 'down'}">前回 ${prev.score}点 → ${score >= prev.score ? '+' : ''}${score - prev.score}点</span>` : ''}</div>
        </div>
        <div class="field-scores">
          ${FIELDS.filter(f => fields[f.id]).map(f => {
            const [c, n] = fields[f.id];
            return `<div class="card fs"><span class="tag ${f.id}">${f.name}</span>
              <div class="num">${c}<small>/${n}</small></div>
              <div class="bar"><i style="width:${c / n * 100}%;background:var(--${f.id})"></i></div></div>`;
          }).join('')}
        </div>
        ${weakUnits.length ? `<div class="card advice"><b>📌 復習するとよい単元</b><br>
          ${weakUnits.map(([u, n]) => `${App.UNIT[u].icon} ${esc(App.UNIT[u].name)}（${n}問まちがい）`).join('<br>')}</div>` : ''}
        <div class="row" style="margin-top:14px">
          ${wrong.length ? `<button class="btn" id="retry">まちがえた${wrong.length}問を復習</button>` : ''}
          <button class="btn sub" id="back">テストのメニューへ</button>
        </div>
        <h2>答え合わせ</h2>
        <div class="review">
          ${res.map((r, k) => `<div class="card rv"><span class="mk ${r.ok ? 'o' : 'x'}">${r.ok ? '○' : '×'}</span>
            <div><span class="muted">第${k + 1}問</span> ${esc(r.it.q)}<br><span class="a">→ ${esc(r.it.a)}</span>
            ${!r.ok ? `<div class="yours">あなたの答え：${r.pick === null ? '（無回答）' : esc(r.pick)}</div>` : ''}
            ${!r.ok && r.it.e ? `<div class="muted">${esc(r.it.e)}</div>` : ''}</div></div>`).join('')}
        </div>`;
      if (wrong.length) $('#retry').onclick = () => App.startSession('quiz', wrong.map(r => r.it), '実力テストの復習');
      $('#back').onclick = menu;
      window.scrollTo(0, 0);
    }

    App.registerMode({
      id: 'exam', section: 'practice', icon: '📋', name: '実力テスト',
      desc: () => { const h = st().history; return h.length ? `前回 ${h[h.length - 1].score}点` : '本番形式で力だめし'; },
      start: menu
    });
  });
})();
