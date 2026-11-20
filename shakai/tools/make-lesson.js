/* =========================================================================
 * 授業プリント（PDF）の一括作成
 *   node tools/make-lesson.js            … 全単元（print/授業プリント/ に出力）
 *   node tools/make-lesson.js g1 h3      … 指定した単元だけ
 *   node tools/make-lesson.js --minutes 90
 * アプリと同じ js/lesson.js でHTMLを組み立て、Playwright（Chromium）で A4 の PDF にする。
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  const root = require('child_process').execSync('npm root -g').toString().trim();
  ({ chromium } = require(path.join(root, 'playwright')));
}

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['data.js', 'readings.js', 'lesson.js', 'prints.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}
const SH = ctx.window.SHAKAI, L = ctx.window.SHAKAI_LESSON, nameOf = ctx.window.SHAKAI_PRINT_NAME;

const args = process.argv.slice(2);
const mi = args.indexOf('--minutes');
const minutes = mi >= 0 ? +args[mi + 1] : 45;
const only = args.filter((a, k) => !a.startsWith('--') && (mi < 0 || k !== mi + 1));
const targets = SH.UNITS.map((u, k) => ({ u, no: k + 1 })).filter(x => !only.length || only.includes(x.u.id));
if (!targets.length) { console.error('単元IDが見つかりません: ' + only.join(' ')); process.exit(1); }

const FONT = '<link href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&display=swap" rel="stylesheet">';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const { u, no } of targets) {
    const doc = L.build(SH, { unitId: u.id, no, minutes, readings: ctx.window.SHAKAI_READINGS });
    await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8">${FONT}
      <style>@page { size: A4; margin: 0; } body { margin: 0; } ${L.CSS}</style></head>
      <body><div class="lp-doc">${doc.html}</div></body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(ROOT, nameOf(no, u));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
    console.log(`第${no}回 ${u.name}：練習${doc.practice}問・確認テスト${doc.test}問 → ${path.relative(ROOT, out)}`);
  }
  await browser.close();
})();
