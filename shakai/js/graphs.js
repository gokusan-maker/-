/* =========================================================================
 * グラフ読み取り（生産量の多い都道府県）
 * 上位の都道府県と全国にしめる割合の棒グラフを見て、何の生産かを当てる。
 * 割合は農林水産省の統計（2023〜2024年）をもとにした概数（％）。
 * 順位が年によって入れかわりやすい品目や順位はのせていない。
 * ========================================================================= */
(function () {
  'use strict';

  const GRAPHS = [
    { name: 'りんご', top: [['青森県', 62], ['長野県', 18], ['岩手県', 5]], hint: 'すずしい地域でつくられる果物。青森県が全国の約6割。' },
    { name: 'ぶどう', top: [['山梨県', 25], ['長野県', 18], ['岡山県', 9]], hint: '甲府盆地の扇状地で栽培がさかん。' },
    { name: 'もも', top: [['山梨県', 29], ['福島県', 27], ['長野県', 10]], hint: '山梨県と福島県で全国の半分以上。' },
    { name: 'さくらんぼ', top: [['山形県', 75], ['北海道', 10]], hint: '山形県が全国の約4分の3。' },
    { name: 'レタス', top: [['長野県', 34], ['茨城県', 16], ['群馬県', 8]], hint: '長野県の高原で夏にすずしい気候を利用して栽培（抑制栽培）。' },
    { name: 'いちご', top: [['栃木県', 15], ['福岡県', 10]], hint: '栃木県は50年以上連続で生産量日本一。' },
    { name: '落花生', top: [['千葉県', 86], ['茨城県', 8]], hint: '千葉県が全国の8割以上。' },
    { name: '米', top: [['新潟県', 9], ['北海道', 7], ['秋田県', 6]], hint: '1位でも1割ほどで、全国で広くつくられている。' },
    { name: '梅', top: [['和歌山県', 60]], hint: '和歌山県が全国の約6割。' },
    { name: 'さとうきび', top: [['沖縄県', 56], ['鹿児島県', 44]], hint: '暖かい沖縄県と鹿児島県の南西諸島だけでつくられる。' },
    { name: '乳用牛（飼育頭数）', top: [['北海道', 63], ['栃木県', 4]], hint: '根釧台地などで酪農がさかんな北海道が約6割。' },
    { name: '肉用牛（飼育頭数）', top: [['北海道', 21], ['鹿児島県', 14], ['宮崎県', 10]], hint: '北海道と九州南部で多い。' }
  ];
  const ROUNDS = 8;
  const COLORS = ['#e2574c', '#f0a04b', '#f2cf5b'];

  function chart(g) {
    const rest = 100 - g.top.reduce((a, [, v]) => a + v, 0);
    const rows = g.top.map(([p, v], k) => ({ p, v, c: COLORS[k] })).concat(rest > 0 ? [{ p: 'その他', v: rest, c: 'var(--line)' }] : []);
    return `<div class="gbar" role="img" aria-label="${g.top.map(([p, v]) => `${p}${v}%`).join('、')}">
      ${rows.map(r => `<span style="width:${r.v}%;background:${r.c}" title="${r.p} 約${r.v}%"></span>`).join('')}
    </div>
    <div class="glegend">${rows.map((r, k) => `<div><i style="background:${r.c}"></i>${k < g.top.length ? `${k + 1}位 ` : ''}${r.p}<b>約${r.v}%</b></div>`).join('')}</div>`;
  }

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc, shuffle, sound } = App;

    function menu() {
      App.onKey(null); App.stopTimer();
      const best = App.extState('graphs').best;
      view.innerHTML = `
        <h2 style="margin-top:4px">📊 グラフ読み取り</h2>
        <p class="muted">生産量（飼育頭数）の多い都道府県と、全国にしめる割合のグラフです。どの品目のグラフか見分けられるようにしよう。割合は農林水産省の統計（2023〜2024年）をもとにした概数です。</p>
        <button class="btn block" id="play">グラフクイズをはじめる（${ROUNDS}問）${best !== undefined ? `　最高 ${best}/${ROUNDS}` : ''}</button>
        <h2>グラフの一覧</h2>
        ${GRAPHS.map(g => `<div class="card gcard"><b>${esc(g.name)}</b>${chart(g)}<div class="muted">${esc(g.hint)}</div></div>`).join('')}
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $('#play').onclick = play;
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    function play() {
      const qs = shuffle(GRAPHS).slice(0, ROUNDS);
      const log = [];
      let i = 0;
      const finish = () => {
        const score = log.filter(l => l.ok).length;
        const s = App.extState('graphs');
        if (s.best === undefined || score > s.best) s.best = score;
        App.save();
        App.showResult({ title: 'グラフ読み取り', log, again: play });
      };
      const ask = () => {
        const g = qs[i];
        const opts = shuffle([g, ...shuffle(GRAPHS.filter(x => x !== g)).slice(0, 3)]);
        view.innerHTML = `${App.header(i, qs.length)}
          <div class="card question"><span class="tag geo">地理</span> <span class="muted">グラフ読み取り</span>
            <p class="qt">このグラフは、何の生産量（飼育頭数）の多い都道府県？</p></div>
          <div class="card gcard">${chart(g)}</div>
          <div class="choices">
            ${opts.map((o, k) => `<button class="choice" data-k="${k}"><span class="no">${k + 1}</span><span>${esc(o.name)}</span></button>`).join('')}
          </div>
          <div id="fb" role="status" aria-live="polite"></div>`;
        App.bindQuit(() => log.length > 0, finish);
        let done = false;
        const answer = k => {
          if (done) return;
          done = true;
          const ok = opts[k] === g;
          ok ? sound.ok() : sound.ng();
          App.touchDay(); App.save();
          $$('.choice').forEach((b, j) => {
            b.disabled = true;
            if (opts[j] === g) b.classList.add('correct'); else if (j === k) b.classList.add('wrong');
          });
          log.push({ q: `グラフ（${g.top.map(([p]) => p).join('・')}）は何の生産？`, a: g.name, ok, pick: opts[k].name });
          $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
              <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
              <div class="ans">${esc(g.name)}</div>
              <div class="exp">${esc(g.hint)}</div>
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

    App.registerMode({ id: 'graphs', icon: '📊', name: 'グラフ読み取り', desc: '生産量の多い都道府県のグラフから品目を当てる', start: menu });
  });

  window.SHAKAI_GRAPHS = GRAPHS;
})();
