/* =========================================================================
 * 用語さくいん
 * 問題・答え・解説・年表・都道府県の特色を語句で検索する。
 * ひらがな／カタカナ、全角／半角のちがいは区別しない。
 * ========================================================================= */
(function () {
  'use strict';

  const MAX = 60;
  // 検索用に文字をそろえる（カタカナ→ひらがな、全角英数→半角、空白・中点を除く）
  const fold = s => String(s).normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/ヶ|ケ/g, 'け').replace(/[\s・･]/g, '');

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc } = App;
    const { EVENTS } = window.SHAKAI;
    const PREFS = (window.SHAKAI_MAP || {}).PREFS || [];

    // 検索対象をまとめて作っておく
    const docs = [
      ...App.ALL.map(it => ({ kind: 'item', it, text: fold(it.q + ' ' + it.a + ' ' + it.e) })),
      ...EVENTS.map(ev => ({ kind: 'event', ev, text: fold(ev.y + '年 ' + ev.t + ' ' + (ev.goro || '')) })),
      ...PREFS.map(p => ({ kind: 'pref', p, text: fold(p.name + ' ' + p.cap + ' ' + p.note) }))
    ];

    // 元の文字列で見つかった部分に印をつける（見つからないときはそのまま）
    function mark(text, q) {
      const t = esc(text);
      if (!q) return t;
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return t;
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
    }

    function open(initial = '') {
      App.onKey(null); App.stopTimer();
      view.innerHTML = `
        <h2 style="margin-top:4px">🔎 用語さくいん</h2>
        <input id="sq" class="write-in search-in" type="search" placeholder="例：琵琶湖、聖徳太子、条約" value="${esc(initial)}" autocomplete="off" enterkeyhint="search">
        <p class="muted" id="scount"></p>
        <div id="sres" class="review"></div>
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      const input = $('#sq');
      const run = () => {
        const raw = input.value.trim();
        const q = fold(raw);
        if (!q) {
          $('#scount').textContent = `${App.ALL.length}問・できごと${EVENTS.length}件・都道府県${PREFS.length}の中から探せます。`;
          $('#sres').innerHTML = '';
          return;
        }
        // 答えに一致するものを先に並べる
        const hits = docs.filter(d => d.text.includes(q));
        const score = d => d.kind === 'item' ? (fold(d.it.a).includes(q) ? 0 : 1) : d.kind === 'pref' ? (fold(d.p.name).includes(q) ? 0 : 2) : 2;
        hits.sort((a, b) => score(a) - score(b));
        const items = hits.filter(d => d.kind === 'item').map(d => d.it);
        $('#scount').innerHTML = hits.length
          ? `${hits.length}件見つかりました${hits.length > MAX ? `（最初の${MAX}件を表示）` : ''}`
          : '見つかりませんでした。ひらがなや別の言い方でも探してみてください。';
        $('#sres').innerHTML = (items.length >= 4
          ? `<button class="btn block" id="squiz">見つかった問題で4択クイズ（${Math.min(items.length, 30)}問）</button>` : '') +
          hits.slice(0, MAX).map(d => {
            if (d.kind === 'item') {
              const u = App.UNIT[d.it.unit];
              return `<div class="card rv"><span class="mk"><span class="dot ${u.field}"></span></span><div>
                <div class="muted">${esc(u.name)}</div>${mark(d.it.q, raw)}<br><span class="a">→ ${mark(d.it.a, raw)}</span>
                ${d.it.e ? `<div class="muted">${mark(d.it.e, raw)}</div>` : ''}</div></div>`;
            }
            if (d.kind === 'event') {
              return `<div class="card rv"><span class="mk"><span class="dot his"></span></span><div>
                <div class="muted">年表</div><span class="a">${d.ev.y}年</span>　${mark(d.ev.t, raw)}
                ${d.ev.goro ? `<div class="muted">ゴロ：${esc(d.ev.goro)}</div>` : ''}</div></div>`;
            }
            return `<div class="card rv"><span class="mk"><span class="dot geo"></span></span><div>
              <div class="muted">都道府県</div><span class="a">${mark(d.p.name, raw)}</span>（県庁所在地：${mark(d.p.cap, raw)}）
              <div class="muted">${mark(d.p.note, raw)}</div></div></div>`;
          }).join('');
        const qb = $('#squiz');
        if (qb) qb.onclick = () => App.startSession('quiz', App.shuffle(items).slice(0, 30), `さくいん「${raw}」`);
      };
      let tm;
      input.oninput = () => { clearTimeout(tm); tm = setTimeout(run, 120); };
      $('#home').onclick = App.goHome;
      run();
      setTimeout(() => input.focus({ preventScroll: true }), 50);
      window.scrollTo(0, 0);
    }

    App.registerMode({ id: 'search', section: 'tool', icon: '🔎', name: '用語さくいん', desc: '語句から問題・答え・解説をさがす', start: () => open() });
    App.openSearch = open;
  });
})();
