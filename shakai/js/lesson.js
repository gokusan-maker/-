/* =========================================================================
 * 授業プリント
 * 単元ごとに、授業でそのまま配れるA4のプリントを組み立てる。
 *   生徒用：表紙（めあて・授業の流れ・得点らん・ふり返り）→ 練習問題 → 確認テスト
 *   先生用：練習問題と確認テストの解答（後ろにまとめてあるので切りはなして使える）
 * アプリの画面（印刷・PDF保存）と、tools/make-lesson.js（PDFの一括作成）の両方で使う。
 * 出題の順番や選択肢は単元IDから決まるので、何度作っても同じプリントになる。
 * ========================================================================= */
(function (global) {
  'use strict';

  const KANA = ['ア', 'イ', 'ウ', 'エ'];
  const TEST_N = 20;   // 確認テストの問題数（1問5点・100点満点）
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 文字列から決まる乱数（同じ単元なら毎回同じ並びになる）
  function rng(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return (h >>> 0) / 4294967296; };
  }
  function shuffle(arr, seed) {
    const r = rng(seed), a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function makeChooser(SH) {
    const all = SH.UNITS.flatMap(u => u.items);
    const group = {}, unitGroup = {};
    all.forEach(it => {
      (group[it.g] = group[it.g] || new Set()).add(it.a);
      const k = it.unit + '|' + it.g;
      (unitGroup[k] = unitGroup[k] || new Set()).add(it.a);
    });
    Object.entries(SH.POOLS || {}).forEach(([g, l]) => l.forEach(a => (group[g] = group[g] || new Set()).add(a)));
    // 4択の選択肢（アプリと同じく、同じ単元の語句を優先）
    return it => {
      if (it.ch) return shuffle([it.a, ...shuffle(it.ch, it.id + 'c').slice(0, 3)], it.id);
      const near = shuffle([...(unitGroup[it.unit + '|' + it.g] || [])].filter(a => a !== it.a), it.id + 'n').slice(0, 2);
      const rest = shuffle([...(group[it.g] || [])].filter(a => a !== it.a && !near.includes(a)), it.id + 'r');
      return shuffle([it.a, ...near, ...rest].slice(0, 4), it.id);
    };
  }

  // 記号でえらばせる問題：選択肢を指定してある・答えが長い・「〜でないもの」など
  const needsChoice = it => !!it.ch || it.a.length > 9 || /どれ|ないもの|ではない|ちがう|あたらない/.test(it.q);

  /**
   * プリントのHTML（ページの束）を作る
   * @param SH     window.SHAKAI（UNITS・FIELDS・POOLS）
   * @param opts   { unitId, title, items（省略時は単元の全問）, no（第何回）, minutes, date,
   *                 version（'A'〜'C'：確認テストの種類）, mode（'lesson'｜'test'）, testN（テストの問題数）, fieldId }
   */
  function build(SH, opts) {
    const unit = SH.UNITS.find(u => u.id === opts.unitId) || null;
    const field = unit ? SH.FIELDS.find(f => f.id === unit.field) : (opts.fieldId ? SH.FIELDS.find(f => f.id === opts.fieldId) : null);
    const items = opts.items || (unit ? unit.items : []);
    const title = opts.title || (unit ? unit.name : '社会');
    // Aは以前と同じ並び。B・Cは別の問題・別の並びになる
    const version = opts.version || 'A';
    const seed = (opts.seed || (unit ? unit.id : title)) + (version === 'A' ? '' : '#' + version);
    const testOnly = opts.mode === 'test';
    const TN = opts.testN || TEST_N;
    const vlabel = opts.version ? `（${version}）` : '';
    const choose = makeChooser(SH);
    const READ = opts.readings || {};

    // 練習問題：単元の問題すべて（多いときは最大40問）
    const practice = (items.length > 40 ? shuffle(items, seed + 'p').slice(0, 40) : items).map(it => {
      if (!needsChoice(it)) return { it, kind: 'write' };
      const c = choose(it);
      return { it, kind: 'choice', choices: c, key: KANA[c.indexOf(it.a)] };
    });
    // 確認テスト：練習問題とは別の並びで20問（記号10問＋記述10問をめざす）
    const pool = shuffle(items, seed + 't');
    const ch = pool.filter(needsChoice), wr = pool.filter(it => !needsChoice(it));
    let test = [...ch.slice(0, Math.ceil(TN / 2)), ...wr.slice(0, Math.ceil(TN / 2))];
    if (test.length < TN) test = test.concat(pool.filter(it => !test.includes(it)).slice(0, TN - test.length));
    test = shuffle(test.slice(0, TN), seed + 'o').map(it => {
      // 確認テストでは、記述の問題の一部も記号にして形式を変える
      if (needsChoice(it) || /[0-9]/.test(it.a)) {
        const c = choose(it);
        return { it, kind: 'choice', choices: c, key: KANA[c.indexOf(it.a)] };
      }
      return { it, kind: 'write' };
    });
    // 1問の点数（20問なら5点）。100点にならない問題数のときは、合計点をそのまま表示する
    const pts = Math.max(1, Math.floor(100 / Math.max(1, test.length)));
    const total = pts * test.length;
    const minutes = opts.minutes || 45;
    const plan = minutes >= 90
      ? [['導入・前回のふり返り', 10], ['要点の説明', 25], ['練習問題', 25], ['確認テスト', 20], ['答え合わせ・ふり返り', 10]]
      : [['導入', 5], ['要点の確認', 10], ['練習問題', 15], ['確認テスト', 10], ['ふり返り', 5]];
    const no = opts.no ? `第${opts.no}回　` : '';
    const ftag = field ? `<span class="lp-field ${field.id}">${field.name}</span>` : '';

    const head = (label, extra = '') => `
      <header class="lp-head">
        <div class="lp-ttl">${ftag}<h1>${esc(title)}</h1><span class="lp-kind">${label}</span></div>
        <div class="lp-boxes"><span>${opts.date ? esc(opts.date) : '　　月　　日'}</span><span class="lp-name">名前</span>${extra}</div>
      </header>`;

    const ans = it => `${esc(it.a)}${READ[it.a] ? `<small>（${esc(READ[it.a])}）</small>` : ''}`;
    const qItem = (q, k, withPts) => `
      <li class="lp-q ${q.kind}">
        <div class="lp-qt"><span class="lp-no">${k + 1}</span>${esc(q.it.q)}${withPts ? `<span class="lp-pts">（${pts}点）</span>` : ''}</div>
        ${q.kind === 'choice'
          ? `<div class="lp-ch">${q.choices.map((c, j) => `<span><b>${KANA[j]}</b> ${esc(c)}</span>`).join('')}</div><div class="lp-box sym"></div>`
          : `<div class="lp-box"></div>`}
      </li>`;

    const cover = `
      <section class="lp-page lp-cover">
        <div class="lp-cover-top">${ftag}<span class="lp-no-big">${esc(no)}授業プリント</span></div>
        <h1 class="lp-cover-ttl">${esc(title)}</h1>
        <div class="lp-cover-name"><span>${opts.date ? esc(opts.date) : '　　年　　月　　日'}</span><span>名前<i></i></span></div>
        <div class="lp-block"><h2>今日のめあて</h2>
          <p>「${esc(title)}」の大切な語句を、<b>漢字で正しく書ける</b>ようにしよう。「要点まとめ」は赤シートで答えをかくして使えます。まちがえた問題は、アプリの「苦手復習」で家でも復習しよう。</p></div>
        <div class="lp-block"><h2>授業の流れ（${minutes}分）</h2>
          <table class="lp-plan">${plan.map(([t, m], k) => `<tr><td>${k + 1}</td><td>${t}</td><td>${m}分</td><td class="chk">□</td></tr>`).join('')}</table></div>
        <div class="lp-block"><h2>得点</h2>
          <div class="lp-scores"><div><span>練習問題</span><b>　　／${practice.length}問</b></div><div><span>確認テスト</span><b>　　／${total}点</b></div></div></div>
        <div class="lp-block"><h2>ふり返り</h2>
          <div class="lp-refl">
            <p>今日の自分は？　□ よくできた　□ できた　□ もう少し</p>
            <p>まちがえた問題で、次までに覚えたい語句</p><div class="lp-lines"><i></i><i></i></div>
            <p>先生から</p><div class="lp-lines"><i></i></div>
          </div></div>
      </section>`;

    // 練習問題・確認テストは、1ページに収まる量ずつに分ける
    // 問題の高さ（mm）を文字数と選択肢から見積もって、A4に収まる分ずつページに分ける
    const lines = (t, per) => Math.max(1, Math.ceil(String(t).length / per));
    const estimate = (q, withPts) => {
      const qh = lines(q.it.q + (withPts ? '（5点）' : ''), 31) * 5.8;
      if (q.kind !== 'choice') return Math.max(10.5, qh) + 3.2;
      const rows = [[0, 1], [2, 3]].map(([a, b]) => Math.max(lines(q.choices[a] || '', 15), lines(q.choices[b] || '', 15)) * 5.3);
      return qh + rows[0] + rows[1] + 4;
    };
    const paginate = (qs, withPts) => {
      const out = [[]];
      let used = 14;   // 1ページ目は説明の行がある
      qs.forEach(q => {
        const h = estimate(q, withPts);
        if (used + h > 236 && out[out.length - 1].length) { out.push([]); used = 0; }
        out[out.length - 1].push(q); used += h;
      });
      return out;
    };
    const startNo = (pages, pi) => pages.slice(0, pi).reduce((a, p) => a + p.length, 0);
    const pPages = paginate(practice, false);
    const practicePages = pPages.map((qs, pi, arr) => `
      <section class="lp-page">
        ${head(`練習問題${arr.length > 1 ? `（${pi + 1}/${arr.length}）` : ''}`, `<span class="lp-score"><i></i>／${practice.length}</span>`)}
        ${pi === 0 ? '<p class="lp-lead">答えを右のらんに書きましょう。<b>ア〜エ</b>がある問題は記号で答えます。語句は<b>漢字で</b>書きましょう。</p>' : ''}
        <ol class="lp-qs">${qs.map((q, k) => qItem(q, startNo(pPages, pi) + k, false)).join('')}</ol>
      </section>`).join('');
    // 要点まとめ：単元の全問を答えつきで一覧にする。答えは赤シートでかくれる色（朱色）で印刷する
    const sumRows = items.map(it => ({ it, h: Math.max(lines(it.q, 38) * 5.0, lines(it.a, 11) * 5.6) + 2.8 }));
    const sPages = [[]];
    let sUsed = 14;
    sumRows.forEach(r => {
      if (sUsed + r.h > 238 && sPages[sPages.length - 1].length) { sPages.push([]); sUsed = 0; }
      sPages[sPages.length - 1].push(r); sUsed += r.h;
    });
    const summaryPages = (testOnly || opts.summary === false || !items.length) ? '' : sPages.map((rows, pi, arr) => `
      <section class="lp-page">
        ${head(`要点まとめ${arr.length > 1 ? `（${pi + 1}/${arr.length}）` : ''}`)}
        ${pi === 0 ? '<p class="lp-lead">赤い字の答えは、<b>赤シート</b>をのせるとかくれます。答えをかくして言えるか確かめましょう。</p>' : ''}
        <table class="lp-sum">${rows.map((r, k) => `<tr><td class="no">${startNo(sPages, pi) + k + 1}</td><td class="q">${esc(r.it.q)}</td><td class="a">${esc(r.it.a)}</td></tr>`).join('')}</table>
      </section>`).join('');
    const tPages = paginate(test, true);
    const testPages = tPages.map((qs, pi, arr) => `
      <section class="lp-page">
        ${head(`${testOnly ? 'テスト' : '確認テスト'}${vlabel}${arr.length > 1 ? `（${pi + 1}/${arr.length}）` : ''}`, `<span class="lp-score big"><i></i>／${total}点</span>`)}
        ${pi === 0 ? `<p class="lp-lead">教科書やノートを見ないで答えましょう。全${test.length}問・1問${pts}点（${total}点満点）。</p>` : ''}
        <ol class="lp-qs">${qs.map((q, k) => qItem(q, startNo(tPages, pi) + k, true)).join('')}</ol>
      </section>`).join('');

    const keyList = (qs, from = 0) => `<ol class="lp-keys">${qs.map((q, k) => `<li><span class="lp-no">${from + k + 1}</span><span>${q.kind === 'choice' ? `<b>${q.key}</b>　` : ''}${ans(q.it)}${q.it.e ? `<em>${esc(q.it.e)}</em>` : ''}</span></li>`).join('')}</ol>`;
    const cut = '<div class="lp-cut">✂ ここから先は先生用（切りはなして使えます）</div>';
    const teacher = (testOnly ? '' : `
      <section class="lp-page lp-teacher">
        ${cut}
        ${head('解答（先生用）')}
        <h2 class="lp-h2">練習問題</h2>${keyList(practice)}
      </section>`) + `
      ${(test.length > 36 ? [test.slice(0, Math.ceil(test.length / 2)), test.slice(Math.ceil(test.length / 2))] : [test]).map((part, pi) => `
      <section class="lp-page lp-teacher">
        ${testOnly && pi === 0 ? cut : ''}
        ${head('解答（先生用）')}
        <h2 class="lp-h2">${testOnly ? 'テスト' : '確認テスト'}${vlabel}（1問${pts}点）${pi ? '（つづき）' : ''}</h2>${keyList(part, pi ? Math.ceil(test.length / 2) : 0)}
      </section>`).join('')}`;

    return {
      title, practice: testOnly ? 0 : practice.length, test: test.length,
      summary: testOnly ? 0 : (summaryPages ? items.length : 0),
      html: testOnly ? testPages + teacher : cover + summaryPages + practicePages + testPages + teacher
    };
  }

  // 印刷・PDF用のスタイル（A4）。アプリでも PDF 作成でも同じものを使う
  const CSS = `
  .lp-doc { font-family: 'BIZ UDPGothic', 'Zen Maru Gothic', 'Hiragino Sans', sans-serif; color: #111; }
  .lp-page { background: #fff; width: 210mm; min-height: 297mm; padding: 14mm 14mm 12mm; box-sizing: border-box; position: relative; break-after: page; font-size: 10.5pt; line-height: 1.55; }
  .lp-page:last-child { break-after: auto; }
  .lp-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 4px 8px; border-bottom: 2.5px solid #111; padding-bottom: 4px; margin-bottom: 8px; }
  .lp-ttl { display: flex; align-items: center; gap: 8px; }
  .lp-ttl { min-width: 0; }
  .lp-ttl h1 { font-size: 15pt; margin: 0; white-space: nowrap; }
  .lp-field, .lp-kind { white-space: nowrap; flex: none; }
  .lp-kind { font-size: 10pt; border: 1.5px solid #111; border-radius: 4px; padding: 0 8px; font-weight: 700; }
  .lp-field { font-size: 9pt; color: #fff; border-radius: 99px; padding: 1px 10px; font-weight: 700; background: #666; }
  .lp-field.geo { background: #2f9e6e; } .lp-field.his { background: #d9622b; } .lp-field.civ { background: #3a6fd8; }
  .lp-boxes { display: flex; gap: 10px; font-size: 10pt; white-space: nowrap; margin-left: auto; }
  .lp-name { display: inline-block; min-width: 42mm; border-bottom: 1px solid #111; }
  .lp-score { border: 1.5px solid #111; padding: 0 8px; }
  .lp-score i { display: inline-block; width: 12mm; }
  .lp-score.big { font-size: 12pt; font-weight: 700; }
  .lp-lead { margin: 0 0 6px; font-size: 10pt; }
  .lp-qs { list-style: none; margin: 0; padding: 0; }
  .lp-q { display: grid; grid-template-columns: 1fr 42mm; grid-template-areas: 'q box' 'ch box'; gap: 2px 8px; padding: 5px 0; border-bottom: 1px dotted #999; break-inside: avoid; }
  .lp-q.write { grid-template-areas: 'q box'; }
  .lp-qt { grid-area: q; }
  .lp-no { display: inline-grid; place-items: center; min-width: 6mm; height: 6mm; border: 1.2px solid #111; border-radius: 50%; font-size: 8.5pt; font-weight: 700; margin-right: 5px; }
  .lp-pts { font-size: 8pt; color: #555; margin-left: 4px; }
  .lp-ch { grid-area: ch; display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px; font-size: 9.5pt; padding-left: 7mm; }
  .lp-ch b { margin-right: 2px; }
  .lp-box { grid-area: box; border: 1.2px solid #111; min-height: 9mm; align-self: center; border-radius: 2px; }
  .lp-box.sym { width: 14mm; justify-self: end; }
  .lp-cover-top { display: flex; align-items: center; gap: 10px; }
  .lp-no-big { font-size: 13pt; font-weight: 700; }
  .lp-cover-ttl { font-size: 26pt; margin: 6mm 0 3mm; border-bottom: 3px double #111; padding-bottom: 2mm; }
  .lp-cover-name { display: flex; justify-content: space-between; font-size: 12pt; margin-bottom: 6mm; }
  .lp-cover-name i { display: inline-block; width: 60mm; border-bottom: 1px solid #111; margin-left: 4px; }
  .lp-block { border: 1.5px solid #111; border-radius: 6px; padding: 3mm 5mm 4mm; margin-bottom: 5mm; }
  .lp-block h2 { font-size: 12pt; margin: 0 0 2mm; }
  .lp-plan { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .lp-plan td { border-bottom: 1px dotted #999; padding: 2mm 1mm; }
  .lp-plan td:first-child { width: 8mm; font-weight: 700; } .lp-plan td:nth-child(3) { width: 18mm; text-align: right; } .lp-plan .chk { width: 8mm; text-align: center; }
  .lp-scores { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .lp-scores div { border: 1.2px solid #111; border-radius: 4px; padding: 2mm 4mm; display: flex; justify-content: space-between; align-items: center; font-size: 12pt; }
  .lp-refl p { margin: 1mm 0; }
  .lp-lines i { display: block; height: 8mm; border-bottom: 1px solid #888; }
  .lp-teacher { background: #fffdf5; }
  .lp-sum { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .lp-sum td { border-bottom: 1px dotted #aaa; padding: 1.1mm 1.5mm; vertical-align: middle; line-height: 1.45; }
  .lp-sum .no { width: 7mm; color: #666; font-weight: 700; text-align: right; }
  .lp-sum .a { width: 44mm; color: #e8380d; font-weight: 700; font-size: 11pt; }
  .lp-cut { text-align: center; font-size: 9pt; color: #555; border-top: 1.5px dashed #555; padding-top: 1mm; margin: -6mm 0 4mm; }
  .lp-h2 { font-size: 12pt; margin: 2mm 0; border-left: 5px solid #111; padding-left: 6px; }
  .lp-keys { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 8mm; font-size: 9.5pt; }
  .lp-keys li { display: flex; gap: 2px; break-inside: avoid; padding: 1.2mm 0; border-bottom: 1px dotted #bbb; }
  .lp-keys small { font-size: 7.5pt; color: #555; }
  .lp-keys em { display: block; font-style: normal; font-size: 8pt; color: #555; }
  `;

  global.SHAKAI_LESSON = { build, CSS, needsChoice };
})(typeof window !== 'undefined' ? window : globalThis);
