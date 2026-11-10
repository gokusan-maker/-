/* =========================================================================
 * 人物さかさクイズ
 * 歴史の「〜したのは？（人物）」の問題を逆向きにして、
 * 人物名を見て、その人物の説明として正しいものをえらぶ。
 * ========================================================================= */
(function () {
  'use strict';

  const ROUNDS = 10;
  // 「〜を定めたのは？」→「〜を定めた」、「〜の皇帝は？」→「〜の皇帝」
  const describe = q => q.replace(/のは？$/, '').replace(/は？$/, '');

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc, shuffle, sound } = App;
    const { UNITS } = window.SHAKAI;
    const HIS = UNITS.filter(u => u.field === 'his');
    const persons = units => units.flatMap(u => u.items).filter(it => it.g === 'person');

    function menu() {
      App.onKey(null); App.stopTimer();
      const best = App.extState('persons').best || {};
      const row = (id, name, n) => `<button class="card unit" data-u="${id}"><span class="uico">👤</span>
        <span><span class="uname">${esc(name)}</span><span class="umeta"> ・ ${n}人${best[id] !== undefined ? `　最高 ${best[id]}/${ROUNDS}` : ''}</span></span><span class="pct">›</span></button>`;
      view.innerHTML = `
        <h2 style="margin-top:4px">👤 人物さかさクイズ</h2>
        <p class="muted">人物の名前を見て、その人物の説明として正しいものをえらびます。「何をした人か」を答えられるようにしよう。</p>
        <div class="units">
          ${row('all', 'すべての時代', persons(HIS).length)}
          ${HIS.map(u => row(u.id, u.name, persons([u]).length)).join('')}
        </div>
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $$('[data-u]').forEach(b => b.onclick = () => play(b.dataset.u));
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    function play(scope) {
      const pool = persons(scope === 'all' ? HIS : HIS.filter(u => u.id === scope));
      const all = persons(HIS);
      const qs = shuffle(pool).slice(0, ROUNDS);
      const log = [];
      let i = 0;
      const finish = () => {
        const score = log.filter(l => l.ok).length;
        const s = App.extState('persons'); s.best = s.best || {};
        if (s.best[scope] === undefined || score > s.best[scope]) s.best[scope] = score;
        App.save();
        App.showResult({ title: '人物さかさクイズ', log, again: () => play(scope) });
      };
      const ask = () => {
        const it = qs[i];
        // 誤答は同じ時代（単元）の人物を優先し、足りなければ他の時代から
        const same = shuffle(pool.filter(x => x.a !== it.a));
        const other = shuffle(all.filter(x => x.a !== it.a && !same.includes(x)));
        const opts = shuffle([it, ...same.concat(other).slice(0, 3)]);
        view.innerHTML = `${App.header(i, qs.length)}
          <div class="card question"><span class="tag his">歴史</span> <span class="muted">${esc(App.UNIT[it.unit].name)}</span>
            <p class="qt"><b class="big-name">${esc(it.a)}</b> について正しい説明は？</p></div>
          <div class="choices">
            ${opts.map((o, k) => `<button class="choice desc" data-k="${k}"><span class="no">${k + 1}</span><span>${esc(describe(o.q))}</span></button>`).join('')}
          </div>
          <div id="fb"></div>`;
        App.bindQuit(() => log.length > 0, finish);
        let done = false;
        const answer = k => {
          if (done) return;
          done = true;
          const ok = opts[k] === it;
          ok ? sound.ok() : sound.ng();
          App.touchDay(); App.save();
          $$('.choice').forEach((b, j) => {
            b.disabled = true;
            if (opts[j] === it) b.classList.add('correct'); else if (j === k) b.classList.add('wrong');
          });
          log.push({ q: `${it.a}について正しい説明は？`, a: describe(it.q), ok, pick: describe(opts[k].q) });
          $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
              <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
              <div class="exp">${opts.map(o => `<b>${esc(o.a)}</b>：${esc(describe(o.q))}`).join('<br>')}</div>
              ${it.e ? `<div class="exp">${esc(it.e)}</div>` : ''}
            </div>
            <div class="next-wrap"><button class="btn block" id="next">${i + 1 < qs.length ? '次の問題へ' : '結果を見る'}</button></div>`;
          $('#next').onclick = () => { i++; i < qs.length ? ask() : finish(); };
          $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
        $$('.choice').forEach(b => b.onclick = () => answer(+b.dataset.k));
        App.onKey(e => {
          if (!done && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
          else if (done && e.key === 'Enter') { e.preventDefault(); $('#next').click(); }
        });
        window.scrollTo(0, 0);
      };
      ask();
    }

    App.registerMode({ id: 'persons', section: 'practice', icon: '👤', name: '人物さかさクイズ', desc: '人物名から「何をした人か」をえらぶ', start: menu });
  });
})();
