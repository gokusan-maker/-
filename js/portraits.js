/* =========================================================================
 * 武将ポートレート生成エンジン
 * 全武将を手続き的に描画する SVG イラストレーター。
 * 背景 → 旗指物/武器 → 胴・袖 → 錣 → 首・顔 → 髪 → 兜鉢 → 吹返 → 前立 → 光彩
 * の順にレイヤーを重ね、グラデーション・ぼかし陰影・質感ノイズで仕上げる。
 * ========================================================================= */
(function (global) {
  'use strict';

  const W = 320, H = 420, CX = 160, HEAD_DY = 8;
  let uidSeq = 0;

  /* ---------- 色ユーティリティ ---------- */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function shade(h, a) {
    const [r, g, b] = hex2rgb(h);
    if (a >= 0) return rgb2hex(r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a);
    a = -a;
    return rgb2hex(r * (1 - a), g * (1 - a), b * (1 - a));
  }
  function mix(h1, h2, t) {
    const a = hex2rgb(h1), b = hex2rgb(h2);
    return rgb2hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }

  /* ---------- 乱数（武将ごとに固定） ---------- */
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  /* ---------- 幾何ユーティリティ ---------- */
  const f = n => (Math.round(n * 10) / 10);
  const pt = p => `${f(p[0])},${f(p[1])}`;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lp = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
  // 左右対称：dx は中心からの距離（外向きが正）、s=-1 で左、+1 で右
  const X = (s, dx) => CX + s * dx;
  function mirrorPath(d) {
    // "x,y" 形式の座標を左右反転
    return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (m, x, y) => `${f(2 * CX - parseFloat(x))},${y}`);
  }
  const both = (d, attrs) => `<path d="${d}" ${attrs}/><path d="${d}" ${attrs} transform="translate(${2 * CX},0) scale(-1,1)"/>`;

  /* ---------- 金属・漆グラデーション ---------- */
  const METALS = {
    gold: '#d8a521', silver: '#aab4bf', black: '#2b2b35', red: '#b51f1a',
    bronze: '#a0662a', navy: '#1f2f55', white: '#e8e6df', purple: '#4b2a6b',
    green: '#2d5a3a', brown: '#5a3a22'
  };
  const metalColor = m => METALS[m] || m;

  function metalGrad(id, base) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(base, .6)}"/>
      <stop offset=".18" stop-color="${shade(base, .2)}"/>
      <stop offset=".45" stop-color="${base}"/>
      <stop offset=".7" stop-color="${shade(base, -.5)}"/>
      <stop offset=".85" stop-color="${shade(base, .12)}"/>
      <stop offset="1" stop-color="${shade(base, -.62)}"/></linearGradient>
    <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${shade(base, -.55)}"/>
      <stop offset=".22" stop-color="${shade(base, .25)}"/>
      <stop offset=".34" stop-color="${shade(base, .7)}"/>
      <stop offset=".5" stop-color="${base}"/>
      <stop offset=".8" stop-color="${shade(base, -.45)}"/>
      <stop offset="1" stop-color="${shade(base, -.7)}"/></linearGradient>
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(base, .55)}"/>
      <stop offset=".4" stop-color="${base}"/>
      <stop offset="1" stop-color="${shade(base, -.6)}"/></linearGradient>`;
  }

  /* ---------- 家紋 ---------- */
  function mon(type, cx, cy, r, color, bg) {
    const c = color;
    const g = (inner) => `<g transform="translate(${f(cx)},${f(cy)}) scale(${f(r / 20 * 100) / 100})">${inner}</g>`;
    const ring = `<circle r="19" fill="none" stroke="${c}" stroke-width="2.4"/>`;
    switch (type) {
      case 'mokkou': { // 織田木瓜
        let s = '';
        for (let i = 0; i < 5; i++) {
          const a = i * 72 - 90;
          s += `<ellipse cx="0" cy="-10" rx="8.5" ry="9.5" transform="rotate(${a + 90})" fill="none" stroke="${c}" stroke-width="2.6"/>`;
        }
        s += `<circle r="5.5" fill="${c}"/>`;
        for (let i = 0; i < 5; i++) s += `<circle cx="0" cy="-5.5" r="2.6" transform="rotate(${i * 72})" fill="${c}"/>`;
        return g(s);
      }
      case 'hishi': { // 武田菱
        const d = (x, y) => `<path d="M${x},${y - 8.5}L${x + 8.5},${y}L${x},${y + 8.5}L${x - 8.5},${y}Z" fill="${c}"/>`;
        return g(d(0, -9.5) + d(9.5, 0) + d(0, 9.5) + d(-9.5, 0));
      }
      case 'take': { // 竹に雀（意匠化）
        let s = ring + `<circle r="14.5" fill="none" stroke="${c}" stroke-width="1.6"/>`;
        for (let i = 0; i < 6; i++) s += `<path d="M0,-3 C4,-8 4,-12 0,-14 C-4,-12 -4,-8 0,-3Z" transform="rotate(${i * 60})" fill="${c}"/>`;
        s += `<circle r="3" fill="${c}"/>`;
        return g(s);
      }
      case 'aoi': { // 三つ葉葵
        let s = ring;
        for (let i = 0; i < 3; i++) {
          s += `<g transform="rotate(${i * 120})"><path d="M0,-2 C-9,-6 -11,-15 -5,-17.5 C-2,-18.5 0,-16 0,-14.5 C0,-16 2,-18.5 5,-17.5 C11,-15 9,-6 0,-2Z" fill="${c}"/>
            <path d="M0,-4 L0,-14 M0,-9 L-4,-12 M0,-9 L4,-12" stroke="${bg}" stroke-width=".9"/></g>`;
        }
        s += `<circle r="2.4" fill="${c}"/>`;
        return g(s);
      }
      case 'kiri': { // 五七桐
        let s = '';
        s += `<path d="M0,16 C-6,6 -18,8 -17,0 C-16,-3 -9,-2 -6,2 C-6,-2 -4,-4 0,-3 C4,-4 6,-2 6,2 C9,-2 16,-3 17,0 C18,8 6,6 0,16Z" fill="${c}"/>`;
        const buds = (x, n, h) => { let b = `<path d="M${x},-1 L${x},${-h}" stroke="${c}" stroke-width="1"/>`; for (let i = 0; i < n; i++) b += `<ellipse cx="${x + (i % 2 ? 2 : -2)}" cy="${-3 - i * (h - 3) / n}" rx="2" ry="1.6" fill="${c}"/>`; return b; };
        s += buds(-9, 5, 14) + buds(0, 7, 19) + buds(9, 5, 14);
        return g(s);
      }
      case 'rokumon': { // 六文銭
        let s = '';
        for (let r2 = 0; r2 < 2; r2++) for (let i = 0; i < 3; i++) {
          const x = -12 + i * 12, y = -6 + r2 * 12;
          s += `<circle cx="${x}" cy="${y}" r="5.4" fill="none" stroke="${c}" stroke-width="2.2"/><rect x="${x - 1.6}" y="${y - 1.6}" width="3.2" height="3.2" fill="none" stroke="${c}" stroke-width="1.1"/>`;
        }
        return g(s);
      }
      case 'kuyo': { // 九曜
        let s = `<circle r="6.5" fill="${c}"/>`;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          s += `<circle cx="${f(Math.cos(a) * 13)}" cy="${f(Math.sin(a) * 13)}" r="4.6" fill="${c}"/>`;
        }
        return g(s);
      }
      case 'kikyo': { // 桔梗
        let s = '';
        for (let i = 0; i < 5; i++) s += `<path d="M0,0 C-7,-6 -8,-14 -5,-18 L0,-14.5 L5,-18 C8,-14 7,-6 0,0Z" transform="rotate(${i * 72})" fill="${c}"/>`;
        s += `<circle r="3.6" fill="${bg}"/><circle r="1.6" fill="${c}"/>`;
        for (let i = 0; i < 5; i++) s += `<path d="M0,-4 L0,-10" transform="rotate(${i * 72})" stroke="${bg}" stroke-width=".9"/>`;
        return g(s);
      }
      case 'mitsuboshi': { // 一文字に三つ星
        return g(`<rect x="-17" y="-17" width="34" height="7" rx="1.5" fill="${c}"/>
          <circle cx="0" cy="-1" r="6" fill="${c}"/><circle cx="-8.5" cy="11" r="6" fill="${c}"/><circle cx="8.5" cy="11" r="6" fill="${c}"/>`);
      }
      case 'juji': { // 丸に十字
        return g(ring + `<path d="M-14,0H14M0,-14V14" stroke="${c}" stroke-width="4.4"/>`);
      }
      case 'uroko': { // 三つ鱗
        const t = (x, y) => `<path d="M${x},${y - 9}L${x + 10},${y + 7}L${x - 10},${y + 7}Z" fill="${c}"/>`;
        return g(t(0, -7) + t(-10.5, 9) + t(10.5, 9));
      }
      case 'igeta': { // 井桁
        return g(`<g transform="rotate(45)"><path d="M-6,-16V16M6,-16V16M-16,-6H16M-16,6H16" stroke="${c}" stroke-width="4.2"/></g>`);
      }
      case 'janome': { // 蛇の目
        return g(`<circle r="15" fill="none" stroke="${c}" stroke-width="7"/>`);
      }
      case 'tomoe': { // 三つ巴
        let s = '';
        for (let i = 0; i < 3; i++) s += `<path d="M0,-5 C7,-5 9,-13 3,-17 C10,-17 16,-9 13,-2 C10,6 0,6 -2,1 C-3,-2 -2,-5 0,-5Z" transform="rotate(${i * 120}) translate(0,2)" fill="${c}"/>`;
        return g(s);
      }
      case 'katabami': { // 酢漿草
        let s = '';
        for (let i = 0; i < 3; i++) s += `<path d="M0,0 C-10,-4 -12,-16 -4,-18 C-1,-18.5 0,-15 0,-15 C0,-15 1,-18.5 4,-18 C12,-16 10,-4 0,0Z" transform="rotate(${i * 120})" fill="${c}"/>`;
        for (let i = 0; i < 3; i++) s += `<path d="M0,0 L0,-15" transform="rotate(${i * 120 + 60})" stroke="${c}" stroke-width="2"/>`;
        return g(s);
      }
      case 'hikiryo': { // 二つ引両
        return g(ring + `<rect x="-16" y="-8.5" width="32" height="5.5" fill="${c}"/><rect x="-16" y="3" width="32" height="5.5" fill="${c}"/>`);
      }
      case 'umebachi': { // 梅鉢
        let s = `<circle r="4.5" fill="${c}"/>`;
        for (let i = 0; i < 5; i++) {
          const a = i * 72 * Math.PI / 180 - Math.PI / 2;
          s += `<circle cx="${f(Math.cos(a) * 12)}" cy="${f(Math.sin(a) * 12)}" r="6" fill="${c}"/>`;
          s += `<path d="M0,-5.5 L0,-8.5" transform="rotate(${i * 72 + 36})" stroke="${c}" stroke-width="1.6"/>`;
        }
        return g(s);
      }
      case 'daiichi': { // 大一大万大吉
        return g(ring + `<text x="0" y="-4" text-anchor="middle" font-size="9" font-weight="900" fill="${c}" font-family="'Shippori Mincho','Noto Serif JP',serif">大一</text>
          <text x="0" y="5" text-anchor="middle" font-size="9" font-weight="900" fill="${c}" font-family="'Shippori Mincho','Noto Serif JP',serif">大万</text>
          <text x="0" y="14" text-anchor="middle" font-size="9" font-weight="900" fill="${c}" font-family="'Shippori Mincho','Noto Serif JP',serif">大吉</text>`);
      }
      case 'shuriken': {
        let s = '';
        for (let i = 0; i < 4; i++) s += `<path d="M0,0 L-4,-6 L0,-19 L4,-6Z" transform="rotate(${i * 90 + 45})" fill="${c}"/>`;
        s += `<circle r="3" fill="${bg}"/>`;
        return g(s);
      }
      case 'gion': { // 祇園守（意匠化）
        return g(`<path d="M-13,-13 L13,13 M13,-13 L-13,13" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/>
          <ellipse rx="5" ry="9" fill="${c}"/><ellipse rx="3" ry="6.5" fill="${bg}"/>`);
      }
      default:
        return g(ring + `<circle r="7" fill="${c}"/>`);
    }
  }

  /* ---------- 背景 ---------- */
  function background(u, c, rnd) {
    const b = c.bg;
    let s = `<rect width="${W}" height="${H}" fill="url(#${u}bg)"/>`;
    const accent = b.accent || '#f2c14e';

    if (b.type === 'sun') {
      // 旭日
      let rays = '';
      const n = 24;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n;
        const R = 520;
        rays += `<path d="M${CX},150 L${f(CX + Math.cos(a0) * R)},${f(150 + Math.sin(a0) * R)} L${f(CX + Math.cos(a1) * R)},${f(150 + Math.sin(a1) * R)}Z"/>`;
      }
      s += `<g fill="${accent}" opacity=".16">${rays}</g>`;
      s += `<circle cx="${CX}" cy="150" r="108" fill="url(#${u}sun)"/>`;
    } else if (b.type === 'mountain') {
      // 水墨の山並みと霞
      s += `<circle cx="236" cy="96" r="44" fill="${accent}" opacity=".55" filter="url(#pf-soft)"/>`;
      s += `<circle cx="236" cy="96" r="30" fill="${shade(accent, .5)}" opacity=".85"/>`;
      const layers = [
        { y: 230, h: 120, c: .25, o: .35 }, { y: 270, h: 100, c: .4, o: .55 }, { y: 315, h: 80, c: .6, o: .8 }
      ];
      layers.forEach((L, li) => {
        let d = `M0,${H} L0,${L.y}`;
        let x = 0;
        while (x < W) {
          const w = 40 + rnd() * 70, pk = L.y - L.h * (0.3 + rnd() * 0.7);
          d += ` Q${f(x + w * 0.35)},${f(pk)} ${f(x + w * 0.5)},${f(pk + 4)} Q${f(x + w * 0.7)},${f(L.y - L.h * 0.15)} ${f(x + w)},${f(L.y - rnd() * 20)}`;
          x += w;
        }
        d += ` L${W},${H}Z`;
        s += `<path d="${d}" fill="${mix(b.c2, '#000000', L.c)}" opacity="${L.o}"/>`;
        s += `<rect x="0" y="${L.y - 30}" width="${W}" height="60" fill="url(#${u}mist)" opacity="${0.5 - li * 0.1}"/>`;
      });
    } else if (b.type === 'flame') {
      // 業火
      for (let i = 0; i < 14; i++) {
        const x = rnd() * W, h = 120 + rnd() * 220, w = 30 + rnd() * 50;
        const by = H + 10;
        s += `<path d="M${f(x - w)},${by} C${f(x - w)},${f(by - h * .5)} ${f(x + w * .4)},${f(by - h * .6)} ${f(x)},${f(by - h)} C${f(x + w * .2)},${f(by - h * .55)} ${f(x + w)},${f(by - h * .4)} ${f(x + w)},${by}Z" fill="url(#${u}flame)" opacity="${f(.35 + rnd() * .4)}"/>`;
      }
      for (let i = 0; i < 40; i++) {
        s += `<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H * .9)}" r="${f(.6 + rnd() * 1.8)}" fill="${shade(accent, .5)}" opacity="${f(.4 + rnd() * .6)}"/>`;
      }
    } else if (b.type === 'moon') {
      // 月下
      s += `<circle cx="${CX + 10}" cy="120" r="118" fill="${accent}" opacity=".18" filter="url(#pf-soft)"/>`;
      s += `<circle cx="${CX + 10}" cy="120" r="96" fill="url(#${u}moon)"/>`;
      for (let i = 0; i < 7; i++) s += `<circle cx="${f(CX - 50 + rnd() * 120)}" cy="${f(60 + rnd() * 120)}" r="${f(6 + rnd() * 14)}" fill="#000" opacity=".05"/>`;
      for (let i = 0; i < 60; i++) s += `<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H * .7)}" r="${f(.4 + rnd() * 1.2)}" fill="#fff" opacity="${f(.3 + rnd() * .7)}"/>`;
    } else if (b.type === 'sakura') {
      s += `<circle cx="${CX}" cy="140" r="120" fill="${accent}" opacity=".25" filter="url(#pf-soft)"/>`;
      // 枝
      s += `<path d="M330,40 C260,60 230,40 180,70 C150,88 120,80 90,96 M250,52 C240,30 228,24 210,20 M200,66 C200,90 190,104 176,112" stroke="#3a2420" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>`;
      s += `<path d="M-10,90 C30,100 50,86 80,108 M30,96 C26,120 32,136 22,150" stroke="#3a2420" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>`;
      const blossom = (x, y, r, o) => {
        let p = '';
        for (let i = 0; i < 5; i++) p += `<ellipse cx="0" cy="${-r * .55}" rx="${r * .42}" ry="${r * .58}" transform="rotate(${i * 72})"/>`;
        return `<g transform="translate(${f(x)},${f(y)}) rotate(${f(rnd() * 72)})" fill="#ffd6e2" opacity="${o}">${p}<circle r="${r * .2}" fill="#d0507a"/></g>`;
      };
      for (let i = 0; i < 26; i++) {
        const t = rnd();
        const onLeft = rnd() < .3;
        const x = onLeft ? rnd() * 90 : 160 + rnd() * 170, y = onLeft ? 80 + rnd() * 70 : 10 + rnd() * 110;
        s += blossom(x, y, 6 + t * 8, f(.7 + rnd() * .3));
      }
      for (let i = 0; i < 30; i++) {
        s += `<ellipse cx="${f(rnd() * W)}" cy="${f(rnd() * H)}" rx="3" ry="1.8" transform="rotate(${f(rnd() * 180)} ${f(rnd() * W)} ${f(rnd() * H)})" fill="#ffc6d6" opacity="${f(.4 + rnd() * .5)}"/>`;
      }
    } else if (b.type === 'wave') {
      // 荒波
      s += `<circle cx="70" cy="90" r="40" fill="${accent}" opacity=".7"/>`;
      for (let row = 0; row < 3; row++) {
        let d = '';
        const y0 = 250 + row * 50;
        for (let x = -40; x < W + 40; x += 60) {
          d += `M${x},${y0} C${x + 10},${y0 - 40} ${x + 50},${y0 - 50} ${x + 60},${y0 - 18} C${x + 46},${y0 - 30} ${x + 34},${y0 - 22} ${x + 38},${y0 - 6} `;
        }
        s += `<path d="${d}" fill="none" stroke="#e8f0ff" stroke-width="2.4" opacity="${.25 + row * .15}"/>`;
      }
    } else if (b.type === 'storm') {
      s += `<path d="M230,0 L200,90 L222,92 L180,190 L240,80 L216,78 L250,0Z" fill="${accent}" opacity=".55" filter="url(#pf-glow)"/>`;
      s += `<path d="M60,0 L48,50 L60,52 L36,110 L72,44 L60,42 L74,0Z" fill="${accent}" opacity=".35"/>`;
      for (let i = 0; i < 70; i++) {
        const x = rnd() * W, y = rnd() * H;
        s += `<path d="M${f(x)},${f(y)} l-6,16" stroke="#cfe0ff" stroke-width=".8" opacity="${f(.15 + rnd() * .3)}"/>`;
      }
    } else if (b.type === 'gold') {
      // 金屏風
      for (let i = 0; i < 6; i++) {
        s += `<rect x="${i * 54}" y="0" width="53" height="${H}" fill="url(#${u}goldleaf)" opacity=".95"/>`;
        s += `<rect x="${i * 54 + 53}" y="0" width="1.2" height="${H}" fill="#5a3a00" opacity=".35"/>`;
      }
      for (let i = 0; i < 16; i++) s += `<rect x="${f(rnd() * W)}" y="${f(rnd() * H)}" width="${f(20 + rnd() * 30)}" height="${f(20 + rnd() * 30)}" fill="#fff6c8" opacity=".09"/>`;
    }

    // 瑞雲（金雲）
    if (b.clouds) {
      const cloud = (x, y, sc, o) => `<g transform="translate(${x},${y}) scale(${sc})" opacity="${o}">
        <path d="M-60,10 C-60,-6 -40,-10 -32,-2 C-30,-20 -6,-24 2,-8 C8,-22 34,-20 36,-4 C52,-8 64,4 58,12 Z" fill="${b.cloudColor || '#f3d27a'}"/>
        <path d="M-50,10 C-46,4 -38,2 -32,6 M-4,4 C2,-4 14,-6 20,2 M36,8 C40,2 48,2 52,8" stroke="${shade(b.cloudColor || '#f3d27a', -.35)}" stroke-width="1.6" fill="none"/></g>`;
      s += cloud(44, 300, 1.2, .55) + cloud(270, 250, 1, .5) + cloud(250, 60, .8, .35);
    }

    // 下部の青海波
    if (b.seigaiha) s += `<rect x="0" y="330" width="${W}" height="90" fill="url(#${u}seigaiha)" opacity=".5"/>`;
    return s;
  }

  /* ---------- 旗指物 ---------- */
  function banner(u, c) {
    const bn = c.banner;
    if (!bn) return '';
    const x = bn.side === 'left' ? 46 : 262;
    const col = bn.color, ink = bn.ink || '#ffffff';
    const wave = bn.side === 'left' ? -1 : 1;
    return `<g>
      <rect x="${x - 2}" y="6" width="4.5" height="${H}" fill="url(#${u}woodv)"/>
      <rect x="${wave > 0 ? x - 3 : x - 41}" y="6" width="44" height="3.5" fill="url(#${u}woodv)"/>
      <path d="M${x + 2 * wave},10 L${x + 42 * wave},10 C${x + 46 * wave},70 ${x + 38 * wave},130 ${x + 44 * wave},190 L${x + 2 * wave},190Z" fill="${col}"/>
      <path d="M${x + 2 * wave},10 L${x + 42 * wave},10 C${x + 46 * wave},70 ${x + 38 * wave},130 ${x + 44 * wave},190 L${x + 2 * wave},190Z" fill="url(#${u}clothShade)"/>
      ${mon(bn.mon || c.mon, x + 23 * wave, 52, 13, ink, col)}
      ${bn.text ? `<text x="${x + 23 * wave}" y="86" font-size="16" writing-mode="tb" fill="${ink}" font-weight="900" font-family="'Shippori Mincho','Noto Serif JP',serif" letter-spacing="3">${bn.text}</text>` : ''}
    </g>`;
  }

  /* ---------- 武器 ---------- */
  function weapon(u, c) {
    const w = c.weapon;
    if (!w) return '';
    const t = typeof w === 'string' ? w : w.type;
    const col = (w && w.color) || '#3a2418';
    switch (t) {
      case 'yari':
      case 'tonbogiri': {
        const long = t === 'tonbogiri';
        return `<g transform="rotate(24 ${CX} 210)">
          <rect x="248" y="${long ? -10 : 0}" width="7" height="460" rx="2" fill="${col}"/>
          <rect x="249" y="${long ? -10 : 0}" width="2" height="460" fill="#fff" opacity=".18"/>
          <rect x="246" y="${long ? 64 : 58}" width="11" height="10" fill="url(#${u}goldv)"/>
          <path d="M251.5,${long ? -86 : -50} L258,${long ? 52 : 50} L251.5,${long ? 64 : 58} L245,${long ? 52 : 50}Z" fill="url(#${u}silverh)"/>
          <path d="M251.5,${long ? -86 : -50} L251.5,${long ? 64 : 58}" stroke="#fff" stroke-width=".7" opacity=".8"/>
        </g>`;
      }
      case 'jumonji': { // 十文字槍（幸村）
        return `<g transform="rotate(24 ${CX} 210)">
          <rect x="248" y="0" width="7" height="460" rx="2" fill="#5a1410"/>
          <rect x="246" y="58" width="11" height="10" fill="url(#${u}goldv)"/>
          <path d="M251.5,-50 L258,50 L251.5,58 L245,50Z" fill="url(#${u}silverh)"/>
          <path d="M251.5,40 C238,40 226,30 216,14 C232,24 242,28 251.5,30 C261,28 271,24 287,14 C277,30 265,40 251.5,40Z" fill="url(#${u}silverh)"/>
        </g>`;
      }
      case 'naginata': {
        return `<g transform="rotate(-22 ${CX} 210)">
          <rect x="62" y="20" width="6.5" height="460" rx="2" fill="${col}"/>
          <rect x="60" y="80" width="10.5" height="9" fill="url(#${u}goldv)"/>
          <rect x="60" y="89" width="10.5" height="12" fill="#1a1010"/>
          <path d="M62,80 C58,30 66,-6 86,-30 C80,8 76,40 69,80Z" fill="url(#${u}silverh)"/>
          <path d="M65,78 C63,40 70,6 84,-24" stroke="#fff" stroke-width=".8" fill="none" opacity=".8"/>
        </g>`;
      }
      case 'katana': {
        return `<g transform="rotate(-38 ${CX} 260)">
          <rect x="60" y="150" width="12" height="78" rx="3" fill="#1a1414"/>
          <path d="M60,156 l12,8 M60,166 l12,8 M60,176 l12,8 M60,186 l12,8 M60,196 l12,8 M60,206 l12,8 M60,216 l12,8 M72,156 l-12,8 M72,166 l-12,8 M72,176 l-12,8 M72,186 l-12,8 M72,196 l-12,8 M72,206 l-12,8 M72,216 l-12,8" stroke="#e8dcc0" stroke-width="1.4" opacity=".9"/>
          <ellipse cx="66" cy="232" rx="17" ry="5" fill="url(#${u}goldh)"/>
          <rect x="59" y="236" width="14" height="260" rx="5" fill="#140c0c"/>
          <path d="M60,240 h12" stroke="${c.colors.accent}" stroke-width="2.5"/>
        </g>`;
      }
      case 'gunbai': { // 軍配
        const tx = w.side === 'left' ? 70 : 250;
        return `<g transform="translate(${tx},150) rotate(${w.side === 'left' ? -18 : 18})">
          <rect x="-3.5" y="40" width="7" height="110" rx="2" fill="#2a1a10"/>
          <path d="M0,46 C-46,40 -54,-30 -30,-56 C-16,-70 16,-70 30,-56 C54,-30 46,40 0,46Z" fill="url(#${u}lacq)" stroke="url(#${u}goldv)" stroke-width="3"/>
          <circle cx="0" cy="-16" r="17" fill="${w.sun || '#c8241c'}"/>
          <path d="M-10,18 A14,14 0 1,0 10,18 A10,10 0 1,1 -10,18Z" fill="#e8d78a"/>
          ${w.mon ? mon(w.mon, 0, -16, 11, '#f5e6b0', w.sun || '#c8241c') : ''}
        </g>`;
      }
      case 'teppo': { // 火縄銃
        return `<g transform="rotate(30 ${CX} 220)">
          <rect x="246" y="-30" width="6" height="330" rx="2" fill="url(#${u}blackh)"/>
          <path d="M243,290 L256,290 L264,420 L238,420Z" fill="#5a2e14"/>
          <path d="M243,290 L256,290 L264,420 L238,420Z" fill="url(#${u}clothShade)"/>
          <rect x="243" y="0" width="12" height="4" fill="url(#${u}goldh)"/>
          <rect x="243" y="110" width="12" height="4" fill="url(#${u}goldh)"/>
          <rect x="243" y="220" width="12" height="4" fill="url(#${u}goldh)"/>
          <rect x="254" y="270" width="8" height="12" fill="url(#${u}goldh)"/>
          <circle cx="249" cy="-30" r="3" fill="#111"/>
        </g>`;
      }
      case 'arrows': { // 三本の矢
        let s = '';
        [-9, 0, 9].forEach((o, i) => {
          s += `<g transform="rotate(${22 + o * .5} ${CX} 220) translate(${o},0)">
            <rect x="252" y="-10" width="3.2" height="400" fill="#c9a66b"/>
            <path d="M253.6,-34 L258,-10 L249.2,-10Z" fill="url(#${u}silverh)"/>
            <path d="M253.6,300 L246,316 L246,346 L253.6,330 L261,346 L261,316Z" fill="${['#f4f0e6', '#2a2a2a', '#f4f0e6'][i]}" stroke="#555" stroke-width=".5"/>
          </g>`;
        });
        s += `<g transform="rotate(22 ${CX} 220)"><rect x="236" y="170" width="34" height="9" rx="2" fill="#a01818"/></g>`;
        return s;
      }
      case 'ninjato': {
        let s = `<g transform="rotate(40 ${CX} 220)">
          <rect x="246" y="-30" width="8" height="90" rx="1" fill="#141414"/>
          <path d="M246,-24 l8,6 M246,-12 l8,6 M246,0 l8,6 M246,12 l8,6 M246,24 l8,6 M246,36 l8,6 M246,48 l8,6" stroke="#6b6b6b" stroke-width="1.3"/>
          <rect x="236" y="60" width="28" height="7" fill="#222"/>
          <rect x="245" y="67" width="10" height="320" fill="#0c0c0c"/></g>`;
        const star = (x, y, r, a) => `<g transform="translate(${x},${y}) rotate(${a}) scale(${r / 20})">${[0, 1, 2, 3].map(i => `<path d="M0,0 L-5,-6 L0,-20 L5,-6Z" transform="rotate(${i * 90})" fill="url(#${u}silverh)"/>`).join('')}<circle r="3" fill="#222"/></g>`;
        s += star(48, 120, 13, 10) + star(276, 300, 10, 30) + star(30, 230, 8, 50);
        return s;
      }
      case 'kiseru': { // 朱槍＋煙管（前田慶次）
        return `<g transform="rotate(-24 ${CX} 210)">
          <rect x="62" y="0" width="7" height="460" rx="2" fill="#b0201a"/>
          <rect x="63" y="0" width="2" height="460" fill="#fff" opacity=".25"/>
          <rect x="60" y="58" width="11" height="10" fill="url(#${u}goldv)"/>
          <path d="M65.5,-50 L72,50 L65.5,58 L59,50Z" fill="url(#${u}silverh)"/>
        </g>`;
      }
      default: return '';
    }
  }

  /* ---------- 小札（さね）の段 ---------- */
  function lames(u, TL, TR, BL, BR, n, o) {
    let s = '';
    const bow = o.bow || 0;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = Math.min(1, (i + 1) / n + 0.015);
      const a = lp(TL, BL, t0), b = lp(TR, BR, t0), c2 = lp(TR, BR, t1), d = lp(TL, BL, t1);
      const m0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bow], m1 = [(c2[0] + d[0]) / 2, (c2[1] + d[1]) / 2 + bow];
      const top = `M${pt(a)} Q${pt(m0)} ${pt(b)}`;
      s += `<path d="${top} L${pt(c2)} Q${pt(m1)} ${pt(d)}Z" fill="url(#${u}lace)"/>`;
      s += `<path d="${top}" stroke="${o.edge}" stroke-width="3.2" fill="none"/>`;
      s += `<path d="${top}" stroke="${o.hi}" stroke-width=".9" fill="none" transform="translate(0,-1.1)" opacity=".9"/>`;
    }
    // 菱縫（最下段の赤い×）
    if (o.hishinui) {
      const a = lp(TL, BL, (n - 1) / n + .5 / n), b = lp(TR, BR, (n - 1) / n + .5 / n);
      const cnt = Math.max(3, Math.round(Math.abs(b[0] - a[0]) / 11));
      for (let k = 0; k < cnt; k++) {
        const p = lp(a, b, (k + .5) / cnt);
        const yy = p[1] + bow * (1 - Math.pow(2 * (k + .5) / cnt - 1, 2));
        s += `<path d="M${f(p[0] - 3)},${f(yy - 2.5)} L${f(p[0] + 3)},${f(yy + 2.5)} M${f(p[0] + 3)},${f(yy - 2.5)} L${f(p[0] - 3)},${f(yy + 2.5)}" stroke="#d8261c" stroke-width="1.6"/>`;
      }
    }
    return s;
  }

  /* ---------- 胴体 ---------- */
  function body(u, c) {
    const col = c.colors;
    const type = c.body || 'yoroi';
    const edge = shade(col.armor, -.15), hi = shade(col.armor, .55);
    let s = '';
    // 下地の肩（衣）
    const under = col.cloth || '#2a1d1a';
    s += `<path d="M138,262 C108,266 60,272 30,300 C16,316 8,360 4,${H} L316,${H} C312,360 304,316 290,300 C260,272 212,266 182,262Z" fill="${under}"/>`;

    if (type === 'yoroi' || type === 'cape' || type === 'female') {
      const fem = type === 'female';
      // 胴（前面）
      const dTL = [fem ? 108 : 98, 304], dTR = [fem ? 212 : 222, 304], dBL = [fem ? 102 : 92, 430], dBR = [fem ? 218 : 228, 430];
      // 胸板
      s += `<path d="M${dTL[0] - 2},${dTL[1] + 8} C${dTL[0]},286 128,${fem ? 286 : 282} 140,280 Q160,${fem ? 296 : 300} 180,280 C192,${fem ? 286 : 282} ${dTR[0]},286 ${dTR[0] + 2},${dTR[1] + 8} L${dBR[0]},${dBR[1]} L${dBL[0]},${dBL[1]}Z" fill="url(#${u}armor)"/>`;
      s += lames(u, [dTL[0], dTL[1] + 12], [dTR[0], dTR[1] + 12], dBL, dBR, 6, { bow: 10, edge, hi, hishinui: false });
      // 胸板の金縁
      s += `<path d="M${dTL[0] - 2},${dTL[1] + 8} C${dTL[0]},286 128,${fem ? 286 : 282} 140,280 Q160,${fem ? 296 : 300} 180,280 C192,${fem ? 286 : 282} ${dTR[0]},286 ${dTR[0] + 2},${dTR[1] + 8}" stroke="url(#${u}goldh)" stroke-width="2.4" fill="none"/>`;
      // 胴の立体陰影
      s += `<path d="M${dTL[0]},300 L${dTR[0]},300 L${dBR[0]},${H} L${dBL[0]},${H}Z" fill="url(#${u}cyl)"/>`;
      // 胸の家紋（金）
      if (c.chestMon !== false) s += `<g opacity=".95">${mon(c.mon, CX, 326, fem ? 12 : 14, 'url(#' + u + 'goldv)', shade(col.armor, -.4))}</g>`;

      // 袖（左右）
      const sw = fem ? 0.82 : 1;
      const sode = (s1) => {
        const TL = [X(s1, 52 * sw + 16), 286], TR = [X(s1, 132 * sw - 4), 280];
        const BL = [X(s1, 154 * sw), 420], BR = [X(s1, 64 * sw + 6), 426];
        // s1=-1 の時、TL 外側 / TR 内側
        const outerTop = [X(s1, 136 * sw), 284], innerTop = [X(s1, 58 * sw + 8), 276];
        const outerBot = [X(s1, 158 * sw), 424], innerBot = [X(s1, 66 * sw + 8), 430];
        let g = '';
        g += `<path d="M${pt(innerTop)} L${pt(outerTop)} L${pt(outerBot)} L${pt(innerBot)}Z" fill="url(#${u}armor)"/>`;
        g += lames(u, innerTop, outerTop, innerBot, outerBot, 6, { bow: 6, edge, hi, hishinui: !fem });
        g += `<path d="M${pt(innerTop)} L${pt(outerTop)} L${pt(outerBot)} L${pt(innerBot)}Z" fill="url(#${u}sodeShade${s1 < 0 ? 'L' : 'R'})"/>`;
        // 冠板（袖の最上部・金縁）
        g += `<path d="M${pt([innerTop[0] - s1 * 2, innerTop[1] - 2])} L${pt([outerTop[0] + s1 * 3, outerTop[1] - 2])} L${pt([outerTop[0] + s1 * 2, outerTop[1] + 10])} L${pt([innerTop[0], innerTop[1] + 10])}Z" fill="url(#${u}armor)" stroke="url(#${u}goldh)" stroke-width="1.8"/>`;
        void TL; void TR; void BL; void BR;
        return g;
      };
      s += sode(-1) + sode(1);

      // 肩上（綿噛）
      s += both(`M140,266 C126,268 116,274 106,284 L120,290 C126,282 134,276 146,274Z`, `fill="url(#${u}armor)" stroke="${shade(col.armor, -.5)}" stroke-width="1"`);
    }

    if (type === 'cape') {
      // 南蛮マント（信長）
      const cape = col.cape || '#1a0b10', lining = col.lining || '#b3121a';
      s += both(`M140,262 C100,260 44,276 18,316 C8,340 4,380 2,${H} L74,${H} C84,370 100,320 126,292 C132,284 138,276 146,272Z`, `fill="${cape}"`);
      s += both(`M74,${H} C84,370 100,320 126,292 C132,284 138,276 146,272 L141,270 C130,282 120,292 112,304 C96,330 82,370 66,${H}Z`, `fill="${lining}"`);
      s += both(`M140,262 C100,260 44,276 18,316 C8,340 4,380 2,${H} L74,${H} C84,370 100,320 126,292 C132,284 138,276 146,272Z`, `fill="url(#${u}clothShade)"`);
      // 立襟
      s += both(`M134,250 C122,246 112,250 104,262 C116,266 128,270 140,276 L146,262Z`, `fill="${lining}" stroke="url(#${u}goldh)" stroke-width="1.6"`);
      // 金の飾り鎖
      s += `<path d="M120,292 Q160,312 200,292" stroke="url(#${u}goldh)" stroke-width="2.4" fill="none" stroke-dasharray="4 2"/>`;
      s += `<circle cx="120" cy="292" r="5" fill="url(#${u}goldv)"/><circle cx="200" cy="292" r="5" fill="url(#${u}goldv)"/>`;
    }

    if (type === 'robe') {
      // 直垂・羽織（軍師）
      const robe = col.robe || '#2a3550', inner = col.inner || '#e9e2cf';
      s += `<path d="M136,262 C104,266 52,276 24,306 C12,322 6,360 2,${H} L318,${H} C314,360 308,322 296,306 C268,276 216,266 184,262Z" fill="${robe}"/>`;
      s += `<path d="M136,262 C104,266 52,276 24,306 C12,322 6,360 2,${H} L318,${H} C314,360 308,322 296,306 C268,276 216,266 184,262Z" fill="url(#${u}robeShade)"/>`;
      // 衣の皺
      s += `<path d="M60,300 C70,340 66,380 70,${H} M100,290 C110,330 104,380 110,${H} M260,300 C250,340 254,380 250,${H} M222,290 C212,330 218,380 212,${H}" stroke="${shade(robe, -.45)}" stroke-width="2.2" fill="none" opacity=".7"/>`;
      s += `<path d="M64,302 C74,340 70,380 74,${H} M226,292 C216,330 222,380 216,${H}" stroke="${shade(robe, .3)}" stroke-width="1" fill="none" opacity=".5"/>`;
      // 襟（重ね）
      s += `<path d="M138,262 L160,330 L182,262 L172,262 L160,300 L148,262Z" fill="${inner}"/>`;
      s += `<path d="M126,266 L160,350 L194,266 L182,262 L160,330 L138,262Z" fill="${shade(robe, -.35)}"/>`;
      s += `<path d="M116,272 L160,372 L204,272 L194,266 L160,350 L126,266Z" fill="${col.trim || shade(robe, .25)}"/>`;
      // 背紋・袖紋
      s += mon(c.mon, 70, 332, 14, col.monColor || '#f1e7c9', robe);
      s += mon(c.mon, 250, 332, 14, col.monColor || '#f1e7c9', robe);
      // 羽織紐
      s += `<path d="M146,360 Q160,372 174,360" stroke="${col.accent}" stroke-width="3" fill="none"/><circle cx="160" cy="368" r="4.5" fill="${col.accent}"/>`;
    }

    if (type === 'ninja') {
      const g1 = '#1b1d24';
      s += `<path d="M136,262 C104,266 52,276 24,306 C12,322 6,360 2,${H} L318,${H} C314,360 308,322 296,306 C268,276 216,266 184,262Z" fill="${g1}"/>`;
      s += `<path d="M136,262 C104,266 52,276 24,306 C12,322 6,360 2,${H} L318,${H} C314,360 308,322 296,306 C268,276 216,266 184,262Z" fill="url(#${u}robeShade)"/>`;
      s += `<path d="M126,268 L160,360 L194,268 L184,264 L160,334 L136,264Z" fill="#2c303a"/>`;
      // 鎖帷子
      s += `<path d="M144,272 L160,320 L176,272Z" fill="url(#${u}chain)"/>`;
      // 肩当て
      s += both(`M70,288 C90,276 118,272 134,276 L128,300 C108,298 88,302 72,312Z`, `fill="url(#${u}blackh)" stroke="#555" stroke-width="1"`);
      // 帯
      s += `<path d="M36,404 C100,396 220,396 284,404 L286,${H} L34,${H}Z" fill="#5a1a1a"/>`;
    }

    if (type === 'kabuki') {
      // 傾奇者の派手な小袖と毛皮
      const k = col.robe || '#2d1b4e';
      s += `<path d="M136,262 C104,266 52,276 24,306 C12,322 6,360 2,${H} L318,${H} C314,360 308,322 296,306 C268,276 216,266 184,262Z" fill="${k}"/>`;
      // 大柄（髑髏ではなく、大輪の牡丹と稲妻）
      const flower = (x, y, r, cc) => {
        let p = '';
        for (let i = 0; i < 8; i++) p += `<ellipse cx="0" cy="${-r * .5}" rx="${r * .35}" ry="${r * .55}" transform="rotate(${i * 45})" fill="${cc}"/>`;
        return `<g transform="translate(${x},${y})">${p}<circle r="${r * .28}" fill="#f6d36b"/></g>`;
      };
      s += flower(60, 340, 34, '#d6336c') + flower(262, 330, 30, '#f08c00') + flower(130, 410, 26, '#e64980') + flower(210, 400, 22, '#ffd43b');
      s += `<path d="M10,300 L40,330 L26,336 L58,370 M300,300 L270,326 L286,332 L256,368" stroke="#7ad3ff" stroke-width="5" fill="none" stroke-linejoin="bevel"/>`;
      s += `<path d="M136,262 C104,266 52,276 24,306 C12,322 6,360 2,${H} L318,${H} C314,360 308,322 296,306 C268,276 216,266 184,262Z" fill="url(#${u}robeShade)"/>`;
      // 襟
      s += `<path d="M126,266 L160,350 L194,266 L182,262 L160,330 L138,262Z" fill="#111"/>`;
      s += `<path d="M138,262 L160,330 L182,262 L172,262 L160,300 L148,262Z" fill="#f2e9d8"/>`;
      // 毛皮の襟巻き（虎）
      s += `<path d="M100,270 C120,252 140,258 160,262 C180,258 200,252 220,270 C238,286 226,304 206,300 C190,296 176,292 160,292 C144,292 130,296 114,300 C94,304 82,286 100,270Z" fill="#e8a33a"/>`;
      s += `<path d="M110,272 l8,16 M128,264 l4,18 M150,264 l0,20 M170,264 l0,20 M192,264 l-4,18 M210,272 l-8,16" stroke="#2a1a0a" stroke-width="3.4" stroke-linecap="round"/>`;
      s += `<path d="M100,270 C120,252 140,258 160,262 C180,258 200,252 220,270 C238,286 226,304 206,300 C190,296 176,292 160,292 C144,292 130,296 114,300 C94,304 82,286 100,270Z" fill="url(#${u}robeShade)"/>`;
    }

    // 襟（鎧の下の小袖）
    if (type === 'yoroi' || type === 'female') {
      const fem = type === 'female';
      const under = col.under || shade(col.lace, -.2);
      // 小袖の襟（首まわりを包む）
      s += `<path d="M${fem ? 128 : 120},266 C${fem ? 132 : 126},252 ${fem ? 142 : 136},250 ${fem ? 146 : 140},256 L160,${fem ? 300 : 298} L${fem ? 174 : 180},256 C${fem ? 178 : 184},250 ${fem ? 188 : 194},252 ${fem ? 192 : 200},266 L160,${fem ? 316 : 314}Z" fill="${under}"/>`;
      s += `<path d="M${fem ? 128 : 120},266 C${fem ? 132 : 126},252 ${fem ? 142 : 136},250 ${fem ? 146 : 140},256 L160,${fem ? 300 : 298} L${fem ? 174 : 180},256 C${fem ? 178 : 184},250 ${fem ? 188 : 194},252 ${fem ? 192 : 200},266 L160,${fem ? 316 : 314}Z" fill="url(#${u}clothShade)"/>`;
      s += `<path d="M${fem ? 140 : 134},258 C${fem ? 143 : 138},254 ${fem ? 146 : 142},254 ${fem ? 148 : 144},258 L160,${fem ? 290 : 288} L${fem ? 172 : 176},258 C${fem ? 174 : 178},254 ${fem ? 177 : 182},254 ${fem ? 180 : 186},258 L160,${fem ? 302 : 300}Z" fill="${col.collar || '#f1ead8'}"/>`;
    }
    if (type === 'cape') {
      s += `<path d="M140,262 L160,296 L180,262 L172,262 L160,284 L148,262Z" fill="#f1ead8"/>`;
      s += `<path d="M132,264 L160,306 L188,264 L180,262 L160,296 L140,262Z" fill="${col.under || '#3a0e12'}"/>`;
    }

    // 数珠（本多忠勝）
    if (c.juzu) {
      let beads = '';
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const x = lerp(96, 236, t), y = 280 + Math.sin(t * Math.PI) * 120 - t * 10;
        beads += `<circle cx="${f(x)}" cy="${f(y)}" r="7.4" fill="url(#${u}bead)"/>`;
      }
      s += `<g>${beads}</g>`;
      s += `<circle cx="168" cy="${f(280 + Math.sin(.5 * Math.PI) * 120 - 5)}" r="10.5" fill="url(#${u}bead)"/>`;
    }
    return s;
  }

  /* ---------- 錣（しころ） ---------- */
  function shikoro(u, c) {
    const hm = c.helmet;
    if (!hm || !['kabuto', 'gokei', 'eboshi', 'shaguma'].includes(hm.type)) return '';
    const col = c.colors;
    const edge = shade(hm.metalColor, -.1), hi = shade(hm.metalColor, .6);
    let s = '';
    const n = hm.shikoro || 4;
    for (let i = n - 1; i >= 0; i--) {
      const y0 = 128 + i * 20, y1 = y0 + 30;
      const w0 = 60 + i * 15, w1 = 70 + i * 18;
      s += `<path d="M${CX - w0},${y0} Q${CX},${y0 - 14} ${CX + w0},${y0} L${CX + w1},${y1} Q${CX},${y1 + 10} ${CX - w1},${y1}Z" fill="url(#${u}laceH)"/>`;
      s += `<path d="M${CX - w1},${y1} Q${CX},${y1 + 10} ${CX + w1},${y1}" stroke="${edge}" stroke-width="3.6" fill="none"/>`;
      s += `<path d="M${CX - w1},${y1} Q${CX},${y1 + 10} ${CX + w1},${y1}" stroke="${hi}" stroke-width="1" fill="none" transform="translate(0,-1.6)"/>`;
      s += `<path d="M${CX - w0},${y0} Q${CX},${y0 - 14} ${CX + w0},${y0} L${CX + w1},${y1} Q${CX},${y1 + 10} ${CX - w1},${y1}Z" fill="url(#${u}shikoroShade)"/>`;
    }
    void col;
    return s;
  }

  /* ---------- 白熊（武田信玄の兜毛） ---------- */
  function shaguma(u, c, rnd) {
    if (!c.helmet || c.helmet.type !== 'shaguma') return '';
    let s = '';
    const base = `<path d="M${CX},64 C100,66 66,120 46,200 C30,260 22,330 20,${H} L300,${H} C298,330 290,260 274,200 C254,120 220,66 ${CX},64Z" fill="url(#${u}mane)"/>`;
    s += base;
    for (let i = 0; i < 90; i++) {
      const side = rnd() < .5 ? -1 : 1;
      const sx = CX + side * (10 + rnd() * 50), sy = 70 + rnd() * 30;
      const ex = CX + side * (60 + rnd() * 110), ey = 240 + rnd() * 190;
      const cx1 = CX + side * (40 + rnd() * 80), cy1 = 120 + rnd() * 60;
      s += `<path d="M${f(sx)},${f(sy)} Q${f(cx1)},${f(cy1)} ${f(ex)},${f(ey)}" stroke="${rnd() < .3 ? '#cfcac0' : '#ffffff'}" stroke-width="${f(.8 + rnd() * 1.8)}" fill="none" opacity="${f(.5 + rnd() * .5)}"/>`;
    }
    return s;
  }

  /* ---------- 頭巾（上杉謙信 / 忍） 後ろ側 ---------- */
  function hoodBack(u, c) {
    const hm = c.helmet;
    if (!hm || (hm.type !== 'hood' && hm.type !== 'ninja')) return '';
    const col = hm.type === 'hood' ? (hm.color || '#f4f3ee') : '#1c1e26';
    return `<path d="M${CX - 58},170 C${CX - 64},104 ${CX - 32},72 ${CX},72 C${CX + 32},72 ${CX + 64},104 ${CX + 58},170 C${CX + 66},222 ${CX + 74},262 ${CX + 92},300 C${CX + 40},310 ${CX - 40},310 ${CX - 92},300 C${CX - 74},262 ${CX - 66},222 ${CX - 58},170Z" fill="${col}"/>
      <path d="M${CX - 58},170 C${CX - 64},104 ${CX - 32},72 ${CX},72 C${CX + 32},72 ${CX + 64},104 ${CX + 58},170 C${CX + 66},222 ${CX + 74},262 ${CX + 92},300 C${CX + 40},310 ${CX - 40},310 ${CX - 92},300 C${CX - 74},262 ${CX - 66},222 ${CX - 58},170Z" fill="url(#${u}hoodShade)"/>
      <path d="M${CX - 70},240 C${CX - 60},270 ${CX - 70},290 ${CX - 84},298 M${CX + 70},240 C${CX + 60},270 ${CX + 70},290 ${CX + 84},298 M${CX - 30},280 C${CX - 26},292 ${CX - 30},300 ${CX - 36},306 M${CX + 30},280 C${CX + 26},292 ${CX + 30},300 ${CX + 36},306" stroke="${shade(col, -.3)}" stroke-width="2" fill="none" opacity=".6"/>`;
  }

  /* ---------- 顔 ---------- */
  function faceGeom(c) {
    const fc = c.face || {};
    const fem = !!fc.female;
    const jaw = fc.jaw != null ? fc.jaw : .5;
    const fw = fem ? 40 : (fc.wide ? 47 : 44);
    const chinY = fem ? 244 : 250 + (fc.long ? 4 : 0);
    const top = 110;
    const jawY = 226 + jaw * 6;
    const jawX = fw - (fem ? 14 : 12 - jaw * 7);
    const chinW = fem ? 10 : 13 + jaw * 7;
    const d = `M${CX - fw},166 C${CX - fw},${196} ${CX - jawX},${jawY - 8} ${CX - jawX + 4},${jawY} C${CX - jawX + 10},${jawY + 10} ${CX - chinW - 6},${chinY - 4} ${CX - chinW},${chinY - 2} Q${CX},${chinY + 4} ${CX + chinW},${chinY - 2} C${CX + chinW + 6},${chinY - 4} ${CX + jawX - 10},${jawY + 10} ${CX + jawX - 4},${jawY} C${CX + jawX},${jawY - 8} ${CX + fw},${196} ${CX + fw},166 C${CX + fw},128 ${CX + 26},${top} ${CX},${top} C${CX - 26},${top} ${CX - fw},128 ${CX - fw},166Z`;
    return { d, fw, chinY, jawY, jawX, fem, fc };
  }

  function face(u, c, rnd) {
    const G = faceGeom(c);
    const fc = G.fc;
    const skin = fc.skin || '#e7b48e';
    const hair = fc.hairColor || '#16110f';
    const hm = c.helmet || { type: 'none' };
    const age = fc.age || 0;
    let s = '';

    // 首
    const nw = G.fem ? 19 : 25;
    s += `<path d="M${CX - nw + 2},214 C${CX - nw},240 ${CX - nw - 2},258 ${CX - nw - 8},276 Q${CX},290 ${CX + nw + 8},276 C${CX + nw + 2},258 ${CX + nw},240 ${CX + nw - 2},214Z" fill="${shade(skin, -.12)}"/>`;
    s += `<path d="M${CX - nw - 8},214 L${CX - nw - 8},276 Q${CX},290 ${CX + nw + 8},276 L${CX + nw + 8},214Z" fill="url(#${u}neckShade)" clip-path="url(#${u}neckClip)"/>`;
    s += `<clipPath id="${u}neckClip"><path d="M${CX - nw + 2},214 C${CX - nw},240 ${CX - nw - 2},258 ${CX - nw - 8},276 Q${CX},290 ${CX + nw + 8},276 C${CX + nw + 2},258 ${CX + nw},240 ${CX + nw - 2},214Z"/></clipPath>`;
    if (!G.fem) s += `<path d="M${CX - 8},262 Q${CX},270 ${CX + 8},262" stroke="${shade(skin, -.4)}" stroke-width="1.4" fill="none" opacity=".45"/>`;
    s += `<path d="M${CX - 14},250 C${CX - 10},262 ${CX - 12},270 ${CX - 20},276 M${CX + 14},250 C${CX + 10},262 ${CX + 12},270 ${CX + 20},276" stroke="${shade(skin, -.35)}" stroke-width="1.4" fill="none" opacity=".45"/>`;

    // 耳
    if (!['hood', 'ninja'].includes(hm.type)) {
      s += both(`M${X(-1, G.fw - 1)},170 C${X(-1, G.fw + 10)},160 ${X(-1, G.fw + 13)},180 ${X(-1, G.fw + 9)},192 C${X(-1, G.fw + 6)},200 ${X(-1, G.fw + 1)},202 ${X(-1, G.fw - 2)},198Z`, `fill="${shade(skin, -.06)}"`);
      s += both(`M${X(-1, G.fw + 1)},174 C${X(-1, G.fw + 8)},170 ${X(-1, G.fw + 9)},182 ${X(-1, G.fw + 5)},190`, `stroke="${shade(skin, -.4)}" stroke-width="1.6" fill="none" opacity=".7"`);
    }

    // 顔の土台
    const fill = fc.makeup ? '#f7f1ea' : `url(#${u}skin)`;
    s += `<path d="${G.d}" fill="${fill}"/>`;

    // ---- 陰影（顔でクリップ） ----
    let sh = '';
    const shadowC = fc.makeup ? '#9a8f9a' : '#5a2410';
    sh += `<path d="${G.d}" fill="url(#${u}faceShade)"/>`;
    sh += `<path d="${G.d}" fill="url(#${u}faceForm)"/>`;
    // 顎のライン（影側）
    sh += `<path d="M${CX + G.fw},180 C${CX + G.fw - 2},214 ${CX + 24},${G.chinY - 6} ${CX},${G.chinY + 2}" stroke="${shadowC}" stroke-width="8" fill="none" opacity=".16" filter="url(#pf-soft)"/>`;
    // 頬骨の下の陰
    sh += `<ellipse cx="${CX - 32}" cy="206" rx="7" ry="18" fill="${shadowC}" opacity="${G.fem ? .06 : .16}" filter="url(#pf-soft)"/>`;
    sh += `<ellipse cx="${CX + 32}" cy="206" rx="8" ry="20" fill="${shadowC}" opacity="${G.fem ? .1 : .24}" filter="url(#pf-soft)"/>`;
    // 眼窩
    sh += `<ellipse cx="${CX - 21}" cy="172" rx="16" ry="9" fill="${shadowC}" opacity=".16" filter="url(#pf-soft)"/>`;
    sh += `<ellipse cx="${CX + 21}" cy="172" rx="16" ry="9" fill="${shadowC}" opacity=".2" filter="url(#pf-soft)"/>`;
    // 鼻の影
    sh += `<path d="M${CX + 2},170 C${CX + 6},182 ${CX + 10},194 ${CX + 9},202 L${CX + 2},202Z" fill="${shadowC}" opacity=".22" filter="url(#pf-soft2)"/>`;
    // 顎下
    sh += `<ellipse cx="${CX}" cy="${G.chinY + 6}" rx="30" ry="10" fill="${shadowC}" opacity=".25" filter="url(#pf-soft)"/>`;
    // 頬の血色
    if (!fc.makeup) {
      sh += `<ellipse cx="${CX - 27}" cy="198" rx="11" ry="7" fill="#e0604a" opacity="${G.fem ? .22 : .1}" filter="url(#pf-soft)"/>`;
      sh += `<ellipse cx="${CX + 27}" cy="198" rx="11" ry="7" fill="#e0604a" opacity="${G.fem ? .2 : .08}" filter="url(#pf-soft)"/>`;
    } else {
      sh += `<ellipse cx="${CX - 26}" cy="198" rx="10" ry="6" fill="#ff7a8a" opacity=".28" filter="url(#pf-soft)"/>`;
      sh += `<ellipse cx="${CX + 26}" cy="198" rx="10" ry="6" fill="#ff7a8a" opacity=".28" filter="url(#pf-soft)"/>`;
    }
    // 額のハイライト
    sh += `<ellipse cx="${CX - 10}" cy="150" rx="18" ry="8" fill="#fff" opacity=".16" filter="url(#pf-soft)"/>`;
    sh += `<ellipse cx="${CX - 2}" cy="188" rx="2.6" ry="10" fill="#fff" opacity=".22" filter="url(#pf-soft2)"/>`;
    sh += `<ellipse cx="${CX - 30}" cy="186" rx="8" ry="5" fill="#fff" opacity=".12" filter="url(#pf-soft)"/>`;
    // 兜の庇の影
    if (['kabuto', 'gokei', 'eboshi', 'shaguma'].includes(hm.type)) {
      sh += `<rect x="${CX - 60}" y="120" width="120" height="48" fill="url(#${u}brimShadow)"/>`;
    }
    // 無精髭
    if (fc.stubble) {
      sh += `<path d="M${CX - 34},214 C${CX - 30},240 ${CX - 14},254 ${CX},256 C${CX + 14},254 ${CX + 30},240 ${CX + 34},214 C${CX + 20},224 ${CX + 10},206 ${CX},206 C${CX - 10},206 ${CX - 20},224 ${CX - 34},214Z" fill="#2a3440" opacity=".14" filter="url(#pf-soft2)"/>`;
    }
    // 皺（年齢）
    if (age > 0) {
      const o = (.2 + age * .35).toFixed(2);
      sh += both(`M${X(-1, 10)},203 C${X(-1, 18)},210 ${X(-1, 21)},218 ${X(-1, 20)},228`, `stroke="${shade(skin, -.45)}" stroke-width="1.4" fill="none" opacity="${o}"`);
      sh += both(`M${X(-1, 12)},186 C${X(-1, 18)},189 ${X(-1, 26)},189 ${X(-1, 31)},185`, `stroke="${shade(skin, -.4)}" stroke-width="1" fill="none" opacity="${o}"`);
      if (age > .5) {
        sh += both(`M${X(-1, 34)},174 l5,-2 M${X(-1, 34)},178 l6,1`, `stroke="${shade(skin, -.4)}" stroke-width=".9" fill="none" opacity="${o}"`);
        sh += `<path d="M${CX - 18},146 Q${CX},142 ${CX + 18},146 M${CX - 14},140 Q${CX},136 ${CX + 14},140" stroke="${shade(skin, -.35)}" stroke-width="1" fill="none" opacity="${o}"/>`;
      }
      sh += `<path d="M${CX - 5},164 L${CX - 3},158 M${CX + 5},164 L${CX + 3},158" stroke="${shade(skin, -.45)}" stroke-width="1.1" opacity="${o}"/>`;
    }
    // 傷
    if (fc.scar) {
      sh += `<path d="M${CX + 14},142 L${CX + 36},176" stroke="#8a3a2a" stroke-width="2.2" opacity=".7"/>`;
      sh += `<path d="M${CX + 15},141 L${CX + 37},175" stroke="#f3c7a8" stroke-width=".8" opacity=".8"/>`;
      sh += `<path d="M${CX - 34},196 L${CX - 18},214" stroke="#8a3a2a" stroke-width="2" opacity=".6"/>`;
      for (let i = 0; i < 4; i++) sh += `<path d="M${f(CX + 18 + i * 5)},${f(146 + i * 7.5)} l4,-3" stroke="#8a3a2a" stroke-width="1" opacity=".55"/>`;
    }
    // リムライト（左上からの光）
    sh += `<path d="${G.d}" fill="none" stroke="${c.rimLight || '#fff1d0'}" stroke-width="3" opacity=".35" transform="translate(2.5,1.5)" filter="url(#pf-soft3)"/>`;
    s += `<g clip-path="url(#${u}faceClip)">${sh}</g>`;
    // 兜の下の鬢（もみあげ）
    if (['kabuto', 'gokei', 'eboshi', 'shaguma', 'court'].includes(hm.type)) {
      const hc = fc.hairColor || '#16110f';
      s += both(`M${X(-1, G.fw + 1)},146 C${X(-1, G.fw + 3)},160 ${X(-1, G.fw + 1)},176 ${X(-1, G.fw - 2)},${hm.type === 'court' ? 196 : 186} C${X(-1, G.fw - 5)},176 ${X(-1, G.fw - 6)},162 ${X(-1, G.fw - 10)},148Z`, `fill="${hc}"`);
      s += both(`M${X(-1, G.fw - 1)},150 C${X(-1, G.fw)},162 ${X(-1, G.fw - 1)},172 ${X(-1, G.fw - 2)},182`, `stroke="${shade(hc, .5)}" stroke-width=".7" fill="none" opacity=".5"`);
    }

    // ---- 眉 ----
    const browStyle = fc.brow || 'fierce';
    const bcol = fc.browColor || hair;
    if (browStyle === 'court') {
      s += `<ellipse cx="${CX - 18}" cy="142" rx="7" ry="3.6" fill="#2a2228" opacity=".9" filter="url(#pf-soft3)"/><ellipse cx="${CX + 18}" cy="142" rx="7" ry="3.6" fill="#2a2228" opacity=".9" filter="url(#pf-soft3)"/>`;
    } else {
      let bd;
      if (browStyle === 'fierce') bd = `M${X(-1, 6)},165 Q${X(-1, 20)},155 ${X(-1, 38)},150 L${X(-1, 37)},154 Q${X(-1, 22)},161 ${X(-1, 7)},170Z`;
      else if (browStyle === 'calm') bd = `M${X(-1, 7)},163 Q${X(-1, 22)},157 ${X(-1, 37)},158 L${X(-1, 36)},161 Q${X(-1, 22)},161 ${X(-1, 8)},167Z`;
      else if (browStyle === 'thick') bd = `M${X(-1, 5)},165 Q${X(-1, 20)},153 ${X(-1, 39)},152 L${X(-1, 38)},158 Q${X(-1, 22)},161 ${X(-1, 6)},172Z`;
      else if (browStyle === 'kind') bd = `M${X(-1, 7)},161 Q${X(-1, 22)},155 ${X(-1, 37)},161 L${X(-1, 36)},163.5 Q${X(-1, 22)},159 ${X(-1, 8)},164.5Z`;
      else bd = `M${X(-1, 8)},162 Q${X(-1, 22)},154 ${X(-1, 36)},157 L${X(-1, 35)},158.6 Q${X(-1, 22)},157 ${X(-1, 9)},164Z`; // thin/female
      s += both(bd, `fill="${bcol}"`);
      // 眉毛の毛流れ
      if (browStyle !== 'thin') {
        let hairs = '';
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const x0 = 8 + t * 27, y0 = (browStyle === 'fierce' || browStyle === 'thick') ? 168 - t * 15 : 165 - t * 5;
          hairs += `M${X(-1, x0)},${f(y0)} l${-3.5},${-3} `;
        }
        s += both(hairs, `stroke="${shade(bcol, .25)}" stroke-width=".7" opacity=".6"`);
      }
    }

    // ---- 眼 ----
    const eyeStyle = fc.eyes || 'sharp';
    const tilt = { sharp: 4.5, calm: 1.5, narrow: 3.5, soft: -.5, female: 2, wide: 0 }[eyeStyle] ?? 2;
    const eh = { sharp: 8, calm: 8.2, narrow: 5.6, soft: 8.6, female: 10, wide: 9.5 }[eyeStyle] ?? 8;
    const irisC = fc.iris || '#3a2216';
    const eye = (sd) => {
      const ix = 8, ox = 34;
      const iy = 178.5, oy = 176 - tilt;
      const shape = `M${X(sd, ix)},${iy} C${X(sd, 12)},${f(iy - eh * 1.05)} ${X(sd, 26)},${f(iy - eh * 1.25)} ${X(sd, ox)},${oy} C${X(sd, 28)},${f(iy + eh * .6)} ${X(sd, 15)},${f(iy + eh * .6)} ${X(sd, ix)},${iy}Z`;
      const id = `${u}eye${sd < 0 ? 'L' : 'R'}`;
      const icx = X(sd, 20.5), icy = 177 - tilt * .25;
      const ir = G.fem ? 6.6 : 5.9;
      let e = '';
      // 眼の周りの柔らかい影（アイホール）
      e += `<path d="M${X(sd, ix - 3)},${iy + 1} C${X(sd, 10)},${iy - eh * 2} ${X(sd, 30)},${iy - eh * 2.2} ${X(sd, ox + 4)},${oy - 1}" stroke="${shade(skin, -.35)}" stroke-width="5" fill="none" opacity=".25" filter="url(#pf-soft3)"/>`;
      e += `<clipPath id="${id}"><path d="${shape}"/></clipPath>`;
      e += `<path d="${shape}" fill="#f8f2ea"/>`;
      e += `<g clip-path="url(#${id})">
        <path d="${shape}" fill="url(#${u}scleraShade)"/>
        <circle cx="${f(icx)}" cy="${f(icy)}" r="${ir}" fill="url(#${u}iris)"/>
        <circle cx="${f(icx)}" cy="${f(icy)}" r="${f(ir - .6)}" fill="none" stroke="${shade(irisC, .5)}" stroke-width=".5" stroke-dasharray=".6 1.1" opacity=".7"/>
        <circle cx="${f(icx)}" cy="${f(icy)}" r="${ir}" fill="none" stroke="#120806" stroke-width="1.1"/>
        <circle cx="${f(icx)}" cy="${f(icy)}" r="${f(ir * .45)}" fill="#040101"/>
        <rect x="${X(sd, 0) - 40}" y="${iy - 22}" width="80" height="${f(eh * .5 + 15)}" fill="#2a1408" opacity=".28"/>
        <ellipse cx="${f(icx - 2.2)}" cy="${f(icy - 2.4)}" rx="1.9" ry="1.6" fill="#fff"/>
        <circle cx="${f(icx + 2.3)}" cy="${f(icy + 2.2)}" r=".9" fill="#fff" opacity=".75"/>
        <ellipse cx="${X(sd, ix + 1)}" cy="${iy}" rx="2.4" ry="2" fill="#d98a80" opacity=".6"/>
      </g>`;
      // 上瞼（太く、目尻へ抜ける）
      e += `<path d="M${X(sd, ix - .5)},${iy + .3} C${X(sd, 12)},${f(iy - eh * 1.12)} ${X(sd, 26)},${f(iy - eh * 1.32)} ${X(sd, ox + 2)},${oy - .3} L${X(sd, ox + 1)},${oy + 1.6} C${X(sd, 26)},${f(iy - eh * 1.05)} ${X(sd, 13)},${f(iy - eh * .92)} ${X(sd, ix + .5)},${iy + 1}Z" fill="#160a06"/>`;
      if (G.fem) e += `<path d="M${X(sd, ox)},${oy} l${sd * 5.5},-3.6 M${X(sd, ox - 3)},${oy - 2.6} l${sd * 4.5},-4 M${X(sd, ox - 6.5)},${oy - 4.4} l${sd * 3},-4" stroke="#160a06" stroke-width="1.3" stroke-linecap="round"/>`;
      else e += `<path d="M${X(sd, ox + 1)},${oy} l${sd * 3.6},-1.6" stroke="#160a06" stroke-width="1.9" stroke-linecap="round"/>`;
      // 二重線
      e += `<path d="M${X(sd, ix + 2.5)},${iy - 4} C${X(sd, 13)},${f(iy - eh * 1.5)} ${X(sd, 26)},${f(iy - eh * 1.75)} ${X(sd, ox - 1)},${oy - 3.6}" stroke="${shade(skin, -.5)}" stroke-width="1.05" fill="none" opacity=".75"/>`;
      // 下瞼
      e += `<path d="M${X(sd, ix + 3)},${iy + 1.4} C${X(sd, 15)},${f(iy + eh * .68)} ${X(sd, 27)},${f(iy + eh * .62)} ${X(sd, ox - 1)},${oy + 1.6}" stroke="${shade(skin, -.45)}" stroke-width="1" fill="none" opacity=".75"/>`;
      e += `<path d="M${X(sd, 24)},${f(iy + eh * .55)} C${X(sd, 28)},${f(iy + eh * .45)} ${X(sd, 31)},${oy + 3} ${X(sd, ox - 1)},${oy + 1.6}" stroke="#160a06" stroke-width="1" fill="none" opacity=".6"/>`;
      if (age > .4) e += `<path d="M${X(sd, ix + 5)},${iy + 5} Q${X(sd, 21)},${iy + eh + 4} ${X(sd, ox - 3)},${oy + 6}" stroke="${shade(skin, -.35)}" stroke-width=".8" fill="none" opacity=".55"/>`;
      return e;
    };
    const patch = fc.eyepatch;
    const drawEye = (sd) => {
      const side = sd < 0 ? 'left' : 'right'; // 画面上の左右
      if (patch === side) {
        return `<path d="M${X(sd, 6)},166 C${X(sd, 8)},156 ${X(sd, 36)},156 ${X(sd, 38)},170 C${X(sd, 38)},186 ${X(sd, 26)},192 ${X(sd, 20)},192 C${X(sd, 10)},192 ${X(sd, 4)},180 ${X(sd, 6)},166Z" fill="url(#${u}patch)"/>
          <path d="M${X(sd, 6)},166 C${X(sd, 8)},156 ${X(sd, 36)},156 ${X(sd, 38)},170" stroke="#4a4a52" stroke-width="1" fill="none"/>
          <path d="M${X(sd, 36)},165 L${X(sd, 50)},150 M${X(sd, 6)},168 C${X(sd, -10)},150 ${X(-sd, 30)},140 ${X(-sd, 48)},140" stroke="#1a1a1a" stroke-width="2.2" fill="none"/>`;
      }
      return eye(sd);
    };
    s += drawEye(-1) + drawEye(1);
    // irisカラー定義
    s += `<radialGradient id="${u}iris" cx="50%" cy="65%" r="60%"><stop offset="0" stop-color="${shade(irisC, .45)}"/><stop offset=".6" stop-color="${irisC}"/><stop offset="1" stop-color="${shade(irisC, -.6)}"/></radialGradient>`;

    // ---- 鼻 ----
    const nd = shade(skin, -.45);
    // 鼻筋の影（右側）とハイライト（左側）
    s += `<path d="M${CX + 3},168 C${CX + 5},180 ${CX + 7},190 ${CX + 8},197" stroke="${shade(skin, -.3)}" stroke-width="3.2" fill="none" opacity=".35" filter="url(#pf-soft3)"/>`;
    s += `<path d="M${CX - 2},170 C${CX - 3},180 ${CX - 3},188 ${CX - 2},194" stroke="#fff" stroke-width="2" fill="none" opacity=".22" filter="url(#pf-soft3)"/>`;
    // 鼻翼
    s += `<path d="M${CX - 7.5},193 C${CX - 11},196 ${CX - 10.5},201 ${CX - 6},202" stroke="${nd}" stroke-width="1.2" fill="none" opacity=".7" stroke-linecap="round"/>`;
    s += `<path d="M${CX + 7.5},193 C${CX + 11},196 ${CX + 10.5},201 ${CX + 6},202" stroke="${nd}" stroke-width="1.3" fill="none" opacity=".85" stroke-linecap="round"/>`;
    // 鼻先と鼻孔
    s += `<path d="M${CX - 5},203 Q${CX},205.5 ${CX + 5},203" stroke="${nd}" stroke-width="1" fill="none" opacity=".45" stroke-linecap="round"/>`;
    s += `<ellipse cx="${CX - 3.8}" cy="202.2" rx="2" ry="1" fill="${shade(skin, -.65)}" opacity=".65" transform="rotate(12 ${CX - 3.8} 202.2)"/>`;
    s += `<ellipse cx="${CX + 3.8}" cy="202.2" rx="2" ry="1" fill="${shade(skin, -.65)}" opacity=".7" transform="rotate(-12 ${CX + 3.8} 202.2)"/>`;
    s += `<ellipse cx="${CX - 1}" cy="198" rx="3" ry="2" fill="#fff" opacity=".28" filter="url(#pf-soft3)"/>`;
    // 鼻の下の落ち影
    s += `<ellipse cx="${CX + 2}" cy="207.5" rx="8" ry="2.6" fill="${shade(skin, -.5)}" opacity=".3" filter="url(#pf-soft3)"/>`;

    // ---- 口 ----
    const mouth = fc.mouth || 'stern';
    const lip = fc.makeup ? '#c81e3a' : (G.fem ? '#c25a5a' : shade(skin, -.38));
    let md;
    if (mouth === 'smile') md = `M${CX - 15},218 Q${CX},229 ${CX + 15},218`;
    else if (mouth === 'smirk') md = `M${CX - 13},222 Q${CX + 2},223 ${CX + 15},216`;
    else if (mouth === 'grin') md = `M${CX - 16},217 Q${CX},232 ${CX + 16},217`;
    else if (mouth === 'calm') md = `M${CX - 11},221 Q${CX},222.5 ${CX + 11},221`;
    else md = `M${CX - 13},222 Q${CX},219.5 ${CX + 13},222`;
    // 人中（柔らかい窪み）
    s += `<path d="M${CX - 2.5},208 L${CX - 3},216 L${CX + 3},216 L${CX + 2.5},208Z" fill="${shade(skin, -.3)}" opacity=".18" filter="url(#pf-soft3)"/>`;
    // 上唇・下唇の量感（男性も控えめに）
    if (!G.fem && !fc.makeup && mouth !== 'grin') {
      s += `<path d="M${CX - 12},221.5 Q${CX - 5},217.5 ${CX},219 Q${CX + 5},217.5 ${CX + 12},221.5Z" fill="${shade(skin, -.28)}" opacity=".45"/>`;
      s += `<path d="M${CX - 9},223 Q${CX},230 ${CX + 9},223Z" fill="${mix(skin, '#c06050', .2)}" opacity=".5"/>`;
      s += `<ellipse cx="${CX - 1}" cy="225.5" rx="4" ry="1.2" fill="#fff" opacity=".22"/>`;
    }
    if (mouth === 'grin') {
      s += `<path d="M${CX - 15},218 Q${CX},231 ${CX + 15},218 Q${CX},222 ${CX - 15},218Z" fill="#fff"/>`;
    }
    if (G.fem || fc.makeup) {
      s += `<path d="M${CX - 11},221 Q${CX - 5},217 ${CX},219 Q${CX + 5},217 ${CX + 11},221 Q${CX},229 ${CX - 11},221Z" fill="${lip}" opacity="${fc.makeup ? 1 : .8}"/>`;
      s += `<ellipse cx="${CX - 2}" cy="224.5" rx="3.5" ry="1.2" fill="#fff" opacity=".35"/>`;
    }
    s += `<path d="${md}" stroke="${shade(skin, -.62)}" stroke-width="${G.fem ? 1.2 : 1.5}" fill="none" stroke-linecap="round"/>`;
    s += `<path d="${md}" stroke="${shade(skin, -.75)}" stroke-width="${G.fem ? 1.6 : 2.2}" fill="none" stroke-dasharray="0 ${G.fem ? 7 : 8} ${G.fem ? 8 : 10} 100" opacity=".9"/>`;
    if (!G.fem) s += `<path d="M${CX - 8},${mouth === 'smile' || mouth === 'grin' ? 233 : 229} Q${CX},${mouth === 'smile' || mouth === 'grin' ? 236 : 231.5} ${CX + 8},${mouth === 'smile' || mouth === 'grin' ? 233 : 229}" stroke="${shade(skin, -.3)}" stroke-width="1.4" fill="none" opacity=".5"/>`;
    if (mouth === 'smile' || mouth === 'grin') s += both(`M${X(-1, 17)},215 q-2,4 1,7`, `stroke="${shade(skin, -.4)}" stroke-width="1" fill="none" opacity=".6"`);
    if (fc.ohaguro && (mouth === 'smile' || mouth === 'grin')) s += `<path d="M${CX - 12},219.5 Q${CX},228 ${CX + 12},219.5 Q${CX},223 ${CX - 12},219.5Z" fill="#111"/>`;

    // ---- 髭 ----
    s += beard(u, c, G, rnd);
    return s;
  }

  function beard(u, c, G, rnd) {
    const fc = c.face || {};
    const b = fc.beard;
    if (!b || b === 'none') return '';
    const bc = fc.beardColor || fc.hairColor || '#16110f';
    let s = '';
    const strands = (n, fn, w = .8) => {
      let d = '';
      for (let i = 0; i < n; i++) d += fn(i) + ' ';
      return `<path d="${d}" stroke="${shade(bc, .35)}" stroke-width="${w}" fill="none" opacity=".55"/>`;
    };
    if (b === 'mustache' || b === 'kaiser' || b === 'full' || b === 'long' || b === 'goatee+') {
      let md;
      if (b === 'kaiser') md = `M${X(-1, 1)},208 C${X(-1, 10)},205 ${X(-1, 20)},208 ${X(-1, 24)},213 C${X(-1, 28)},210 ${X(-1, 30)},204 ${X(-1, 29)},200 C${X(-1, 33)},206 ${X(-1, 30)},216 ${X(-1, 22)},217 C${X(-1, 14)},215 ${X(-1, 6)},213 ${X(-1, 1)},213Z`;
      else md = `M${X(-1, 1)},208 C${X(-1, 9)},205 ${X(-1, 19)},209 ${X(-1, 25)},220 C${X(-1, 17)},215 ${X(-1, 9)},214 ${X(-1, 1)},213Z`;
      s += both(md, `fill="${bc}"`);
      s += both(`M${X(-1, 4)},210 l8,1.5 M${X(-1, 10)},210 l7,3 M${X(-1, 16)},211 l5,4`, `stroke="${shade(bc, .35)}" stroke-width=".7" opacity=".7"`);
    }
    if (b === 'goatee' || b === 'goatee+') {
      s += `<path d="M${CX - 9},234 C${CX - 8},246 ${CX - 4},256 ${CX},262 C${CX + 4},256 ${CX + 8},246 ${CX + 9},234 Q${CX},238 ${CX - 9},234Z" fill="${bc}"/>`;
      s += strands(6, i => `M${CX - 6 + i * 2.4},237 l${(i - 2.5) * .4},${12 + (i % 2) * 4}`);
    }
    if (b === 'full' || b === 'long') {
      const fw = G.fw;
      const hang = b === 'long' ? 300 : 266;
      s += `<path d="M${CX - fw + 1},188 C${CX - fw + 2},222 ${CX - 34},${hang - 30} ${CX},${hang} C${CX + 34},${hang - 30} ${CX + fw - 2},222 ${CX + fw - 1},188 C${CX + fw - 6},208 ${CX + 30},226 ${CX + 18},230 C${CX + 10},226 ${CX + 4},225 ${CX},226 C${CX - 4},225 ${CX - 10},226 ${CX - 18},230 C${CX - 30},226 ${CX - fw + 6},208 ${CX - fw + 1},188Z" fill="${bc}"/>`;
      s += `<path d="M${CX - fw + 1},188 C${CX - fw + 2},222 ${CX - 34},${hang - 30} ${CX},${hang} C${CX + 34},${hang - 30} ${CX + fw - 2},222 ${CX + fw - 1},188 C${CX + fw - 6},208 ${CX + 30},226 ${CX + 18},230 C${CX + 10},226 ${CX + 4},225 ${CX},226 C${CX - 4},225 ${CX - 10},226 ${CX - 18},230 C${CX - 30},226 ${CX - fw + 6},208 ${CX - fw + 1},188Z" fill="url(#${u}beardShade)"/>`;
      s += strands(34, i => {
        const t = i / 33;
        const x = CX - fw + 4 + t * (fw * 2 - 8);
        const y0 = 200 + Math.sin(t * Math.PI) * 30;
        return `M${f(x)},${f(y0)} q${f((CX - x) * .1)},${f(18 + rnd() * 10)} ${f((CX - x) * .3)},${f(30 + Math.sin(t * Math.PI) * (hang - 236) * .7)}`;
      }, .9);
      // 下唇を残す
      s += `<path d="M${CX - 9},228 Q${CX},233 ${CX + 9},228 Q${CX},231 ${CX - 9},228Z" fill="${shade((c.face || {}).skin || '#e7b48e', -.25)}"/>`;
    }
    if (b === 'stubble') { /* faceで描画 */ }
    return s;
  }

  /* ---------- 髪（兜を被らない武将） ---------- */
  function hair(u, c, rnd) {
    const fc = c.face || {};
    const hs = c.hair;
    if (!hs) return '';
    const hc = fc.hairColor || '#16110f';
    const G = faceGeom(c);
    let s = '';
    const gloss = (d) => `<path d="${d}" stroke="url(#${u}hairGloss)" stroke-width="5" fill="none" opacity=".5" stroke-linecap="round"/>`;
    if (hs === 'chasen') {
      // 月代
      s += `<path d="M${CX - 34},132 C${CX - 30},112 ${CX - 14},106 ${CX},106 C${CX + 14},106 ${CX + 30},112 ${CX + 34},132 C${CX + 20},126 ${CX - 20},126 ${CX - 34},132Z" fill="url(#${u}sakayaki)"/>`;
      // 鬢（側頭部）
      s += both(`M${X(-1, 34)},128 C${X(-1, 46)},134 ${X(-1, 48)},150 ${X(-1, 46)},176 C${X(-1, 43)},168 ${X(-1, 42)},156 ${X(-1, 40)},150 C${X(-1, 38)},142 ${X(-1, 30)},136 ${X(-1, 34)},128Z`, `fill="${hc}"`);
      s += both(`M${X(-1, 34)},130 C${X(-1, 42)},140 ${X(-1, 44)},152 ${X(-1, 44)},166`, `stroke="${shade(hc, .5)}" stroke-width="1" fill="none" opacity=".5"`);
      // 茶筅髷
      s += `<path d="M${CX - 6},110 C${CX - 8},90 ${CX - 4},74 ${CX + 2},64 L${CX + 10},66 C${CX + 6},78 ${CX + 6},92 ${CX + 6},110Z" fill="${hc}"/>`;
      for (let i = 0; i < 4; i++) s += `<rect x="${CX - 7 + i * .8}" y="${96 - i * 7}" width="${13 - i * .8}" height="3.4" rx="1" fill="#c8202a" transform="rotate(${4 + i * 2} ${CX} ${96 - i * 7})"/>`;
      let brush = '';
      for (let i = 0; i < 26; i++) {
        const a = -Math.PI / 2 + (rnd() - .5) * 1.6;
        const L = 26 + rnd() * 22;
        brush += `M${CX + 6},66 q${f(Math.cos(a) * L * .3)},${f(Math.sin(a) * L * .5)} ${f(Math.cos(a) * L)},${f(Math.sin(a) * L)} `;
      }
      s += `<path d="${brush}" stroke="${hc}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      s += `<path d="${brush}" stroke="${shade(hc, .4)}" stroke-width=".6" fill="none" opacity=".6"/>`;
    }
    if (hs === 'tied' || hs === 'long' || hs === 'wild') {
      const wild = hs === 'wild';
      const long = hs === 'long';
      // 頭頂のボリューム
      const top = wild ? 82 : 90;
      s += `<path d="M${CX - G.fw - 5},178 C${CX - G.fw - 14},120 ${CX - 40},${top} ${CX},${top} C${CX + 40},${top} ${CX + G.fw + 14},120 ${CX + G.fw + 5},178 C${CX + G.fw},160 ${CX + G.fw - 4},146 ${CX + 30},136 C${CX + 14},134 ${CX - 8},128 ${CX - 22},138 C${CX - 30},144 ${CX - G.fw + 2},152 ${CX - G.fw - 5},178Z" fill="url(#${u}hairFill)"/>`;
      // 前髪の房
      let fringe = '';
      const nF = wild ? 9 : 7;
      for (let i = 0; i < nF; i++) {
        const t = i / (nF - 1);
        const x0 = CX - 30 + t * 60;
        const L = (wild ? 30 : 26) + rnd() * 10;
        const dx = (t - .5) * 14 + (wild ? (rnd() - .5) * 14 : 0);
        const y0 = top + 10 + Math.pow(Math.abs(t - .5) * 2, 2) * 16;
        fringe += `<path d="M${f(x0 - 10)},${f(y0)} C${f(x0 - 4)},${f(y0 + 8)} ${f(x0 + dx)},${f(y0 + 8 + L * .5)} ${f(x0 + dx * 1.4)},${f(y0 + 6 + L)} C${f(x0 + 4)},${f(y0 + 8 + L * .4)} ${f(x0 + 8)},${f(y0 + 8)} ${f(x0 + 11)},${f(y0)}Z" fill="${hc}"/>`;
      }
      s += fringe;
      // 艶（天使の輪）
      s += gloss(`M${CX - 34},${top + 22} C${CX - 18},${top + 10} ${CX + 12},${top + 10} ${CX + 30},${top + 20}`);
      // 鬢
      s += both(`M${X(-1, G.fw + 2)},150 C${X(-1, G.fw + 4)},176 ${X(-1, G.fw + 2)},200 ${X(-1, G.fw - 4)},${long ? 230 : 214} C${X(-1, G.fw - 6)},196 ${X(-1, G.fw - 4)},170 ${X(-1, G.fw - 2)},152Z`, `fill="${hc}"`);
      // 髪の毛流れ
      let lines = '';
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        const x = CX - 40 + t * 80;
        lines += `M${f(CX + (t - .5) * 10)},${top + 2} Q${f(x)},${f(top + 6 + Math.abs(t - .5) * 20)} ${f(x + (t - .5) * 22)},${f(top + 30 + Math.abs(t - .5) * 30)} `;
      }
      s += `<path d="${lines}" stroke="${shade(hc, .35)}" stroke-width=".6" fill="none" opacity=".28"/>`;
      // 髷 / 結い
      if (hs === 'tied') {
        s += `<path d="M${CX - 10},${top + 2} C${CX - 12},${top - 18} ${CX - 4},${top - 26} ${CX + 6},${top - 22} C${CX + 12},${top - 14} ${CX + 10},${top - 4} ${CX + 10},${top + 2}Z" fill="${hc}"/>`;
        s += `<rect x="${CX - 11}" y="${top - 6}" width="22" height="5" rx="2" fill="${c.colors.accent}"/>`;
      }
      if (wild) {
        // 天を衝く大髷
        let spikes = '';
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * .22;
          const L = 60 + rnd() * 30;
          spikes += `<path d="M${CX - 10},${top + 4} Q${f(CX + Math.cos(a) * L * .5)},${f(top - 10 + Math.sin(a) * L * .4)} ${f(CX + Math.cos(a) * L)},${f(top + Math.sin(a) * L)} Q${f(CX + Math.cos(a) * L * .4 + 6)},${f(top + Math.sin(a) * L * .3)} ${CX + 10},${top + 4}Z" fill="${hc}"/>`;
        }
        s += spikes;
        s += `<rect x="${CX - 14}" y="${top - 6}" width="28" height="9" rx="3" fill="#e03131"/><rect x="${CX - 14}" y="${top - 2}" width="28" height="2.4" fill="#ffd43b"/>`;
        // 長い垂れ髪
        s += both(`M${X(-1, 44)},170 C${X(-1, 60)},220 ${X(-1, 58)},270 ${X(-1, 76)},310 C${X(-1, 54)},280 ${X(-1, 46)},230 ${X(-1, 40)},190Z`, `fill="${hc}"`);
      }
      if (c.hachimaki) {
        const hk = c.hachimaki;
        s += `<path d="M${CX - G.fw - 3},146 C${CX - 30},132 ${CX + 30},132 ${CX + G.fw + 3},146 L${CX + G.fw + 3},156 C${CX + 30},142 ${CX - 30},142 ${CX - G.fw - 3},156Z" fill="${hk}"/>`;
        s += `<path d="M${CX - G.fw - 3},146 C${CX - 30},132 ${CX + 30},132 ${CX + G.fw + 3},146" stroke="${shade(hk, .4)}" stroke-width="1" fill="none"/>`;
        s += `<circle cx="${CX}" cy="140" r="5" fill="url(#${u}goldv)"/>`;
        s += `<path d="M${CX + G.fw + 2},150 C${CX + G.fw + 20},150 ${CX + G.fw + 34},170 ${CX + G.fw + 44},196 L${CX + G.fw + 36},198 C${CX + G.fw + 28},176 ${CX + G.fw + 16},162 ${CX + G.fw + 2},158Z" fill="${hk}"/>`;
        s += `<path d="M${CX + G.fw + 2},152 C${CX + G.fw + 26},156 ${CX + G.fw + 40},180 ${CX + G.fw + 58},190 L${CX + G.fw + 54},196 C${CX + G.fw + 36},186 ${CX + G.fw + 22},166 ${CX + G.fw + 2},158Z" fill="${shade(hk, -.2)}"/>`;
      }
    }
    return s;
  }

  function hairBack(u, c) {
    if (c.hair !== 'long') return '';
    const hc = (c.face || {}).hairColor || '#16110f';
    let s = both(`M${CX - 46},140 C${CX - 64},200 ${CX - 70},270 ${CX - 88},340 C${CX - 70},350 ${CX - 50},348 ${CX - 34},340 C${CX - 38},290 ${CX - 32},230 ${CX - 30},196Z`, `fill="${hc}"`);
    s += both(`M${CX - 52},180 C${CX - 62},240 ${CX - 68},290 ${CX - 80},330 M${CX - 42},200 C${CX - 48},250 ${CX - 50},300 ${CX - 54},338`, `stroke="${shade(hc, .45)}" stroke-width="1.2" fill="none" opacity=".5"`);
    return s;
  }

  /* ---------- 兜・被り物 ---------- */
  function helmetBack(u, c, rnd) {
    // 兜の後ろに配置される装飾（後立・輪貫）
    const hm = c.helmet;
    if (!hm) return '';
    const md = hm.maedate || [];
    let s = '';
    if (md.includes('rays')) { // 馬藺後立（秀吉）
      const n = 29;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI;
        const r0 = 50, r1 = 150 + (i % 2 ? -16 : 0);
        const ax = Math.cos(a), ay = Math.sin(a);
        const px = -ay * 3.4, py = ax * 3.4;
        s += `<path d="M${f(CX + ax * r0 + px)},${f(108 + ay * r0 + py)} L${f(CX + ax * r1)},${f(108 + ay * r1)} L${f(CX + ax * r0 - px)},${f(108 + ay * r0 - py)}Z" fill="url(#${u}goldh)" stroke="#7a5200" stroke-width=".5"/>`;
      }
    }
    if (md.includes('wanuki')) { // 大輪貫（立花）
      s += `<circle cx="${CX}" cy="96" r="88" fill="none" stroke="url(#${u}silverh)" stroke-width="18"/>`;
      s += `<circle cx="${CX}" cy="96" r="88" fill="none" stroke="#fff" stroke-width="1" opacity=".6" transform="translate(-2,-2)"/>`;
      s += `<circle cx="${CX}" cy="96" r="79" fill="none" stroke="#3a4048" stroke-width="1.2"/>`;
    }
    void rnd;
    return s;
  }

  function helmet(u, c, rnd) {
    const hm = c.helmet;
    if (!hm || hm.type === 'none') return '';
    const G = faceGeom(c);
    const mid = `${u}metal`;
    let s = '';

    if (hm.type === 'kabuto' || hm.type === 'shaguma') {
      // 鉢
      const bd = `M${CX - 58},146 C${CX - 62},96 ${CX - 34},66 ${CX},64 C${CX + 34},66 ${CX + 62},96 ${CX + 58},146Z`;
      s += `<path d="${bd}" fill="url(#${mid}h)"/>`;
      // 筋（星兜/筋兜）
      let ribs = '';
      for (let i = -6; i <= 6; i++) {
        if (i === 0) continue;
        const bx = CX + i * 9.3;
        ribs += `M${f(bx)},146 Q${f(CX + i * 8.6)},${f(86 - Math.abs(i))} ${CX},${66}`;
      }
      s += `<path d="${ribs}" stroke="${shade(hm.metalColor, -.6)}" stroke-width="1.3" fill="none" opacity=".75"/>`;
      s += `<path d="${ribs}" stroke="${shade(hm.metalColor, .6)}" stroke-width=".6" fill="none" opacity=".55" transform="translate(-1.2,0)"/>`;
      // 星（鋲）
      if (hm.rivets) {
        for (let i = -5; i <= 5; i++) for (let k = 0; k < 5; k++) {
          const t = .15 + k * .17;
          const x = lerp(CX + i * 9.3 + 4.6, CX, t * t), y = lerp(146, 66, t);
          s += `<circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="url(#${u}goldv)"/>`;
        }
      }
      // 天辺の座
      s += `<ellipse cx="${CX}" cy="67" rx="10" ry="4" fill="url(#${u}goldh)" stroke="#5a3a00" stroke-width=".6"/>`;
      s += `<ellipse cx="${CX}" cy="66" rx="4.5" ry="1.8" fill="#2a1a00"/>`;
      // 鉢の照り
      s += `<path d="M${CX - 46},128 C${CX - 48},100 ${CX - 30},78 ${CX - 12},72" stroke="#fff" stroke-width="3" fill="none" opacity=".35" filter="url(#pf-soft3)"/>`;
      // 腰巻
      s += `<path d="M${CX - 59},138 Q${CX},128 ${CX + 59},138 L${CX + 59},147 Q${CX},137 ${CX - 59},147Z" fill="url(#${u}goldh)"/>`;
      // 眉庇
      s += `<path d="M${CX - 64},146 Q${CX},128 ${CX + 64},146 L${CX + 60},155 Q${CX},140 ${CX - 60},155Z" fill="url(#${mid})"/>`;
      s += `<path d="M${CX - 60},155 Q${CX},140 ${CX + 60},155" stroke="url(#${u}goldh)" stroke-width="1.8" fill="none"/>`;
      s += `<path d="M${CX - 64},146 Q${CX},128 ${CX + 64},146" stroke="${shade(hm.metalColor, .5)}" stroke-width=".8" fill="none"/>`;
      // 吹返
      s += fukigaeshi(u, c);
    } else if (hm.type === 'gokei') { // 合子形兜（黒田官兵衛）
      const bd = `M${CX - 58},148 C${CX - 66},70 ${CX - 40},34 ${CX},32 C${CX + 40},34 ${CX + 66},70 ${CX + 58},148Z`;
      s += `<path d="${bd}" fill="url(#${mid}h)"/>`;
      s += `<path d="M${CX - 40},120 C${CX - 46},80 ${CX - 30},50 ${CX - 10},42" stroke="#fff" stroke-width="5" fill="none" opacity=".3" filter="url(#pf-soft3)"/>`;
      s += `<path d="M${CX - 58},148 C${CX - 66},70 ${CX - 40},34 ${CX},32 C${CX + 40},34 ${CX + 66},70 ${CX + 58},148" stroke="url(#${u}goldh)" stroke-width="2" fill="none"/>`;
      s += `<path d="M${CX - 64},146 Q${CX},130 ${CX + 64},146 L${CX + 60},155 Q${CX},140 ${CX - 60},155Z" fill="url(#${u}blackh)" stroke="url(#${u}goldh)" stroke-width="1.2"/>`;
      s += fukigaeshi(u, c);
    } else if (hm.type === 'eboshi') { // 長烏帽子形兜（加藤清正）
      const bd = `M${CX - 56},148 C${CX - 58},100 ${CX - 50},40 ${CX - 22},-6 L${CX + 18},-10 C${CX + 50},40 ${CX + 60},100 ${CX + 56},148Z`;
      s += `<path d="${bd}" fill="url(#${mid}h)"/>`;
      s += `<path d="M${CX - 44},130 C${CX - 46},80 ${CX - 36},30 ${CX - 18},0" stroke="#fff" stroke-width="5" fill="none" opacity=".35" filter="url(#pf-soft3)"/>`;
      s += `<path d="M${CX - 20},0 C${CX - 6},40 ${CX - 4},90 ${CX - 8},146" stroke="${shade(hm.metalColor, -.4)}" stroke-width="1.4" fill="none" opacity=".6"/>`;
      s += mon('janome', CX + 6, 86, 20, '#15151a', hm.metalColor);
      s += `<path d="M${CX - 64},146 Q${CX},130 ${CX + 64},146 L${CX + 60},155 Q${CX},140 ${CX - 60},155Z" fill="url(#${u}blackh)" stroke="url(#${u}goldh)" stroke-width="1.2"/>`;
      s += fukigaeshi(u, c);
    } else if (hm.type === 'hood') { // 行人包（上杉謙信）
      const col = hm.color || '#f4f3ee';
      // 額・頬を覆う布
      s += `<path d="M${CX - 58},170 C${CX - 64},104 ${CX - 32},72 ${CX},72 C${CX + 32},72 ${CX + 64},104 ${CX + 58},170 L${CX + 46},200 C${CX + 46},170 ${CX + 40},150 ${CX + 30},146 C${CX + 10},140 ${CX - 10},140 ${CX - 30},146 C${CX - 40},150 ${CX - 46},170 ${CX - 46},200Z" fill="${col}"/>`;
      s += `<path d="M${CX - 58},170 C${CX - 64},104 ${CX - 32},72 ${CX},72 C${CX + 32},72 ${CX + 64},104 ${CX + 58},170 L${CX + 46},200 C${CX + 46},170 ${CX + 40},150 ${CX + 30},146 C${CX + 10},140 ${CX - 10},140 ${CX - 30},146 C${CX - 40},150 ${CX - 46},170 ${CX - 46},200Z" fill="url(#${u}hoodShade)"/>`;
      s += `<path d="M${CX - 46},200 C${CX - 46},170 ${CX - 40},150 ${CX - 30},146 C${CX - 10},140 ${CX + 10},140 ${CX + 30},146 C${CX + 40},150 ${CX + 46},170 ${CX + 46},200" stroke="${shade(col, -.25)}" stroke-width="2" fill="none"/>`;
      s += `<path d="M${CX - 40},110 C${CX - 20},96 ${CX + 20},96 ${CX + 40},110 M${CX - 50},134 C${CX - 30},118 ${CX + 30},118 ${CX + 50},134 M${CX - 30},88 C${CX - 10},82 ${CX + 10},82 ${CX + 30},88" stroke="${shade(col, -.2)}" stroke-width="1.6" fill="none" opacity=".7"/>`;
      // 顎下を包む布
      s += `<path d="M${CX - 46},200 C${CX - 44},226 ${CX - 30},252 ${CX},262 C${CX + 30},252 ${CX + 44},226 ${CX + 46},200 L${CX + 60},214 C${CX + 60},250 ${CX + 40},282 ${CX},292 C${CX - 40},282 ${CX - 60},250 ${CX - 60},214Z" fill="${shade(col, -.06)}"/>`;
      s += `<path d="M${CX - 46},200 C${CX - 44},226 ${CX - 30},252 ${CX},262 C${CX + 30},252 ${CX + 44},226 ${CX + 46},200 L${CX + 60},214 C${CX + 60},250 ${CX + 40},282 ${CX},292 C${CX - 40},282 ${CX - 60},250 ${CX - 60},214Z" fill="url(#${u}hoodShade)"/>`;
      s += `<path d="M${CX - 40},250 C${CX - 20},268 ${CX + 20},268 ${CX + 40},250 M${CX - 50},236 C${CX - 30},258 ${CX + 30},258 ${CX + 50},236" stroke="${shade(col, -.22)}" stroke-width="1.4" fill="none" opacity=".7"/>`;
    } else if (hm.type === 'ninja') {
      s += `<path d="M${CX - 58},170 C${CX - 64},104 ${CX - 32},72 ${CX},72 C${CX + 32},72 ${CX + 64},104 ${CX + 58},170 L${CX + 46},190 C${CX + 46},170 ${CX + 40},152 ${CX + 30},148 C${CX + 10},142 ${CX - 10},142 ${CX - 30},148 C${CX - 40},152 ${CX - 46},170 ${CX - 46},190Z" fill="#1c1e26"/>`;
      s += `<path d="M${CX - 58},170 C${CX - 64},104 ${CX - 32},72 ${CX},72 C${CX + 32},72 ${CX + 64},104 ${CX + 58},170 L${CX + 46},190 C${CX + 46},170 ${CX + 40},152 ${CX + 30},148 C${CX + 10},142 ${CX - 10},142 ${CX - 30},148 C${CX - 40},152 ${CX - 46},170 ${CX - 46},190Z" fill="url(#${u}hoodShade)"/>`;
      // 鉢金
      s += `<path d="M${CX - 34},134 Q${CX},124 ${CX + 34},134 L${CX + 32},146 Q${CX},136 ${CX - 32},146Z" fill="url(#${u}silverh)" stroke="#333" stroke-width=".8"/>`;
      s += mon('shuriken', CX, 136, 6, '#222', '#aaa');
      // 口布
      s += `<path d="M${CX - 50},190 C${CX - 40},186 ${CX - 24},188 ${CX - 10},192 C${CX - 4},186 ${CX + 4},186 ${CX + 10},192 C${CX + 24},188 ${CX + 40},186 ${CX + 50},190 C${CX + 54},230 ${CX + 40},266 ${CX},282 C${CX - 40},266 ${CX - 54},230 ${CX - 50},190Z" fill="#23262f"/>`;
      s += `<path d="M${CX - 50},190 C${CX - 40},186 ${CX - 24},188 ${CX - 10},192 C${CX - 4},186 ${CX + 4},186 ${CX + 10},192 C${CX + 24},188 ${CX + 40},186 ${CX + 50},190 C${CX + 54},230 ${CX + 40},266 ${CX},282 C${CX - 40},266 ${CX - 54},230 ${CX - 50},190Z" fill="url(#${u}hoodShade)"/>`;
      s += `<path d="M${CX - 40},214 C${CX - 20},226 ${CX + 20},226 ${CX + 40},214 M${CX - 34},240 C${CX - 16},252 ${CX + 16},252 ${CX + 34},240 M${CX},196 L${CX},214" stroke="#0e0f14" stroke-width="2" fill="none" opacity=".8"/>`;
    } else if (hm.type === 'court') { // 烏帽子
      s += `<path d="M${CX - 34},134 C${CX - 40},100 ${CX - 26},52 ${CX + 4},28 C${CX + 18},20 ${CX + 30},30 ${CX + 30},48 C${CX + 36},76 ${CX + 40},110 ${CX + 36},134 Q${CX},124 ${CX - 34},134Z" fill="url(#${u}blackh)"/>`;
      s += `<path d="M${CX - 10},50 C${CX + 4},70 ${CX + 2},96 ${CX + 6},128 M${CX + 6},34 C${CX + 18},60 ${CX + 22},90 ${CX + 24},128" stroke="#4a4a58" stroke-width="1.4" fill="none" opacity=".8"/>`;
      s += `<path d="M${CX - 26},120 C${CX - 28},96 ${CX - 18},66 ${CX - 2},48" stroke="#fff" stroke-width="2.4" fill="none" opacity=".25" filter="url(#pf-soft3)"/>`;
      // 掛緒
      s += both(`M${X(-1, 34)},134 C${X(-1, 40)},170 ${X(-1, 40)},210 ${X(-1, 30)},236`, `stroke="#f1ead8" stroke-width="2" fill="none" opacity=".85"`);
    }

    // 前立
    s += maedate(u, c, rnd);
    void G;
    return s;
  }

  function fukigaeshi(u, c) {
    const hm = c.helmet;
    const mid = `${u}metal`;
    const sz = hm.fukigaeshi || 1;
    const d = `M${X(-1, 54)},140 C${X(-1, 70 + 6 * sz)},126 ${X(-1, 86 + 10 * sz)},134 ${X(-1, 88 + 10 * sz)},150 C${X(-1, 90 + 10 * sz)},170 ${X(-1, 78 + 8 * sz)},184 ${X(-1, 70 + 6 * sz)},186 C${X(-1, 70)},170 ${X(-1, 62)},156 ${X(-1, 52)},154Z`;
    let s = both(d, `fill="url(#${mid})" stroke="url(#${u}goldh)" stroke-width="1.8"`);
    s += both(`M${X(-1, 58)},146 C${X(-1, 70)},140 ${X(-1, 80 + 8 * sz)},144 ${X(-1, 82 + 8 * sz)},156`, `stroke="${shade(hm.metalColor, .5)}" stroke-width="1" fill="none" opacity=".7"`);
    const mx = 74 + 7 * sz;
    s += mon(c.mon, X(-1, mx), 160, 8.5, 'url(#' + u + 'goldv)', hm.metalColor);
    s += mon(c.mon, X(1, mx), 160, 8.5, 'url(#' + u + 'goldv)', hm.metalColor);
    return s;
  }

  function maedate(u, c, rnd) {
    const hm = c.helmet;
    const md = hm.maedate || [];
    let s = '';
    const gold = `url(#${u}goldh)`, goldD = `url(#${u}gold)`;
    // 台座
    const mount = () => `<path d="M${CX - 7},146 L${CX - 5},126 L${CX + 5},126 L${CX + 7},146Z" fill="${goldD}" stroke="#5a3a00" stroke-width=".6"/>`;

    if (md.includes('kuwagata')) {
      const L = hm.kuwagataLen || 1;
      const kc = hm.kuwagataColor ? `url(#${u}kuwa)` : goldD;
      const d = `M${CX - 5},134 C${CX - 26},${f(118 - 6 * L)} ${CX - 46},${f(84 - 24 * L)} ${CX - 52},${f(40 - 40 * L)} C${CX - 38},${f(74 - 26 * L)} ${CX - 22},${f(104 - 10 * L)} ${CX + 2},126Z`;
      s += both(d, `fill="${kc}" stroke="#5a3a00" stroke-width=".7"`);
      s += both(`M${CX - 8},128 C${CX - 26},${f(112 - 6 * L)} ${CX - 42},${f(82 - 22 * L)} ${CX - 50},${f(44 - 38 * L)}`, `stroke="#fff6c8" stroke-width=".9" fill="none" opacity=".8"`);
      s += mount();
    }
    if (md.includes('crescent')) { // 弦月（伊達政宗）
      s += `<path d="M42,62 Q150,226 294,26 Q160,206 42,62Z" fill="${goldD}" stroke="#6a4600" stroke-width=".8"/>`;
      s += `<path d="M50,68 Q150,214 286,34" stroke="#fff6c8" stroke-width="1.2" fill="none" opacity=".75"/>`;
      s += mount();
    }
    if (md.includes('antlers')) { // 鹿角
      const ac = hm.antlerColor || '#1a1a1e';
      const beam = `M${CX - 8},136 C${CX - 34},120 ${CX - 64},112 ${CX - 72},80 C${CX - 78},58 ${CX - 68},34 ${CX - 60},8`;
      const tines = `M${CX - 70},74 C${CX - 88},70 ${CX - 98},56 ${CX - 102},38 M${CX - 66},40 C${CX - 80},36 ${CX - 88},24 ${CX - 90},10 M${CX - 46},118 C${CX - 52},104 ${CX - 52},96 ${CX - 50},86`;
      s += both(beam, `stroke="${ac}" stroke-width="9" fill="none" stroke-linecap="round"`);
      s += both(tines, `stroke="${ac}" stroke-width="6.5" fill="none" stroke-linecap="round"`);
      s += both(beam, `stroke="${shade(ac, .5)}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"`);
      s += both(tines, `stroke="${shade(ac, .5)}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".6"`);
      // 金の角先
      s += both(`M${CX - 60},8 l0,0 M${CX - 102},38 l0,0 M${CX - 90},10 l0,0`, `stroke="url(#${u}goldv)" stroke-width="7" stroke-linecap="round"`);
    }
    if (md.includes('rokumon')) { // 六文銭
      s += `<rect x="${CX - 26}" y="100" width="52" height="32" rx="3" fill="url(#${u}blackh)" stroke="url(#${u}goldh)" stroke-width="1.6"/>`;
      s += mon('rokumon', CX, 116, 14, 'url(#' + u + 'goldv)', '#111');
      s += mount();
    }
    if (md.includes('ai')) { // 愛（直江兼続）
      s += `<path d="M${CX - 34},134 C${CX - 44},134 ${CX - 46},120 ${CX - 36},116 C${CX - 36},104 ${CX - 20},102 ${CX - 14},110 C${CX - 8},100 ${CX + 8},100 ${CX + 14},110 C${CX + 20},102 ${CX + 36},104 ${CX + 36},116 C${CX + 46},120 ${CX + 44},134 ${CX + 34},134Z" fill="${goldD}" stroke="#5a3a00" stroke-width=".8"/>`;
      s += `<path d="M${CX - 2},106 L${CX - 2},28" stroke="${goldD}" stroke-width="5"/>`;
      s += `<text x="${CX}" y="88" text-anchor="middle" font-size="58" font-weight="900" fill="${goldD}" stroke="#5a3a00" stroke-width="1.2" font-family="'Shippori Mincho','Noto Serif JP',serif" paint-order="stroke">愛</text>`;
    }
    if (md.includes('tentsuki')) { // 天衝（井伊直政）
      const d = `M${CX - 6},136 C${CX - 18},110 ${CX - 30},60 ${CX - 34},-4 L${CX - 22},-4 C${CX - 18},56 ${CX - 8},104 ${CX + 4},128Z`;
      s += both(d, `fill="${goldD}" stroke="#5a3a00" stroke-width=".7"`);
      s += both(`M${CX - 10},128 C${CX - 20},100 ${CX - 28},56 ${CX - 30},0`, `stroke="#fff6c8" stroke-width=".9" fill="none" opacity=".8"`);
      s += mount();
    }
    if (md.includes('shida')) { // 歯朶（徳川家康）
      const frond = (ang, len) => {
        let g = `<g transform="translate(${CX},132) rotate(${ang})"><path d="M0,0 C2,-${len * .4} -2,-${len * .7} 0,-${len}" stroke="${goldD}" stroke-width="2.4" fill="none"/>`;
        const n = 11;
        for (let i = 1; i <= n; i++) {
          const t = i / (n + 1);
          const y = -len * t, sz = (1 - t) * 13 + 4;
          g += `<ellipse cx="${-sz * .7}" cy="${f(y)}" rx="${f(sz * .75)}" ry="${f(sz * .28)}" transform="rotate(-30 ${-sz * .7} ${f(y)})" fill="${goldD}" stroke="#5a3a00" stroke-width=".4"/>`;
          g += `<ellipse cx="${sz * .7}" cy="${f(y)}" rx="${f(sz * .75)}" ry="${f(sz * .28)}" transform="rotate(30 ${sz * .7} ${f(y)})" fill="${goldD}" stroke="#5a3a00" stroke-width=".4"/>`;
        }
        return g + '</g>';
      };
      s += frond(-48, 96) + frond(48, 96) + frond(-20, 110) + frond(20, 110) + frond(0, 120);
      s += mount();
    }
    if (md.includes('kikyo')) {
      s += mount();
      s += `<circle cx="${CX}" cy="110" r="21" fill="url(#${u}blackh)" stroke="url(#${u}goldh)" stroke-width="2"/>`;
      s += mon('kikyo', CX, 110, 17, goldD, '#111');
    }
    if (md.includes('sun')) { // 日輪
      s += mount();
      s += `<circle cx="${CX}" cy="106" r="22" fill="${goldD}" stroke="#5a3a00" stroke-width="1"/>`;
      s += `<circle cx="${CX}" cy="106" r="15" fill="#c8241c"/>`;
    }
    if (md.includes('monplate')) { // 家紋の前立
      s += mount();
      s += mon(c.mon, CX, 108, 22, goldD, '#111');
    }
    if (md.includes('oni')) { // 獅噛（鬼面）
      s += `<path d="M${CX - 16},144 C${CX - 20},128 ${CX - 14},114 ${CX},112 C${CX + 14},114 ${CX + 20},128 ${CX + 16},144Z" fill="${goldD}" stroke="#5a3a00" stroke-width=".8"/>`;
      s += `<circle cx="${CX - 6}" cy="126" r="3" fill="#c8241c"/><circle cx="${CX + 6}" cy="126" r="3" fill="#c8241c"/>`;
      s += `<path d="M${CX - 9},136 L${CX - 5},140 L${CX},136 L${CX + 5},140 L${CX + 9},136" stroke="#5a3a00" stroke-width="1.4" fill="none"/>`;
      s += `<path d="M${CX - 12},114 L${CX - 18},102 L${CX - 6},112 M${CX + 12},114 L${CX + 18},102 L${CX + 6},112" fill="${goldD}" stroke="#5a3a00" stroke-width=".6"/>`;
    }
    if (md.includes('rays')) { // 正面に小さな日輪
      s += mount();
      s += `<circle cx="${CX}" cy="116" r="12" fill="${goldD}" stroke="#5a3a00" stroke-width=".8"/>`;
    }
    if (md.includes('wanuki')) {
      s += mount();
    }
    void rnd;
    return s;
  }

  /* ---------- defs ---------- */
  function defs(u, c) {
    const col = c.colors;
    const fc = c.face || {};
    const skin = fc.skin || '#e7b48e';
    const hm = c.helmet || {};
    const b = c.bg;
    const lace = col.lace, armor = col.armor;
    const helmLace = hm.lace || lace;
    const hair = fc.hairColor || '#16110f';
    return `<defs>
      <radialGradient id="${u}bg" cx="50%" cy="34%" r="80%"><stop offset="0" stop-color="${b.c1}"/><stop offset="1" stop-color="${b.c2}"/></radialGradient>
      <radialGradient id="${u}sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${shade(b.accent || '#f2c14e', .4)}"/><stop offset=".75" stop-color="${b.accent || '#f2c14e'}"/><stop offset="1" stop-color="${b.accent || '#f2c14e'}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${u}moon" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fffdf0"/><stop offset=".7" stop-color="${b.accent || '#f4e7b8'}"/><stop offset="1" stop-color="${shade(b.accent || '#f4e7b8', -.2)}"/></radialGradient>
      <linearGradient id="${u}mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${u}flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4a1c"/><stop offset=".6" stop-color="${b.accent || '#ff9d2e'}"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></linearGradient>
      <linearGradient id="${u}goldleaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d77a"/><stop offset=".5" stop-color="#d9a93c"/><stop offset="1" stop-color="#f1cd6a"/></linearGradient>
      <pattern id="${u}seigaiha" width="40" height="20" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="${b.waveColor || '#ffffff'}" stroke-width="1.2" opacity=".5">
          <circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="8"/>
          <circle cx="0" cy="10" r="18"/><circle cx="0" cy="10" r="13"/><circle cx="0" cy="10" r="8"/>
          <circle cx="40" cy="10" r="18"/><circle cx="40" cy="10" r="13"/><circle cx="40" cy="10" r="8"/></g>
      </pattern>

      <radialGradient id="${u}skin" cx="40%" cy="42%" r="68%"><stop offset="0" stop-color="${shade(skin, .2)}"/><stop offset=".55" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, -.25)}"/></radialGradient>
      <radialGradient id="${u}sakayaki" cx="45%" cy="30%" r="70%"><stop offset="0" stop-color="${mix(shade(skin, .1), '#b9c6cf', .18)}"/><stop offset="1" stop-color="${mix(shade(skin, -.15), '#7f8f9c', .3)}"/></radialGradient>
      <linearGradient id="${u}faceShade" x1="0" y1="0" x2="1" y2="0"><stop offset=".5" stop-color="#4a1a08" stop-opacity="0"/><stop offset=".82" stop-color="#4a1a08" stop-opacity=".18"/><stop offset="1" stop-color="#4a1a08" stop-opacity=".42"/></linearGradient>
      <radialGradient id="${u}faceForm" cx="44%" cy="44%" r="62%"><stop offset=".55" stop-color="#4a1a08" stop-opacity="0"/><stop offset="1" stop-color="#4a1a08" stop-opacity=".28"/></radialGradient>
      <linearGradient id="${u}neckShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1206" stop-opacity=".6"/><stop offset=".45" stop-color="#3a1206" stop-opacity=".15"/><stop offset="1" stop-color="#3a1206" stop-opacity=".35"/></linearGradient>
      <linearGradient id="${u}brimShadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0800" stop-opacity=".7"/><stop offset=".55" stop-color="#1a0800" stop-opacity=".18"/><stop offset="1" stop-color="#1a0800" stop-opacity="0"/></linearGradient>
      <linearGradient id="${u}scleraShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6a5a" stop-opacity=".45"/><stop offset=".6" stop-color="#8a6a5a" stop-opacity="0"/></linearGradient>
      <radialGradient id="${u}patch" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#4a4a54"/><stop offset=".6" stop-color="#1c1c22"/><stop offset="1" stop-color="#050507"/></radialGradient>
      <linearGradient id="${u}hairGloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(hair, .6)}" stop-opacity="0"/><stop offset=".5" stop-color="${shade(hair, .7)}"/><stop offset="1" stop-color="${shade(hair, .6)}" stop-opacity="0"/></linearGradient>
      <linearGradient id="${u}hairFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(hair, .22)}"/><stop offset=".5" stop-color="${hair}"/><stop offset="1" stop-color="${shade(hair, -.5)}"/></linearGradient>
      <linearGradient id="${u}beardShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
      <linearGradient id="${u}mane" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9d4ca"/><stop offset=".3" stop-color="#ffffff"/><stop offset=".7" stop-color="#f1eee8"/><stop offset="1" stop-color="#bdb6aa"/></linearGradient>
      <linearGradient id="${u}hoodShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".05"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset=".7" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>

      ${metalGrad(`${u}armor`, armor)}
      ${metalGrad(`${u}metal`, hm.metalColor || armor)}
      ${metalGrad(`${u}gold`, '#d8a521')}
      ${metalGrad(`${u}silver`, '#b8c2cc')}
      ${metalGrad(`${u}black`, '#2b2b35')}
      ${hm.kuwagataColor ? metalGrad(`${u}kuwa`, hm.kuwagataColor) : ''}
      <linearGradient id="${u}woodv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1608"/><stop offset=".4" stop-color="#7a4a22"/><stop offset="1" stop-color="#1a0e04"/></linearGradient>
      <linearGradient id="${u}lacq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a44"/><stop offset=".5" stop-color="#111116"/><stop offset="1" stop-color="#000"/></linearGradient>
      <radialGradient id="${u}bead" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#f6d9a0"/><stop offset=".35" stop-color="#c58a3a"/><stop offset="1" stop-color="#4a2a0a"/></radialGradient>
      <linearGradient id="${u}cyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".25" stop-color="#fff" stop-opacity=".08"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
      <linearGradient id="${u}sodeShadeL" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset=".55" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
      <linearGradient id="${u}sodeShadeR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".2"/><stop offset=".5" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></linearGradient>
      <linearGradient id="${u}shikoroShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".3" stop-color="#fff" stop-opacity=".06"/><stop offset=".7" stop-color="#000" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>
      <linearGradient id="${u}clothShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".4" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
      <linearGradient id="${u}robeShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".3" stop-color="#fff" stop-opacity=".06"/><stop offset=".6" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
      <pattern id="${u}lace" width="6" height="7" patternUnits="userSpaceOnUse">
        <rect width="6" height="7" fill="${shade(armor, -.55)}"/>
        <rect x="1" y="0" width="4" height="6" rx="1.2" fill="${lace}"/>
        <rect x="1.5" y="0" width="1.1" height="6" fill="${shade(lace, .45)}" opacity=".85"/>
        <rect x="3.9" y="0" width=".9" height="6" fill="${shade(lace, -.4)}"/>
      </pattern>
      <pattern id="${u}laceH" width="6" height="7" patternUnits="userSpaceOnUse">
        <rect width="6" height="7" fill="${shade(hm.metalColor || armor, -.55)}"/>
        <rect x="1" y="0" width="4" height="6" rx="1.2" fill="${helmLace}"/>
        <rect x="1.5" y="0" width="1.1" height="6" fill="${shade(helmLace, .45)}" opacity=".85"/>
        <rect x="3.9" y="0" width=".9" height="6" fill="${shade(helmLace, -.4)}"/>
      </pattern>
      <pattern id="${u}chain" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#15161b"/><circle cx="2.5" cy="2.5" r="1.7" fill="none" stroke="#7a808a" stroke-width=".8"/></pattern>
      <radialGradient id="${u}vignette" cx="50%" cy="45%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
      <linearGradient id="${u}rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.rimLight || '#fff3c4'}" stop-opacity=".22"/><stop offset=".4" stop-color="${c.rimLight || '#fff3c4'}" stop-opacity="0"/></linearGradient>
      <clipPath id="${u}faceClip"><path d="${faceGeom(c).d}"/></clipPath>
    </defs>`;
  }

  /* ---------- 共通フィルタ（ドキュメントに1度だけ） ---------- */
  function ensureGlobalDefs() {
    if (typeof document === 'undefined' || document.getElementById('pf-global-defs')) return;
    const div = document.createElement('div');
    div.innerHTML = `<svg id="pf-global-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <filter id="pf-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5"/></filter>
      <filter id="pf-soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.8"/></filter>
      <filter id="pf-soft3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter>
      <filter id="pf-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="pf-shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="6"/><feOffset dx="0" dy="6"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="pf-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .5  0 0 0 0 .4  0 0 0 0 .3  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    </defs></svg>`;
    document.body.appendChild(div.firstChild);
  }

  /* ---------- メイン ---------- */
  function render(c, opts = {}) {
    ensureGlobalDefs();
    const u = `p${c.id}${++uidSeq}_`;
    const rnd = seeded(c.id);
    const hm = c.helmet || { type: 'none' };
    hm.metalColor = metalColor(hm.metal || 'black');
    c.helmet = hm;
    const silhouette = !!opts.silhouette;

    let art = '';
    art += background(u, c, rnd);
    art += banner(u, c);
    art += weapon(u, c);
    // レアリティの後光
    if (c.rarity === 'UR' || c.rarity === 'SSR') {
      const glow = c.rarity === 'UR' ? (c.aura || '#ffe9a8') : '#fff3d0';
      art += `<circle cx="${CX}" cy="${150 + HEAD_DY}" r="${c.rarity === 'UR' ? 120 : 95}" fill="${glow}" opacity="${c.rarity === 'UR' ? .32 : .18}" filter="url(#pf-soft)" style="mix-blend-mode:screen"/>`;
      if (c.rarity === 'UR') {
        for (let i = 0; i < 26; i++) {
          const a = rnd() * Math.PI * 2, r = 70 + rnd() * 110;
          art += `<circle cx="${f(CX + Math.cos(a) * r)}" cy="${f(160 + Math.sin(a) * r * .9)}" r="${f(.8 + rnd() * 1.8)}" fill="#fff8d8" opacity="${f(.5 + rnd() * .5)}" filter="url(#pf-soft3)"/>`;
        }
      }
    }
    // 人物全体に落ち影をつける
    let fig = '';
    const head = (x) => x ? `<g transform="translate(0,${HEAD_DY})">${x}</g>` : '';
    fig += head(shaguma(u, c, rnd) + hoodBack(u, c) + hairBack(u, c));
    fig += body(u, c);
    fig += head(shikoro(u, c) + helmetBack(u, c, rnd) + face(u, c, rnd) + hair(u, c, seeded(c.id + 'h')) + helmet(u, c, rnd));

    art += `<g filter="url(#pf-shadow)">${fig}</g>`;
    // 仕上げ：リムライト・ビネット・紙の質感
    art += `<rect width="${W}" height="${H}" fill="url(#${u}rim)"/>`;
    art += `<rect width="${W}" height="${H}" fill="url(#${u}vignette)"/>`;
    if (!opts.lite) art += `<rect width="${W}" height="${H}" fill="#fff" filter="url(#pf-grain)" opacity=".22"/>`;

    if (silhouette) {
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="portrait silhouette" preserveAspectRatio="xMidYMid slice">${defs(u, c)}
        <rect width="${W}" height="${H}" fill="#120f14"/>
        <g opacity=".9" style="filter:brightness(0)">${fig}</g>
        <rect width="${W}" height="${H}" fill="url(#${u}vignette)"/></svg>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="portrait" preserveAspectRatio="xMidYMid slice">${defs(u, c)}${art}</svg>`;
  }

  global.Portrait = { render, mon, shade };
})(typeof window !== 'undefined' ? window : globalThis);
