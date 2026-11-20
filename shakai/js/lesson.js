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
   * @param opts   { unitId, title, items（省略時は単元の全問）, no（第何回）, minutes, date }
   */
  function build(SH, opts) {
    const unit = SH.UNITS.find(u => u.id === opts.unitId) || null;
    const field = unit ? SH.FIELDS.find(f => f.id === unit.field) : null;
    const items = opts.items || (unit ? unit.items : []);
    const title = opts.title || (unit ? unit.name : '社会');
    const seed = opts.seed || (unit ? unit.id : title);
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
    let test = [...ch.slice(0, 10), ...wr.slice(0, 10)];
    if (test.length < TEST_N) test = test.concat(pool.filter(it => !test.includes(it)).slice(0, TEST_N - test.length));
    test = shuffle(test.slice(0, TEST_N), seed + 'o').map(it => {
      // 確認テストでは、記述の問題の一部も記号にして形式を変える
      if (needsChoice(it) || /[0-9]/.test(it.a)) {
        const c = choose(it);
        return { it, kind: 'choice', choices: c, key: KANA[c.indexOf(it.a)] };
      }
      return { it, kind: 'write' };
    });
    const pts = Math.round(100 / Math.max(1, test.length));
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
          <p>「${esc(title)}」の大切な語句を、<b>漢字で正しく書ける</b>ようにしよう。まちがえた問題は、アプリの「苦手復習」で家でも復習しよう。</p></div>
        <div class="lp-block"><h2>授業の流れ（${minutes}分）</h2>
          <table class="lp-plan">${plan.map(([t, m], k) => `<tr><td>${k + 1}</td><td>${t}</td><td>${m}分</td><td class="chk">□</td></tr>`).join('')}</table></div>
        <div class="lp-block"><h2>得点</h2>
          <div class="lp-scores"><div><span>練習問題</span><b>　　／${practice.length}問</b></div><div><span>確認テスト</span><b>　　／100点</b></div></div></div>
        <div class="lp-block"><h2>ふり返り</h2>
          <div class="lp-refl">
            <p>今日の自分は？　□ よくできた　□ できた　□ もう少し</p>
            <p>まちがえた問題で、次までに覚えたい語句</p><div class="lp-lines"><i></i><i></i></div>
            <p>先生から</p><div class="lp-lines"><i></i></div>
          </div></div>
      </section>`;

    // 練習問題・確認テストは、1ページに収まる量ずつに分ける
    const paginate = (qs, perPage) => { const out = []; for (let i = 0; i < qs.length; i += perPage) out.push(qs.slice(i, i + perPage)); return out; };
    const practicePages = paginate(practice, 18).map((qs, pi, arr) => `
      <section class="lp-page">
        ${head(`練習問題${arr.length > 1 ? `（${pi + 1}/${arr.length}）` : ''}`, `<span class="lp-score"><i></i>／${practice.length}</span>`)}
        ${pi === 0 ? '<p class="lp-lead">答えを右のらんに書きましょう。<b>ア〜エ</b>がある問題は記号で答えます。語句は<b>漢字で</b>書きましょう。</p>' : ''}
        <ol class="lp-qs">${qs.map((q, k) => qItem(q, pi * 18 + k, false)).join('')}</ol>
      </section>`).join('');
    const testPages = paginate(test, 12).map((qs, pi, arr) => `
      <section class="lp-page">
        ${head(`確認テスト${arr.length > 1 ? `（${pi + 1}/${arr.length}）` : ''}`, '<span class="lp-score big"><i></i>／100点</span>')}
        ${pi === 0 ? `<p class="lp-lead">教科書やノートを見ないで答えましょう。全${test.length}問・1問${pts}点。</p>` : ''}
        <ol class="lp-qs">${qs.map((q, k) => qItem(q, pi * 12 + k, true)).join('')}</ol>
      </section>`).join('');

    const keyList = qs => `<ol class="lp-keys">${qs.map((q, k) => `<li><span class="lp-no">${k + 1}</span><span>${q.kind === 'choice' ? `<b>${q.key}</b>　` : ''}${ans(q.it)}${q.it.e ? `<em>${esc(q.it.e)}</em>` : ''}</span></li>`).join('')}</ol>`;
    const teacher = `
      <section class="lp-page lp-teacher">
        <div class="lp-cut">✂ ここから先は先生用（切りはなして使えます）</div>
        ${head('解答（先生用）')}
        <h2 class="lp-h2">練習問題</h2>${keyList(practice)}
      </section>
      <section class="lp-page lp-teacher">
        ${head('解答（先生用）')}
        <h2 class="lp-h2">確認テスト（1問${pts}点）</h2>${keyList(test)}
      </section>`;

    return {
      title, practice: practice.length, test: test.length,
      html: cover + practicePages + testPages + teacher
    };
  }

  // 印刷・PDF用のスタイル（A4）。アプリでも PDF 作成でも同じものを使う
  const CSS = `
  .lp-doc { font-family: 'BIZ UDPGothic', 'Zen Maru Gothic', 'Hiragino Sans', sans-serif; color: #111; }
  .lp-page { background: #fff; width: 210mm; min-height: 297mm; padding: 14mm 14mm 12mm; box-sizing: border-box; position: relative; break-after: page; font-size: 10.5pt; line-height: 1.55; }
  .lp-page:last-child { break-after: auto; }
  .lp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; border-bottom: 2.5px solid #111; padding-bottom: 4px; margin-bottom: 8px; }
  .lp-ttl { display: flex; align-items: center; gap: 8px; }
  .lp-ttl { min-width: 0; }
  .lp-ttl h1 { font-size: 15pt; margin: 0; white-space: nowrap; }
  .lp-field, .lp-kind { white-space: nowrap; flex: none; }
  .lp-kind { font-size: 10pt; border: 1.5px solid #111; border-radius: 4px; padding: 0 8px; font-weight: 700; }
  .lp-field { font-size: 9pt; color: #fff; border-radius: 99px; padding: 1px 10px; font-weight: 700; background: #666; }
  .lp-field.geo { background: #2f9e6e; } .lp-field.his { background: #d9622b; } .lp-field.civ { background: #3a6fd8; }
  .lp-boxes { display: flex; gap: 10px; font-size: 10pt; white-space: nowrap; }
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
  .lp-cut { text-align: center; font-size: 9pt; color: #555; border-top: 1.5px dashed #555; padding-top: 1mm; margin: -6mm 0 4mm; }
  .lp-h2 { font-size: 12pt; margin: 2mm 0; border-left: 5px solid #111; padding-left: 6px; }
  .lp-keys { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 8mm; font-size: 9.5pt; }
  .lp-keys li { display: flex; gap: 2px; break-inside: avoid; padding: 1.2mm 0; border-bottom: 1px dotted #bbb; }
  .lp-keys small { font-size: 7.5pt; color: #555; }
  .lp-keys em { display: block; font-style: normal; font-size: 8pt; color: #555; }
  `;

  global.SHAKAI_LESSON = { build, CSS, needsChoice };
})(typeof window !== 'undefined' ? window : globalThis);
