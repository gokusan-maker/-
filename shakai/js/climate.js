/* =========================================================================
 * 雨温図クイズ
 * 日本の6つの気候区分を代表する都市の雨温図を描き、どの気候かを当てる。
 * 数値は気象庁の平年値（1991〜2020年）をもとにした概数。
 * t：月平均気温（℃）、p：月降水量（mm）
 * ========================================================================= */
(function () {
  'use strict';

  const CITIES = [
    {
      city: '札幌', climate: '北海道の気候',
      t: [-3.2, -2.7, 1.1, 7.3, 13.0, 17.0, 21.1, 22.3, 18.6, 12.1, 5.2, -0.9],
      p: [108, 92, 78, 55, 56, 60, 91, 127, 135, 110, 114, 115],
      point: '冬の気温が0℃を下回り、1年中すずしい。梅雨がないので6月の降水量が少ない。'
    },
    {
      city: '金沢', climate: '日本海側の気候',
      t: [4.0, 4.3, 7.4, 12.6, 17.7, 21.6, 25.8, 27.3, 23.3, 17.6, 11.9, 6.7],
      p: [256, 163, 157, 144, 138, 170, 233, 179, 232, 177, 250, 301],
      point: '北西の季節風の影響で、冬（12・1月）の降水量（雪）が多い。'
    },
    {
      city: '東京', climate: '太平洋側の気候',
      t: [5.4, 6.1, 9.4, 14.3, 18.8, 21.9, 25.7, 26.9, 23.3, 18.0, 12.5, 7.7],
      p: [60, 57, 116, 134, 140, 168, 156, 155, 225, 235, 96, 58],
      point: '夏から秋（梅雨・台風）に降水量が多く、冬は乾燥して降水量が少ない。'
    },
    {
      city: '松本', climate: '中央高地の気候',
      t: [-0.4, 0.4, 4.3, 10.4, 15.7, 19.6, 23.6, 24.7, 20.0, 13.2, 7.4, 2.1],
      p: [36, 44, 80, 75, 100, 126, 138, 92, 129, 103, 57, 32],
      point: '1年を通して降水量が少なく、夏と冬の気温差が大きい。冬は0℃近くまで下がる。'
    },
    {
      city: '高松', climate: '瀬戸内の気候',
      t: [5.9, 6.3, 9.4, 14.7, 19.8, 23.3, 27.5, 28.6, 24.7, 19.0, 13.2, 8.1],
      p: [39, 46, 83, 76, 108, 151, 144, 86, 148, 104, 60, 46],
      point: '1年を通して降水量が少なく、冬もそれほど寒くない（中央高地の気候より暖かい）。'
    },
    {
      city: '那覇', climate: '南西諸島の気候',
      t: [17.3, 17.5, 19.1, 21.5, 24.2, 27.2, 29.1, 29.0, 27.9, 25.5, 22.5, 19.0],
      p: [102, 115, 143, 161, 245, 284, 188, 240, 275, 179, 119, 110],
      point: '1年中暖かく、冬でも平均気温が15℃以上。梅雨や台風の時期に降水量が多い。'
    }
  ];
  const sum = a => a.reduce((x, y) => x + y, 0);
  CITIES.forEach(c => { c.avg = (sum(c.t) / 12).toFixed(1); c.total = Math.round(sum(c.p)); });

  // 雨温図：棒グラフ＝降水量（右目盛り 0〜400mm）、折れ線＝気温（左目盛り -10〜30℃）
  function chart(c, opts = {}) {
    const W = 320, H = 230, L = 40, R = 40, Tp = 16, B = 28;
    const pw = W - L - R, ph = H - Tp - B;
    const tY = v => Tp + ph * (30 - v) / 40;
    const pY = v => Tp + ph * (400 - Math.min(v, 400)) / 400;
    const bx = m => L + pw * (m + .5) / 12;
    const bw = pw / 12 * .62;
    let g = '';
    for (let v = -10; v <= 30; v += 10) {
      g += `<line x1="${L}" x2="${W - R}" y1="${tY(v)}" y2="${tY(v)}" class="grid"/>`;
      g += `<text x="${L - 6}" y="${tY(v)}" class="ax tl">${v}</text>`;
      g += `<text x="${W - R + 6}" y="${tY(v)}" class="ax pl">${(v + 10) * 10}</text>`;
    }
    const bars = c.p.map((v, m) => `<rect x="${bx(m) - bw / 2}" y="${pY(v)}" width="${bw}" height="${Tp + ph - pY(v)}" class="pbar"/>`).join('');
    const line = c.t.map((v, m) => `${m ? 'L' : 'M'}${bx(m).toFixed(1)},${tY(v).toFixed(1)}`).join('');
    const dots = c.t.map((v, m) => `<circle cx="${bx(m)}" cy="${tY(v)}" r="3" class="tdot"/>`).join('');
    const months = c.t.map((v, m) => `<text x="${bx(m)}" y="${H - B + 14}" class="ax mo">${m + 1}</text>`).join('');
    return `<svg class="ondo" viewBox="0 0 ${W} ${H}" role="img" aria-label="雨温図${opts.reveal ? '（' + c.city + '）' : ''}">
      ${g}
      <line x1="${L}" x2="${W - R}" y1="${tY(0)}" y2="${tY(0)}" class="zero"/>
      ${bars}<path d="${line}" class="tline"/>${dots}${months}
      <text x="${L - 6}" y="8" class="ax tl unit">℃</text>
      <text x="${W - R + 6}" y="8" class="ax pl unit">mm</text>
      <text x="${W / 2}" y="${H - 2}" class="ax mo">（月）</text>
    </svg>`;
  }

  const ROUNDS = 6;

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc, shuffle, sound } = App;

    function menu() {
      App.onKey(null);
      const best = App.extState('climate').best;
      view.innerHTML = `
        <h2 style="margin-top:4px">☔ 雨温図</h2>
        <p class="muted">棒グラフが月ごとの降水量（右の目盛り）、折れ線グラフが月ごとの平均気温（左の目盛り）です。数値は気象庁の平年値（1991〜2020年）をもとにした概数です。</p>
        <button class="btn block" id="play">雨温図クイズをはじめる（${ROUNDS}問）${best !== undefined ? `　最高 ${best}/${ROUNDS}` : ''}</button>
        <h2>6つの気候の見分け方</h2>
        ${CITIES.map(c => `<div class="card ondo-card">
          <div class="ondo-head"><b>${c.climate}</b><span class="muted">${c.city}　年平均 ${c.avg}℃・年降水量 約${c.total}mm</span></div>
          ${chart(c, { reveal: true })}
          <div class="exp">${esc(c.point)}</div></div>`).join('')}
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $('#play').onclick = play;
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    function play() {
      const qs = shuffle(CITIES).slice(0, ROUNDS);
      const log = [];
      let i = 0;
      const finish = () => {
        const score = log.filter(l => l.ok).length;
        const s = App.extState('climate');
        if (s.best === undefined || score > s.best) s.best = score;
        App.save();
        App.showResult({ title: '雨温図クイズ', log, again: play });
      };
      const ask = () => {
        const c = qs[i];
        // 2問に1問は都市名、残りは気候名で答える
        const byCity = i % 2 === 1;
        const label = x => byCity ? `${x.city}（${x.climate}）` : x.climate;
        const opts = shuffle([c, ...shuffle(CITIES.filter(x => x !== c)).slice(0, 3)]);
        view.innerHTML = `${App.header(i, qs.length)}
          <div class="card question"><span class="tag geo">地理</span> <span class="muted">雨温図</span>
            <p class="qt">${byCity ? 'この雨温図にあてはまる都市は？' : 'この雨温図は、どの気候のもの？'}</p></div>
          <div class="card ondo-card">${chart(c)}</div>
          <div class="choices">
            ${opts.map((o, k) => `<button class="choice" data-k="${k}"><span class="no">${k + 1}</span><span>${byCity ? o.city : o.climate}</span></button>`).join('')}
          </div>
          <div id="fb"></div>`;
        App.bindQuit(() => log.length > 0, finish);
        let done = false;
        const answer = k => {
          if (done) return;
          done = true;
          const ok = opts[k] === c;
          ok ? sound.ok() : sound.ng();
          App.touchDay(); App.save();
          $$('.choice').forEach((b, j) => {
            b.disabled = true;
            if (opts[j] === c) b.classList.add('correct'); else if (j === k) b.classList.add('wrong');
          });
          log.push({ q: byCity ? '雨温図の都市は？' : '雨温図の気候は？', a: label(c), ok, pick: label(opts[k]) });
          $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
              <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
              <div class="ans">${c.city}（${c.climate}）</div>
              <div class="exp">年平均 ${c.avg}℃・年降水量 約${c.total}mm。${esc(c.point)}</div>
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

    App.registerMode({ id: 'climate', icon: '☔', name: '雨温図', desc: 'グラフから6つの気候を見分ける', start: menu });
  });
})();
