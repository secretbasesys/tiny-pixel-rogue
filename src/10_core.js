/* =====================================================================
   TINY PIXEL ROGUE v4 · 타이니 픽셀 로그 — STONESHARD-SCALE
   Single-file HTML5 Canvas turn-based roguelike. No external assets.
   Town hub + contracts + wide field zones + grand dungeons.
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------- utils */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function RNG(seed) {
  const f = mulberry32(seed >>> 0);
  return {
    r: f,
    int: (a, b) => a + Math.floor(f() * (b - a + 1)),
    float: (a, b) => a + f() * (b - a),
    pick: arr => arr[Math.floor(f() * arr.length)],
    chance: p => f() < p,
    shuffle: arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
    weighted: (list) => { // list of [value, weight]
      let tot = 0; for (const it of list) tot += it[1];
      let r = f() * tot;
      for (const it of list) { r -= it[1]; if (r <= 0) return it[0]; }
      return list[list.length - 1][0];
    }
  };
}
function J(w, type) {
  if (!w) return w;
  const c = w.charCodeAt(w.length - 1);
  const jong = (c >= 0xAC00 && c <= 0xD7A3) ? (c - 0xAC00) % 28 : 0;
  const m = { iga: ['이', '가'], eun: ['은', '는'], eul: ['을', '를'], gwa: ['과', '와'], e: ['이', ''] };
  return w + (m[type] || m.iga)[jong ? 0 : 1];
}
const DIR8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const key = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const dist = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));
const euc = (a, b, c, d) => Math.hypot(a - c, b - d);

/* ---------------------------------------------------------------- audio */
const SFX = (() => {
  let ac = null, master = null, enabled = true;
  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.22; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!enabled) return; const c = ctx(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol == null ? 0.3 : vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, hp, delay) {
    if (!enabled) return; const c = ctx(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hp || 900; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = vol == null ? 0.25 : vol;
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0);
  }
  const lib = {
    step() { tone(120, 0.05, 'triangle', 0.05); },
    hit() { noise(0.09, 0.3, 700); tone(150, 0.08, 'square', 0.12, 90); },
    crit() { noise(0.13, 0.42, 1600); tone(420, 0.12, 'square', 0.16, 120); },
    hurt() { tone(220, 0.14, 'sawtooth', 0.15, 70); noise(0.1, 0.2, 400); },
    kill() { tone(300, 0.1, 'square', 0.1, 60); noise(0.2, 0.24, 500); },
    pick() { tone(880, 0.07, 'square', 0.1); tone(1320, 0.09, 'square', 0.08, null, 0.05); },
    gold() { tone(1180, 0.06, 'square', 0.08); tone(1560, 0.08, 'square', 0.07, null, 0.05); },
    drink() { tone(520, 0.09, 'sine', 0.14, 900); tone(300, 0.14, 'sine', 0.1, 180, 0.06); },
    throwp() { tone(600, 0.08, 'triangle', 0.1, 300); },
    bow() { tone(900, 0.05, 'triangle', 0.12, 200); noise(0.12, 0.18, 2200); },
    fire() { noise(0.3, 0.3, 500); tone(180, 0.25, 'sawtooth', 0.08, 60); },
    freeze() { tone(1400, 0.18, 'sine', 0.1, 700); noise(0.2, 0.12, 3000); },
    bolt() { tone(1200, 0.12, 'sawtooth', 0.12, 200); noise(0.14, 0.16, 2200); },
    zap() { tone(900, 0.18, 'square', 0.12, 90); noise(0.22, 0.22, 1800); },
    stairs() { tone(300, 0.1, 'sine', 0.1); tone(400, 0.1, 'sine', 0.1, null, 0.09); tone(520, 0.16, 'sine', 0.1, null, 0.18); },
    gate() { tone(220, 0.2, 'sine', 0.14); tone(160, 0.3, 'sine', 0.12, 90, 0.12); noise(0.3, 0.15, 300, 0.05); },
    lock() { tone(700, 0.04, 'square', 0.06); tone(1100, 0.05, 'square', 0.05, null, 0.06); noise(0.06, 0.1, 2600); },
    ui() { tone(700, 0.04, 'square', 0.05); },
    bad() { tone(140, 0.3, 'sawtooth', 0.16, 60); },
    heal() { tone(660, 0.1, 'sine', 0.1); tone(990, 0.14, 'sine', 0.09, null, 0.07); },
    level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.1, null, i * 0.08)); },
    boss() { tone(90, 0.6, 'sawtooth', 0.2, 50); tone(60, 0.8, 'square', 0.12, 40, 0.1); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.24, 'square', 0.1, null, i * 0.12)); },
    dead() { [420, 340, 260, 160].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.12, null, i * 0.16)); }
  };
  return {
    play(n) { try { if (lib[n]) lib[n](); } catch (e) { } },
    setEnabled(v) { enabled = v; },
    get enabled() { return enabled; },
    unlock() { ctx(); }
  };
})();

/* ---------------------------------------------------------------- save */
const SAVE_KEY = 'tinyPixelRogue.save.v4';
const DB = {
  best: 0, runs: [], codexM: {}, codexI: {}, muted: false, lastSeed: '',
  ui: { dpad: false, zoom: 1, map: true }
};
function loadDB() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) Object.assign(DB, JSON.parse(raw));
  } catch (e) { }
  if (!Array.isArray(DB.runs)) DB.runs = [];
  if (!DB.codexM || typeof DB.codexM !== 'object') DB.codexM = {};
  if (!DB.codexI || typeof DB.codexI !== 'object') DB.codexI = {};
  if (!DB.ui || typeof DB.ui !== 'object') DB.ui = { dpad: false, zoom: 1, map: true };
  if ([0.75, 1, 1.5, 2].indexOf(DB.ui.zoom) < 0) DB.ui.zoom = 1;
}
function saveDB() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(DB)); } catch (e) { }
}
function codexSee(kind) { DB.codexM[kind] = (DB.codexM[kind] || 0) + 1; }
function codexItem(id) { DB.codexI[id] = (DB.codexI[id] || 0) + 1; }

/* ---------------------------------------------------------------- world size (per zone) */
let W = 64, H = 48;
function setMapSize(w, h) { W = w; H = h; }

/* ---------------------------------------------------------------- tiles */
const T = {
  WALL: 0, FLOOR: 1, WATER: 2, GRASS: 3, OIL: 4, CHASM: 5,
  STAIRS: 6, DOOR: 7, LOCKED: 8, SECRET: 9, ICE: 10, RUBBLE: 11,
  PILLAR: 12, COVER: 13,
  ROAD: 14, DIRT: 15, WOOD: 16, TREE: 17, BUSH: 18, FENCE: 19,
  BRICK: 20, BANNER: 21, BRAZIER: 22, BOOKSHELF: 23, WELL: 24,
  STATUE: 25, TENT: 26, RETURN: 27, BLOOD: 28, GATE: 29,
  PLANK: 30, CARPET: 31, MUD: 32, MOSS: 33, ARCH: 34
};
/* walk / opaque(blocks sight) / proj(blocks bolts) / solid(blocks bodies) / moveCost */
const TILE_SPEC = {
  [T.WALL]:     { walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.FLOOR]:    { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.WATER]:    { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 2 },
  [T.GRASS]:    { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.OIL]:      { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.CHASM]:    { walk: 0, opaque: 0, proj: 0, solid: 0, cost: 0 },
  [T.STAIRS]:   { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.DOOR]:     { walk: 1, opaque: 1, proj: 1, solid: 0, cost: 1 },
  [T.LOCKED]:   { walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.SECRET]:   { walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.ICE]:      { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.RUBBLE]:   { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 2 },
  [T.PILLAR]:   { walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.COVER]:    { walk: 0, opaque: 0, proj: 1, solid: 1, cost: 0 },
  [T.ROAD]:     { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.DIRT]:     { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.WOOD]:     { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.TREE]:     { walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.BUSH]:     { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.FENCE]:    { walk: 0, opaque: 0, proj: 1, solid: 1, cost: 0 },
  [T.BRICK]:    { walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.BANNER]:   { walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.BRAZIER]:  { walk: 0, opaque: 0, proj: 0, solid: 1, cost: 0 },
  [T.BOOKSHELF]:{ walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.WELL]:     { walk: 0, opaque: 0, proj: 1, solid: 1, cost: 0 },
  [T.STATUE]:   { walk: 0, opaque: 0, proj: 1, solid: 1, cost: 0 },
  [T.TENT]:     { walk: 0, opaque: 1, proj: 1, solid: 1, cost: 0 },
  [T.RETURN]:   { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.BLOOD]:    { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.GATE]:     { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.PLANK]:    { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.CARPET]:   { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.MUD]:      { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 2 },
  [T.MOSS]:     { walk: 1, opaque: 0, proj: 0, solid: 0, cost: 1 },
  [T.ARCH]:     { walk: 0, opaque: 0, proj: 1, solid: 1, cost: 0 }
};
const TILE_WALK = {}, TILE_OPAQUE = {}, TILE_PROJ = {}, TILE_SOLID = {}, TILE_COST = {};
for (const k in TILE_SPEC) {
  const s = TILE_SPEC[k];
  TILE_WALK[k] = !!s.walk; TILE_OPAQUE[k] = !!s.opaque; TILE_PROJ[k] = !!s.proj;
  TILE_SOLID[k] = !!s.solid; TILE_COST[k] = s.cost;
}

/* ---------------------------------------------------------------- classes */
const CLASSES = {
  warrior: {
    id: 'warrior', name: '전사', color: '#e2b45c',
    desc: '두꺼운 체력과 장검·창. 정면에서 버틴다.',
    stats: 'HP 44 · MP 8 · 공격 6 · 치명 10%',
    hp: 44, mp: 8, atk: 6, crit: 0.1, sight: 8,
    slots: [
      { name: '장검', dmg: 5, crit: 0.1, reach: 1, kind: 'sword', plus: 0 },
      { name: '전투 창', dmg: 4, crit: 0.08, reach: 2, kind: 'spear', plus: 0 }
    ],
    armor: { name: '사슬 갑옷', def: 3, plus: 0 },
    kit: [{ t: 'potion', k: 'heal', n: 2 }, { t: 'food', k: 'ration', n: 2 }, { t: 'lockpick', n: 2 }, { t: 'scroll', k: 'identify', n: 1 }]
  },
  rogue: {
    id: 'rogue', name: '도적', color: '#7fd18a',
    desc: '높은 치명타, 단검과 단궁. 함정과 자물쇠의 달인.',
    stats: 'HP 30 · MP 12 · 공격 4 · 치명 35%',
    hp: 30, mp: 12, atk: 4, crit: 0.35, sight: 9, trapSense: 0.6,
    slots: [
      { name: '단검', dmg: 3, crit: 0.35, reach: 1, kind: 'dagger', plus: 0 },
      { name: '단궁', dmg: 4, crit: 0.14, reach: 1, kind: 'bow', range: 5, ranged: true, plus: 0 }
    ],
    armor: { name: '가죽 조끼', def: 1, plus: 0 },
    kit: [{ t: 'wand', k: 'blink', n: 1, charges: 4 }, { t: 'potion', k: 'speed', n: 1 }, { t: 'food', k: 'ration', n: 1 }, { t: 'lockpick', n: 4 }, { t: 'potion', k: 'heal', n: 1 }]
  },
  mage: {
    id: 'mage', name: '마법사', color: '#7fb6e8',
    desc: '화염 마법과 석궁. 유리 대포지만 원소 연계가 강하다.',
    stats: 'HP 28 · MP 24 · 공격 3 · 지력 2',
    hp: 28, mp: 24, atk: 3, crit: 0.08, sight: 8, int: 2,
    slots: [
      { name: '불꽃 지팡이', dmg: 2, crit: 0.05, reach: 1, kind: 'staff', plus: 0 },
      { name: '석궁', dmg: 6, crit: 0.08, reach: 1, kind: 'crossbow', range: 4, ranged: true, plus: 0 }
    ],
    armor: { name: '로브', def: 1, plus: 0 },
    kit: [{ t: 'wand', k: 'firebolt', n: 1, charges: 7 }, { t: 'potion', k: 'mana', n: 1 }, { t: 'potion', k: 'heal', n: 1 }, { t: 'scroll', k: 'identify', n: 2 }, { t: 'lockpick', n: 2 }]
  }
};

/* ---------------------------------------------------------------- monsters */
const MONS = {
  rat: { name: '쥐', hp: 5, atk: 2, def: 0, xp: 2, ai: 'erratic', spr: 'rat', desc: '빠르게 튀어다니는 잡몹.' },
  goblin: { name: '고블린', hp: 9, atk: 3, def: 0, xp: 4, ai: 'chase', spr: 'goblin', desc: '작고 사납다. 금화를 좋아한다.' },
  bat: { name: '박쥐', hp: 6, atk: 2, def: 0, xp: 3, ai: 'erratic', fly: true, spr: 'bat', desc: '물과 구덩이를 날아 넘는다.' },
  skeleton: { name: '해골 병사', hp: 12, atk: 4, def: 1, xp: 6, ai: 'chase', undead: true, spr: 'skeleton', desc: '독에 강하고 회복 물약에 피해를 입는다.' },
  slime: { name: '슬라임', hp: 10, atk: 2, def: 0, xp: 5, ai: 'chase', split: true, spr: 'slime', desc: '죽으면 둘로 갈라진다.' },
  shaman: { name: '주술사', hp: 9, atk: 3, def: 0, xp: 7, ai: 'ranged', range: 5, spr: 'shaman', tele: 'hex', teleCd: 4, desc: '멀리서 저주 화살을 쏘고, 땅에 저주 폭탄을 예고한다.' },
  mimic: { name: '미믹', hp: 16, atk: 6, def: 1, xp: 12, ai: 'chase', spr: 'mimic', desc: '상자로 위장하고 있다.' },
  orc: { name: '오크 대장', hp: 50, atk: 7, def: 2, xp: 40, ai: 'chase', boss: true, spr: 'orc', tele: 'cleave', teleCd: 3, desc: '대지를 가르는 일격을 예고한다.' },
  lich: { name: '고대 리치', hp: 95, atk: 10, def: 3, xp: 100, ai: 'ranged', range: 6, boss: true, undead: true, fireImmune: true, spr: 'lich', tele: 'deathwave', teleCd: 3, desc: '죽음의 파동을 예고한다.' },
  imp: { name: '임프', hp: 14, atk: 5, def: 1, xp: 10, ai: 'chase', fly: true, fireImmune: true, spr: 'imp', tele: 'firebomb', teleCd: 4, desc: '불꽃을 두르고 날아들며 화염을 예고한다.' },
  golem: { name: '돌 골렘', hp: 26, atk: 7, def: 4, xp: 16, ai: 'chase', slow: true, spr: 'golem', tele: 'quake', teleCd: 4, desc: '느리지만 단단하다. 지진 강타를 예고한다.' },
  wraith: { name: '망령', hp: 18, atk: 6, def: 1, xp: 14, ai: 'chase', fly: true, undead: true, spr: 'wraith', desc: '공격을 흘리며 떠다닌다.' },
  wolf: { name: '들늑대', hp: 11, atk: 3, def: 0, xp: 5, ai: 'chase', fast: true, spr: 'wolf', desc: '빠르게 달려와 물어뜯는다. 무리로 사냥한다.' },
  boar: { name: '멧돼지', hp: 18, atk: 5, def: 1, xp: 8, ai: 'chase', spr: 'boar', desc: '돌진해 밀어붙이는 야수.' },
  spider: { name: '동굴 거미', hp: 8, atk: 3, def: 0, xp: 5, ai: 'erratic', spr: 'spider', desc: '독을 가진 거미. 빠르게 튄다.' },
  bandit: { name: '산적', hp: 15, atk: 4, def: 1, xp: 8, ai: 'chase', spr: 'bandit', desc: '숲길을 지키는 산적. 동료를 부른다.' },
  banditArcher: { name: '산적 궁수', hp: 12, atk: 4, def: 0, xp: 9, ai: 'ranged', range: 5, spr: 'banditArcher', desc: '멀리서 화살을 쏜다. 붙으면 물러난다.' },
  cultist: { name: '광신도', hp: 13, atk: 4, def: 1, xp: 9, ai: 'ranged', range: 5, spr: 'cultist', tele: 'hex', teleCd: 4, desc: '저주를 예고하는 광신도.' },
  banditlord: { name: '산적 두목', hp: 78, atk: 9, def: 3, xp: 70, ai: 'chase', boss: true, spr: 'banditlord', tele: 'cleave', teleCd: 3, desc: '야영지의 주인. 도끼를 크게 휘두른다.' },
  bonewarden: { name: '뼈의 수호자', hp: 86, atk: 8, def: 3, xp: 75, ai: 'chase', boss: true, undead: true, spr: 'bonewarden', tele: 'quake', teleCd: 3, desc: '납골당을 지키는 거대 해골. 땅을 가른다.' },
  alchemist: { name: '광기의 연금술사', hp: 72, atk: 8, def: 2, xp: 75, ai: 'ranged', range: 6, boss: true, spr: 'alchemist', tele: 'firebomb', teleCd: 3, desc: '요새의 주인. 불꽃 폭탄을 예고한다.' },
  goblinShop: { name: '고블린 상인', hp: 40, atk: 0, def: 2, xp: 0, ai: 'idle', spr: 'goblinShop', desc: '던전에서 장사를 하는 고블린. 공격하지 않는다.' }
};

/* ---------------------------------------------------------------- item kinds */
const POTIONS = [
  { k: 'heal', name: '회복 물약', desc: 'HP를 16 회복한다. 언데드에게 던지면 피해를 준다.', use: 'drink' },
  { k: 'fire', name: '화염 물약', desc: '던진 자리에 불길이 일어난다.', use: 'throw' },
  { k: 'poison', name: '독 물약', desc: '던진 자리에 독구름이 퍼진다.', use: 'throw' },
  { k: 'frost', name: '냉기 물약', desc: '주변을 얼리고 물을 얼음으로 만든다.', use: 'throw' },
  { k: 'confuse', name: '혼란 물약', desc: '던진 자리의 적이 갈피를 못 잡는다.', use: 'throw' },
  { k: 'speed', name: '신속 물약', desc: '잠시 동안 두 배로 움직인다.', use: 'drink' },
  { k: 'mana', name: '마나 물약', desc: 'MP를 16 회복한다.', use: 'drink' }
];
const POTION_COLORS = [
  { n: '붉은', c: '#e4585c' }, { n: '초록', c: '#7fd18a' }, { n: '푸른', c: '#5aa9e6' },
  { n: '노란', c: '#e9c25c' }, { n: '보라', c: '#b07fe0' }, { n: '주황', c: '#ef8a4a' },
  { n: '분홍', c: '#e87fa8' }, { n: '청록', c: '#5fd6c8' }
];
const SCROLLS = [
  { k: 'identify', name: '감정 두루마리', desc: '가방 속 모든 아이템의 정체를 밝힌다.' },
  { k: 'teleport', name: '순간이동 두루마리', desc: '이 지역 어딘가로 순간이동한다.' },
  { k: 'mapping', name: '지도 두루마리', desc: '이 지역의 지형을 모두 밝힌다.' },
  { k: 'upgrade', name: '강화 두루마리', desc: '무기나 갑옷을 +1 강화한다.' },
  { k: 'fear', name: '공포 두루마리', desc: '보이는 적들이 도망친다.' }
];
const SCROLL_LABELS = ['ZYN', 'KRA', 'VOL', 'MIR', 'XAN', 'THU', 'ERB', 'NOX'];

const WANDS = {
  firebolt: { name: '화염 마법봉', desc: '불꽃을 쏘아 8 피해. 풀밭을 태운다.', dmg: 8, range: 7, color: '#ff8a3c', mp: 2 },
  lightning: { name: '번개 마법봉', desc: '10 피해. 물을 타고 연쇄 감전.', dmg: 10, range: 7, color: '#9fd8ff', mp: 3 },
  blink: { name: '순간이동 마법봉', desc: '보이는 위치로 순간이동.', dmg: 0, range: 8, color: '#b07fe0', mp: 2 },
  knockback: { name: '밀치기 마법봉', desc: '4 피해를 주고 적을 밀어낸다.', dmg: 4, range: 4, color: '#7fd1b0', mp: 2 }
};
const RINGS = {
  vampiric: { name: '흡혈의 반지', desc: '가한 피해의 30%를 회복한다.' },
  haste: { name: '가속의 반지', desc: '가끔 한 번 더 행동한다.' },
  regen: { name: '재생의 반지', desc: '3턴마다 HP를 1 회복한다.' },
  vision: { name: '시야의 반지', desc: '시야가 2칸 늘어난다.' },
  mana: { name: '마력의 반지', desc: '최대 MP +6, MP 회복이 빨라진다.' }
};
const WEAPON_TYPES = [
  { kind: 'dagger', name: '단검', dmg: 3, crit: 0.3 },
  { kind: 'sword', name: '장검', dmg: 5, crit: 0.1 },
  { kind: 'spear', name: '창', dmg: 4, crit: 0.08, reach: 2 },
  { kind: 'axe', name: '전투 도끼', dmg: 7, crit: 0.06 },
  { kind: 'bow', name: '단궁', dmg: 4, crit: 0.14, range: 5, ranged: true },
  { kind: 'crossbow', name: '석궁', dmg: 6, crit: 0.08, range: 4, ranged: true }
];
/* ---------------------------------------------------------------- weapon arts */
const WEAPON_ART = {
  dagger: { name: '기습', short: '기습', desc: '잠든·기절·후방의 적에게 2.2배 치명타와 추가 피해.' },
  sword: { name: '방어 태세', short: '방어', desc: '대기하면 다음 공격을 막고 반격하는 방어 태세를 취한다.' },
  spear: { name: '관통·저지', short: '관통', desc: '2칸을 찌르고 뒤의 적도 관통한다. 대기하면 접근하는 적을 저지한다.' },
  axe: { name: '휩쓸기', short: '휩쓸기', desc: '대상과 대상에 붙은 적들을 한 번에 베어낸다.' },
  staff: { name: '집중', short: '집중', desc: '마법봉 위력이 지력에 비례해 오른다.' },
  bow: { name: '조준 사격', short: '조준', desc: '3칸 이상 떨어진 적을 노리면 피해 +3. 붙으면 위력이 줄어든다.' },
  crossbow: { name: '관통 볼트', short: '관통', desc: '일직선의 적 둘을 꿰뚫는다. 붙으면 위력이 줄어든다.' }
};

/* ---------------------------------------------------------------- class skills */
const SKILLS = {
  warrior: [
    {
      id: 'bash', name: '방패 밀치기', icon: '⬢', cd: 4, range: 1, mode: 'enemy', mp: 3,
      desc: '1칸 밀쳐낸다. 벽·기둥에 부딪히면 기절 2턴과 추가 피해, 구덩이면 즉사, 불·함정이면 발동.'
    },
    {
      id: 'whirl', name: '회전 베기', icon: '⟳', cd: 5, range: 1, mode: 'self', mp: 5,
      desc: '주변 8칸의 모든 적을 한 번에 베어낸다.'
    }
  ],
  rogue: [
    {
      id: 'shadow', name: '그림자 이동', icon: '➤', cd: 3, range: 3, mode: 'tile', mp: 4,
      desc: '3칸 안의 빈 곳으로 순간 이동한다. 적을 대상으로 하면 자리를 바꿔 등 뒤로 파고들어 은신한다.'
    },
    {
      id: 'throw', name: '투척 단검', icon: '➶', cd: 3, range: 5, mode: 'enemy', mp: 2,
      desc: '시야가 트인 적에게 단검을 던진다. 방심한 적에게는 치명타.'
    }
  ],
  mage: [
    {
      id: 'pulse', name: '충격파', icon: '◎', cd: 4, range: 1, mode: 'self', mp: 4,
      desc: '주변 8칸의 적을 밀쳐내고 피해를 준다. 벽·구덩이·불길과 연계된다.'
    },
    {
      id: 'shield', name: '마력 보호막', icon: '◇', cd: 6, range: 0, mode: 'self', mp: 6,
      desc: '5턴 동안 피해를 흡수하는 마력 보호막을 두른다.'
    }
  ]
};
const SKILL_BY_ID = {};
for (const c in SKILLS) for (const s of SKILLS[c]) SKILL_BY_ID[s.id] = Object.assign({ cls: c }, s);

/* ---------------------------------------------------------------- enemy telegraphs */
const TELE_KINDS = {
  hex: { name: '저주 폭탄', color: '#b07fe0', icon: '☠' },
  quake: { name: '지진 강타', color: '#e07f36', icon: '⚡' },
  firebomb: { name: '화염 작렬', color: '#ff8a3c', icon: '🔥' },
  cleave: { name: '대지 가르기', color: '#e0553c', icon: '⚔' },
  deathwave: { name: '죽음의 파동', color: '#9f6fe0', icon: '☠' }
};
const ARMOR_TYPES = [
  { name: '가죽 갑옷', def: 2 }, { name: '사슬 갑옷', def: 4 }, { name: '판금 갑옷', def: 6 }
];

/* ---------------------------------------------------------------- biomes & contracts */
const BIOMES = {
  forest: {
    name: '검은 숲', field: '숲길', dungeon: '고목 폐허',
    ground: T.GRASS, alt: T.DIRT, accent: '#3d6b3f', sky: '#0e1512',
    desc: '안개 낀 숲길. 늑대와 산적이 길목을 지킨다.'
  },
  ruins: {
    name: '무너진 옛길', field: '폐허 들판', dungeon: '고대 납골당',
    ground: T.DIRT, alt: T.RUBBLE, accent: '#5a5347', sky: '#12100e',
    desc: '부서진 성벽과 돌무더기. 해골이 서성인다.'
  },
  marsh: {
    name: '썩은 습지', field: '독안개 습지', dungeon: '연금술 요새',
    ground: T.MUD, alt: T.WATER, accent: '#3f5b45', sky: '#0d1412',
    desc: '물이 고인 습지. 거미와 광신도가 도사린다.'
  }
};
const CONTRACT_TEMPLATES = [
  {
    id: 'bandit', name: '산적 야영지 토벌', biome: 'forest',
    boss: 'banditlord', bossName: '산적 두목 그로스카',
    desc: '북쪽 숲길에 산적 야영지가 들어섰다. 길을 막는 두목을 베어라.',
    elite: 'banditArcher'
  },
  {
    id: 'crypt', name: '고대 납골당 정화', biome: 'ruins',
    boss: 'bonewarden', bossName: '뼈의 수호자',
    desc: '옛 성벽 아래 납골당에서 해골이 일어난다. 수호자를 잠재워라.',
    elite: 'skeleton'
  },
  {
    id: 'fort', name: '버려진 연금술 요새', biome: 'marsh',
    boss: 'alchemist', bossName: '광기의 연금술사 베스',
    desc: '독안개 너머 요새에서 연금술 실험이 계속된다. 실험자를 멈춰라.',
    elite: 'cultist'
  }
];

/* ---------------------------------------------------------------- helper tables */
const STATUS_NAME = {
  poison: '중독', burn: '화상', freeze: '빙결', confuse: '혼란',
  haste: '가속', regen: '재생', bless: '축복', curse: '저주', weak: '약화', blind: '실명',
  wet: '젖음', oil: '기름', stun: '기절', guard: '방어 태세', brace: '저지',
  stealth: '은신', shield: '보호막', slow: '둔화', fear: '공포'
};
const STATUS_ICON = {
  poison: '☠', burn: '🔥', freeze: '❄', confuse: '💫', haste: '⚡', regen: '✚', bless: '✦',
  curse: '☠', weak: '▼', blind: '◍', wet: '💧', oil: '🛢', stun: '★', guard: '🛡', brace: '⟂',
  stealth: '🌫', shield: '◇', slow: '🐌', fear: '😱'
};
const STATUS_TONE = {
  poison: 'bad', burn: 'bad', freeze: 'bad', confuse: 'bad', curse: 'bad', weak: 'bad',
  blind: 'bad', slow: 'bad', fear: 'bad', haste: 'good', regen: 'good', bless: 'good',
  guard: 'good', brace: 'good', stealth: 'good', shield: 'good'
};
