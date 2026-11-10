/* =========================================================================
 * 赤シートで覚える
 * 単元の問題と答えを一覧で読み、答えを赤いシートでかくして覚える。
 * 答えをタップすると、その答えだけシートがめくれる。
 * ========================================================================= */
(function () {
  'use strict';

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc } = App;
    const { FIELDS, UNITS } = window.SHAKAI;

    function menu() {
      App.onKey(null); App.stopTimer();
      view.innerHTML = `
        <h2 style="margin-top:4px">🟥 赤シートで覚える</h2>
        <p class="muted">単元の問題と答えを一覧で読み、答えを赤いシートでかくして覚えます。答えをタップするとシートがめくれます。</p>
        ${FIELDS.map(f => `<h2><span class="tag ${f.id}">${f.name}</span></h2>
          <div class="units">${UNITS.filter(u => u.field === f.id).map(u => {
            const m = u.items.filter(it => App.isMastered(it.id)).length;
            return `<button class="card unit" data-u="${u.id}"><span class="uico">${u.icon}</span>
              <span><span class="uname">${esc(u.name)}</span><span class="umeta"> ・ ${u.items.length}問（覚えた ${m}）</span></span><span class="pct">›</span></button>`;
          }).join('')}</div>`).join('')}
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $$('[data-u]').forEach(b => b.onclick = () => sheet(b.dataset.u));
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    function sheet(uid, opts = { hide: true, only: false }) {
      const u = App.UNIT[uid];
      const items = u.items.filter(it => !opts.only || !App.isMastered(it.id));
      view.innerHTML = `
        <h2 style="margin-top:4px">${u.icon} ${esc(u.name)}</h2>
        <div class="seg sheet-ctl">
          <button id="hide" class="${opts.hide ? 'on' : ''}">🟥 答えをかくす</button>
          <button id="only" class="${opts.only ? 'on' : ''}">まだ覚えていない問題だけ</button>
        </div>
        <ol class="redsheet ${opts.hide ? 'hiding' : ''}">
          ${items.map(it => `<li class="card">
            <div class="rs-q">${esc(it.q)}${App.isMastered(it.id) ? ' <span class="tag geo">覚えた</span>' : ''}</div>
            <button class="rs-a"><span>${App.withReading(it.a)}</span></button>
            ${it.e ? `<div class="rs-e muted">${esc(it.e)}</div>` : ''}
          </li>`).join('')}
        </ol>
        ${items.length ? '' : '<p class="muted">この単元の問題はすべて覚えました！</p>'}
        <div class="row" style="margin-top:16px">
          ${items.length ? `<button class="btn" id="quiz">この単元の4択クイズ</button>` : ''}
          <button class="btn sub" id="back">単元をえらぶ</button>
        </div>`;
      $('#hide').onclick = () => sheet(uid, { ...opts, hide: !opts.hide });
      $('#only').onclick = () => sheet(uid, { ...opts, only: !opts.only });
      $$('.rs-a').forEach(b => b.onclick = () => b.classList.toggle('open'));
      if (items.length) $('#quiz').onclick = () => App.startSession('quiz', items, u.name);
      $('#back').onclick = menu;
      window.scrollTo(0, 0);
    }

    App.registerMode({ id: 'notes', section: 'tool', icon: '🟥', name: '赤シート', desc: '単元の問題と答えを一覧で覚える', start: menu });
  });
})();
