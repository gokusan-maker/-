/* =========================================================================
 * 武将データ
 * rarity: UR / SSR / SR / R
 * skill.type: exp(経験値UP) / koban(小判UP) / combo(連撃ボーナス) / guard(1ミス無効) / hint(選択肢を1つ消す)
 * ========================================================================= */
window.WARLORDS = [
  /* ============================== UR ============================== */
  {
    id: 'nobunaga', name: '織田信長', nameEn: 'Oda Nobunaga', rarity: 'UR', title: '第六天魔王', clan: '織田家', mon: 'mokkou',
    colors: { armor: '#1a1a22', lace: '#a3121c', accent: '#c8202a', cloth: '#1a0b10', cape: '#120609', lining: '#b3121a', under: '#3a0e12' },
    body: 'cape', hair: 'chasen',
    helmet: { type: 'none' },
    face: { jaw: .45, brow: 'fierce', eyes: 'sharp', mouth: 'smirk', beard: 'mustache', skin: '#e8b994', stubble: true },
    bg: { type: 'flame', c1: '#5a0d0a', c2: '#0d0203', accent: '#ff8a1c' },
    weapon: 'teppo',
    banner: { side: 'left', color: '#f2e6c8', mon: 'mokkou', ink: '#1a1a1a', text: '天下布武' },
    stats: { bu: 92, chi: 96, tou: 98 },
    skill: { type: 'exp', value: .5, name: '天下布武', desc: '獲得経験値 +50%' },
    quote: { en: 'Fortune favors those who act without hesitation.', ja: '迷わず動く者に、天は味方する。' }
  },
  {
    id: 'hideyoshi', name: '豊臣秀吉', nameEn: 'Toyotomi Hideyoshi', rarity: 'UR', title: '天下人', clan: '豊臣家', mon: 'kiri',
    colors: { armor: '#c99a2e', lace: '#e8402a', accent: '#d4a017', cloth: '#5a1a10' },
    helmet: { type: 'kabuto', metal: 'black', lace: '#e8402a', maedate: ['rays'], shikoro: 3 },
    face: { jaw: .25, brow: 'kind', eyes: 'soft', mouth: 'grin', beard: 'kaiser', skin: '#e2ae86', age: .35 },
    bg: { type: 'gold', c1: '#f4d27a', c2: '#a8741a', clouds: true, cloudColor: '#fff2c0' },
    weapon: 'gunbai',
    stats: { bu: 74, chi: 97, tou: 95 },
    skill: { type: 'koban', value: 1.0, name: '黄金の茶室', desc: '獲得小判 +100%' },
    quote: { en: 'Make people want to follow you, not fear you.', ja: '恐れさせるな。ついて行きたいと思わせよ。' }
  },
  {
    id: 'ieyasu', name: '徳川家康', nameEn: 'Tokugawa Ieyasu', rarity: 'UR', title: '東照大権現', clan: '徳川家', mon: 'aoi',
    colors: { armor: '#20232b', lace: '#2c3a6b', accent: '#c8a02a', cloth: '#1a1f2e' },
    helmet: { type: 'kabuto', metal: 'black', lace: '#2c3a6b', maedate: ['shida'], rivets: true },
    face: { jaw: .9, wide: true, brow: 'calm', eyes: 'calm', mouth: 'stern', beard: 'goatee', skin: '#e3b08a', age: .5 },
    bg: { type: 'mountain', c1: '#cdd6c8', c2: '#3a4a40', accent: '#f6e7b0' },
    banner: { side: 'right', color: '#f4efe0', mon: 'aoi', ink: '#1a1a1a', text: '厭離穢土' },
    stats: { bu: 82, chi: 95, tou: 99 },
    skill: { type: 'guard', value: 2, name: '鳴くまで待とう', desc: '1合戦につき2回までミスで連撃が途切れない' },
    quote: { en: 'Patience is the longest road, and the surest.', ja: '忍耐こそ最も長く、最も確かな道。' }
  },
  {
    id: 'kenshin', name: '上杉謙信', nameEn: 'Uesugi Kenshin', rarity: 'UR', title: '越後の龍', clan: '上杉家', mon: 'take',
    colors: { armor: '#d8dce4', lace: '#3b4a8a', accent: '#4a6ad0', cloth: '#1c2236', robe: '#283a6a' },
    body: 'yoroi',
    helmet: { type: 'hood', color: '#f6f5f0' },
    face: { jaw: .4, brow: 'calm', eyes: 'sharp', mouth: 'calm', skin: '#ecc2a0' },
    bg: { type: 'moon', c1: '#2c3c6a', c2: '#070b1c', accent: '#f4ecc8' },
    weapon: 'katana',
    banner: { side: 'right', color: '#101828', mon: 'take', ink: '#f2f2f2', text: '毘' },
    stats: { bu: 99, chi: 88, tou: 96 },
    skill: { type: 'combo', value: .5, name: '車懸りの陣', desc: '連撃ボーナス +50%' },
    quote: { en: 'Fight for what is right, not for what is easy.', ja: '易きためでなく、義のために戦え。' }
  },
  {
    id: 'shingen', name: '武田信玄', nameEn: 'Takeda Shingen', rarity: 'UR', title: '甲斐の虎', clan: '武田家', mon: 'hishi',
    colors: { armor: '#8a1a14', lace: '#c4281e', accent: '#c4281e', cloth: '#3a0a08' },
    helmet: { type: 'shaguma', metal: 'black', lace: '#c4281e', maedate: ['kuwagata', 'oni'], kuwagataLen: 1.1 },
    face: { jaw: .95, wide: true, brow: 'thick', eyes: 'sharp', mouth: 'stern', beard: 'full', beardColor: '#2a2420', skin: '#dca57c', age: .55 },
    bg: { type: 'flame', c1: '#6a1608', c2: '#120402', accent: '#ffb02e' },
    weapon: 'gunbai',
    stats: { bu: 94, chi: 97, tou: 98 },
    skill: { type: 'exp', value: .45, name: '風林火山', desc: '獲得経験値 +45%' },
    quote: { en: 'People are the castle. Trust is the wall.', ja: '人は城、人は石垣、人は堀。' }
  },
  {
    id: 'masamune', name: '伊達政宗', nameEn: 'Date Masamune', rarity: 'UR', title: '独眼竜', clan: '伊達家', mon: 'kuyo',
    colors: { armor: '#18181f', lace: '#25252e', accent: '#d8a521', cloth: '#0e0e14' },
    helmet: { type: 'kabuto', metal: 'black', lace: '#3a3a48', maedate: ['crescent'], rivets: true },
    face: { jaw: .5, brow: 'fierce', eyes: 'sharp', mouth: 'smirk', eyepatch: 'right', skin: '#eab896' },
    bg: { type: 'storm', c1: '#1e2a48', c2: '#05070e', accent: '#a8c8ff' },
    weapon: 'katana',
    stats: { bu: 93, chi: 90, tou: 94 },
    skill: { type: 'combo', value: .6, name: '六爪流', desc: '連撃ボーナス +60%' },
    quote: { en: 'A late start is still a start. Ride hard.', ja: '遅れて生まれようと、駆ければ追いつく。' }
  },

  /* ============================== SSR ============================== */
  {
    id: 'yukimura', name: '真田幸村', nameEn: 'Sanada Yukimura', rarity: 'SSR', title: '日本一の兵', clan: '真田家', mon: 'rokumon',
    colors: { armor: '#b8211a', lace: '#d8332a', accent: '#e8402a', cloth: '#4a0a08' },
    helmet: { type: 'kabuto', metal: 'red', lace: '#d8332a', maedate: ['antlers', 'rokumon'], antlerColor: '#c8a040' },
    face: { jaw: .35, brow: 'fierce', eyes: 'sharp', mouth: 'stern', skin: '#edbe98' },
    bg: { type: 'sun', c1: '#7a1a10', c2: '#1a0302', accent: '#f0a020' },
    weapon: 'jumonji',
    stats: { bu: 98, chi: 80, tou: 88 },
    skill: { type: 'combo', value: .4, name: '真田丸', desc: '連撃ボーナス +40%' },
    quote: { en: 'Give everything you have, especially when it is hard.', ja: '苦しい時こそ、持てる全てを賭けよ。' }
  },
  {
    id: 'tadakatsu', name: '本多忠勝', nameEn: 'Honda Tadakatsu', rarity: 'SSR', title: '戦国最強', clan: '徳川家', mon: 'aoi',
    colors: { armor: '#17171c', lace: '#2a2a32', accent: '#d8a521', cloth: '#0e0e12' },
    helmet: { type: 'kabuto', metal: 'black', lace: '#2a2a32', maedate: ['antlers'], antlerColor: '#141418' },
    juzu: true,
    face: { jaw: 1, wide: true, brow: 'thick', eyes: 'sharp', mouth: 'stern', beard: 'goatee+', skin: '#d8a07a', stubble: true },
    bg: { type: 'storm', c1: '#3a3a44', c2: '#08080a', accent: '#ffe08a' },
    weapon: 'tonbogiri',
    stats: { bu: 100, chi: 66, tou: 88 },
    skill: { type: 'guard', value: 1, name: '無傷の猛将', desc: '1合戦につき1回ミスで連撃が途切れない' },
    quote: { en: 'In fifty-seven battles, never once wounded.', ja: '生涯五十七戦、かすり傷ひとつ負わず。' }
  },
  {
    id: 'mitsuhide', name: '明智光秀', nameEn: 'Akechi Mitsuhide', rarity: 'SSR', title: '敵は本能寺にあり', clan: '明智家', mon: 'kikyo',
    colors: { armor: '#2a3a5a', lace: '#6a7ac0', accent: '#8a9ae0', cloth: '#141c2e' },
    helmet: { type: 'kabuto', metal: 'navy', lace: '#7a8ad0', maedate: ['kikyo'] },
    face: { jaw: .35, long: true, brow: 'calm', eyes: 'narrow', mouth: 'calm', skin: '#e9bb98', age: .3 },
    bg: { type: 'flame', c1: '#2a0e2a', c2: '#06020a', accent: '#c04aff' },
    banner: { side: 'left', color: '#d8dcf4', mon: 'kikyo', ink: '#2a3a7a' },
    stats: { bu: 82, chi: 95, tou: 88 },
    skill: { type: 'hint', value: 2, name: '本能寺の変', desc: '1合戦につき2回、誤答を1つ消す' },
    quote: { en: 'The enemy is closer than you think.', ja: '敵は、思うよりも近くにいる。' }
  },
  {
    id: 'kanetsugu', name: '直江兼続', nameEn: 'Naoe Kanetsugu', rarity: 'SSR', title: '愛の兜', clan: '上杉家', mon: 'take',
    colors: { armor: '#2b3550', lace: '#a8b8e8', accent: '#d8a521', cloth: '#1a2030' },
    helmet: { type: 'kabuto', metal: 'navy', lace: '#a8b8e8', maedate: ['ai'], rivets: true },
    face: { jaw: .3, brow: 'calm', eyes: 'calm', mouth: 'calm', skin: '#efc4a2' },
    bg: { type: 'sakura', c1: '#f4c6d6', c2: '#6a3a5a', accent: '#ffe4ec' },
    stats: { bu: 78, chi: 93, tou: 86 },
    skill: { type: 'exp', value: .3, name: '直江状', desc: '獲得経験値 +30%' },
    quote: { en: 'Lead with love, and loyalty will follow.', ja: '愛をもって導けば、義は自ずとついてくる。' }
  },
  {
    id: 'motonari', name: '毛利元就', nameEn: 'Mori Motonari', rarity: 'SSR', title: '謀神', clan: '毛利家', mon: 'mitsuboshi',
    colors: { armor: '#3a2a1a', lace: '#6a5a3a', accent: '#c89a3a', cloth: '#1a120a', robe: '#3a3020', inner: '#efe7d2', trim: '#7a6a40', monColor: '#e8dcb8' },
    body: 'robe',
    helmet: { type: 'court' },
    face: { jaw: .6, long: true, brow: 'calm', eyes: 'narrow', mouth: 'calm', beard: 'long', beardColor: '#cfc8bc', hairColor: '#8a8478', skin: '#e0ac86', age: .9 },
    bg: { type: 'wave', c1: '#3a5a7a', c2: '#0a1424', accent: '#f4d27a' },
    weapon: 'arrows',
    stats: { bu: 70, chi: 99, tou: 92 },
    skill: { type: 'koban', value: .6, name: '三矢の訓', desc: '獲得小判 +60%' },
    quote: { en: 'One arrow breaks easily. Three together do not.', ja: '一本の矢は折れても、三本束ねれば折れぬ。' }
  },
  {
    id: 'kiyomasa', name: '加藤清正', nameEn: 'Kato Kiyomasa', rarity: 'SSR', title: '虎退治', clan: '加藤家', mon: 'janome',
    colors: { armor: '#2a2a30', lace: '#c8c8d0', accent: '#d8a521', cloth: '#16161a' },
    helmet: { type: 'eboshi', metal: 'silver', lace: '#3a3a44', shikoro: 3 },
    face: { jaw: 1, wide: true, brow: 'thick', eyes: 'sharp', mouth: 'stern', beard: 'full', skin: '#d9a47e' },
    bg: { type: 'mountain', c1: '#e8d8b0', c2: '#5a4020', accent: '#ff8a3a' },
    weapon: 'yari',
    stats: { bu: 95, chi: 74, tou: 87 },
    skill: { type: 'exp', value: .3, name: '築城の名手', desc: '獲得経験値 +30%' },
    quote: { en: 'Build your foundation deep, and nothing can shake you.', ja: '石垣は深く積め。何ものにも揺るがぬように。' }
  },
  {
    id: 'ginchiyo', name: '立花誾千代', nameEn: 'Tachibana Ginchiyo', rarity: 'SSR', title: '雷神の姫', clan: '立花家', mon: 'gion',
    colors: { armor: '#c8ccd6', lace: '#6a4ac8', accent: '#9a7af0', cloth: '#2a1a40', collar: '#f6f0ff', under: '#5a3aa8' },
    body: 'female', hair: 'long', hachimaki: '#f4f4ff',
    helmet: { type: 'none' },
    face: { female: true, jaw: 0, brow: 'thin', eyes: 'female', mouth: 'calm', skin: '#f6d2b8', iris: '#4a2a6a' },
    bg: { type: 'storm', c1: '#3a2a6a', c2: '#0a0618', accent: '#d8c8ff' },
    weapon: 'naginata',
    stats: { bu: 90, chi: 84, tou: 86 },
    skill: { type: 'combo', value: .35, name: '雷切', desc: '連撃ボーナス +35%' },
    quote: { en: 'Strength has no gender. Only resolve.', ja: '強さに男女はない。あるのは覚悟のみ。' }
  },

  /* ============================== SR ============================== */
  {
    id: 'kanbei', name: '黒田官兵衛', nameEn: 'Kuroda Kanbei', rarity: 'SR', title: '天才軍師', clan: '黒田家', mon: 'tomoe',
    colors: { armor: '#2a2a30', lace: '#3a3a4a', accent: '#c8241c', cloth: '#16161a' },
    helmet: { type: 'gokei', metal: 'red', lace: '#2a2a34', shikoro: 3 },
    face: { jaw: .5, brow: 'calm', eyes: 'narrow', mouth: 'smirk', beard: 'goatee', skin: '#e2ad88', age: .4 },
    bg: { type: 'mountain', c1: '#c8d0d8', c2: '#2a3440', accent: '#f4e0b0' },
    weapon: { type: 'gunbai', side: 'right', mon: 'tomoe' },
    stats: { bu: 68, chi: 98, tou: 84 },
    skill: { type: 'hint', value: 1, name: '神算鬼謀', desc: '1合戦につき1回、誤答を1つ消す' },
    quote: { en: 'Win without fighting, if you can.', ja: '戦わずして勝つ。それが最上の策。' }
  },
  {
    id: 'ujiyasu', name: '北条氏康', nameEn: 'Hojo Ujiyasu', rarity: 'SR', title: '相模の獅子', clan: '北条家', mon: 'uroko',
    colors: { armor: '#3a3a20', lace: '#c8a83a', accent: '#d8a521', cloth: '#1a1a0a' },
    helmet: { type: 'kabuto', metal: 'bronze', lace: '#8a6a2a', maedate: ['kuwagata'], kuwagataLen: .8 },
    face: { jaw: .8, brow: 'thick', eyes: 'sharp', mouth: 'stern', beard: 'mustache', scar: true, skin: '#d9a27a', age: .3 },
    bg: { type: 'sun', c1: '#6a5a20', c2: '#100a02', accent: '#f4c040' },
    banner: { side: 'left', color: '#1a1a1a', mon: 'uroko', ink: '#f4d27a' },
    stats: { bu: 86, chi: 90, tou: 92 },
    skill: { type: 'koban', value: .4, name: '氏康傷', desc: '獲得小判 +40%' },
    quote: { en: 'Scars on the front are a warrior\'s pride.', ja: '向こう傷は武士の誇り。' }
  },
  {
    id: 'mitsunari', name: '石田三成', nameEn: 'Ishida Mitsunari', rarity: 'SR', title: '義の官吏', clan: '石田家', mon: 'daiichi',
    colors: { armor: '#2a2a40', lace: '#4a5aa0', accent: '#8a9ad8', cloth: '#14141e' },
    helmet: { type: 'kabuto', metal: 'black', lace: '#4a5aa0', maedate: ['kuwagata'], kuwagataLen: .6, kuwagataColor: '#b8c2cc' },
    face: { jaw: .1, long: true, brow: 'fierce', eyes: 'narrow', mouth: 'stern', skin: '#f0c6a6' },
    bg: { type: 'mountain', c1: '#b8c8e0', c2: '#1a2440', accent: '#e8eef8' },
    banner: { side: 'right', color: '#f2f2f2', mon: 'daiichi', ink: '#1a1a1a' },
    stats: { bu: 62, chi: 94, tou: 80 },
    skill: { type: 'exp', value: .25, name: '大一大万大吉', desc: '獲得経験値 +25%' },
    quote: { en: 'Details win wars long before the first arrow flies.', ja: '戦は、矢が飛ぶ前の段取りで決まる。' }
  },
  {
    id: 'naomasa', name: '井伊直政', nameEn: 'Ii Naomasa', rarity: 'SR', title: '井伊の赤鬼', clan: '井伊家', mon: 'igeta',
    colors: { armor: '#c0241c', lace: '#e8402a', accent: '#d8a521', cloth: '#4a0a08' },
    helmet: { type: 'kabuto', metal: 'red', lace: '#e8402a', maedate: ['tentsuki'] },
    face: { jaw: .3, brow: 'fierce', eyes: 'sharp', mouth: 'stern', skin: '#efc29e' },
    bg: { type: 'flame', c1: '#7a1a0a', c2: '#140302', accent: '#ffb02e' },
    weapon: 'yari',
    stats: { bu: 92, chi: 76, tou: 88 },
    skill: { type: 'combo', value: .3, name: '赤備え', desc: '連撃ボーナス +30%' },
    quote: { en: 'Lead from the front. Always.', ja: '常に先陣を切れ。' }
  },
  {
    id: 'keiji', name: '前田慶次', nameEn: 'Maeda Keiji', rarity: 'SR', title: '天下御免の傾奇者', clan: '前田家', mon: 'umebachi',
    colors: { armor: '#2d1b4e', lace: '#d6336c', accent: '#f08c00', cloth: '#1a0f2e', robe: '#2d1b4e' },
    body: 'kabuki', hair: 'wild',
    helmet: { type: 'none' },
    face: { jaw: .6, brow: 'thick', eyes: 'sharp', mouth: 'grin', beard: 'goatee', skin: '#e6b28a', stubble: true },
    bg: { type: 'sakura', c1: '#ffb0c8', c2: '#4a1a3a', accent: '#fff0f4' },
    weapon: 'kiseru',
    stats: { bu: 96, chi: 78, tou: 70 },
    skill: { type: 'koban', value: .5, name: '傾奇御免', desc: '獲得小判 +50%' },
    quote: { en: 'Live boldly. Life is too short to be dull.', ja: '派手に生きよ。退屈するには人生は短い。' }
  },
  {
    id: 'hanzo', name: '服部半蔵', nameEn: 'Hattori Hanzo', rarity: 'SR', title: '鬼の半蔵', clan: '服部家', mon: 'shuriken',
    colors: { armor: '#1b1d24', lace: '#2c303a', accent: '#8a2a2a', cloth: '#101116' },
    body: 'ninja',
    helmet: { type: 'ninja' },
    face: { jaw: .5, brow: 'fierce', eyes: 'sharp', mouth: 'stern', skin: '#d9a682' },
    bg: { type: 'moon', c1: '#2a1a3a', c2: '#05030a', accent: '#e8d0a0' },
    weapon: 'ninjato',
    stats: { bu: 88, chi: 86, tou: 72 },
    skill: { type: 'hint', value: 1, name: '影働き', desc: '1合戦につき1回、誤答を1つ消す' },
    quote: { en: 'Silence is the sharpest blade.', ja: '沈黙こそ、最も鋭い刃。' }
  },
  {
    id: 'muneshige', name: '立花宗茂', nameEn: 'Tachibana Muneshige', rarity: 'SR', title: '西国無双', clan: '立花家', mon: 'gion',
    colors: { armor: '#3a3a44', lace: '#c8c8d8', accent: '#d8d8e8', cloth: '#1a1a22' },
    helmet: { type: 'kabuto', metal: 'silver', lace: '#4a4a5a', maedate: ['wanuki'] },
    face: { jaw: .4, brow: 'calm', eyes: 'sharp', mouth: 'calm', skin: '#ecbe9a' },
    bg: { type: 'wave', c1: '#2a4a6a', c2: '#050c18', accent: '#f4f0e0' },
    stats: { bu: 94, chi: 84, tou: 90 },
    skill: { type: 'exp', value: .25, name: '西国無双', desc: '獲得経験値 +25%' },
    quote: { en: 'Lose everything, keep your honor, and rise again.', ja: '全てを失っても、義を守れば再び立てる。' }
  },

  /* ============================== R ============================== */
  {
    id: 'yoshimoto', name: '今川義元', nameEn: 'Imagawa Yoshimoto', rarity: 'R', title: '海道一の弓取り', clan: '今川家', mon: 'hikiryo',
    colors: { armor: '#4a2a6a', lace: '#c8a0e8', accent: '#d8a521', cloth: '#2a1a3a', robe: '#5a3a8a', inner: '#f4eee0', trim: '#c8a83a', monColor: '#f4e0a8' },
    body: 'robe',
    helmet: { type: 'court' },
    face: { jaw: .7, wide: true, brow: 'court', eyes: 'soft', mouth: 'smile', makeup: true, ohaguro: true, skin: '#f7f1ea' },
    bg: { type: 'gold', c1: '#e8c870', c2: '#8a6a20', clouds: true, cloudColor: '#f4e4b0' },
    stats: { bu: 60, chi: 82, tou: 86 },
    skill: { type: 'koban', value: .3, name: '海道一', desc: '獲得小判 +30%' },
    quote: { en: 'Elegance is also a weapon.', ja: '雅もまた、武器なり。' }
  },
  {
    id: 'hanbei', name: '竹中半兵衛', nameEn: 'Takenaka Hanbei', rarity: 'R', title: '今孔明', clan: '竹中家', mon: 'kuyo',
    colors: { armor: '#2a4a3a', lace: '#6a9a7a', accent: '#5aa07a', cloth: '#122018', robe: '#2a4a3a', inner: '#f0ead8', trim: '#8ab89a' },
    body: 'robe', hair: 'tied',
    helmet: { type: 'none' },
    face: { jaw: .1, brow: 'thin', eyes: 'calm', mouth: 'calm', skin: '#f2cdb0' },
    bg: { type: 'mountain', c1: '#d8e8d8', c2: '#2a4030', accent: '#f8f4e0' },
    weapon: { type: 'gunbai', side: 'right', mon: 'kuyo', sun: '#2a5a3a' },
    stats: { bu: 52, chi: 97, tou: 78 },
    skill: { type: 'hint', value: 1, name: '十面埋伏', desc: '1合戦につき1回、誤答を1つ消す' },
    quote: { en: 'A clear mind sees ten moves ahead.', ja: '澄んだ心は十手先を見通す。' }
  },
  {
    id: 'kansuke', name: '山本勘助', nameEn: 'Yamamoto Kansuke', rarity: 'R', title: '隻眼の軍師', clan: '武田家', mon: 'hishi',
    colors: { armor: '#4a2a1a', lace: '#a0602a', accent: '#c4281e', cloth: '#1e120a' },
    helmet: { type: 'kabuto', metal: 'brown', lace: '#a0602a', maedate: ['monplate'], shikoro: 3 },
    face: { jaw: .7, brow: 'thick', eyes: 'narrow', mouth: 'stern', eyepatch: 'left', beard: 'goatee+', beardColor: '#5a5048', skin: '#d29c74', age: .7 },
    bg: { type: 'mountain', c1: '#d0c0a0', c2: '#3a2a18', accent: '#f0d090' },
    weapon: { type: 'gunbai', side: 'right', mon: 'hishi' },
    stats: { bu: 64, chi: 90, tou: 76 },
    skill: { type: 'exp', value: .15, name: 'キツツキ戦法', desc: '獲得経験値 +15%' },
    quote: { en: 'A good plan needs a second plan.', ja: '良き策には、次の策を備えよ。' }
  },
  {
    id: 'yoshihiro', name: '島津義弘', nameEn: 'Shimazu Yoshihiro', rarity: 'R', title: '鬼島津', clan: '島津家', mon: 'juji',
    colors: { armor: '#2a2a2a', lace: '#3a6a3a', accent: '#d8a521', cloth: '#141a14' },
    helmet: { type: 'kabuto', metal: 'black', lace: '#3a6a3a', maedate: ['kuwagata', 'monplate'], kuwagataLen: .7 },
    face: { jaw: 1, wide: true, brow: 'thick', eyes: 'sharp', mouth: 'stern', beard: 'full', beardColor: '#8a8478', skin: '#cf9a72', age: .75 },
    bg: { type: 'flame', c1: '#3a2a0a', c2: '#0a0602', accent: '#ffc040' },
    banner: { side: 'left', color: '#f4f0e6', mon: 'juji', ink: '#1a1a1a' },
    stats: { bu: 95, chi: 76, tou: 88 },
    skill: { type: 'guard', value: 1, name: '捨て奸', desc: '1合戦につき1回ミスで連撃が途切れない' },
    quote: { en: 'Retreat forward, through the enemy.', ja: '退くなら前へ。敵中を突破せよ。' }
  },
  {
    id: 'motochika', name: '長宗我部元親', nameEn: 'Chosokabe Motochika', rarity: 'R', title: '土佐の出来人', clan: '長宗我部家', mon: 'katabami',
    colors: { armor: '#3a2a4a', lace: '#7a5aa0', accent: '#d8a521', cloth: '#1a1424' },
    helmet: { type: 'kabuto', metal: 'purple', lace: '#7a5aa0', maedate: ['kuwagata', 'sun'], kuwagataLen: .9 },
    face: { jaw: .4, brow: 'calm', eyes: 'sharp', mouth: 'calm', beard: 'mustache', skin: '#e4b08a' },
    bg: { type: 'wave', c1: '#3a5a8a', c2: '#06101e', accent: '#f4c040' },
    stats: { bu: 84, chi: 82, tou: 86 },
    skill: { type: 'koban', value: .25, name: '一領具足', desc: '獲得小判 +25%' },
    quote: { en: 'Even a gentle soul can rule the seas.', ja: '姫若子と呼ばれようと、海は統べられる。' }
  },
  {
    id: 'naotora', name: '井伊直虎', nameEn: 'Ii Naotora', rarity: 'R', title: '女城主', clan: '井伊家', mon: 'igeta',
    colors: { armor: '#c0241c', lace: '#f0a0a0', accent: '#e8402a', cloth: '#4a0a10', collar: '#fff4ee', under: '#d8332a' },
    body: 'female', hair: 'long', hachimaki: '#c0241c',
    helmet: { type: 'none' },
    face: { female: true, jaw: 0, brow: 'thin', eyes: 'female', mouth: 'calm', skin: '#f6d0b4', iris: '#5a2a1a' },
    bg: { type: 'sakura', c1: '#ffd0d8', c2: '#7a2a3a', accent: '#fff4f6' },
    weapon: 'naginata',
    stats: { bu: 66, chi: 86, tou: 88 },
    skill: { type: 'exp', value: .15, name: '女城主', desc: '獲得経験値 +15%' },
    quote: { en: 'Protect what matters, whatever the title.', ja: '肩書がどうあれ、守るべきものを守る。' }
  }
];
