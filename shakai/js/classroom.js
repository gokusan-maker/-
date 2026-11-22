/* =========================================================================
 * 授業で映す（授業用プリントの「授業で映す」タブ）
 * プロジェクターやテレビに、単元の問題を1問ずつ大きく映して、クラスで復習する。
 *   ・一問一答：問題 →（タップ）→ 答え・読みがな・解説
 *   ・4択：ア〜エの選択肢を見せてから正解を表示
 * 生徒の学習記録には残さない。キーボード（→・スペースで次、←で前、Enterで答え）でも操作できる。
 * ========================================================================= */
(function () {
  'use strict';

  const KANA = ['ア', 'イ', 'ウ', 'エ'];
  const pickN = (arr, n, not) => arr.filter(x => x !== not).sort(() => Math.random() - .5).slice(0, n);

  // 図やグラフを見て答える「資料」のデッキ。どれも { q, a, e, html, ch（誤答3つ） } の形
  const DECKS = [
    { id: 'map', name: '白地図：この都道府県は？', field: 'geo', make: () => {
      const M = window.SHAKAI_MAP;
      return M.PREFS.map(p => ({ q: '色のついている都道府県は？', a: p.name, e: `県庁所在地は${p.cap}。${p.note}`,
        html: M.mapSvg({ labels: false, highlight: p.i, region: false }),
        ch: M.PREFS.filter(x => x !== p).sort((a, b) => M.dist(a, p) - M.dist(b, p)).slice(0, 5).sort(() => Math.random() - .5).slice(0, 3).map(x => x.name) }));
    } },
    { id: 'cap', name: '白地図：県庁所在地は？', field: 'geo', make: () => {
      const M = window.SHAKAI_MAP;
      return M.PREFS.filter(p => p.name !== '東京都').map(p => ({ q: `色のついている都道府県（${p.name}）の県庁所在地は？`, a: p.cap, e: p.note,
        html: M.mapSvg({ labels: true, highlight: p.i, region: false }),
        ch: M.PREFS.filter(x => x !== p && x.name !== '東京都').sort((a, b) => M.dist(a, p) - M.dist(b, p)).slice(0, 5).sort(() => Math.random() - .5).slice(0, 3).map(x => x.cap) }));
    } },
    { id: 'sym', name: '地図記号', field: 'geo', make: () => (window.SHAKAI_SYMBOLS || []).map(x => ({
      q: 'この地図記号は何を表している？', a: x.name, e: x.note,
      html: `<svg class="cl-sym" viewBox="0 0 100 100" aria-hidden="true">${x.svg}</svg>`,
      ch: pickN(window.SHAKAI_SYMBOLS, 3, x).map(y => y.name) })) },
    { id: 'climate', name: '雨温図', field: 'geo', make: () => {
      const C = window.SHAKAI_CLIMATE;
      return C.CITIES.map(c => ({ q: 'この雨温図は、どの気候のもの？', a: c.climate, e: `${c.city}。${c.point}`,
        html: `<div class="cl-chart">${C.chart(c)}</div>`, ch: pickN(C.CITIES, 3, c).map(y => y.climate) }));
    } },
    { id: 'nengo', name: '年号', field: 'his', make: () => window.SHAKAI.EVENTS.map(ev => {
      const near = [];
      window.SHAKAI.EVENTS.slice().sort((a, b) => Math.abs(a.y - ev.y) - Math.abs(b.y - ev.y)).forEach(e => { if (e.y !== ev.y && !near.includes(e.y) && near.length < 3) near.push(e.y); });
      return { q: `「${ev.t}」${/[るすつくぶむう]$/.test(ev.t) ? 'のは' : 'は'}何年？`, a: `${ev.y}年`, e: ev.goro ? `💡${ev.goro}` : '', ch: near.map(y => `${y}年`) };
    }) }
  ];

  window.SHAKAI_CLASS = {
    menuHtml(App) {
      const s = App.extState('classroom');
      const { FIELDS, UNITS } = window.SHAKAI;
      const seg = (id, list, cur) => `<div class="seg" id="${id}">${list.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
      return `<p class="muted">問題を1問ずつ大きく映して、クラスで答えを言い合う授業用の画面です。プロジェクターや大きなテレビにつないで使います。生徒の学習記録には残りません。</p>
        <div class="card setting col">
          <span><b>出し方</b></span>${seg('cl-kind', [['flash', '一問一答'], ['choice', '4択（ア〜エ）']], s.kind || 'flash')}
          <span><b>問題数</b></span>${seg('cl-n', [[10, '10問'], [20, '20問'], [0, 'ぜんぶ']], s.n === undefined ? 10 : s.n)}
          <span><b>順番</b></span>${seg('cl-order', [['random', 'ランダム'], ['seq', '問題の順']], s.order || 'random')}
        </div>
        <h2>資料（地図・グラフ・年号）</h2>
        <div class="units">${DECKS.filter(d => d.id !== 'climate' || window.SHAKAI_CLIMATE).map(d => `
          <button class="card unit cl-deck" data-d="${d.id}"><span class="uico">${{ map: '🗾', cap: '🏛', sym: '📍', climate: '☔', nengo: '⏳' }[d.id]}</span>
            <span><span class="uname">${App.esc(d.name)}</span></span><span class="pct">📺</span></button>`).join('')}</div>
        ${FIELDS.map(f => `<h2><span class="tag ${f.id}">${f.name}</span></h2>
          <div class="units">${UNITS.filter(u => u.field === f.id).map(u => `
            <button class="card unit cl-unit" data-u="${u.id}"><span class="uico">${u.icon}</span>
              <span><span class="uname">${App.esc(u.name)}</span><span class="umeta"> ・ ${u.items.length}問</span></span><span class="pct">📺</span></button>`).join('')}</div>`).join('')}`;
    },

    bind(App, menu) {
      const s = App.extState('classroom');
      const set = (k, v) => { s[k] = v; App.save(); menu(); };
      App.$$('#cl-kind button').forEach(b => b.onclick = () => set('kind', b.dataset.v));
      App.$$('#cl-n button').forEach(b => b.onclick = () => set('n', +b.dataset.v));
      App.$$('#cl-order button').forEach(b => b.onclick = () => set('order', b.dataset.v));
      App.$$('.cl-unit').forEach(b => b.onclick = () => this.present(App, menu, b.dataset.u));
      App.$$('.cl-deck').forEach(b => b.onclick = () => this.present(App, menu, null, DECKS.find(d => d.id === b.dataset.d)));
    },

    present(App, menu, unitId, deck) {
      const s = App.extState('classroom');
      // 単元の問題か、資料のデッキか
      const u = deck ? { name: deck.name, field: deck.field } : App.UNIT[unitId];
      const src = deck ? deck.make() : u.items;
      const kind = s.kind || 'flash', n = s.n === undefined ? 10 : s.n;
      let items = s.order === 'seq' ? src.slice() : App.shuffle(src);
      if (n) items = items.slice(0, n);
      const opts = items.map(it => kind !== 'choice' ? null : it.ch ? App.shuffle([it.a, ...it.ch]) : App.choicesFor(it));
      let i = 0, shown = false;
      const { $, esc } = App;

      const close = () => {
        document.body.classList.remove('cl-on');
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
        App.onKey(null);
        menu();
      };
      const draw = () => {
        const it = items[i];
        const read = App.reading(it.a);
        App.view.innerHTML = `
          <div class="cl-screen">
            <div class="cl-top">
              <span class="tag ${u.field}">${esc(App.FIELD[u.field].name)}</span><span class="cl-unit-name">${esc(u.name)}</span>
              <span class="cl-count">${i + 1} / ${items.length}</span>
              <button class="cl-btn" id="cl-full" title="全画面">⛶</button>
              <button class="cl-btn" id="cl-close" title="おわる">✕</button>
            </div>
            <div class="cl-q ${it.html ? 'small' : ''}">${esc(it.q)}</div>
            ${it.html ? `<div class="cl-fig">${it.html}</div>` : ''}
            ${kind === 'choice' ? `<div class="cl-ch">${opts[i].map((c, k) => `<div class="cl-c ${shown && c === it.a ? 'ok' : ''} ${shown && c !== it.a ? 'dim' : ''}"><b>${KANA[k]}</b>${esc(c)}</div>`).join('')}</div>` : ''}
            <div class="cl-a ${shown ? 'on' : ''}" id="cl-a">
              ${shown ? `<div class="cl-ans">${kind === 'choice' ? `<b>${KANA[opts[i].indexOf(it.a)]}</b>　` : ''}${esc(it.a)}${read ? `<small>（${esc(read)}）</small>` : ''}</div>
                ${it.e ? `<div class="cl-exp">${esc(it.e)}</div>` : ''}` : '<span class="cl-tap">タップして答えを見る</span>'}
            </div>
            <div class="cl-nav">
              <button class="btn sub" id="cl-prev" ${i ? '' : 'disabled'}>‹ 前の問題</button>
              <button class="btn" id="cl-next">${!shown ? '答えを見る' : i + 1 < items.length ? '次の問題 ›' : 'おわり'}</button>
            </div>
          </div>`;
        const go = d => { const j = i + d; if (j < 0) return; if (j >= items.length) return close(); i = j; shown = false; draw(); };
        const step = () => { if (!shown) { shown = true; draw(); } else go(1); };
        $('#cl-a').onclick = () => { if (!shown) step(); };
        $('#cl-next').onclick = step;
        $('#cl-prev').onclick = () => go(-1);
        $('#cl-close').onclick = close;
        $('#cl-full').onclick = () => {
          const el = document.documentElement;
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        };
        App.onKey(e => {
          if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); step(); }
          else if (e.key === 'Enter') { e.preventDefault(); if (!shown) step(); }
          else if (e.key === 'ArrowLeft') go(-1);
          else if (e.key === 'Escape') close();
        });
        window.scrollTo(0, 0);
      };
      document.body.classList.add('cl-on');
      draw();
    }
  };
})();
