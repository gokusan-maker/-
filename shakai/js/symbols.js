/* =========================================================================
 * 地図記号クイズ
 * 国土地理院の地図記号をもとに、形を簡略化してSVGで描く（100×100の座標）。
 * ========================================================================= */
(function () {
  'use strict';

  const L = 'fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"';
  const T = (ch, size = 62, y = 52) => `<text x="50" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="currentColor" font-weight="700">${ch}</text>`;
  const gear = (r1, r2, n) => {
    let d = '';
    for (let k = 0; k < n * 2; k++) {
      const a = Math.PI * k / n, r = k % 2 ? r1 : r2;
      const a2 = Math.PI * (k + 1) / n;
      const p1 = [50 + r * Math.cos(a), 50 + r * Math.sin(a)], p2 = [50 + r * Math.cos(a2), 50 + r * Math.sin(a2)];
      d += (k ? 'L' : 'M') + p1.map(v => v.toFixed(1)).join(',') + 'L' + p2.map(v => v.toFixed(1)).join(',');
    }
    return d + 'Z';
  };

  const SYMBOLS = [
    { name: '小・中学校', note: '「文」の字を図案化したもの。', svg: T('文', 66) },
    { name: '高等学校', note: '「文」を丸で囲む。', svg: `<circle cx="50" cy="50" r="42" ${L}/>` + T('文', 50) },
    { name: '市役所', note: '二重丸（◎）。東京都の区役所も同じ記号。', svg: `<circle cx="50" cy="50" r="40" ${L}/><circle cx="50" cy="50" r="22" ${L}/>` },
    { name: '郵便局', note: '昔の逓信省の「テ」を図案化した〒を丸で囲む。', svg: `<circle cx="50" cy="50" r="42" ${L}/><path d="M30 32H70M30 48H70M50 48V76" ${L}/>` },
    { name: '警察署', note: '交番の記号（警棒を交差させた形）を丸で囲む。', svg: `<circle cx="50" cy="50" r="42" ${L}/><path d="M30 30L70 70M70 30L30 70" ${L}/>` },
    { name: '交番', note: '2本の警棒を交差させた形。', svg: `<path d="M22 22L78 78M78 22L22 78" ${L}/>` },
    { name: '神社', note: '神社の入り口にある鳥居の形。', svg: `<path d="M14 26Q50 18 86 26M24 42H76M32 26V86M68 26V86" ${L}/>` },
    { name: '寺院', note: '仏教で使われる「卍（まんじ）」の形。', svg: T('卍', 70) },
    { name: '工場', note: '機械の歯車の形。', svg: `<path d="${gear(30, 40, 8)}" ${L}/><circle cx="50" cy="50" r="10" ${L}/>` },
    { name: '温泉', note: '湯つぼと立ちのぼる湯気の形。', svg: `<path d="M20 58Q20 86 50 86Q80 86 80 58" ${L}/><path d="M34 52Q26 42 34 32Q42 22 34 12M50 52Q42 42 50 32Q58 22 50 12M66 52Q58 42 66 32Q74 22 66 12" ${L}/>` },
    { name: '田', note: '稲をかり取ったあとの切り株の形。', svg: `<path d="M38 28V72M62 28V72" ${L}/>` },
    { name: '畑', note: '植物の双葉の形。', svg: `<path d="M50 82V52M50 52Q30 50 24 26M50 52Q70 50 76 26" ${L}/>` },
    { name: '果樹園', note: 'りんごやなしなどの果実の形。', svg: `<circle cx="50" cy="58" r="24" ${L}/><path d="M50 34V16" ${L}/>` },
    { name: '茶畑', note: '茶の実を図案化したもの。', svg: `<circle cx="50" cy="30" r="9" fill="currentColor"/><circle cx="30" cy="66" r="9" fill="currentColor"/><circle cx="70" cy="66" r="9" fill="currentColor"/>` },
    { name: '広葉樹林', note: '横から見た広葉樹の形。', svg: `<circle cx="50" cy="40" r="22" ${L}/><path d="M50 62V88" ${L}/>` },
    { name: '針葉樹林', note: '横から見た針葉樹の形。', svg: `<path d="M24 64L50 16L76 64M50 16V88" ${L}/>` },
    { name: '灯台', note: '光が四方を照らすようすを表す。', svg: `<circle cx="50" cy="50" r="10" fill="currentColor"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = Math.PI * a / 180; return `<path d="M${(50 + 20 * Math.cos(r)).toFixed(1)} ${(50 + 20 * Math.sin(r)).toFixed(1)}L${(50 + 40 * Math.cos(r)).toFixed(1)} ${(50 + 40 * Math.sin(r)).toFixed(1)}" ${L}/>`; }).join('')}` },
    { name: '港', note: '船のいかりの形（地方港）。', svg: `<circle cx="50" cy="20" r="8" ${L}/><path d="M50 28V86M32 44H68M18 62Q22 86 50 86Q78 86 82 62" ${L}/>` },
    { name: '図書館', note: '本を開いた形。2002年に追加された。', svg: `<path d="M50 30Q34 20 14 26V78Q34 72 50 82Q66 72 86 78V26Q66 20 50 30Z" ${L}/><path d="M50 30V82" ${L}/>` },
    { name: '博物館', note: '博物館・美術館の建物の形。2002年に追加された。', svg: `<path d="M14 40L50 16L86 40Z" ${L}/><path d="M26 46V76M42 46V76M58 46V76M74 46V76M14 84H86" ${L}/>` },
    { name: '老人ホーム', note: '建物の中につえをえがいた形。2006年に追加された。', svg: `<path d="M14 46L50 16L86 46V86H14Z" ${L}/><path d="M54 80V48Q54 38 44 38Q36 38 36 46" ${L}/>` },
    { name: '風車', note: '風力発電用の風車の形。', svg: `<path d="M50 40V90" ${L}/><path d="M50 40L50 10M50 40L24 55M50 40L76 55" ${L}/><circle cx="50" cy="40" r="5" fill="currentColor"/>` },
    { name: '自然災害伝承碑', note: '記念碑の形に、碑文を表す線を加えた形。2019年に追加された。', svg: `<path d="M30 84V30Q30 14 50 14Q70 14 70 30V84M20 86H80" ${L}/><path d="M42 36V72M58 36V72" ${L}/>` },
    { name: '記念碑', note: '石碑を立てた形。', svg: `<path d="M30 84V30Q30 14 50 14Q70 14 70 30V84M20 86H80" ${L}/>` }
  ];
  const icon = (s, cls = '') => `<svg class="sym ${cls}" viewBox="0 0 100 100" aria-hidden="true">${s.svg}</svg>`;
  const ROUNDS = 10;

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc, shuffle, sound } = App;

    function menu() {
      App.onKey(null);
      const best = App.extState('symbols').best || {};
      view.innerHTML = `
        <h2 style="margin-top:4px">📍 地図記号</h2>
        <p class="muted">国土地理院の地図記号をもとに、形を簡略化してえがいています。由来もいっしょに覚えると忘れにくくなります。</p>
        <div class="modes">
          <button class="mode" data-m="s2n"><span class="ico">🔍</span><span class="ttl">記号 → 名前</span><span class="dsc">記号を見て名前をえらぶ${best.s2n !== undefined ? `<br>最高 ${best.s2n}/${ROUNDS}` : ''}</span></button>
          <button class="mode" data-m="n2s"><span class="ico">✍️</span><span class="ttl">名前 → 記号</span><span class="dsc">名前を見て記号をえらぶ${best.n2s !== undefined ? `<br>最高 ${best.n2s}/${ROUNDS}` : ''}</span></button>
        </div>
        <h2>記号の一覧</h2>
        <div class="sym-list">
          ${SYMBOLS.map(s => `<div class="card sym-item">${icon(s)}<div><b>${s.name}</b><div class="muted">${esc(s.note)}</div></div></div>`).join('')}
        </div>
        <p class="muted">「消防署」（さすまた）・「病院」（旧陸軍の衛生隊のしるし）などの由来は、単元「地形図と地図記号」で出題されます。</p>
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $$('[data-m]').forEach(b => b.onclick = () => play(b.dataset.m));
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    function play(kind) {
      const qs = shuffle(SYMBOLS).slice(0, ROUNDS);
      const log = [];
      let i = 0;
      const finish = () => {
        const score = log.filter(l => l.ok).length;
        const s = App.extState('symbols'); s.best = s.best || {};
        if (s.best[kind] === undefined || score > s.best[kind]) s.best[kind] = score;
        App.save();
        App.showResult({ title: kind === 's2n' ? '地図記号（記号→名前）' : '地図記号（名前→記号）', log, again: () => play(kind) });
      };
      const ask = () => {
        const s = qs[i];
        const opts = shuffle([s, ...shuffle(SYMBOLS.filter(x => x !== s)).slice(0, 3)]);
        view.innerHTML = `${App.header(i, qs.length)}
          <div class="card question sym-q"><span class="tag geo">地理</span> <span class="muted">地図記号</span>
            ${kind === 's2n' ? `<div class="sym-big">${icon(s)}</div><p class="qt">この地図記号は何を表している？</p>`
              : `<p class="qt"><b class="big-name">${s.name}</b> の地図記号はどれ？</p>`}
          </div>
          <div class="choices ${kind === 'n2s' ? 'sym-grid' : ''}">
            ${opts.map((o, k) => `<button class="choice" data-k="${k}"><span class="no">${k + 1}</span>${kind === 's2n' ? `<span>${o.name}</span>` : icon(o)}</button>`).join('')}
          </div>
          <div id="fb" role="status" aria-live="polite"></div>`;
        App.bindQuit(() => log.length > 0, finish);
        let done = false;
        const answer = k => {
          if (done) return;
          done = true;
          const ok = opts[k] === s;
          ok ? sound.ok() : sound.ng();
          App.touchDay(); App.save();
          $$('.choice').forEach((b, j) => {
            b.disabled = true;
            if (opts[j] === s) b.classList.add('correct'); else if (j === k) b.classList.add('wrong');
          });
          log.push({ q: kind === 's2n' ? 'この記号は？' : `${s.name}の記号は？`, qHtml: `${icon(s, 'mini')} ${kind === 's2n' ? 'この記号は？' : `${s.name}の記号は？`}`, a: s.name, ok, pick: kind === 's2n' ? opts[k].name : `${opts[k].name}の記号` });
          $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
              <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
              <div class="sym-ans">${icon(s)}<div><div class="ans">${s.name}</div><div class="exp">${esc(s.note)}</div></div></div>
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

    App.registerMode({ id: 'symbols', icon: '📍', name: '地図記号', desc: '記号の形と名前・由来を覚える', start: menu });
  });
})();
