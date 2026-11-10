/* =========================================================================
 * 白地図（都道府県タイルマップ）
 * 47都道府県をマス目に並べた地図で、位置・名前・県庁所在地・地方区分を覚える。
 * x, y はマスの位置、w, h はマスの幅と高さ（省略時は1）。
 * ========================================================================= */
(function () {
  'use strict';

  const REGIONS = [
    { id: 'hokkaido', name: '北海道地方', color: '#8ec5e8' },
    { id: 'tohoku', name: '東北地方', color: '#9ed6b0' },
    { id: 'kanto', name: '関東地方', color: '#f2c27b' },
    { id: 'chubu', name: '中部地方', color: '#c9b3e6' },
    { id: 'kinki', name: '近畿地方', color: '#f2a3a3' },
    { id: 'chugoku', name: '中国地方', color: '#a8d8d2' },
    { id: 'shikoku', name: '四国地方', color: '#f0d27a' },
    { id: 'kyushu', name: '九州地方', color: '#b9c98a' }
  ];

  const P = (name, cap, r, x, y, note, w = 1, h = 1) => ({ name, cap, r, x, y, w, h, note });
  const PREFS = [
    P('北海道', '札幌市', 'hokkaido', 12, 0, '面積日本一。じゃがいも・小麦・生乳の生産が日本一。', 2),
    P('青森県', '青森市', 'tohoku', 12, 1, 'りんごの生産日本一。陸奥湾でほたての養殖。津軽塗。', 2),
    P('秋田県', '秋田市', 'tohoku', 12, 2, '日本一深い田沢湖。あきたこまち。白神山地。'),
    P('岩手県', '盛岡市', 'tohoku', 13, 2, '面積は全国2位。南部鉄器。世界遺産の平泉。'),
    P('山形県', '山形市', 'tohoku', 12, 3, 'さくらんぼ・西洋なしの生産日本一。最上川と庄内平野。'),
    P('宮城県', '仙台市', 'tohoku', 13, 3, '仙台市は東北地方最大の都市。北上川の下流に仙台平野。'),
    P('福井県', '福井市', 'chubu', 8, 4, '鯖江市のめがねフレーム。若狭湾はリアス海岸。'),
    P('石川県', '金沢市', 'chubu', 9, 4, '輪島塗・九谷焼。能登半島。'),
    P('富山県', '富山市', 'chubu', 10, 4, '神通川流域でイタイイタイ病が発生。チューリップの球根。'),
    P('新潟県', '新潟市', 'chubu', 11, 4, '米の生産日本一。信濃川と越後平野。佐渡島。'),
    P('福島県', '福島市', 'tohoku', 12, 4, 'ももの生産は全国2位。会津塗。', 2),
    P('島根県', '松江市', 'chugoku', 4, 5, '世界遺産の石見銀山。宍道湖のしじみ。竹島。'),
    P('鳥取県', '鳥取市', 'chugoku', 5, 5, '人口が日本一少ない。鳥取砂丘。'),
    P('兵庫県', '神戸市', 'kinki', 6, 5, '明石市を日本の標準時子午線（東経135度）が通る。姫路城。', 1, 2),
    P('京都府', '京都市', 'kinki', 7, 5, '西陣織・清水焼。古都京都の文化財。'),
    P('滋賀県', '大津市', 'kinki', 8, 5, '日本最大の湖・琵琶湖。信楽焼。'),
    P('岐阜県', '岐阜市', 'chubu', 9, 5, '白川郷の合掌造り。木曽三川の輪中。美濃焼。'),
    P('長野県', '長野市', 'chubu', 10, 5, 'レタスの生産日本一。接する都道府県が8つで日本一。'),
    P('群馬県', '前橋市', 'kanto', 11, 5, '富岡製糸場。こんにゃくいもの生産日本一。'),
    P('栃木県', '宇都宮市', 'kanto', 12, 5, 'いちごの生産日本一。日光の社寺。益子焼。'),
    P('茨城県', '水戸市', 'kanto', 13, 5, '日本で2番目に大きい湖・霞ヶ浦。鹿島臨海工業地域。'),
    P('山口県', '山口市', 'chugoku', 3, 6, '本州の西のはし。関門海峡をはさんで九州と向かいあう。'),
    P('広島県', '広島市', 'chugoku', 4, 6, '原爆ドームと厳島神社。かきの養殖日本一。'),
    P('岡山県', '岡山市', 'chugoku', 5, 6, '備前焼。倉敷市水島地区の石油化学コンビナート。瀬戸大橋。'),
    P('大阪府', '大阪市', 'kinki', 7, 6, '面積は全国で2番目に小さい。阪神工業地帯。百舌鳥・古市古墳群。'),
    P('奈良県', '奈良市', 'kinki', 8, 6, '海に面していない。法隆寺・東大寺。'),
    P('愛知県', '名古屋市', 'chubu', 9, 6, '製造品出荷額日本一の中京工業地帯。豊田市の自動車。電照菊。'),
    P('山梨県', '甲府市', 'chubu', 10, 6, 'ぶどう・ももの生産日本一。甲府盆地の扇状地。'),
    P('埼玉県', 'さいたま市', 'kanto', 11, 6, '海に面していない。東京への通勤・通学者が多い。'),
    P('東京都', '東京（新宿区）', 'kanto', 12, 6, '日本の首都。人口が日本一多い。沖ノ鳥島・南鳥島も東京都。'),
    P('千葉県', '千葉市', 'kanto', 13, 6, '落花生の生産日本一。成田国際空港・銚子港。京葉工業地域。'),
    P('佐賀県', '佐賀市', 'kyushu', 1, 7, '有田焼。有明海でのりの養殖がさかん。吉野ヶ里遺跡。'),
    P('福岡県', '福岡市', 'kyushu', 2, 7, '九州地方の中心。北九州市の八幡製鉄所。博多人形。'),
    P('愛媛県', '松山市', 'shikoku', 4, 7, 'みかんの生産がさかん。今治市のタオル。しまなみ海道。'),
    P('香川県', '高松市', 'shikoku', 5, 7, '面積が日本一小さい。讃岐平野のため池。'),
    P('和歌山県', '和歌山市', 'kinki', 7, 7, 'みかん・梅の生産日本一。紀伊山地の霊場と参詣道。', 2),
    P('三重県', '津市', 'kinki', 9, 7, '四日市ぜんそく。伊勢神宮。志摩半島はリアス海岸。'),
    P('静岡県', '静岡市', 'chubu', 10, 7, '富士山と浜名湖。焼津港。東海工業地域。'),
    P('神奈川県', '横浜市', 'kanto', 11, 7, '横浜市は人口が日本一多い市。京浜工業地帯。'),
    P('長崎県', '長崎市', 'kyushu', 0, 8, '島の数が日本一多い。鎖国中の出島。雲仙岳。'),
    P('熊本県', '熊本市', 'kyushu', 1, 8, '阿蘇山のカルデラ。水俣病が発生。い草の生産日本一。'),
    P('大分県', '大分市', 'kyushu', 2, 8, '温泉の源泉数・湧出量が日本一。八丁原の地熱発電。'),
    P('高知県', '高知市', 'shikoku', 4, 8, '高知平野でなすなどの促成栽培。四万十川。'),
    P('徳島県', '徳島市', 'shikoku', 5, 8, '吉野川と徳島平野。鳴門の渦潮。阿波おどり。'),
    P('鹿児島県', '鹿児島市', 'kyushu', 1, 9, 'シラス台地。桜島。豚の飼育頭数日本一。屋久島。'),
    P('宮崎県', '宮崎市', 'kyushu', 2, 9, '宮崎平野でピーマン・きゅうりの促成栽培。'),
    P('沖縄県', '那覇市', 'kyushu', 0, 1, 'さとうきび・パイナップルの生産日本一。1972年に日本に返還。')
  ];
  PREFS.forEach((p, i) => { p.i = i; p.short = p.name === '北海道' ? '北海道' : p.name.replace(/[都府県]$/, ''); });
  const REGION = Object.fromEntries(REGIONS.map(r => [r.id, r]));

  const CELL = 44, GAP = 3, COLS = 14, ROWS = 10;
  const ROUNDS = 10;

  // 2つの県がどれだけ近いか（マスの中心どうしの距離）
  const center = p => [p.x + p.w / 2, p.y + p.h / 2];
  const dist = (a, b) => { const [ax, ay] = center(a), [bx, by] = center(b); return Math.hypot(ax - bx, ay - by); };

  function mapSvg(opts = {}) {
    const { labels = true, highlight = null, marks = {}, region = true } = opts;
    const W = COLS * CELL, H = ROWS * CELL;
    return `<svg class="jmap" viewBox="-4 -4 ${W + 8} ${H + 8}" role="img" aria-label="日本の都道府県タイル地図">
      <rect x="${-CELL * .1}" y="${CELL * .7}" width="${CELL * 1.6}" height="${CELL * 1.6}" rx="6" class="inset"/>
      ${PREFS.map(p => {
        const x = p.x * CELL + GAP / 2, y = p.y * CELL + GAP / 2;
        const w = p.w * CELL - GAP, h = p.h * CELL - GAP;
        const cls = ['tile', marks[p.i] || '', highlight === p.i ? 'hl' : ''].join(' ');
        const fill = region ? REGION[p.r].color : 'var(--tile)';
        const fs = p.short.length >= 3 ? 12.5 : 16;
        return `<g class="${cls}" data-p="${p.i}" tabindex="-1">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" style="--fill:${fill}"/>
          ${labels ? `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${fs}">${p.short}</text>` : ''}
        </g>`;
      }).join('')}
    </svg>`;
  }

  window.SHAKAI_EXT = (window.SHAKAI_EXT || []).concat(App => {
    const { view, $, $$, esc, shuffle, sound } = App;
    const st = () => App.extState('map');

    function menu() {
      App.onKey(null);
      const best = st().best || {};
      const item = (id, ico, ttl, dsc) => `<button class="mode" data-m="${id}"><span class="ico">${ico}</span><span class="ttl">${ttl}</span><span class="dsc">${dsc}${best[id] !== undefined ? `<br>最高 ${best[id]}/${ROUNDS}` : ''}</span></button>`;
      view.innerHTML = `
        <h2 style="margin-top:4px">🗾 白地図で覚える</h2>
        <p class="muted">47都道府県をマス目で表した地図です。実際の形とはちがいますが、位置関係と地方区分をつかめます。</p>
        <div class="modes">
          ${item('where', '👆', '場所をタップ', '県名を見て、地図の場所をタップ')}
          ${item('name', '🏷', 'この県はどこ？', '色のついた県の名前をえらぶ')}
          ${item('cap', '🏛', '県庁所在地', '色のついた県の県庁所在地をえらぶ')}
          ${item('region', '🧩', '地方区分', '色のついた県が何地方かえらぶ')}
        </div>
        <h2>ぜんぶ見つけよう</h2>
        <p class="muted">条件にあう都道府県を、地図の上でぜんぶタップしよう。</p>
        <div class="units">
          ${CHALLENGES.map(c => {
            const r = (st().chal || {})[c.id];
            const n = c.list().length;
            return `<button class="card unit" data-ch="${c.id}"><span class="uico">${c.icon}</span>
              <span><span class="uname">${esc(c.name)}</span>${n ? `<span class="umeta"> ・ ${n}つ</span>` : ''}
              ${r ? `<div class="umeta">最高記録 ${fmtTime(r.time)}・まちがい${r.miss}回</div>` : ''}</span><span class="pct">›</span></button>`;
          }).join('')}
        </div>
        <h2>地図で調べる</h2>
        <p class="muted">県をタップすると、県庁所在地と特色が表示されます。</p>
        <div class="card map-card">${mapSvg()}</div>
        <div id="info" class="card pref-info"><span class="muted">県をタップしてください</span></div>
        <div class="legend">${REGIONS.map(r => `<span><i style="background:${r.color}"></i>${r.name}</span>`).join('')}</div>
        <div class="row" style="margin-top:16px"><button class="btn sub" id="home">ホームへ</button></div>`;
      $$('[data-m]').forEach(b => b.onclick = () => play(b.dataset.m));
      $$('[data-ch]').forEach(b => b.onclick = () => challenge(CHALLENGES.find(c => c.id === b.dataset.ch)));
      $$('.jmap .tile').forEach(g => g.onclick = () => {
        const p = PREFS[+g.dataset.p];
        $$('.jmap .tile').forEach(t => t.classList.toggle('hl', t === g));
        $('#info').innerHTML = `<div class="pi-head"><b>${p.name}</b><span class="tag" style="background:${REGION[p.r].color};color:#222">${REGION[p.r].name}</span></div>
          <div>県庁所在地：<b>${esc(p.cap)}</b></div><div class="muted">${esc(p.note)}</div>`;
      });
      $('#home').onclick = App.goHome;
      window.scrollTo(0, 0);
    }

    /* ---------- ぜんぶ見つけよう ---------- */
    const LANDLOCKED = ['栃木県', '群馬県', '埼玉県', '山梨県', '長野県', '岐阜県', '滋賀県', '奈良県'];
    const CHALLENGES = [
      { id: 'landlocked', icon: '🏞', name: '海に面していない県', labels: false, list: () => PREFS.filter(p => LANDLOCKED.includes(p.name)) },
      { id: 'capdiff', icon: '🏛', name: '県名と県庁所在地名がちがう都道府県', labels: true, note: '東京都は除く。',
        list: () => PREFS.filter(p => p.name !== '東京都' && p.cap.replace(/市$/, '') !== p.short) },
      { id: 'region', icon: '🧩', name: 'ある地方の県（地方はランダム）', labels: false, list: () => [] }
    ];
    const fmtTime = ms => { const t = Math.round(ms / 1000); return `${Math.floor(t / 60)}分${String(t % 60).padStart(2, '0')}秒`; };
    function addLabel(g) {
      if (g.querySelector('text')) return;
      const pp = PREFS[+g.dataset.p], r = g.querySelector('rect');
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', +r.getAttribute('x') + +r.getAttribute('width') / 2);
      tx.setAttribute('y', +r.getAttribute('y') + +r.getAttribute('height') / 2);
      tx.setAttribute('font-size', pp.short.length >= 3 ? 12.5 : 16);
      tx.textContent = pp.short;
      g.appendChild(tx);
    }
    function challenge(c) {
      let title = c.name, targets = c.list();
      if (c.id === 'region') {
        // 北海道地方は1つだけなので出さない
        const rs = REGIONS.filter(x => x.id !== 'hokkaido');
        const r = rs[Math.floor(Math.random() * rs.length)];
        title = `${r.name}の県`;
        targets = PREFS.filter(p => p.r === r.id);
      }
      const want = new Set(targets.map(p => p.i));
      const found = new Set();
      let miss = 0, over = false;
      const t0 = Date.now();
      App.onKey(null);
      view.innerHTML = `
        <div class="qhead"><button class="quit" aria-label="やめる">×</button>
          <div class="bar"><i id="chbar" style="width:0%"></i></div><span class="count" id="chcount">0/${want.size}</span></div>
        <div class="card question"><span class="tag geo">地理</span> <span class="muted">ぜんぶ見つけよう</span>
          <p class="qt"><b>${esc(title)}</b>をぜんぶタップしよう${c.note ? `<br><span class="muted">${esc(c.note)}</span>` : ''}</p>
          <div class="muted" id="chmiss">まちがい 0回</div></div>
        <div class="card map-card">${mapSvg({ labels: c.labels, region: false })}</div>
        <div id="fb"></div>
        <div class="row" id="chctl"><button class="btn sub" id="giveup">答えを見る</button></div>`;
      const end = gaveUp => {
        over = true;
        const time = Date.now() - t0;
        $$('.jmap .tile').forEach(g => {
          addLabel(g);
          if (want.has(+g.dataset.p) && !found.has(+g.dataset.p)) g.classList.add('missed');
        });
        let best = '';
        if (!gaveUp) {
          sound.done();
          const s = st(); s.chal = s.chal || {};
          const prev = s.chal[c.id];
          if (!prev || time < prev.time) { s.chal[c.id] = { time, miss }; best = '🏆 最高記録！'; }
        }
        if (found.size) App.touchDay(found.size);
        App.save();
        $('#chctl').style.display = 'none';
        $('#fb').innerHTML = `<div class="card feedback ${gaveUp ? 'ng' : ''}">
            <div class="verdict">${gaveUp ? '答え' : `🎉 ぜんぶ見つけた！ ${best}`}</div>
            ${gaveUp ? '' : `<div class="ans">${fmtTime(time)}・まちがい${miss}回</div>`}
            <div class="exp">${targets.map(p => c.id === 'capdiff' ? `${p.name}（${p.cap}）` : p.name).join('、')}</div>
          </div>
          <div class="row next-wrap"><button class="btn" id="again">もう一度</button><button class="btn sub" id="back">白地図メニューへ</button></div>`;
        $('#again').onclick = () => challenge(c);
        $('#back').onclick = menu;
      };
      $$('.jmap .tile').forEach(g => g.onclick = () => {
        if (over) return;
        const k = +g.dataset.p;
        if (found.has(k)) return;
        if (want.has(k)) {
          found.add(k); g.classList.add('ok'); addLabel(g); sound.ok();
          $('#chcount').textContent = `${found.size}/${want.size}`;
          $('#chbar').style.width = `${found.size / want.size * 100}%`;
          if (found.size === want.size) end(false);
        } else {
          miss++; sound.ng();
          $('#chmiss').textContent = `まちがい ${miss}回（${PREFS[k].name}）`;
          g.classList.add('ng'); setTimeout(() => g.classList.toggle('ng', false), 600);
        }
      });
      $('.quit').onclick = () => { if (over || confirm('やめますか？')) menu(); };
      $('#giveup').onclick = () => end(true);
      window.scrollTo(0, 0);
    }

    // 4択の誤答：近くの県を優先して選ぶ（まぎらわしいほど力がつく）
    function nearOptions(p, key) {
      const others = PREFS.filter(q => q !== p && q[key] !== p[key])
        .sort((a, b) => dist(a, p) - dist(b, p));
      const near = shuffle(others.slice(0, 6)).slice(0, 3);
      return shuffle([p, ...near]);
    }

    function play(kind) {
      let pool = shuffle(PREFS);
      if (kind === 'cap') pool = pool.filter(p => p.name !== '東京都');
      const qs = pool.slice(0, ROUNDS);
      const log = [];
      let i = 0;

      const finish = () => {
        const score = log.filter(l => l.ok).length;
        const s = st(); s.best = s.best || {};
        if (s.best[kind] === undefined || score > s.best[kind]) s.best[kind] = score;
        App.save();
        App.showResult({
          title: { where: '場所をタップ', name: 'この県はどこ？', cap: '県庁所在地', region: '地方区分' }[kind],
          log,
          again: () => play(kind)
        });
      };

      const ask = () => {
        const p = qs[i];
        const prompt = {
          where: `<b class="big-name">${p.name}</b> はどこ？ 地図をタップしよう`,
          name: '色のついた県の名前は？',
          cap: `色のついた県（${p.name}）の県庁所在地は？`,
          region: `色のついた県（${p.name}）は何地方？`
        }[kind];
        let opts = [];
        if (kind === 'name') opts = nearOptions(p, 'name').map(q => q.name);
        if (kind === 'cap') opts = nearOptions(p, 'cap').map(q => q.cap);
        if (kind === 'region') opts = REGIONS.map(r => r.name);
        const answer = kind === 'cap' ? p.cap : kind === 'region' ? REGION[p.r].name : p.name;

        view.innerHTML = `${App.header(i, qs.length)}
          <div class="card question"><span class="tag geo">地理</span> <span class="muted">白地図</span>
            <p class="qt">${prompt}</p></div>
          <div class="card map-card">${mapSvg({ labels: kind !== 'where' && kind !== 'name', highlight: kind === 'where' ? null : p.i, region: kind !== 'region' && kind !== 'where' && kind !== 'name' })}</div>
          ${opts.length ? `<div class="choices ${kind === 'region' ? 'grid2' : ''}">${opts.map((o, k) => `<button class="choice" data-k="${k}"><span class="no">${k + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>` : ''}
          <div id="fb"></div>`;
        App.bindQuit(() => log.length > 0, finish);

        let done = false;
        const settle = (ok, pick) => {
          done = true;
          ok ? sound.ok() : sound.ng();
          App.touchDay(); App.save();
          log.push({ q: kind === 'name' ? '地図で色のついた県の名前は？' : prompt.replace(/<[^>]+>/g, ''), a: answer, ok, pick });
          $('#fb').innerHTML = `<div class="card feedback ${ok ? '' : 'ng'}">
              <div class="verdict">${ok ? '⭕ 正解！' : '❌ ざんねん'}</div>
              ${ok ? '' : `<div class="ans">正解：${esc(answer)}</div>`}
              <div class="exp">${p.name}（${REGION[p.r].name}）県庁所在地：${esc(p.cap)}。${esc(p.note)}</div>
            </div>
            <div class="next-wrap"><button class="btn block" id="next">${i + 1 < qs.length ? '次の問題へ' : '結果を見る'}</button></div>`;
          $('#next').onclick = () => { i++; i < qs.length ? ask() : finish(); };
          $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };

        if (kind === 'where') {
          $$('.jmap .tile').forEach(g => g.onclick = () => {
            if (done) return;
            const q = PREFS[+g.dataset.p];
            const ok = q === p;
            g.classList.add(ok ? 'ok' : 'ng');
            if (!ok) $(`.jmap .tile[data-p="${p.i}"]`).classList.add('ok');
            // 答え合わせのあとは県名を表示する
            $$('.jmap .tile').forEach(t => {
              const pp = PREFS[+t.dataset.p], r = t.querySelector('rect');
              if (!t.querySelector('text')) {
                const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                tx.setAttribute('x', +r.getAttribute('x') + +r.getAttribute('width') / 2);
                tx.setAttribute('y', +r.getAttribute('y') + +r.getAttribute('height') / 2);
                tx.setAttribute('font-size', pp.short.length >= 3 ? 12.5 : 16);
                tx.textContent = pp.short;
                t.appendChild(tx);
              }
            });
            settle(ok, q.name);
          });
        } else {
          const answerK = k => {
            if (done) return;
            const ok = opts[k] === answer;
            $$('.choice').forEach((b, j) => {
              b.disabled = true;
              if (opts[j] === answer) b.classList.add('correct'); else if (j === k) b.classList.add('wrong');
            });
            settle(ok, opts[k]);
          };
          $$('.choice').forEach(b => b.onclick = () => answerK(+b.dataset.k));
          App.onKey(e => {
            const max = opts.length;
            if (!done && /^[1-9]$/.test(e.key) && +e.key <= max) answerK(+e.key - 1);
            else if (done && e.key === 'Enter') { e.preventDefault(); $('#next').click(); }
          });
        }
        if (kind === 'where') App.onKey(e => { if (done && e.key === 'Enter') { e.preventDefault(); $('#next').click(); } });
        window.scrollTo(0, 0);
      };
      ask();
    }

    App.registerMode({ id: 'map', icon: '🗾', name: '白地図', desc: '都道府県の位置・県庁所在地・地方区分', start: menu });
  });

  window.SHAKAI_MAP = { PREFS, REGIONS };
})();
