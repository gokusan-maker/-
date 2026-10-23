/* =========================================================================
 * 理科暗記プリント（PDF）生成
 * 使い方: node rika/tools/make-print.js [分野ID=bio] [出力パス]
 *   分野ID: bio / earth / chem / lab
 * 問題データは js/data.js をそのまま使う。Playwright（Chromium）で A4 PDF に出力。
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
const { FIELDS, UNITS, QUESTIONS } = new Function(src + '; return { FIELDS, UNITS, QUESTIONS };')();

const fieldId = process.argv[2] || 'bio';
const field = FIELDS.find(f => f.id === fieldId);
if (!field) { console.error('分野IDが不正です: ' + fieldId); process.exit(1); }
const out = process.argv[3] || path.join(ROOT, 'print', `理科暗記プリント_${field.name}.pdf`);

const KANA = ['ア', 'イ', 'ウ', 'エ'];
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 選択肢の並びは問題IDから決める（何度作っても同じ解答になるように）
function seededShuffle(arr, seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// 選択肢がないと答えが一つに決まらない問題・答えが長い問題は記号選択にする
const needsChoices = q => q.a.length > 9 || /正しい|ふくまれ|ではない|でない|どれ|適して/.test(q.q);

const units = UNITS.filter(u => u.field === fieldId);
const sheets = units.map((u, ui) => {
  const qs = QUESTIONS.filter(q => q.unit === u.id).map(q => {
    if (!needsChoices(q)) return { ...q, kind: 'write', key: q.a };
    const choices = seededShuffle([q.a, ...q.d], q.id);
    return { ...q, kind: 'choice', choices, key: `${KANA[choices.indexOf(q.a)]}　${q.a}` };
  });
  return { u, no: CIRCLED[ui], qs };
});

const head = (s, label) => `
  <header class="sheet-h">
    <div class="ttl"><span class="field">${esc(field.name)}${s.no}</span><h1>${esc(s.u.name)}</h1><span class="kind">${label}</span></div>
    <div class="boxes"><span>月　　日</span><span class="name">名前</span><span class="score"><i></i>／${s.qs.length}</span></div>
  </header>`;

const problemPages = sheets.map(s => `
  <section class="sheet">
    ${head(s, '問題')}
    <p class="lead">答えは右のらんに書きましょう。<b>ア〜エ</b>の問題は記号で答えましょう。</p>
    <ol class="qs">${s.qs.map(q => `
      <li>
        <div class="row"><p class="q">${esc(q.q)}</p><span class="ans ${q.kind}"></span></div>
        ${q.kind === 'choice' ? `<ul class="ch">${q.choices.map((c, i) => `<li><b>${KANA[i]}</b>${esc(c)}</li>`).join('')}</ul>` : ''}
      </li>`).join('')}
    </ol>
  </section>`).join('');

const answerPages = sheets.map(s => `
  <section class="sheet answers">
    <header class="sheet-h ans-h"><div class="ttl"><span class="field">${esc(field.name)}${s.no}</span><h1>${esc(s.u.name)}</h1><span class="kind">解答・解説</span></div></header>
    <ol class="ak">${s.qs.map(q => `<li><p class="k">${esc(q.key)}</p><p class="e">${esc(q.e)}</p></li>`).join('')}</ol>
  </section>`).join('');

const cover = `
  <section class="sheet cover">
    <p class="eyebrow">中学受験　理科　暗記分野</p>
    <h1>理科暗記プリント<br><span>${esc(field.name)}</span></h1>
    <table class="toc"><thead><tr><th>回</th><th>単元</th><th>問題数</th><th>1回目</th><th>2回目</th><th>3回目</th></tr></thead>
      <tbody>${sheets.map(s => `<tr><td>${esc(field.name)}${s.no}</td><td>${esc(s.u.name)}</td><td>${s.qs.length}問</td><td></td><td></td><td></td></tr>`).join('')}</tbody>
    </table>
    <div class="howto">
      <h2>使い方</h2>
      <ul>
        <li>問題ページを解いてから、うしろの「解答・解説」で丸つけをしましょう。</li>
        <li>まちがえた問題には印をつけ、解説を読んでからもう一度ときましょう。</li>
        <li>上の表に点数を書いて、3回とも満点をめざしましょう。</li>
      </ul>
    </div>
  </section>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 13mm 14mm 14mm; }
  :root { --c: ${field.color}; --ink: #1f2a24; --muted: #66726b; --line: #c9d3cc; --soft: #f1f5f2; }
  * { box-sizing: border-box; }
  body { margin: 0; color: var(--ink); font-family: 'Zen Maru Gothic', 'IPAGothic', 'IPAPGothic', sans-serif; font-weight: 500; font-size: 10.2pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { break-after: page; }
  .sheet:last-child { break-after: auto; }
  .sheet-h { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; border-bottom: 2.5pt solid var(--c); padding-bottom: 5px; margin-bottom: 8px; }
  .ttl { display: flex; align-items: baseline; gap: 8px; }
  .field { background: var(--c); color: #fff; font-weight: 900; padding: 1px 8px; border-radius: 4px; font-size: 10pt; }
  .ttl h1 { margin: 0; font-size: 16pt; font-weight: 900; }
  .kind { color: var(--c); font-weight: 700; font-size: 10pt; }
  .boxes { display: flex; gap: 6px; font-size: 9pt; color: var(--muted); }
  .boxes span { border: 1px solid var(--line); border-radius: 4px; padding: 3px 8px; white-space: nowrap; }
  .boxes .name { width: 40mm; }
  .boxes .score i { display: inline-block; width: 9mm; }
  .lead { margin: 0 0 6px; font-size: 9pt; color: var(--muted); }
  .qs { list-style: none; counter-reset: q; margin: 0; padding: 0; }
  .qs > li { counter-increment: q; position: relative; padding: 5px 0 5px 26px; border-bottom: 1px dashed var(--line); break-inside: avoid; }
  .qs > li::before { content: counter(q); position: absolute; left: 0; top: 6px; width: 19px; height: 19px; border-radius: 50%; background: var(--soft); border: 1px solid var(--c); color: var(--c); font-size: 8.5pt; font-weight: 900; display: grid; place-items: center; }
  .row { display: flex; align-items: center; gap: 10px; }
  .q { margin: 0; flex: 1; }
  .ans { flex: none; height: 8.5mm; border: 1.2px solid var(--ink); border-radius: 3px; }
  .ans.write { width: 46mm; }
  .ans.choice { width: 13mm; }
  .ch { list-style: none; margin: 3px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px 14px; font-size: 9.2pt; }
  .ch b { color: var(--c); margin-right: 5px; }
  .ak { list-style: none; counter-reset: a; margin: 0; padding: 0; columns: 2; column-gap: 8mm; }
  .ak li { counter-increment: a; break-inside: avoid; padding: 4px 0 5px 22px; position: relative; border-bottom: 1px dashed var(--line); }
  .ak li::before { content: counter(a); position: absolute; left: 0; top: 4px; font-weight: 900; color: var(--c); }
  .ak .k { margin: 0; font-weight: 900; font-size: 10.5pt; }
  .ak .e { margin: 1px 0 0; font-size: 8.6pt; color: var(--muted); line-height: 1.45; }
  .cover { padding-top: 30mm; }
  .eyebrow { color: var(--c); font-weight: 700; letter-spacing: .1em; margin: 0; }
  .cover h1 { font-size: 30pt; font-weight: 900; margin: 4px 0 18mm; line-height: 1.25; }
  .cover h1 span { color: var(--c); }
  .toc { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  .toc th { background: var(--c); color: #fff; padding: 6px; font-weight: 700; }
  .toc td { border: 1px solid var(--line); padding: 9px 6px; }
  .toc td:nth-child(n+3) { text-align: center; width: 17mm; }
  .howto { margin-top: 12mm; background: var(--soft); border-radius: 8px; padding: 10px 16px; }
  .howto h2 { font-size: 12pt; margin: 0 0 4px; color: var(--c); }
  .howto ul { margin: 0; padding-left: 1.2em; }
</style></head><body>${cover}${problemPages}${answerPages}</body></html>`;

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.pdf({
    path: out, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;text-align:center;font-size:8px;color:#888;font-family:'IPAGothic',sans-serif">理科暗記プリント ${esc(field.name)} ― <span class="pageNumber"></span> / <span class="totalPages"></span></div>`
  });
  await browser.close();
  console.log('出力: ' + out);
})();
