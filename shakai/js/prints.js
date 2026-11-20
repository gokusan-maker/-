/* =========================================================================
 * 授業用プリント（メニュー）
 * 問題を解く画面とは別のメニュー。単元ごとの授業プリント（練習問題・確認テスト・解答）を
 * 画面で確かめて、印刷または PDF で保存・ダウンロードできる。
 *   ・作成ずみの PDF：print/授業プリント/ に全単元分（tools/make-lesson.js で作成）
 *   ・苦手な問題だけのプリント：そのユーザーがアプリでまちがえた問題から作る
 * ========================================================================= */
(function () {
  'use strict';

  // 作成ずみ PDF のファイル名（tools/make-lesson.js と同じ規則）
  const pdfName = (no, unit) => `print/授業プリント/第${String(no).padStart(2, '0')}回_${unit.name.replace(/[\\/:*?"<>|]/g, '')}.pdf`;

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc } = App;
    const { FIELDS, UNITS } = window.SHAKAI;
    const L = window.SHAKAI_LESSON;
    const st = () => App.extState('prints');

    // プリント用のスタイルを1回だけ読みこむ
    function ensureCss() {
      if (document.getElementById('lp-style')) return;
      const s = document.createElement('style');
      s.id = 'lp-style';
      s.textContent = L.CSS;
      document.head.appendChild(s);
    }

    function menu() {
      App.onKey(null); App.stopTimer();
      document.body.classList.remove('printing-lesson');
      const s = st();
      const minutes = s.minutes || 45;
      const weak = App.ALL.filter(it => App.isWeak(it.id));
      view.innerHTML = `
        <h2 style="margin-top:4px">🖨 授業用プリント</h2>
        <p class="muted">アプリで練習する問題を、授業でそのまま配れるプリントにしました。1単元が1回分で、<b>表紙（めあて・授業の流れ・得点・ふり返り）→ 練習問題 → 確認テスト（100点）</b>の順。後ろに<b>先生用の解答</b>がついています。</p>
        <div class="card setting col">
          <span><b>授業の時間</b><br><span class="muted">表紙の「授業の流れ」の時間配分が変わります（画面で作るプリントのみ）</span></span>
          <div class="seg" id="min">${[45, 90].map(m => `<button data-m="${m}" class="${minutes === m ? 'on' : ''}">${m}分</button>`).join('')}</div>
        </div>
        ${weak.length ? `<button class="card unit pr-weak" id="pr-weak"><span class="uico">🎯</span>
          <span><span class="uname">苦手な問題だけのプリント</span><span class="umeta"> ・ ${weak.length}問（アプリでまちがえた問題）</span></span><span class="pct">›</span></button>` : ''}
        ${FIELDS.map(f => `<h2><span class="tag ${f.id}">${f.name}</span></h2>
          <div class="units">${UNITS.map((u, k) => ({ u, no: k + 1 })).filter(x => x.u.field === f.id).map(({ u, no }) => `
            <div class="card pr-row">
              <span class="uico">${u.icon}</span>
              <span class="pr-info"><span class="uname">第${no}回　${esc(u.name)}</span><span class="umeta">練習${Math.min(40, u.items.length)}問・確認テスト20問</span></span>
              <span class="pr-btns">
                <button class="btn sub pr-view" data-u="${u.id}" data-no="${no}">見る・印刷</button>
                <a class="btn pr-dl" href="${encodeURI(pdfName(no, u))}" download>PDF</a>
              </span>
            </div>`).join('')}</div>`).join('')}
        <p class="muted" style="margin-top:14px">「PDF」は作成ずみのファイルをダウンロードします。「見る・印刷」では画面で確かめてから、印刷または「PDFに保存」ができます（日付・名前らんは空らん）。</p>
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $$('#min button').forEach(b => b.onclick = () => { s.minutes = +b.dataset.m; App.save(); menu(); });
      $$('.pr-view').forEach(b => b.onclick = () => preview({ unitId: b.dataset.u, no: +b.dataset.no, minutes }));
      const w = $('#pr-weak');
      if (w) w.onclick = () => preview({ title: '苦手な問題', items: weak, seed: 'weak-' + App.today(), minutes });
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    function preview(opts) {
      ensureCss();
      App.onKey(null);
      const doc = L.build(window.SHAKAI, { ...opts, readings: window.SHAKAI_READINGS || {} });
      view.innerHTML = `
        <div class="pr-bar no-print">
          <button class="btn sub" id="back">‹ もどる</button>
          <span class="pr-bar-ttl">${esc(doc.title)}<small>練習${doc.practice}問・確認テスト${doc.test}問</small></span>
          <button class="btn" id="doprint">🖨 印刷・PDF保存</button>
        </div>
        <p class="muted no-print">印刷画面の「送信先」で「PDFに保存」をえらぶと PDF になります。用紙は A4・余白なし（または最小）がおすすめです。</p>
        <div class="pr-stage"><div class="lp-doc" id="lp-doc">${doc.html}</div></div>`;
      // 画面の幅に合わせてプリントを縮小して見せる（印刷のときは原寸）
      const fit = () => {
        const stage = $('.pr-stage'), d = $('#lp-doc');
        if (!stage || !d) return;
        const scale = Math.min(1, stage.clientWidth / d.scrollWidth);
        d.style.transform = `scale(${scale})`;
        stage.style.height = (d.scrollHeight * scale) + 'px';
      };
      fit();
      window.addEventListener('resize', fit, { once: true });
      $('#back').onclick = menu;
      $('#doprint').onclick = () => {
        document.body.classList.add('printing-lesson');
        const done = () => { document.body.classList.remove('printing-lesson'); window.removeEventListener('afterprint', done); };
        window.addEventListener('afterprint', done);
        window.print();
        setTimeout(done, 1000);
      };
      window.scrollTo(0, 0);
    }

    App.openPrints = menu;
    const btn = document.getElementById('btn-prints');
    if (btn) btn.onclick = () => { if (!document.querySelector('#view .qhead') || confirm('ホームにもどりますか？')) menu(); };
  });

  window.SHAKAI_PRINT_NAME = pdfName;
})();
