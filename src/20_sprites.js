/* =====================================================================
   SPRITES — all drawn procedurally into 16x16 offscreen canvases
   ===================================================================== */
const SP = {};
const SPR = 16;

function newCv(w, h) {
  const c = document.createElement('canvas'); c.width = w || SPR; c.height = h || SPR;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return c;
}
function pix(rows, pal) {
  const c = newCv(), g = c.getContext('2d');
  for (let y = 0; y < rows.length && y < 16; y++) {
    const row = rows[y];
    for (let x = 0; x < 16; x++) {
      const ch = row[x] || '.';
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}
function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }

/* ---------------------------------------------------------------- terrain */
function makeFloor(v, base) {
  const c = newCv(), g = c.getContext('2d');
  const r = RNG(1000 + v * 977);
  px(g, 0, 0, 16, 16, '#1d2129');
  const toners = ['#333a47', '#2f3541', '#38404e', '#2b313d'];
  for (let by = 0; by < 2; by++) {
    for (let bx = 0; bx < 2; bx++) {
      const x = bx * 8 + 1, y = by * 8 + 1, w = 7, h = 7;
      const t = toners[(bx + by * 2 + v * 3) % toners.length];
      px(g, x, y, w, h, t);
      px(g, x, y, w, 1, 'rgba(255,255,255,.11)');
      px(g, x, y, 1, h, 'rgba(255,255,255,.07)');
      px(g, x, y + h - 1, w, 1, 'rgba(0,0,0,.38)');
      px(g, x + w - 1, y, 1, h, 'rgba(0,0,0,.3)');
    }
  }
  for (let i = 0; i < 5; i++) px(g, r.int(2, 13), r.int(2, 13), 1, 1, 'rgba(0,0,0,.26)');
  if (v === 1) { px(g, 3, 5, 3, 1, 'rgba(0,0,0,.3)'); px(g, 4, 6, 1, 1, 'rgba(0,0,0,.3)'); }
  if (v === 2) { px(g, 9, 11, 2, 2, 'rgba(92,126,92,.18)'); }
  return c;
}
function makeWall() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 0, 0, 16, 16, '#12161d');
  const bh = 5;
  for (let y = 0, row = 0; y < 16; y += bh, row++) {
    const off = (row % 2) * 4;
    for (let x = -4; x < 16; x += 8) {
      px(g, x + off, y, 8, bh - 1, row === 0 ? '#3b4350' : '#333a46');
      px(g, x + off, y, 8, 1, '#525d6e');
      px(g, x + off, y + bh - 2, 8, 1, '#1a1f27');
      px(g, x + off, y + 1, 1, bh - 2, 'rgba(255,255,255,.05)');
    }
  }
  const r = RNG(4242);
  for (let i = 0; i < 16; i++) px(g, r.int(0, 15), r.int(0, 15), 1, 1, r.chance(0.5) ? '#1d222b' : '#454e5d');
  px(g, 0, 0, 16, 1, '#69748a');
  px(g, 0, 15, 16, 1, '#0b0e13');
  return c;
}
function makeWallTop() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 0, 0, 16, 16, '#2b313d');
  const r = RNG(99);
  for (let i = 0; i < 24; i++) px(g, r.int(0, 15), r.int(0, 15), 1, 1, r.chance(0.5) ? '#333a47' : '#242a34');
  px(g, 0, 14, 16, 2, '#1b1f27');
  return c;
}
function makeWater(f) {
  const c = newCv(), g = c.getContext('2d');
  px(g, 0, 0, 16, 16, '#1a3f63');
  const r = RNG(777);
  for (let i = 0; i < 20; i++) px(g, r.int(0, 15), r.int(0, 15), 1, 1, r.chance(0.5) ? '#21527e' : '#163553');
  for (let i = 0; i < 3; i++) {
    const y = 2 + i * 5 + (f ? 1 : 0);
    px(g, 1 + i * 3, y, 4, 1, '#3b7aa8');
    px(g, 9 - i * 2, y + 2, 3, 1, '#2f6b96');
  }
  px(g, 0, 0, 16, 1, 'rgba(120,190,255,.28)');
  return c;
}
function makeGrass(v) {
  v = v || 0;
  const c = newCv(), g = c.getContext('2d');
  const r = RNG(313 + v * 811);
  const base = ['#3a4d33', '#38492f', '#3d5136'][v % 3];
  px(g, 0, 0, 16, 16, base);
  for (let i = 0; i < 34; i++) px(g, r.int(0, 15), r.int(0, 15), 1, 1, r.chance(0.5) ? '#425838' : '#31432c');
  for (let i = 0; i < 8; i++) {
    const x = r.int(1, 14), y = r.int(5, 15), h = r.int(1, 3);
    px(g, x, y - h, 1, h, r.chance(0.5) ? '#52734a' : '#405c39');
  }
  for (let i = 0; i < 3; i++) px(g, r.int(1, 14), r.int(1, 14), 1, 1, r.chance(0.5) ? '#6d8a4e' : '#2b3b26');
  if (v === 1) px(g, r.int(2, 12), r.int(2, 12), 1, 1, '#8fae5e');
  return c;
}
function makeOil() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.floor[2], 0, 0);
  px(g, 0, 0, 16, 16, 'rgba(30,20,44,.62)');
  const r = RNG(515);
  for (let i = 0; i < 12; i++) px(g, r.int(0, 15), r.int(0, 15), r.int(1, 3), 1, 'rgba(90,60,140,.35)');
  px(g, 3, 4, 5, 1, 'rgba(180,150,255,.18)');
  return c;
}
function makeChasm() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 0, 0, 16, 16, '#05060a');
  const r = RNG(808);
  for (let i = 0; i < 10; i++) px(g, r.int(0, 15), r.int(0, 15), 1, 1, '#0b0e16');
  px(g, 0, 0, 16, 1, '#151922'); px(g, 0, 15, 16, 1, '#151922');
  px(g, 0, 0, 1, 16, '#151922'); px(g, 15, 0, 1, 16, '#151922');
  return c;
}
function makeStairs() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 0, 0, 16, 16, '#1b1e26');
  for (let i = 0; i < 4; i++) {
    const y = 1 + i * 4;
    px(g, 1, y, 14, 3, i % 2 ? '#33394a' : '#3d4557');
    px(g, 1, y, 14, 1, '#4d566c');
    px(g, 1, y + 3, 14, 1, '#12151b');
  }
  px(g, 1, 1, 14, 14, 'rgba(90,150,255,.10)');
  return c;
}
function makeDoor(locked) {
  const c = newCv(), g = c.getContext('2d');
  px(g, 0, 0, 16, 16, '#20242e');
  px(g, 1, 0, 14, 16, locked ? '#5b3a26' : '#6b4527');
  for (let i = 0; i < 3; i++) {
    px(g, 2 + i * 5, 1, 4, 14, locked ? '#6b4429' : '#7d512d');
    px(g, 2 + i * 5, 1, 1, 14, '#94603a');
  }
  px(g, 0, 7, 16, 2, '#4a4f5e');
  px(g, 0, 7, 16, 1, '#6a7182');
  if (locked) {
    px(g, 6, 10, 4, 3, '#e9c25c'); px(g, 7, 12, 2, 3, '#e9c25c');
    px(g, 7, 11, 2, 1, '#7a5a12');
  } else {
    px(g, 11, 10, 2, 2, '#e9c25c');
  }
  return c;
}
function makeSecret() { return makeWall(); }
function makeIce() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 0, 0, 16, 16, '#5f93b8');
  const r = RNG(606);
  for (let i = 0; i < 20; i++) px(g, r.int(0, 15), r.int(0, 15), 1, 1, r.chance(0.5) ? '#7db4d4' : '#4d7fa3');
  px(g, 0, 0, 16, 1, 'rgba(220,245,255,.5)');
  px(g, 0, 15, 16, 1, 'rgba(200,235,255,.25)');
  return c;
}
function makeRubble() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.floor[1], 0, 0);
  const r = RNG(232);
  for (let i = 0; i < 5; i++) {
    const x = r.int(1, 12), y = r.int(1, 12);
    px(g, x, y, r.int(2, 3), r.int(1, 2), '#4a5160');
    px(g, x, y, 1, 1, '#5c6577');
  }
  return c;
}
function makePillar() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.floor[0], 0, 0);
  g.fillStyle = 'rgba(0,0,0,.6)';
  g.beginPath(); g.ellipse(10, 14.5, 6.6, 2.4, 0, 0, 6.2832); g.fill();
  /* plinth */
  px(g, 1, 11, 14, 4, '#2b313c');
  px(g, 1, 11, 14, 1, '#5f6a7d');
  px(g, 2, 13, 12, 1, '#1a1e25');
  /* shaft with strong light from the upper-left */
  px(g, 4, 3, 8, 9, '#4a5464');
  px(g, 4, 3, 3, 9, '#6f7c92');
  px(g, 5, 3, 1, 9, '#9fabbf');
  px(g, 10, 3, 2, 9, '#333b47');
  px(g, 11, 3, 1, 9, '#232932');
  /* capital */
  g.fillStyle = '#5b677a';
  g.beginPath(); g.ellipse(8, 3.2, 5.4, 2.9, 0, 0, 6.2832); g.fill();
  g.fillStyle = '#8b97ab';
  g.beginPath(); g.ellipse(8, 2.6, 4.1, 2.0, 0, 0, 6.2832); g.fill();
  g.fillStyle = '#b6c2d6';
  g.beginPath(); g.ellipse(6.8, 2.1, 1.9, 0.9, 0, 0, 6.2832); g.fill();
  /* carved bands + chips */
  px(g, 4, 6, 8, 1, '#3a414d');
  px(g, 4, 9, 8, 1, '#3a414d');
  px(g, 8, 5, 1, 1, '#2f3540');
  px(g, 6, 10, 1, 1, '#2f3540');
  px(g, 9, 7, 1, 1, '#b6c2d6');
  return c;
}
function makeCover() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.floor[0], 0, 0);
  // low stone barricade, see over it
  px(g, 1, 7, 14, 7, '#3a404d');
  px(g, 1, 6, 14, 2, '#5c6577');
  px(g, 2, 7, 12, 1, '#6e788c');
  px(g, 1, 13, 14, 1, '#22262e');
  const r = RNG(717);
  for (let i = 0; i < 6; i++) px(g, r.int(2, 12), r.int(8, 12), 1, 1, r.chance(0.5) ? '#4a5160' : '#2c323c');
  // wooden braces
  px(g, 3, 10, 2, 3, '#6d4625');
  px(g, 11, 10, 2, 3, '#6d4625');
  px(g, 1, 8, 14, 1, 'rgba(255,255,255,.06)');
  return c;
}
function makeBarrel() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 3, 2, 10, 12, '#5c3a20');
  px(g, 3, 2, 10, 1, '#7d512d');
  px(g, 4, 3, 8, 10, '#6d4625');
  px(g, 4, 5, 8, 1, '#3d2714');
  px(g, 4, 10, 8, 1, '#3d2714');
  px(g, 5, 3, 2, 10, '#855630');
  px(g, 12, 3, 1, 10, '#4a2c16');
  px(g, 6, 6, 4, 3, '#f0b03c');
  px(g, 7, 7, 2, 1, '#5c3a20');
  return c;
}
function makeChest(open) {
  const c = newCv(), g = c.getContext('2d');
  px(g, 2, 6, 12, 8, '#5b3a22');
  px(g, 2, 5, 12, 3, open ? '#3a2514' : '#6d4625');
  px(g, 2, 4, 12, 1, '#8a5c33');
  px(g, 3, 7, 10, 6, '#6d4625');
  px(g, 3, 9, 10, 1, '#3d2714');
  px(g, 6, 9, 4, 4, '#e9c25c');
  px(g, 7, 10, 2, 2, '#8a6a18');
  if (open) px(g, 3, 7, 10, 2, '#1b1208');
  return c;
}
function makeShrine() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 2, 12, 12, 3, '#3a3f4c');
  px(g, 2, 12, 12, 1, '#5e6577');
  px(g, 4, 9, 8, 3, '#4a5060');
  px(g, 4, 9, 8, 1, '#6d7688');
  px(g, 6, 4, 4, 6, '#454b5a');
  px(g, 7, 5, 2, 4, '#7fd8ff');
  px(g, 7, 3, 2, 2, '#bfe9ff');
  px(g, 6, 11, 4, 1, 'rgba(120,200,255,.5)');
  return c;
}
function makeTorch() {
  const c = newCv(), g = c.getContext('2d');
  // bracket
  px(g, 4, 10, 8, 2, '#3e4655');
  px(g, 4, 10, 8, 1, '#5b6478');
  px(g, 7, 8, 2, 3, '#2b303b');
  // flame
  px(g, 6, 4, 4, 5, '#e8721c');
  px(g, 6, 3, 3, 3, '#ff9a3c');
  px(g, 7, 2, 2, 3, '#ffc45a');
  px(g, 7, 4, 2, 2, '#fff2b8');
  px(g, 5, 5, 1, 3, '#ff8a2f');
  px(g, 10, 5, 1, 3, '#ff8a2f');
  return c;
}
function makeSign() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 7, 8, 2, 7, '#4a2c16');
  px(g, 2, 3, 12, 6, '#6d4625');
  px(g, 3, 4, 10, 4, '#8a5c33');
  px(g, 4, 5, 8, 1, '#3d2714');
  px(g, 4, 7, 5, 1, '#3d2714');
  return c;
}

/* ------------------------------------------------- dungeon props */
function makeFood() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 1, 12, 14, 2, '#6d4625');
  px(g, 1, 12, 14, 1, '#8a5c33');
  // bread loaf
  px(g, 3, 5, 7, 6, '#c99250');
  px(g, 3, 4, 7, 2, '#e5b878');
  px(g, 4, 6, 5, 1, '#f2d29b');
  px(g, 4, 8, 1, 1, '#a8763c');
  px(g, 7, 7, 1, 1, '#a8763c');
  // drumstick
  px(g, 10, 7, 4, 4, '#a8483e');
  px(g, 10, 7, 4, 1, '#c9635a');
  px(g, 11, 10, 2, 3, '#e8e0c8');
  px(g, 11, 12, 2, 1, '#cfc6ab');
  return c;
}
function makeAnvil() {
  const c = newCv(), g = c.getContext('2d');
  // stump base
  px(g, 4, 13, 8, 3, '#3f2612');
  px(g, 4, 13, 8, 1, '#6d4625');
  // waist
  px(g, 6, 10, 4, 4, '#3e4554');
  px(g, 6, 10, 1, 4, '#5a6377');
  // body
  px(g, 3, 7, 10, 4, '#4e5768');
  px(g, 3, 7, 10, 1, '#98a3b8');
  px(g, 3, 10, 10, 1, '#2c313d');
  // face / horn
  px(g, 2, 6, 8, 2, '#6b7689');
  px(g, 2, 5, 7, 2, '#8d98ad');
  px(g, 9, 5, 4, 1, '#b6c0d2');
  px(g, 12, 6, 2, 1, '#d2dae7');
  px(g, 1, 6, 1, 2, '#5a6377');
  // hot metal glint
  px(g, 5, 4, 3, 1, 'rgba(255,170,80,.7)');
  px(g, 11, 3, 1, 1, '#ffb04a');
  px(g, 13, 4, 1, 1, '#ffd88a');
  return c;
}
function makeStatue() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 2, 12, 12, 3, '#474e5e');
  px(g, 2, 12, 12, 1, '#6b7488');
  px(g, 4, 4, 8, 8, '#5c6475');
  px(g, 4, 4, 8, 1, '#7d879b');
  px(g, 4, 4, 1, 8, '#6f798d');
  px(g, 11, 4, 1, 8, '#454c5b');
  px(g, 5, 1, 6, 4, '#6a7285');
  px(g, 5, 1, 6, 1, '#8a93a6');
  // glowing eyes
  px(g, 6, 3, 2, 1, '#c9a0ff');
  px(g, 9, 3, 2, 1, '#c9a0ff');
  px(g, 6, 8, 4, 1, '#3c4352');
  px(g, 6, 9, 4, 1, '#3c4352');
  return c;
}
function makeBones() {
  const c = newCv(), g = c.getContext('2d');
  const w = '#ddd6c2', W = '#a8a08c';
  // skull
  px(g, 5, 5, 6, 5, w);
  px(g, 6, 9, 4, 2, w);
  px(g, 6, 6, 1, 1, '#2a2e38'); px(g, 9, 6, 1, 1, '#2a2e38');
  px(g, 7, 8, 2, 1, W);
  // ribs and bones
  px(g, 3, 12, 5, 1, w); px(g, 3, 11, 1, 1, w); px(g, 7, 11, 1, 1, w);
  px(g, 10, 11, 4, 1, w); px(g, 10, 12, 1, 2, w); px(g, 13, 12, 1, 2, w);
  return c;
}
function makeCampfire() {
  const c = newCv(), g = c.getContext('2d');
  // stones
  px(g, 2, 11, 3, 3, '#4d5566'); px(g, 11, 11, 3, 3, '#4d5566');
  px(g, 6, 13, 4, 2, '#5d6678'); px(g, 4, 8, 2, 2, '#3f4656'); px(g, 10, 8, 2, 2, '#3f4656');
  // logs
  px(g, 3, 11, 10, 2, '#5c3a20'); px(g, 3, 11, 10, 1, '#7d512d');
  px(g, 5, 9, 2, 2, '#6d4625'); px(g, 9, 9, 2, 2, '#6d4625');
  // flames
  px(g, 6, 5, 4, 5, '#e8721c');
  px(g, 6, 4, 3, 3, '#ff9a3c');
  px(g, 7, 2, 2, 3, '#ffc45a');
  px(g, 7, 4, 2, 2, '#fff2b8');
  px(g, 5, 6, 1, 3, '#ff8a2f'); px(g, 10, 6, 1, 3, '#ff8a2f');
  return c;
}
function makeMerchantStall() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.floor[2], 0, 0);
  // counter
  px(g, 1, 9, 14, 4, '#6d4625');
  px(g, 1, 9, 14, 1, '#8a5c33');
  px(g, 2, 12, 12, 1, '#3d2714');
  // awning
  px(g, 1, 2, 14, 3, '#7a3f3f');
  for (let x = 2; x < 15; x += 4) px(g, x, 2, 2, 3, '#c9a86a');
  px(g, 1, 5, 14, 1, '#5a2c2c');
  // goods
  px(g, 3, 6, 3, 3, '#8fd18a');
  px(g, 7, 6, 3, 3, '#e9c25c');
  px(g, 11, 6, 3, 3, '#7fb6e8');
  return c;
}

/* ---------------------------------------------------------------- characters */
const PAL = {
  k: '#12101a', w: '#f2efe4', s: '#e8b98a', S: '#b98a5f', m: '#b9c2d0', M: '#6e7787',
  r: '#c8433f', R: '#8c2b30', c: '#3f5f9e', C: '#28406e', g: '#4f8f5a', G: '#2f6138',
  y: '#e9c25c', Y: '#a8862c', p: '#7a4fa8', P: '#523176', b: '#4a7fb5', o: '#e07f36',
  n: '#e6e0c8', N: '#a9a184', e: '#ffd95e', t: '#6d4625', T: '#3d2714', x: '#5e6577',
  X: '#3a4050', l: '#9fe0ff', v: '#b07fe0', d: '#8c3f3f', f: '#ff9a3c', i: '#7fd18a'
};
function sp(rows, extra) { return pix(rows, Object.assign({}, PAL, extra || {})); }

const CH_SRC = {
  warrior: [
    "................",
    "................",
    ".....kkkkk......",
    "....kMmmmMk.....",
    "....kMmmmMk.....",
    "....kMeeeMk.....",
    "....kMmmmMk.....",
    ".....kmmmk......",
    "...kkmmmmmkk....",
    "..kMmmmmmmmMk...",
    "..kMmmmyymmmMk..",
    "...kmmmmmmmk....",
    "....kmmkmmk.....",
    "....kmmkmmk.....",
    "....kMMkMMk.....",
    ".....kk.kk......"
  ],
  rogue: [
    "................",
    "....kkkkkkk.....",
    "...kgGgggGgk....",
    "..kgggggggggk...",
    "..kgGssssssgk...",
    "..kgsksssksgk...",
    "..kgsssssssgk...",
    "..kggCCCCgggk...",
    ".kggCCCCCCgggk..",
    ".kgGCCCCCCGgk...",
    "..kgCCCCCCgk....",
    "..kgkCCCCkgk....",
    "...kkCCCCkk.....",
    "....kCkkCk......",
    "....kCk.kCk.....",
    "....kk...kk....."
  ],
  mage: [
    "................",
    "......kkk.......",
    ".....kpppk......",
    "....kpppppk.....",
    "...kpppppppk....",
    "..kppppppppppk..",
    "..kkkkkkkkkkkk..",
    "...ksssssssk....",
    "...ksksssksk....",
    "..kpppppppppk...",
    "..kpppwwwpppk...",
    "..kppwwywwppk...",
    "..kpppwwwpppk...",
    "..kpppppppppk...",
    "...kppk.kppk....",
    "....kk...kk....."
  ],
  rat: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "......kk..kk....",
    ".....kxxkkxxk...",
    "....kxxxxxkxxk..",
    "...kxxexxxxxxxk.",
    "...kxxxxxxxxxxk.",
    "....kxxxxxxxxk..",
    ".....kkxxxxkk...",
    "......kkkkk.....",
    ".....kk..kk.....",
    "................"
  ],
  goblin: [
    "................",
    "....k....k......",
    "...kgk..kgk.....",
    "...kggkggk......",
    "..kgggggggk.....",
    "..kgggssgggk....",
    "..kgsegssegsgk..",
    "..kgggssssggk...",
    "...kgggggggk....",
    "..kGgggggggGk...",
    "..kGggtttggGk...",
    "..kGgggggggGk...",
    "...kgggggggk....",
    "....kgk.kgk.....",
    "....kgk.kgk.....",
    "....kk...kk....."
  ],
  bat: [
    "................",
    "................",
    "................",
    "................",
    "..k..........k..",
    ".kpk........kpk.",
    "kppk..kkkk..kppk",
    "kpppkkppppkkpppk",
    ".kppppppppppppk.",
    "..kppppppppppk..",
    "...kppk..kppk...",
    "....kk....kk....",
    "................",
    "................",
    "................",
    "................"
  ],
  skeleton: [
    "................",
    "....kkkkkk......",
    "...knnnnnnk.....",
    "..knnnnnnnnk....",
    "..knkennkennk...",
    "..knnnnnnnnnk...",
    "...knknknknk....",
    "....knnnnk......",
    "...knnnnnnnk....",
    "..knknnnnknk....",
    "..knknnnnknk....",
    "...knnnnnnk.....",
    "....knknk.......",
    "....knknk.......",
    "...knnknnk......",
    "...kkk.kkk......"
  ],
  slime: [
    "................",
    "................",
    "................",
    "......kkkk......",
    "....kkiiikik....",
    "...kiikiiiiik...",
    "..kiiiiiiiiiik..",
    "..kiikeiikeiik..",
    "..kiiiiiiiiiik..",
    "..kiiiiiiiiiik..",
    "..kiiiiiikiiik..",
    "...kiikiiiikik..",
    "....kkiiikkik...",
    "......kkkkk.....",
    "................",
    "................"
  ],
  shaman: [
    "................",
    "......kkkk......",
    ".....kvvvvk.....",
    "....kvvvvvvk....",
    "...kvvssssvvk...",
    "...kvskssksvk...",
    "...kvssssssvk...",
    "...kvvssssvvk...",
    "..kvvvvvvvvvvk..",
    "..kvvvvyyvvvvk..",
    "..kvvvvyyvvvvk..",
    "...kvvvvvvvvk...",
    "....kvvvvvvk....",
    "....kvvkkvvk....",
    "....kvvkkvvk....",
    ".....kk..kk....."
  ],
  mimic: [
    "................",
    "................",
    "..kkkkkkkkkk....",
    ".kttttttttttk...",
    ".ktTttttttTtk...",
    ".kttttttttttk...",
    ".kttttttttttk...",
    ".kyyyyyyyyyyk...",
    ".ktttekkkettk...",
    ".kttttttttttk...",
    ".kttttkkttttk...",
    ".kttttkkttttk...",
    ".kttttttttttk...",
    ".kkkkkkkkkkkk...",
    ".kk.kk.kk.kk....",
    "................"
  ],
  orc: [
    "................",
    "...kkkkkkkkk....",
    "..kRRRRRRRRRk...",
    "..kRgggggggRk...",
    "..kggsssssggk...",
    "..kgseggseggk...",
    "..kggsssssggk...",
    "..kgggnnggggk...",
    "...kgggggggk....",
    "..kMgggggggMk...",
    ".kMMgggggggMMk..",
    ".kMkgggggggkMk..",
    "..kkgggggggkk...",
    "....kgk.kgk.....",
    "....kgk.kgk.....",
    "....kk...kk....."
  ],
  lich: [
    "................",
    ".....kkkkkk.....",
    "....kNNNNNNk....",
    "...kNNNNNNNNk...",
    "...kNkekkekNk...",
    "...kNNNNNNNNk...",
    "....kNNkkNNk....",
    "...kNNNNNNNNk...",
    "..kvvNNNNNNvvk..",
    "..kvvvNNNNvvvk..",
    "..kvvvvNNvvvvk..",
    "...kvvvvvvvvk...",
    "....kvvvvvvk....",
    "....kvvkkvvk....",
    "....kvvkkvvk....",
    ".....kk..kk....."
  ],
  imp: [
    "................",
    "....k......k....",
    "...kRk....kRk...",
    "....kRk..kRk....",
    "....kkkkkkkk....",
    "...kdddddddk....",
    "..kddedddedddk..",
    "..kdddddddddk...",
    "..kdddkkkkddk...",
    "...kdddddddk....",
    "..kddRdddRddk...",
    "..kdddddddddk...",
    "...kdddddddk....",
    "....kdk.kdk.....",
    "....kdk.kdk.....",
    "....kk...kk....."
  ],
  golem: [
    "................",
    "...kkkkkkkkk....",
    "..kxxxxxxxxxk...",
    "..kxXxxxxxXxk...",
    "..kxexxxexxxk...",
    "..kxxxxxxxxxk...",
    "kkkxxxxxxxxxkkk.",
    "kxxkxxxxxxxkxxk.",
    "kxxkxxxxxxxkxxk.",
    "kxxkxxxxxxxkxxk.",
    ".kkkxxxxxxxkkk..",
    "...kxxxxxxxk....",
    "...kxxk.kxxk....",
    "...kxxk.kxxk....",
    "...kxxk.kxxk....",
    "...kkk...kkk...."
  ],
  wraith: [
    "................",
    ".....kkkkk......",
    "....kllllk......",
    "...klllllk......",
    "...klkllklk.....",
    "...klllllk......",
    "..klllllllk.....",
    "..klllllllk.....",
    "..klllllllk.....",
    "..klllllllk.....",
    "...kllllllk.....",
    "...klllllk......",
    "....klllk.......",
    "....kkllk.......",
    ".....klk........",
    "......k........."
  ],
  goblinShop: [
    "................",
    "....kkkkkk......",
    "...kyyyyyyk.....",
    "..kyyyyyyyyk....",
    "..kggssssggk....",
    "..kgsegssegk....",
    "..kggssssggk....",
    "...kggggggk.....",
    "..kGggggggGk....",
    "..kGgyyyygGk....",
    "..kGggggggGk....",
    "...kggggggk.....",
    "....kgk.kgk.....",
    "....kgk.kgk.....",
    "....kk...kk.....",
    "................"
  ]
};

/* ---------------------------------------------------------------- items */
function makePotion(col) {
  const c = newCv(), g = c.getContext('2d');
  px(g, 6, 1, 4, 2, '#8a7a5c');
  px(g, 6, 2, 4, 2, '#c9b98c');
  px(g, 5, 4, 6, 9, '#b9c2d0');
  px(g, 6, 4, 4, 9, '#dde4ee');
  px(g, 6, 7, 4, 5, col);
  px(g, 5, 7, 1, 5, col);
  px(g, 7, 8, 1, 3, 'rgba(255,255,255,.55)');
  px(g, 5, 4, 6, 1, '#8a93a3');
  px(g, 4, 7, 1, 5, '#7e8797');
  px(g, 9, 3, 1, 1, '#7e8797');
  return c;
}
function makeScroll() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 2, 4, 12, 8, '#e6dcc0');
  px(g, 2, 4, 12, 1, '#f4ecd6');
  px(g, 2, 11, 12, 1, '#c4b795');
  px(g, 1, 3, 2, 10, '#b9a97f');
  px(g, 13, 3, 2, 10, '#b9a97f');
  px(g, 1, 3, 2, 1, '#8f8259'); px(g, 13, 3, 2, 1, '#8f8259');
  px(g, 4, 6, 8, 1, '#8c7a52'); px(g, 4, 8, 6, 1, '#8c7a52');
  return c;
}
function makeWand(col) {
  const c = newCv(), g = c.getContext('2d');
  px(g, 3, 12, 2, 2, '#6d4625');
  px(g, 4, 10, 2, 3, '#8a5c33');
  px(g, 5, 8, 2, 3, '#6d4625');
  px(g, 6, 6, 2, 3, '#8a5c33');
  px(g, 7, 4, 3, 3, col);
  px(g, 8, 3, 2, 2, '#ffffff');
  px(g, 8, 4, 1, 1, col);
  px(g, 6, 5, 1, 1, 'rgba(255,255,255,.4)');
  return c;
}
function makeWeapon(kind) {
  const c = newCv(), g = c.getContext('2d');
  if (kind === 'dagger') {
    px(g, 8, 6, 2, 6, '#cfd6e2'); px(g, 9, 5, 1, 2, '#eef2f8');
    px(g, 6, 11, 6, 1, '#e9c25c'); px(g, 7, 12, 2, 3, '#6d4625');
    px(g, 10, 6, 1, 1, '#8a93a3');
  } else if (kind === 'sword') {
    px(g, 8, 2, 2, 10, '#cfd6e2'); px(g, 7, 6, 1, 6, '#a9b3c2'); px(g, 10, 4, 1, 8, '#8a93a3');
    px(g, 6, 11, 6, 1, '#e9c25c'); px(g, 7, 12, 3, 3, '#6d4625'); px(g, 8, 2, 1, 1, '#eef2f8');
  } else if (kind === 'spear') {
    px(g, 2, 13, 2, 2, '#6d4625');
    for (let i = 0; i < 9; i++) px(g, 4 + i, 12 - i, 2, 1, i % 2 ? '#8a5c33' : '#6d4625');
    px(g, 11, 2, 2, 4, '#cfd6e2'); px(g, 12, 1, 1, 2, '#eef2f8'); px(g, 11, 6, 2, 1, '#8a93a3');
  } else if (kind === 'staff') {
    px(g, 2, 12, 2, 3, '#6d4625');
    for (let i = 0; i < 9; i++) px(g, 3 + i, 12 - i, 2, 1, i % 2 ? '#8a5c33' : '#6d4625');
    px(g, 9, 1, 4, 4, '#7a4fa8');
    px(g, 10, 2, 2, 2, '#b07fe0');
    px(g, 10, 2, 1, 1, '#e2c9ff');
  } else {
    px(g, 6, 3, 4, 8, '#a9b3c2'); px(g, 5, 4, 1, 5, '#cfd6e2'); px(g, 10, 4, 1, 5, '#cfd6e2');
    px(g, 7, 2, 2, 2, '#cfd6e2'); px(g, 8, 11, 2, 4, '#6d4625');
  }
  return c;
}
function makeArmor() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 4, 3, 8, 2, '#8a93a3');
  px(g, 3, 5, 10, 7, '#b9c2d0');
  px(g, 4, 6, 8, 5, '#cfd6e2');
  px(g, 5, 6, 2, 1, '#eef2f8');
  px(g, 6, 8, 4, 3, '#8a93a3');
  px(g, 2, 6, 2, 5, '#8a93a3'); px(g, 12, 6, 2, 5, '#8a93a3');
  px(g, 5, 12, 6, 1, '#6e7787');
  return c;
}
function makeRing() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 5, 6, 6, 2, '#e9c25c'); px(g, 4, 8, 2, 4, '#e9c25c'); px(g, 10, 8, 2, 4, '#e9c25c');
  px(g, 5, 12, 6, 2, '#e9c25c');
  px(g, 6, 4, 4, 3, '#b07fe0'); px(g, 7, 4, 2, 1, '#e2c9ff'); px(g, 6, 5, 1, 1, '#8a5cc0');
  px(g, 5, 7, 2, 1, '#ffe9a8');
  return c;
}
function makeKey() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 5, 4, 2, 2, '#e9c25c'); px(g, 4, 6, 4, 4, '#e9c25c'); px(g, 6, 7, 2, 2, '#2a2e38');
  px(g, 8, 9, 1, 1, '#e9c25c');
  px(g, 9, 8, 1, 6, '#e9c25c'); px(g, 10, 11, 2, 1, '#e9c25c'); px(g, 10, 13, 2, 1, '#e9c25c');
  px(g, 4, 5, 1, 1, '#ffe9a8');
  return c;
}
function makeGold() {
  const c = newCv(), g = c.getContext('2d');
  const coins = [[3, 10], [6, 11], [9, 10], [5, 8], [8, 8], [7, 6]];
  for (const [x, y] of coins) {
    px(g, x, y, 4, 3, '#c99b2a'); px(g, x, y, 4, 1, '#ffe9a8'); px(g, x + 1, y + 1, 2, 1, '#fff6d0');
  }
  return c;
}
function makeHeart() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 4, 5, 3, 2, '#e4585c'); px(g, 9, 5, 3, 2, '#e4585c');
  px(g, 3, 6, 10, 4, '#e4585c'); px(g, 4, 10, 8, 2, '#e4585c'); px(g, 6, 12, 4, 2, '#e4585c');
  px(g, 7, 13, 2, 1, '#e4585c');
  px(g, 5, 6, 2, 1, '#ffb3b3');
  return c;
}


function makeWarriorSpr() {
  const c = newCv(), g = c.getContext('2d');
  // cape
  px(g, 3, 7, 2, 6, '#7a1e24'); px(g, 11, 7, 2, 6, '#7a1e24');
  // sword
  px(g, 12, 2, 1, 8, '#d7dde8'); px(g, 13, 2, 1, 8, '#7d8798');
  px(g, 11, 10, 3, 1, '#e9c25c'); px(g, 12, 11, 1, 2, '#6d4625');
  // legs
  px(g, 5, 11, 2, 4, '#5b6478'); px(g, 9, 11, 2, 4, '#5b6478');
  px(g, 5, 14, 2, 1, '#333a47'); px(g, 9, 14, 2, 1, '#333a47');
  // torso
  px(g, 4, 6, 8, 6, '#6e7787');
  px(g, 5, 6, 6, 5, '#8f9aac');
  px(g, 7, 6, 2, 5, '#c8433f');          // tabard
  px(g, 5, 8, 6, 1, '#525a69');
  px(g, 5, 10, 6, 1, '#e9c25c');         // belt
  px(g, 7, 6, 1, 4, '#e05a58');
  // shoulders
  px(g, 3, 6, 2, 2, '#5b6478'); px(g, 11, 6, 2, 2, '#5b6478');
  // head
  px(g, 5, 1, 6, 5, '#8f9aac');
  px(g, 5, 1, 6, 1, '#b9c2d0');
  px(g, 6, 2, 5, 2, '#1b1f27');
  px(g, 7, 2, 1, 1, '#ffe066'); px(g, 9, 2, 1, 1, '#ffe066');
  px(g, 6, 4, 4, 1, '#5b6478');
  // crest
  px(g, 7, 0, 3, 1, '#c8433f');
  return c;
}

/* =====================================================================
   v4 · WIDE-WORLD TERRAIN & PROPS
   ===================================================================== */
function makeRoad(v) {
  const c = newCv(), g = c.getContext('2d');
  const r = RNG(2100 + v * 131);
  px(g, 0, 0, 16, 16, '#464b56');
  // irregular cobbles
  for (let y = 0; y < 16; y += 4) {
    const off = ((y / 4) % 2) * 3;
    for (let x = -4; x < 16; x += 7) {
      const sx = x + off + r.int(-1, 1), sy = y + r.int(0, 1);
      px(g, sx, sy, 6, 3, r.chance(0.5) ? '#565c69' : '#4f5561');
      px(g, sx, sy, 6, 1, '#6a7180');
      px(g, sx, sy + 2, 6, 1, '#393e48');
    }
  }
  if (v === 1) { px(g, 4, 6, 2, 2, '#3c414b'); px(g, 10, 11, 3, 1, '#5f6675'); }
  if (v === 2) { px(g, 8, 3, 1, 3, '#3a3f49'); px(g, 2, 9, 3, 1, '#5b6270'); }
  px(g, 0, 0, 16, 1, 'rgba(255,255,255,.05)');
  px(g, 0, 15, 16, 1, 'rgba(0,0,0,.22)');
  return c;
}
function makeDirt(v) {
  const c = newCv(), g = c.getContext('2d');
  const r = RNG(2400 + v * 91);
  px(g, 0, 0, 16, 16, '#4a3d2d');
  for (let i = 0; i < 34; i++) {
    const x = r.int(0, 15), y = r.int(0, 15);
    px(g, x, y, 1, 1, r.chance(0.5) ? '#554733' : '#3c3022');
  }
  for (let i = 0; i < 6; i++) px(g, r.int(0, 14), r.int(0, 14), 2, 1, r.chance(0.5) ? '#5d4e39' : '#33291d');
  for (let i = 0; i < 3; i++) px(g, r.int(1, 13), r.int(1, 13), 1, 1, '#6b5a42');
  if (v === 1) { px(g, 6, 5, 1, 2, '#6b5a42'); px(g, 9, 11, 2, 1, '#3a2f21'); }
  if (v === 2) { px(g, 2, 7, 3, 1, '#5a4a35'); }
  return c;
}
function makeWood(v) {
  const c = newCv(), g = c.getContext('2d');
  const r = RNG(2500 + v * 61);
  px(g, 0, 0, 16, 16, '#4a3624');
  for (let y = 0; y < 16; y += 4) {
    px(g, 0, y, 16, 4, y % 8 ? '#543d29' : '#5c432d');
    px(g, 0, y, 16, 1, '#3a291a');
    px(g, 0, y + 3, 16, 1, '#6b4f35');
    px(g, r.int(0, 12), y + 2, 3, 1, '#4a3624');
  }
  if (v === 1) { px(g, 7, 0, 1, 16, '#3a291a'); }
  return c;
}
function makeMud() {
  const c = newCv(), g = c.getContext('2d');
  const r = RNG(2600);
  px(g, 0, 0, 16, 16, '#3b3127');
  for (let i = 0; i < 22; i++) px(g, r.int(0, 15), r.int(0, 15), r.int(1, 3), 1, r.chance(0.5) ? '#453a2c' : '#31281f');
  px(g, 2, 4, 5, 1, 'rgba(120,140,120,.22)');
  px(g, 9, 11, 4, 1, 'rgba(120,140,120,.18)');
  px(g, 0, 15, 16, 1, 'rgba(0,0,0,.2)');
  return c;
}
function makeMoss() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.floor[0], 0, 0);
  const r = RNG(2650);
  for (let i = 0; i < 12; i++) px(g, r.int(0, 14), r.int(0, 14), r.int(1, 3), 1, r.chance(0.5) ? 'rgba(70,110,70,.45)' : 'rgba(50,90,55,.4)');
  return c;
}
function makeBrick(v) {
  const c = newCv(), g = c.getContext('2d');
  const r = RNG(2700 + (v || 0) * 47);
  px(g, 0, 0, 16, 16, '#25272a');
  const tones = ['#4e5257', '#555a60', '#4a4e53', '#535960'];
  for (let y = 0, row = 0; y < 16; y += 5, row++) {
    const off = (row % 2) * 4;
    for (let x = -4; x < 16; x += 8) {
      const col = tones[(row + Math.floor((x + 8) / 8) + v) % tones.length];
      px(g, x + off, y, 8, 4, col);
      px(g, x + off, y, 8, 1, 'rgba(255,255,255,.14)');
      px(g, x + off, y + 3, 8, 1, 'rgba(0,0,0,.4)');
      px(g, x + off, y, 1, 4, 'rgba(0,0,0,.18)');
    }
  }
  for (let i = 0; i < 10; i++) px(g, r.int(0, 15), r.int(0, 15), 1, 1, r.chance(0.5) ? '#3a3e43' : '#5e646b');
  px(g, 0, 0, 16, 1, '#6b7279');
  px(g, 0, 15, 16, 1, '#16181b');
  return c;
}
function makeTree(v) {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage((SP.grass && SP.grass[0]) || SP.floor[0], 0, 0);
  const r = RNG(3000 + v * 173);
  /* shadow */
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(8, 14.5, 6, 2, 0, 0, 6.2832); g.fill();
  /* trunk */
  px(g, 6, 10, 4, 5, '#3a2716');
  px(g, 6, 10, 1, 5, '#5a3f26');
  px(g, 9, 10, 1, 5, '#241608');
  /* canopy: dark outline, body, light */
  const cx = 8, cy = 5.5;
  const blobAt = (rad0, rad1, col) => {
    for (let i = 0; i < 30; i++) {
      const a = r.float(0, 6.2832), rad = r.float(rad0, rad1);
      const x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * rad * 0.8);
      px(g, x, y, 2, 2, col);
    }
  };
  blobAt(4.4, 6.4, '#0e2212');
  blobAt(3.2, 5.6, '#1e4224');
  blobAt(1.6, 4.4, '#2f6330');
  blobAt(0.4, 2.8, '#458a3f');
  px(g, 6, 1, 2, 1, '#6aad57');
  px(g, 9, 2, 1, 1, '#5a9c4d');
  px(g, 4, 5, 1, 1, '#3f7c3a');
  return c;
}
function makeBush() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage((SP.grass && SP.grass[0]) || SP.floor[0], 0, 0);
  const r = RNG(3100);
  for (let i = 0; i < 16; i++) {
    const x = r.int(2, 12), y = r.int(6, 13);
    px(g, x, y, 2, 2, r.chance(0.5) ? '#3f7a41' : '#2e5f33');
  }
  px(g, 4, 8, 2, 2, '#4f8f4a'); px(g, 9, 9, 2, 2, '#4f8f4a');
  px(g, 6, 11, 3, 1, 'rgba(0,0,0,.25)');
  return c;
}
function makeFence() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.dirt ? SP.dirt[0] : SP.floor[0], 0, 0);
  px(g, 1, 5, 14, 2, '#6d4a2c');
  px(g, 1, 5, 14, 1, '#8a6238');
  px(g, 1, 10, 14, 2, '#6d4a2c');
  px(g, 1, 10, 14, 1, '#8a6238');
  for (const x of [2, 8, 13]) {
    px(g, x, 3, 2, 11, '#5c3d22');
    px(g, x, 3, 1, 11, '#7a5430');
    px(g, x, 2, 2, 1, '#4a3018');
  }
  return c;
}
function makeBanner() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage((SP.brick && SP.brick[0]) || SP.wall, 0, 0);
  px(g, 3, 1, 10, 1, '#3d2b16');
  px(g, 4, 2, 8, 11, '#7a1e24');
  px(g, 4, 2, 2, 11, '#9a2a30');
  px(g, 10, 2, 2, 11, '#5c141a');
  px(g, 4, 13, 8, 1, '#3d0e12');
  // emblem
  px(g, 7, 5, 2, 5, '#e9c25c');
  px(g, 6, 6, 4, 1, '#e9c25c');
  px(g, 6, 9, 4, 1, '#e9c25c');
  px(g, 5, 14, 2, 1, '#7a1e24'); px(g, 9, 14, 2, 1, '#7a1e24');
  return c;
}
function makeBrazier() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage((SP.road && SP.road[1]) || SP.floor[0], 0, 0);
  px(g, 6, 13, 4, 2, '#2f333d');
  px(g, 7, 10, 2, 4, '#454b58');
  px(g, 3, 8, 10, 3, '#5c6373');
  px(g, 3, 8, 10, 1, '#8d96a8');
  px(g, 4, 7, 8, 1, '#2a2e37');
  px(g, 6, 3, 4, 5, '#e8721c');
  px(g, 6, 2, 3, 3, '#ff9a3c');
  px(g, 7, 1, 2, 3, '#ffc45a');
  px(g, 7, 3, 2, 2, '#fff2b8');
  px(g, 5, 4, 1, 2, '#ff8a2f'); px(g, 10, 4, 1, 2, '#ff8a2f');
  return c;
}
function makeBookshelf() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.wood ? SP.wood[1] : SP.floor[0], 0, 0);
  px(g, 1, 1, 14, 14, '#3d2a19');
  px(g, 2, 2, 12, 12, '#5a3d24');
  for (let y = 3; y < 13; y += 4) {
    px(g, 2, y, 12, 3, '#2e2013');
    const cols = ['#8c3f3f', '#3f5f9e', '#4f8f5a', '#c9a24a', '#7a4fa8'];
    let x = 3;
    while (x < 13) {
      const w = Math.random() < 0.5 ? 1 : 2;
      px(g, x, y, w, 3, cols[(x + y) % cols.length]);
      px(g, x, y, w, 1, 'rgba(255,255,255,.18)');
      x += w + 1;
    }
  }
  px(g, 1, 1, 14, 1, '#6b4a2c');
  return c;
}
function makeWell() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.road ? SP.road[0] : SP.floor[0], 0, 0);
  px(g, 2, 6, 12, 8, '#4a505c');
  px(g, 3, 7, 10, 6, '#2a3a4a');
  px(g, 4, 8, 8, 3, '#3f6f92');
  px(g, 5, 8, 6, 1, '#7fb6d8');
  px(g, 2, 6, 12, 2, '#6b7484');
  px(g, 1, 5, 14, 1, '#8d96a8');
  px(g, 4, 2, 2, 4, '#5c3d22'); px(g, 10, 2, 2, 4, '#5c3d22');
  px(g, 3, 1, 10, 2, '#6d4a2c');
  px(g, 7, 3, 2, 3, '#3d2a19');
  return c;
}
function makeTent() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.dirt ? SP.dirt[0] : SP.floor[0], 0, 0);
  px(g, 1, 5, 14, 9, '#5c4a32');
  px(g, 2, 4, 12, 3, '#6f5a3c');
  px(g, 4, 2, 8, 3, '#7d6644');
  px(g, 6, 1, 4, 2, '#8a7050');
  px(g, 7, 8, 3, 6, '#2a2015');
  px(g, 3, 6, 1, 8, '#463823'); px(g, 12, 6, 1, 8, '#463823');
  px(g, 1, 13, 14, 1, '#3a2c1a');
  return c;
}
function makePortal() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.floor[0], 0, 0);
  px(g, 2, 2, 12, 12, 'rgba(60,40,120,.55)');
  px(g, 3, 3, 10, 10, '#3a2a6a');
  px(g, 4, 4, 8, 8, '#6a4fc0');
  px(g, 5, 5, 6, 6, '#9f7fe8');
  px(g, 6, 6, 4, 4, '#d8c8ff');
  px(g, 7, 3, 2, 10, 'rgba(255,255,255,.35)');
  px(g, 3, 7, 10, 2, 'rgba(255,255,255,.2)');
  return c;
}
function makeBlood() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.floor[1], 0, 0);
  const r = RNG(3300);
  px(g, 3, 6, 7, 3, 'rgba(120,20,24,.55)');
  px(g, 5, 4, 5, 4, 'rgba(110,18,22,.5)');
  px(g, 9, 8, 4, 2, 'rgba(90,14,18,.45)');
  for (let i = 0; i < 7; i++) px(g, r.int(2, 13), r.int(4, 12), 1, 1, 'rgba(140,26,30,.5)');
  return c;
}
function makeGateTile() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.road ? SP.road[0] : SP.floor[0], 0, 0);
  px(g, 0, 0, 16, 3, '#3a2c1a');
  for (let x = 1; x < 16; x += 3) { px(g, x, 0, 1, 16, '#2a1f12'); }
  px(g, 2, 3, 12, 10, 'rgba(0,0,0,.35)');
  px(g, 0, 0, 2, 16, '#4a3a24'); px(g, 14, 0, 2, 16, '#4a3a24');
  return c;
}
function makeCarpet() {
  const c = newCv(), g = c.getContext('2d');
  const r = RNG(3400);
  px(g, 0, 0, 16, 16, '#351419');
  for (let i = 0; i < 18; i++) px(g, r.int(0, 15), r.int(0, 15), 1, 1, r.chance(0.5) ? '#401a20' : '#2b1014');
  px(g, 0, 0, 16, 1, 'rgba(255,220,150,.06)');
  px(g, 7, 7, 2, 2, 'rgba(233,194,92,.12)');
  return c;
}
function makePlank() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.water ? SP.water[0] : SP.floor[0], 0, 0);
  for (let y = 1; y < 16; y += 3) {
    px(g, 1, y, 14, 2, '#6d4a2c');
    px(g, 1, y, 14, 1, '#8a6238');
  }
  return c;
}
/* --- town buildings & furniture ------------------------------------- */
function makeInnProp() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.wood[0], 0, 0);
  px(g, 0, 0, 16, 6, '#5c3d24'); px(g, 0, 0, 16, 1, '#7a5430');
  px(g, 1, 2, 14, 1, '#3d2a19');
  px(g, 3, 5, 10, 11, '#7a5430');
  px(g, 4, 6, 8, 10, '#5c3d24');
  px(g, 6, 8, 4, 8, '#3a2718');
  px(g, 7, 9, 2, 7, '#2a1c10');
  px(g, 12, 10, 2, 2, '#e9c25c');
  px(g, 2, 7, 2, 1, '#8a6a3c'); px(g, 12, 7, 2, 1, '#8a6a3c');
  // hanging sign
  px(g, 2, 0, 1, 3, '#2a1c10'); px(g, 1, 3, 4, 3, '#8a5c33');
  px(g, 2, 4, 2, 1, '#ffe1a0');
  return c;
}
function makeSmithProp() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.road[1], 0, 0);
  px(g, 0, 2, 16, 3, '#3a3f4a');
  px(g, 0, 2, 16, 1, '#5c6373');
  // forge
  px(g, 2, 8, 8, 6, '#3a3f4a');
  px(g, 3, 9, 6, 4, '#1e2129');
  px(g, 4, 10, 4, 2, '#ff8a2f');
  px(g, 5, 10, 2, 1, '#ffe089');
  // anvil
  px(g, 11, 10, 5, 2, '#5c6373');
  px(g, 12, 12, 3, 2, '#3a3f4a');
  px(g, 10, 9, 3, 1, '#8d96a8');
  // sparks
  px(g, 6, 5, 1, 1, '#ffd24a'); px(g, 9, 4, 1, 1, '#ff9a3c');
  return c;
}
function makeHerbalistProp() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.road[2], 0, 0);
  px(g, 1, 3, 14, 4, '#2f5a33');
  px(g, 1, 3, 14, 1, '#4a8046');
  for (let x = 2; x < 15; x += 3) px(g, x, 3, 2, 4, '#7fd18a');
  px(g, 1, 7, 14, 7, '#3d2a19');
  px(g, 2, 8, 5, 3, '#5c3d24'); px(g, 9, 8, 5, 3, '#5c3d24');
  px(g, 3, 8, 3, 2, '#4f8f4a'); px(g, 10, 8, 3, 2, '#7a4fa8');
  px(g, 2, 12, 12, 2, '#5c3d24');
  return c;
}
function makeBoardProp() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.road[0], 0, 0);
  px(g, 4, 12, 2, 3, '#4a3320'); px(g, 10, 12, 2, 3, '#4a3320');
  px(g, 2, 3, 12, 9, '#5c3d24');
  px(g, 3, 4, 10, 7, '#7a5430');
  px(g, 4, 4, 2, 1, '#3d2a19');
  px(g, 4, 5, 4, 3, '#e6dcc0'); px(g, 5, 6, 2, 1, '#8c7a52');
  px(g, 9, 5, 3, 2, '#d8d0b8'); px(g, 10, 6, 1, 1, '#8c7a52');
  px(g, 4, 9, 3, 2, '#e6dcc0'); px(g, 9, 8, 3, 3, '#e0d6bc');
  px(g, 12, 4, 1, 1, '#c9302f');
  return c;
}
function makeFountainProp() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.road[0], 0, 0);
  px(g, 1, 3, 14, 11, '#4a505c');
  px(g, 2, 4, 12, 9, '#5c6373');
  px(g, 3, 5, 10, 7, '#2f5f86');
  px(g, 4, 6, 8, 4, '#4f8fbf');
  px(g, 5, 7, 6, 1, '#a8d8f0');
  px(g, 6, 2, 4, 4, '#6b7484');
  px(g, 7, 0, 2, 4, '#9fd8ff');
  px(g, 5, 1, 1, 2, '#7fb6d8'); px(g, 10, 1, 1, 2, '#7fb6d8');
  px(g, 1, 3, 14, 1, '#8d96a8');
  return c;
}
function makeStallProp() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage(SP.road[1], 0, 0);
  px(g, 1, 8, 14, 5, '#6d4a2c');
  px(g, 1, 8, 14, 1, '#8a6238');
  px(g, 2, 12, 12, 1, '#3d2a19');
  px(g, 1, 1, 14, 4, '#7a3f3f');
  for (let x = 2; x < 15; x += 4) px(g, x, 1, 2, 4, '#c9a86a');
  px(g, 1, 5, 14, 1, '#5a2c2c');
  px(g, 3, 6, 3, 2, '#8fd18a'); px(g, 7, 6, 3, 2, '#e9c25c'); px(g, 11, 6, 3, 2, '#7fb6e8');
  return c;
}

/* ---------------------------------------------------------------- v4 monsters */
const CH_SRC_V4 = {
  wolf: [
    "................",
    "................",
    "................",
    "...kk......kk...",
    "..kxxk....kxxk..",
    "..kxexk..kxexk..",
    "..kxxxxxxxxxxxxk",
    ".kxxxxxxxxxxxxxx",
    ".kxxkxxxxxxxkxxk",
    ".kxkxxxxxxxxxkxk",
    "..kkxxxxxxxxxkk.",
    "...kxxkkkkxxk...",
    "...kxk...kxk....",
    "..kxxk...kxxk...",
    "..kkk.....kkk...",
    "................"
  ],
  boar: [
    "................",
    "................",
    "....kkkkkk......",
    "...kTTTTTTk.....",
    "..kTTttttTTk....",
    "..kTteeteetTk...",
    "..kTtttttttTk...",
    "..kTTttnnnTTkk..",
    ".kTTTTTTTTTTTk..",
    ".kTtTTTTTTTtTk..",
    ".kTTTTTTTTTTTk..",
    "..kTTkTTTTkTTk..",
    "..kTk..kk..kTk..",
    "..kTk......kTk..",
    "..kkk......kkk..",
    "................"
  ],
  spider: [
    "................",
    "................",
    "k..k......k..k..",
    ".k..k....k..k...",
    "..k..kkkk..k....",
    "...kkPPPPkk.....",
    "...kPPeePPk.....",
    "..kPPPPPPPPk....",
    ".kPkPPPPPPkPk...",
    "kPk.kPPPPk.kPk..",
    "k....kPPk....k..",
    ".....kPPk.......",
    "....kPkkPk......",
    "...kPk..kPk.....",
    "..kk......kk....",
    "................"
  ],
  bandit: [
    "................",
    ".....kkkkk......",
    "....kRRRRRk.....",
    "...kRRssRRk.....",
    "...kRskssksk....",
    "...kRssssssk....",
    "....kRsssRk.....",
    "...kktttttkk....",
    "..kttttttttttk..",
    "..ktTtttttTttk..",
    "..ktTtttttTttk..",
    "...kktttttkk....",
    "....kTk.kTk.....",
    "....kTk.kTk.....",
    "....kk...kk.....",
    "................"
  ],
  banditArcher: [
    "................",
    ".....kkkkk......",
    "....kGGGGGk.....",
    "...kGGssGGk.....",
    "...kGskssksk....",
    "...kGssssssk....",
    "....kGsssGk.....",
    "...kktttttkk....",
    "..kttttttttk....",
    "..ktTtttttTk.k..",
    "..ktTtttttTkkTk.",
    "...kktttttk.kTk.",
    "....kTk.kTk.kTk.",
    "....kTk.kTk.kTk.",
    "....kk...kk.kk..",
    "................"
  ],
  cultist: [
    "................",
    "......kkkk......",
    ".....kvvvvk.....",
    "....kvvvvvvk....",
    "...kvvssssvvk...",
    "...kvskssksvk...",
    "...kvssssssvk...",
    "...kvvssssvvk...",
    "..kvvvvvvvvvvk..",
    "..kvvvvvvvvvvk..",
    "..kvvvkyykvvvk..",
    "..kvvvkyykvvvk..",
    "...kvvvvvvvvk...",
    "....kvvkkvvk....",
    "....kvvkkvvk....",
    ".....kk..kk....."
  ],
  banditlord: [
    "................",
    "...kkkkkkkkk....",
    "..kRRRRRRRRRk...",
    "..kRsssssssRk...",
    "..ksseesseesk...",
    "..ksssssssssk...",
    "..ksssttttssk...",
    "...ksssssssk....",
    "..kMMttttttMMk..",
    ".kMMtttTttttMMk.",
    ".kMkttttttttkMk.",
    "..kkttttttttkk..",
    "....kTk.kTk.....",
    "....kTk.kTk.....",
    "....kk...kk.....",
    "................"
  ],
  bonewarden: [
    "................",
    "..k..kkkkkk..k..",
    ".kNk.kNNNNk.kNk.",
    "..kNNNNNNNNNNk..",
    "..kNkekNNkekNk..",
    "..kNNNNNNNNNNk..",
    "...kNNkNNkNNk...",
    "....kNNNNNNk....",
    "..kkNNNNNNNNkk..",
    ".kNNkNNNNNNkNNk.",
    ".kNk.kNNNNk.kNk.",
    "..k..kNNNNk..k..",
    "....kNNkkNNk....",
    "....kNNkkNNk....",
    "...kNNk..kNNk...",
    "...kkk....kkk..."
  ],
  alchemist: [
    "................",
    ".....kkkkk......",
    "....kGGGGGk.....",
    "...kGGsssGGk....",
    "...kGskssksk....",
    "...kGssssssk....",
    "....kGsssGk.....",
    "...kkGGGGGkk....",
    "..kGGGtttGGGk...",
    "..kGGtyyytGGk...",
    "..kGGtyyytGGk...",
    "...kGGGGGGGk....",
    "....kGGkGGk.....",
    "....kGGkGGk.....",
    "....kk..kk......",
    "................"
  ],
  npcGuard: [
    "................",
    ".....kkkkk......",
    "....kMMMMMk.....",
    "...kMmmmmmMk....",
    "...kMseesemk....",
    "...kMmmmmmmk....",
    "....kMmmmMk.....",
    "...kkMMMMMkk....",
    "..kMMbmmmMbMk...",
    "..kMMbmmmbMMk...",
    "..kMMbbbbbMMk...",
    "...kkMMMMMkk....",
    "....kMk.kMk.k...",
    "....kMk.kMk.k...",
    "....kk...kk.k...",
    "................"
  ],
  npcSmith: [
    "................",
    ".....kkkkk......",
    "....kSSSSSk.....",
    "...kSsssssSk....",
    "...kSseesessk...",
    "...kSssssssk....",
    "....kSsssSk.....",
    "...kktttttkk....",
    "..ktttttttttk...",
    "..kttTtttTttk...",
    "..kttTtttTttk...",
    "...kktttttkk....",
    "....kTk.kTk.....",
    "....kTk.kTk.....",
    "....kk...kk.....",
    "................"
  ],
  npcHerbalist: [
    "................",
    ".....kkkkk......",
    "....kgggggk.....",
    "...kggsssggk....",
    "...kgskssksk....",
    "...kgssssssk....",
    "....kgsssgk.....",
    "...kkgggggkk....",
    "..kgggggggggk...",
    "..kgggyyygggk...",
    "..kgggggggggk...",
    "...kkgggggkk....",
    "....kgk.kgk.....",
    "....kgk.kgk.....",
    "....kk...kk.....",
    "................"
  ],
  npcInnkeeper: [
    "................",
    ".....kkkkk......",
    "....kyyyyyk.....",
    "...kysssssyk....",
    "...kyskssksk....",
    "...kyssssssk....",
    "....kysssky.....",
    "...kkyyyyykk....",
    "..kyyyyyyyyyk...",
    "..kyynnnnyyyk...",
    "..kyynnnnyyyk...",
    "...kkyyyyykk....",
    "....kyk.kyk.....",
    "....kyk.kyk.....",
    "....kk...kk.....",
    "................"
  ],
  villager: [
    "................",
    ".....kkkkk......",
    "....kttttttk....",
    "...kttsssstk....",
    "...ktskssksk....",
    "...ktssssssk....",
    "....ktssstk.....",
    "...kkxxxxxkk....",
    "..kxxxxxxxxxk...",
    "..kxxTxxxTxxk...",
    "..kxxTxxxTxxk...",
    "...kkxxxxxkk....",
    "....kxk.kxk.....",
    "....kxk.kxk.....",
    "....kk...kk.....",
    "................"
  ]
};

/* ---------------------------------------------------------------- v4 items */
function makeLockpick() {
  const c = newCv(), g = c.getContext('2d');
  px(g, 2, 3, 2, 10, '#8d96a8');
  px(g, 2, 3, 1, 8, '#c9d2e2');
  px(g, 4, 5, 2, 1, '#c9d2e2');
  px(g, 8, 4, 2, 9, '#8d96a8');
  px(g, 8, 4, 1, 7, '#c9d2e2');
  px(g, 10, 8, 3, 1, '#c9d2e2');
  px(g, 2, 12, 2, 1, '#5c6373');
  px(g, 11, 11, 2, 2, '#e9c25c');
  return c;
}
function makeHerb() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage((SP.grass && SP.grass[0]) || SP.floor[0], 0, 0);
  px(g, 7, 8, 2, 6, '#3d6b3f');
  px(g, 5, 6, 3, 3, '#6fbf6a'); px(g, 9, 7, 3, 3, '#5faf5c');
  px(g, 6, 4, 2, 3, '#8fd18a'); px(g, 9, 3, 2, 4, '#7fd18a');
  px(g, 7, 2, 2, 2, '#e9e06a');
  px(g, 4, 11, 2, 1, '#4a8046'); px(g, 10, 12, 2, 1, '#4a8046');
  return c;
}
function makeBerry() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage((SP.bush) || (SP.grass && SP.grass[0]) || SP.floor[0], 0, 0);
  px(g, 4, 7, 2, 2, '#c9304f'); px(g, 8, 6, 2, 2, '#e0455f'); px(g, 10, 9, 2, 2, '#c9304f');
  px(g, 6, 10, 2, 2, '#e0455f');
  px(g, 4, 7, 1, 1, '#ffb3c0'); px(g, 8, 6, 1, 1, '#ffb3c0');
  return c;
}

function makeArch() {
  const c = newCv(), g = c.getContext('2d');
  g.drawImage((SP.dirt && SP.dirt[0]) || SP.floor[0], 0, 0);
  /* ruined stone arch: two legs + a broken span */
  px(g, 1, 4, 4, 12, '#5a5346');
  px(g, 1, 4, 1, 12, '#7a7364');
  px(g, 3, 4, 2, 12, '#423c32');
  px(g, 11, 4, 4, 12, '#5a5346');
  px(g, 11, 4, 1, 12, '#7a7364');
  px(g, 13, 4, 2, 12, '#423c32');
  px(g, 1, 2, 14, 3, '#6a6253');
  px(g, 1, 2, 14, 1, '#8a8272');
  px(g, 5, 3, 6, 2, '#2a241c');
  px(g, 1, 7, 4, 1, '#3a352c');
  px(g, 11, 10, 4, 1, '#3a352c');
  px(g, 5, 5, 6, 7, 'rgba(10,8,6,.55)');
  px(g, 6, 4, 4, 1, '#7a7364');
  px(g, 2, 13, 2, 2, '#3a352c');
  px(g, 12, 6, 2, 2, '#7a7364');
  return c;
}

/* ---------------------------------------------------------------- build */
function buildSprites() {
  SP.floor = [makeFloor(0), makeFloor(1), makeFloor(2)];
  SP.wall = makeWall();
  SP.wallTop = makeWallTop();
  SP.water = [makeWater(0), makeWater(1)];
  SP.grass = [makeGrass(0), makeGrass(1), makeGrass(2)];
  SP.oil = makeOil();
  SP.chasm = makeChasm();
  SP.stairs = makeStairs();
  SP.door = makeDoor(false);
  SP.locked = makeDoor(true);
  SP.secret = makeSecret();
  SP.ice = makeIce();
  SP.rubble = makeRubble();
  SP.pillar = makePillar();
  SP.cover = makeCover();
  SP.barrel = makeBarrel();
  SP.chest = makeChest(false);
  SP.chestOpen = makeChest(true);
  SP.shrine = makeShrine();
  SP.anvil = makeAnvil();
  SP.statue = makeStatue();
  SP.bones = makeBones();
  SP.campfire = makeCampfire();
  SP.stall = makeMerchantStall();
  SP.food = makeFood();
  SP.torch = makeTorch();
  SP.sign = makeSign();
  SP.potion = {};
  for (const pc of POTION_COLORS) SP.potion[pc.n] = makePotion(pc.c);
  SP.scroll = makeScroll();
  SP.wand = {};
  for (const k in WANDS) SP.wand[k] = makeWand(WANDS[k].color);
  SP.weapon = {};
  for (const k of ['dagger', 'sword', 'spear', 'axe', 'staff']) SP.weapon[k] = makeWeapon(k);
  SP.armor = makeArmor();
  SP.ring = makeRing();
  SP.key = makeKey();
  SP.gold = makeGold();
  SP.heart = makeHeart();
  SP.ch = {};
  for (const k in CH_SRC) SP.ch[k] = sp(CH_SRC[k]);
  SP.ch.warrior = makeWarriorSpr();

  /* ---- v4 wide-world terrain ---- */
  SP.road = [makeRoad(0), makeRoad(1), makeRoad(2)];
  SP.dirt = [makeDirt(0), makeDirt(1), makeDirt(2)];
  SP.wood = [makeWood(0), makeWood(1)];
  SP.mud = makeMud();
  SP.moss = makeMoss();
  SP.brick = [makeBrick(0), makeBrick(1)];
  SP.tree = [makeTree(0), makeTree(1), makeTree(2)];
  SP.bush = makeBush();
  SP.fence = makeFence();
  SP.banner = makeBanner();
  SP.brazier = makeBrazier();
  SP.bookshelf = makeBookshelf();
  SP.well = makeWell();
  SP.tent = makeTent();
  SP.portal = makePortal();
  SP.blood = makeBlood();
  SP.gate = makeGateTile();
  SP.carpet = makeCarpet();
  SP.plank = makePlank();
  SP.arch = makeArch();
  SP.prop = {
    inn: makeInnProp(), smith: makeSmithProp(), herbalist: makeHerbalistProp(),
    board: makeBoardProp(), fountain: makeFountainProp(), stall: makeStallProp()
  };
  /* ---- v4 monsters & townsfolk ---- */
  for (const k in CH_SRC_V4) SP.ch[k] = sp(CH_SRC_V4[k]);
  /* ---- v4 items ---- */
  SP.lockpick = makeLockpick();
  SP.herb = makeHerb();
  SP.berry = makeBerry();
}
