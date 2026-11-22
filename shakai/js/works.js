/* =========================================================================
 * 資料ワーク（授業用プリントの「資料ワーク」タブ）
 * 白地図・年表・地図記号の書きこみワークシートを A4 で作る。どれも後ろに解答つき。
 *   ・白地図①：都道府県名を書こう（番号の県の名前）
 *   ・白地図②：県庁所在地を書こう（県名と県庁所在地名がちがう18都道府県）
 *   ・白地図③：地方区分の色分け
 *   ・年表ワーク：できごとの年を書こう（時代別4枚）
 *   ・地図記号ワーク：記号の名前を書こう
 * アプリの画面（印刷・PDF保存）と tools/make-lesson.js（PDFの一括作成）の両方で使う。
 * ========================================================================= */
(function (global) {
  'use strict';

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CIRCLED = n => n <= 20 ? String.fromCharCode(0x2460 + n - 1) : `(${n})`;

  // ページの見出し（授業プリントと同じ形）
  const head = (title, label, extra = '') => `
    <header class="lp-head">
      <div class="lp-ttl"><span class="lp-field geo">資料</span><h1>${esc(title)}</h1><span class="lp-kind">${label}</span></div>
      <div class="lp-boxes"><span>　　月　　日</span><span class="lp-name">名前</span>${extra}</div>
    </header>`;
  const cut = '<div class="lp-cut">✂ ここから先は先生用（切りはなして使えます）</div>';

  /* ---------- 白地図（都道府県のタイル地図） ---------- */
  const CELL = 44, GAP = 3, COLS = 14, ROWS = 10;
  // label(p) でマスに書く文字、fill(p) でマスの色を決める
  function mapSvg(PREFS, label, fill) {
    return `<svg class="wk-map" viewBox="-4 -4 ${COLS * CELL + 8} ${ROWS * CELL + 8}">
      <rect x="${-CELL * .1}" y="${CELL * .7}" width="${CELL * 1.6}" height="${CELL * 1.6}" rx="6" fill="none" stroke="#666" stroke-dasharray="4 3"/>
      ${PREFS.map(p => {
        const x = p.x * CELL + GAP / 2, y = p.y * CELL + GAP / 2, w = p.w * CELL - GAP, h = p.h * CELL - GAP;
        const t = label(p);
        const fs = t.length >= 3 ? 12 : t.length === 2 ? 14 : 15;
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill(p)}" stroke="#333" stroke-width="1.2"/>
          ${t ? `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" font-weight="700" fill="#111">${esc(t)}</text>` : ''}`;
      }).join('')}
    </svg>`;
  }
  // 番号は都道府県コードの順（北海道＝1 … 沖縄県＝47）
  const JIS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県',
    '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県',
    '宮崎県', '鹿児島県', '沖縄県'];
  const numbered = PREFS => JIS.map(n => PREFS.find(p => p.name === n));

  function buildPrefNames(SH) {
    const { PREFS } = SH.MAP;
    const order = numbered(PREFS), no = new Map(order.map((p, k) => [p, k + 1]));
    const boxes = order.map((p, k) => `<li><span class="lp-no">${k + 1}</span><span class="wk-ans"></span></li>`).join('');
    const keys = order.map((p, k) => `<li><span class="lp-no">${k + 1}</span>${esc(p.name)}</li>`).join('');
    return {
      title: '白地図① 都道府県名', summary: '47都道府県の名前を書く',
      html: `<section class="lp-page">${head('白地図① 都道府県名', 'ワーク', '<span class="lp-score"><i></i>／47</span>')}
          <p class="lp-lead">地図の番号の都道府県の名前を、下のらんに<b>漢字で</b>書きましょう（「県」「府」「都」も書く）。点線の中は沖縄県です。</p>
          ${mapSvg(PREFS, p => String(no.get(p)), () => '#fff')}
          <ol class="wk-grid">${boxes}</ol></section>
        <section class="lp-page lp-teacher">${cut}${head('白地図① 都道府県名', '解答（先生用）')}
          ${mapSvg(PREFS, p => p.short, () => '#fffdf5')}
          <ol class="wk-grid key">${keys}</ol></section>`
    };
  }

  function buildCapitals(SH) {
    const { PREFS } = SH.MAP;
    const diff = numbered(PREFS).filter(p => p.name !== '東京都' && p.cap.replace(/市$/, '') !== p.short);
    const no = new Map(diff.map((p, k) => [p, k + 1]));
    return {
      title: '白地図② 県庁所在地', summary: '県名と県庁所在地名がちがう18都道府県',
      html: `<section class="lp-page">${head('白地図② 県庁所在地', 'ワーク', `<span class="lp-score"><i></i>／${diff.length}</span>`)}
          <p class="lp-lead">番号の都道府県は、<b>県名と県庁所在地名がちがう</b>ところです。それぞれの県庁所在地を<b>漢字で</b>書きましょう（「市」も書く）。</p>
          ${mapSvg(PREFS, p => no.has(p) ? `${CIRCLED(no.get(p))}${p.short}` : '', p => no.has(p) ? '#fff3d6' : '#fff')}
          <ol class="wk-grid wide">${diff.map((p, k) => `<li><span class="lp-no">${k + 1}</span><span class="wk-pref">${esc(p.name)}</span><span class="wk-ans"></span></li>`).join('')}</ol></section>
        <section class="lp-page lp-teacher">${cut}${head('白地図② 県庁所在地', '解答（先生用）')}
          <ol class="wk-grid wide key">${diff.map((p, k) => `<li><span class="lp-no">${k + 1}</span><span class="wk-pref">${esc(p.name)}</span>${esc(p.cap)}</li>`).join('')}</ol></section>`
    };
  }

  function buildRegions(SH) {
    const { PREFS, REGIONS } = SH.MAP;
    const color = Object.fromEntries(REGIONS.map(r => [r.id, r.color]));
    return {
      title: '白地図③ 地方区分', summary: '8つの地方に色分けする',
      html: `<section class="lp-page">${head('白地図③ 地方区分', 'ワーク')}
          <p class="lp-lead">日本を8つの地方に分けて、地図を色分けしましょう。色えんぴつで下の□に色をぬってから、同じ色で地図をぬります。</p>
          ${mapSvg(PREFS, p => p.short, () => '#fff')}
          <div class="wk-legend">${REGIONS.map(r => `<span><i></i>${esc(r.name)}</span>`).join('')}</div>
          <div class="wk-q"><b>問</b> 三重県と新潟県は、それぞれ何地方にふくまれますか。<span>三重県（　　　　　　地方）　新潟県（　　　　　　地方）</span></div></section>
        <section class="lp-page lp-teacher">${cut}${head('白地図③ 地方区分', '解答（先生用）')}
          ${mapSvg(PREFS, p => p.short, p => color[p.r])}
          <div class="wk-legend key">${REGIONS.map(r => `<span><i style="background:${r.color}"></i>${esc(r.name)}（${PREFS.filter(p => p.r === r.id).length}）</span>`).join('')}</div>
          <div class="wk-q"><b>問</b> 三重県：近畿地方　新潟県：中部地方</div></section>`
    };
  }

  /* ---------- 年表 ---------- */
  const chunks = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
  const ERAS = [
    { id: 'ancient', name: '古代（〜平安時代）', from: 0, to: 1184 },
    { id: 'medieval', name: '中世（鎌倉〜安土桃山時代）', from: 1185, to: 1602 },
    { id: 'early', name: '近世（江戸時代）', from: 1603, to: 1867 },
    { id: 'modern', name: '近代・現代（明治時代〜）', from: 1868, to: 9999 }
  ];
  function buildTimeline(SH, eraId) {
    const era = ERAS.find(e => e.id === eraId);
    const evs = SH.EVENTS.filter(e => e.y >= era.from && e.y <= era.to).slice().sort((a, b) => a.y - b.y);
    const title = `年表ワーク ${era.name}`;
    const row = (e, k, key) => `<tr><td class="no">${k + 1}</td><td class="yr">${key ? `${e.y}年` : '<span class="wk-ans"></span>年'}</td><td>${esc(e.t)}${key && e.goro ? `<small>💡${esc(e.goro)}</small>` : ''}</td></tr>`;
    return {
      title, summary: `できごと${evs.length}件の年を書く`,
      html: chunks(evs, 20).map((part, pi) => `<section class="lp-page">${head(title, 'ワーク', `<span class="lp-score"><i></i>／${evs.length}</span>`)}
          ${pi === 0 ? '<p class="lp-lead">できごとが起こった年を書きましょう。できごとは古い順にならんでいます。</p>' : ''}
          <table class="wk-tl">${part.map((e, k) => row(e, pi * 20 + k, false)).join('')}</table></section>`).join('') +
        chunks(evs, 18).map((part, pi) => `<section class="lp-page lp-teacher">${pi === 0 ? cut : ''}${head(title, '解答（先生用）')}
          <table class="wk-tl key">${part.map((e, k) => row(e, pi * 18 + k, true)).join('')}</table></section>`).join('')
    };
  }

  /* ---------- 地図記号 ---------- */
  function buildSymbols(SH) {
    const S = SH.SYMBOLS;
    const cell = (s, k, key) => `<div class="wk-sym"><span class="lp-no">${k + 1}</span>
      <svg viewBox="0 0 100 100" style="color:#111">${s.svg}</svg>${key ? `<b>${esc(s.name)}</b><small>${esc(s.note)}</small>` : '<span class="wk-ans"></span>'}</div>`;
    return {
      title: '地図記号ワーク', summary: `${S.length}種類の地図記号の名前を書く`,
      html: `<section class="lp-page">${head('地図記号ワーク', 'ワーク', `<span class="lp-score"><i></i>／${S.length}</span>`)}
          <p class="lp-lead">それぞれの地図記号が何を表しているか、下のらんに書きましょう。</p>
          <div class="wk-syms">${S.map((s, k) => cell(s, k, false)).join('')}</div></section>
        <section class="lp-page lp-teacher">${cut}${head('地図記号ワーク', '解答（先生用）')}
          <div class="wk-syms key">${S.map((s, k) => cell(s, k, true)).join('')}</div></section>`
    };
  }

  // ワークの一覧（id → 作り方）。PDF のファイル名にも使う
  const LIST = [
    { id: 'pref', title: '白地図① 都道府県名', build: SH => buildPrefNames(SH) },
    { id: 'cap', title: '白地図② 県庁所在地', build: SH => buildCapitals(SH) },
    { id: 'region', title: '白地図③ 地方区分', build: SH => buildRegions(SH) },
    ...ERAS.map(e => ({ id: 'tl-' + e.id, title: `年表ワーク ${e.name}`, build: SH => buildTimeline(SH, e.id) })),
    { id: 'sym', title: '地図記号ワーク', build: SH => buildSymbols(SH) }
  ];
  const pdfName = w => `print/資料ワーク/${w.title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}.pdf`;

  const CSS = `
  .wk-map { display: block; width: 100%; height: auto; margin: 2mm 0 3mm; }
  .wk-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5mm 4mm; font-size: 9.5pt; }
  .wk-grid li { display: flex; align-items: center; gap: 1mm; border-bottom: 1px solid #999; min-height: 7mm; }
  .wk-grid.wide { grid-template-columns: repeat(2, 1fr); font-size: 11pt; }
  .wk-grid.wide li { min-height: 10mm; }
  .wk-grid .wk-pref { width: 22mm; font-weight: 700; }
  .wk-grid.key li { font-weight: 700; }
  .wk-ans { display: inline-block; flex: 1; min-width: 18mm; }
  .wk-legend { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; font-size: 11pt; margin: 2mm 0; }
  .wk-legend span { display: flex; align-items: center; gap: 2mm; }
  .wk-legend i { display: inline-block; width: 9mm; height: 7mm; border: 1.2px solid #111; border-radius: 2px; }
  .wk-q { border: 1.5px solid #111; border-radius: 6px; padding: 3mm 4mm; margin-top: 4mm; font-size: 11pt; }
  .wk-q span { display: block; margin-top: 2mm; }
  .wk-tl { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  .wk-tl td { border-bottom: 1px solid #999; padding: 1.6mm 2mm; vertical-align: middle; }
  .wk-tl .no { width: 7mm; font-weight: 700; color: #555; }
  .wk-tl .yr { width: 30mm; white-space: nowrap; }
  .wk-tl .yr .wk-ans { width: 18mm; border-bottom: 1px solid #111; flex: none; }
  .wk-tl small { display: block; font-size: 8pt; color: #b5541f; }
  .wk-syms { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; }
  .wk-sym { border: 1.2px solid #111; border-radius: 4px; padding: 1.5mm 2mm 2mm; display: flex; flex-direction: column; align-items: center; gap: 1mm; position: relative; min-height: 31mm; }
  .wk-sym .lp-no { position: absolute; top: 1.5mm; left: 1.5mm; }
  .wk-sym svg { width: 14mm; height: 14mm; }
  .wk-sym .wk-ans { width: 100%; flex: none; height: 8mm; border: 1px solid #999; border-radius: 2px; }
  .wk-sym b { font-size: 10pt; } .wk-sym small { font-size: 7.5pt; color: #555; text-align: center; line-height: 1.35; }
  .wk-sym text { font-family: 'BIZ UDPMincho', 'Hiragino Mincho ProN', serif; }
  `;

  // アプリの「資料ワーク」タブ
  function menuHtml(App) {
    return `<p class="muted">白地図・年表・地図記号の書きこみワークです。授業のはじめの確認や、宿題・家庭学習に。どれも後ろに解答がついています。</p>
      <div class="units">${LIST.map(w => `
        <div class="card pr-row">
          <span class="uico">${w.id.startsWith('tl') ? '📜' : w.id === 'sym' ? '📍' : '🗾'}</span>
          <span class="pr-info"><span class="uname">${esc(w.title)}</span></span>
          <span class="pr-btns">
            <button class="btn sub pr-work" data-w="${w.id}">見る・印刷</button>
            <a class="btn pr-dl" href="${encodeURI(pdfName(w))}" download>PDF</a>
          </span>
        </div>`).join('')}</div>`;
  }
  function bind(App, preview) {
    App.$$('.pr-work').forEach(b => b.onclick = () => {
      const w = LIST.find(x => x.id === b.dataset.w);
      preview({ doc: build(w.id) });
    });
  }
  // アプリの中では window のデータから作る
  function build(id, SH) {
    SH = SH || { ...global.SHAKAI, MAP: global.SHAKAI_MAP, SYMBOLS: global.SHAKAI_SYMBOLS };
    return LIST.find(w => w.id === id).build(SH);
  }

  global.SHAKAI_WORKS = { LIST, build, pdfName, CSS, menuHtml, bind };
  global.SHAKAI_WORKS_CSS = CSS;
})(typeof window !== 'undefined' ? window : globalThis);
