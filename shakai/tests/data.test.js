/* =========================================================================
 * 問題データの整合性テスト（node tests/data.test.js）
 * 問題を追加・修正したら実行して、出題できない問題がないか確かめる。
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ブラウザ用のスクリプトを window つきの環境で読みこむ
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['data.js', 'readings.js', 'map.js', 'symbols.js', 'climate.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const { FIELDS, UNITS, EVENTS, POOLS } = ctx.window.SHAKAI;
const { PREFS, REGIONS } = ctx.window.SHAKAI_MAP;

let failures = 0, checks = 0;
function check(cond, msg) {
  checks++;
  if (!cond) { failures++; console.error('✗ ' + msg); }
}

/* ---------- 単元と問題 ---------- */
const fieldIds = new Set(FIELDS.map(f => f.id));
const unitIds = new Set();
UNITS.forEach(u => {
  check(!unitIds.has(u.id), `単元IDが重複: ${u.id}`);
  unitIds.add(u.id);
  check(fieldIds.has(u.field), `${u.id}: 分野が不明 (${u.field})`);
  check(u.items.length >= 5, `${u.id}: 問題が少なすぎる`);
});

const all = UNITS.flatMap(u => u.items);
const group = {};
all.forEach(it => (group[it.g] = group[it.g] || new Set()).add(it.a));
Object.entries(POOLS).forEach(([g, list]) => list.forEach(a => (group[g] = group[g] || new Set()).add(a)));

// 片方がもう片方をふくむが、別のものとして区別できると確認ずみの組み合わせ
const OK_NEAR = new Set(['大津市|津市', '新潟水俣病|水俣病', '15か国|5か国', '株主|株主総会', '茶畑|畑'].map(x => x.split('|').sort().join('|')));

const ids = new Set();
all.forEach(it => {
  check(!ids.has(it.id), `問題IDが重複: ${it.id}`);
  ids.add(it.id);
  check(typeof it.q === 'string' && it.q.length >= 4, `${it.id}: 問題文が短すぎる`);
  check(typeof it.a === 'string' && it.a.trim() === it.a && it.a.length > 0, `${it.id}: 答えが空か、前後に空白がある`);
  check(/[？?]$/.test(it.q), `${it.id}: 問題文が「？」で終わっていない`);
  check(typeof it.e === 'string', `${it.id}: 解説が文字列ではない（誤答の配列を4番目に書いていないか）`);
  if (it.ch) {
    check(it.ch.length >= 3, `${it.id}: 指定した誤答が3つ未満`);
    check(!it.ch.includes(it.a), `${it.id}: 誤答に正解がふくまれている`);
    check(new Set(it.ch).size === it.ch.length, `${it.id}: 誤答が重複している`);
  } else {
    const others = [...(group[it.g] || [])].filter(a => a !== it.a);
    check(others.length >= 3, `${it.id}: グループ「${it.g}」の誤答候補が3つ未満`);
    // 「刀狩」と「刀狩令」のように、片方がもう片方をふくむ答えが誤答に出るとまぎらわしい
    const near = others.filter(o => (o.includes(it.a) || it.a.includes(o)) && !OK_NEAR.has([it.a, o].sort().join('|')));
    check(!near.length, `${it.id}: 「${it.a}」とまぎらわしい誤答候補がある（${near.join('、')}）。誤答を指定するかグループを分ける`);
  }
});

// 同じ問題文で答えがちがうものは、誤答を指定していないとあいまいになる
const byQ = {};
all.forEach(it => (byQ[it.q] = byQ[it.q] || []).push(it));
Object.values(byQ).filter(l => l.length > 1).forEach(l => {
  const answers = new Set(l.map(it => it.a));
  check(answers.size === 1 || l.every(it => it.ch && l.every(o => !it.ch.includes(o.a))),
    `同じ問題文で答えがちがう: ${l.map(it => it.id).join(', ')}`);
});

/* ---------- 読みがな ---------- */
const answers = new Set(all.map(it => it.a));
Object.entries(ctx.window.SHAKAI_READINGS).forEach(([a, r]) => {
  check(answers.has(a), `読みがなの見出し「${a}」が問題の答えにない`);
  check(/^[\u3041-\u309f・ー]+$/.test(r), `「${a}」の読みがなにひらがな以外がある（${r}）`);
});

/* ---------- 年代ならべかえ ---------- */
EVENTS.forEach(e => {
  check(Number.isInteger(e.y) && e.y > 0 && e.y <= new Date().getFullYear(), `できごとの年が不正: ${e.t}`);
  check(e.t.length > 0, 'できごとの文が空');
});
check(new Set(EVENTS.map(e => e.y)).size >= 20, '年代ならべかえの年の種類が少なすぎる');

/* ---------- 白地図 ---------- */
check(PREFS.length === 47, `都道府県の数が47ではない (${PREFS.length})`);
check(new Set(PREFS.map(p => p.name)).size === 47, '都道府県名が重複している');
const regionIds = new Set(REGIONS.map(r => r.id));
const cells = new Map();
PREFS.forEach(p => {
  check(regionIds.has(p.r), `${p.name}: 地方が不明`);
  for (let dx = 0; dx < p.w; dx++) for (let dy = 0; dy < p.h; dy++) {
    const k = `${p.x + dx},${p.y + dy}`;
    check(!cells.has(k), `地図のマスが重なっている: ${p.name} と ${cells.get(k)} (${k})`);
    cells.set(k, p.name);
  }
});
// 4択の答えとして、問題データの県庁所在地と白地図の県庁所在地が食いちがっていないか
all.filter(it => /の(県|道|府)庁所在地は？$/.test(it.q)).forEach(it => {
  const name = it.q.replace(/の(県|道|府)庁所在地は？$/, '');
  const p = PREFS.find(x => x.name === name);
  check(p && p.cap === it.a, `${it.id}: 白地図の県庁所在地と食いちがう (${name})`);
});

/* ---------- 結果 ---------- */
console.log(`${UNITS.length}単元・${all.length}問・できごと${EVENTS.length}件・都道府県${PREFS.length}`);
if (failures) {
  console.error(`\n${failures}件の問題があります（${checks}件中）`);
  process.exit(1);
}
console.log(`すべてのチェックに合格しました（${checks}件）`);
