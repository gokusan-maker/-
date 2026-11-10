/* =========================================================================
 * 画面の通しテスト（Playwright が必要）
 *   node tests/e2e.test.js
 * すべてのモードを一通り操作し、JavaScript のエラーが出ないことを確かめる。
 * ========================================================================= */
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) {
  const root = require('child_process').execSync('npm root -g').toString().trim();
  ({ chromium } = require(path.join(root, 'playwright')));
}
const URL = 'file://' + path.join(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  const step = async (name, fn) => { try { await fn(); } catch (e) { errs.push(`${name}: ${e.message.split('\n')[0]}`); } };
  await p.goto(URL);

  await step('記述の判定', async () => {
    const r = await p.evaluate(() => {
      const f = window.__shakai.isTypedCorrect;
      return [f('青森', '青森県'), f(' 札幌市 ', '札幌市'), f('フランシスコ ザビエル', 'フランシスコ・ザビエル'),
        f('霞ケ浦', '霞ヶ浦'), f('ＵＮＥＳＣＯ', 'UNESCO'), !f('津', '津市'), !f('', '津市'), !f('岩手県', '青森県')];
    });
    if (r.some(x => !x)) throw new Error(JSON.stringify(r));
  });
  await step('4択クイズ', async () => {
    await p.click('[data-mode=quiz]'); await p.click('#start');
    for (let i = 0; i < 10; i++) { await p.click('.choice[data-k="0"]'); await p.click('#next'); }
    await p.click('#home');
  });
  await step('書いて答える', async () => {
    await p.click('[data-mode=write]'); await p.click('#start');
    await p.fill('#win', 'まちがい'); await p.click('button[type=submit]'); await p.click('.fix'); await p.click('#next');
    await p.click('#giveup'); await p.click('#next'); await p.click('.quit'); await p.click('#home');
  });
  await step('一問一答', async () => {
    await p.click('[data-mode=flash]'); await p.click('#start');
    await p.click('#reveal'); await p.click('#ok'); await p.click('.quit'); await p.click('#home');
  });
  await step('タイムアタック', async () => {
    await p.click('[data-mode=ta]'); await p.click('#start');
    for (let i = 0; i < 2; i++) { await p.click('.choice[data-k="1"]'); await p.waitForTimeout(1000); }
    await p.click('.quit');
  });
  await step('苦手復習・今日の復習', async () => {
    await p.click('[data-mode=weak]'); await p.click('.choice[data-k="0"]'); await p.click('.quit'); await p.click('#home');
    await p.evaluate(() => { const S = JSON.parse(localStorage['shakai-drill-v1']); Object.values(S.items).forEach(r => r.due = '2000-01-01'); localStorage['shakai-drill-v1'] = JSON.stringify(S); });
    await p.goto(URL);
    await p.click('[data-mode=due]'); await p.click('.choice[data-k="0"]'); await p.click('.quit'); await p.click('#home');
  });
  await step('年代ならべかえ', async () => {
    await p.click('[data-mode=sort]'); await p.click('[data-era=medieval]');
    for (let r = 0; r < 5; r++) { for (let k = 0; k < 4; k++) await p.click(`.event[data-k="${k}"]`); await p.click('#check'); await p.click('#next'); }
    await p.click('#home');
    await p.click('[data-mode=sort]'); await p.click('#ckind [data-k=nengo]'); await p.click('[data-era=all]');
    for (let i = 0; i < 10; i++) { await p.click('.choice[data-k="0"]'); await p.click('#next'); }
    await p.click('#home');
  });
  await step('白地図', async () => {
    for (const m of ['where', 'name', 'cap', 'region']) {
      await p.click('[data-mode="x:map"]'); await p.click(`[data-m=${m}]`);
      for (let i = 0; i < 10; i++) {
        if (m === 'where') await p.click('.jmap .tile[data-p="5"]'); else await p.click('.choice[data-k="0"]');
        await p.click('#next');
      }
      await p.click('#home');
    }
  });
  await step('地図記号', async () => {
    for (const m of ['s2n', 'n2s']) {
      await p.click('[data-mode="x:symbols"]'); await p.click(`[data-m=${m}]`);
      for (let i = 0; i < 10; i++) { await p.click('.choice[data-k="2"]'); await p.click('#next'); }
      await p.click('#home');
    }
  });
  await step('雨温図', async () => {
    await p.click('[data-mode="x:climate"]'); await p.click('#play');
    for (let i = 0; i < 6; i++) { await p.click('.choice[data-k="0"]'); await p.click('#next'); }
    await p.click('#home');
  });
  await step('用語さくいん', async () => {
    await p.click('[data-mode="x:search"]'); await p.fill('#sq', 'りあす');
    await p.waitForTimeout(300);
    if (!(await p.textContent('#sres')).includes('リアス海岸')) throw new Error('ひらがなでリアス海岸が見つからない');
    await p.fill('#sq', '条約'); await p.waitForTimeout(300); await p.click('#squiz');
    await p.click('.choice[data-k="0"]'); await p.click('.quit'); await p.click('#home');
  });
  await step('歴史年表', async () => {
    await p.click('[data-mode="x:timeline"]'); await p.click('#tl-hide'); await p.click('.tl-row[data-k="3"]');
    await p.click('#tl-quiz'); await p.click('[data-era=all]'); await p.click('.choice[data-k="0"]'); await p.click('.quit'); await p.click('#home');
  });
  await step('記録・設定', async () => {
    await p.click('#btn-stats'); await p.click('#print');
    await p.selectOption('#src', 'h3'); await p.click('#pcount [data-n="10"]'); await p.click('#shuffle');
    if (await p.$$eval('.sheet-list li', x => x.length) !== 10) throw new Error('プリントの問題数');
    await p.click('#home');
    await p.click('#btn-settings'); await p.click('#goal [data-g="10"]'); await p.click('#home');
    await p.click('#btn-settings'); await p.click('[data-key=big]'); await p.click('[data-key=big]'); await p.click('#home');
  });
  await step('旧形式の記録の移行', async () => {
    await p.evaluate(() => localStorage['shakai-drill-v1'] = JSON.stringify({ v: 1, items: { 'g1-01': { c: 2, w: 1, s: 2 } }, days: {}, lastDay: null, streak: 0, sort: { played: 0, perfect: 0 }, pref: { units: ['g1'], count: 10 } }));
    await p.goto(URL);
    const r = await p.evaluate(() => JSON.parse(localStorage['shakai-drill-v1']).items['g1-01']);
    if (r.box !== 2 || !r.due) throw new Error(JSON.stringify(r));
  });

  await browser.close();
  if (errs.length) { console.error('✗ ' + errs.join('\n✗ ')); process.exit(1); }
  console.log('すべての画面テストに合格しました');
})();
