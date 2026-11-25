/* =====================================================================
   WORLD GENERATION v4
   · 거점 마을 (town hub)  · 야외 들판 (field)  · 대형 던전 (grand dungeon)
   Maps are 60~80 tiles wide, with 3~5 tile roads, plazas and halls.
   ===================================================================== */

function newMap(w, h, zone, name) {
  setMapSize(w, h);
  const m = {
    zone, name, theme: '', biome: 'forest',
    t: new Uint8Array(w * h).fill(T.WALL),
    vari: new Uint8Array(w * h),
    seen: new Uint8Array(w * h),
    vis: new Uint8Array(w * h),
    fire: new Float32Array(w * h),
    gas: new Float32Array(w * h),
    rooms: [], torches: [], traps: [], objs: [], items: [], mons: [], npcs: [],
    start: { x: 2, y: 2 }, stairs: null, upStairs: null,
    shopRoom: null, vault: null, bossSpawn: null, outdoors: false,
    lockGates: [], seedName: ''
  };
  return m;
}
const mAt = (m, x, y) => (inb(x, y) ? m.t[y * W + x] : T.WALL);
const mSet = (m, x, y, v) => { if (inb(x, y)) { m.t[y * W + x] = v; } };
const mIsFloor = (m, x, y) => inb(x, y) && m.t[y * W + x] === T.FLOOR;

/* fill a rectangular area */
function fillRect(m, x0, y0, w, h, tile, vari) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (!inb(x, y)) continue;
    m.t[y * W + x] = tile;
    if (vari != null) m.vari[y * W + x] = vari;
  }
}
function fillEllipse(m, cx, cy, rx, ry, tile) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (!inb(x, y)) continue;
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1) m.t[y * W + x] = tile;
  }
}
/* a thick line of tiles (roads / broad corridors) */
function carveThick(m, x1, y1, x2, y2, width, tile, mask) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2 + 1;
  const half = (width - 1) / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
    for (let oy = -Math.ceil(half); oy <= Math.ceil(half); oy++) {
      for (let ox = -Math.ceil(half); ox <= Math.ceil(half); ox++) {
        const x = Math.round(cx + ox), y = Math.round(cy + oy);
        if (!inb(x, y)) continue;
        // soften corners: skip extreme corners for a rounded path
        if (Math.abs(ox) > half + 0.2 || Math.abs(oy) > half + 0.2) continue;
        const cur = m.t[y * W + x];
        if (tile === T.DIRT && (cur === T.WATER)) continue;
        m.t[y * W + x] = tile;
        m.vari[y * W + x] = (x * 7 + y * 13) % 3;
        if (mask) mask[y * W + x] = 1;
      }
    }
  }
}
function blob(m, cx, cy, size, tile, opts) {
  const o = opts || {};
  let x = cx, y = cy, placed = 0;
  for (let guard = 0; guard < size * 14 && placed < size; guard++) {
    if (inb(x, y) && (o.anyTile || m.t[y * W + x] === (o.from == null ? T.GRASS : o.from))) {
      if (!(o.avoid && o.avoid[y * W + x])) {
        m.t[y * W + x] = tile; placed++;
      }
    }
    const d = DIR8[Math.floor(Math.random() * 8)];
    x += d[0]; y += d[1];
    if (!inb(x, y)) break;
  }
}
function scatterBlob(m, cx, cy, size, tile, from, avoidMask) {
  const r = RNG(hashStr(cx + ':' + cy + ':' + size));
  let x = Math.round(cx), y = Math.round(cy), placed = 0;
  for (let guard = 0; guard < size * 16 && placed < size; guard++) {
    if (inb(x, y)) {
      const cur = m.t[y * W + x];
      if ((cur === from || (Array.isArray(from) && from.indexOf(cur) >= 0)) && !(avoidMask && avoidMask[y * W + x])) {
        m.t[y * W + x] = tile; placed++;
      }
    }
    const d = DIR8[r.int(0, 7)];
    x += d[0]; y += d[1];
    if (!inb(x, y)) { x = Math.round(cx); y = Math.round(cy); }
  }
}

/* ---------------------------------------------------------------- monster factory */
function monsterPool(biome, depth) {
  const d = Math.max(1, depth || 1);
  if (biome === 'forest') {
    if (d <= 1) return ['wolf', 'bandit', 'rat', 'goblin'];
    if (d === 2) return ['wolf', 'bandit', 'banditArcher', 'boar', 'goblin'];
    return ['wolf', 'bandit', 'banditArcher', 'boar', 'spider'];
  }
  if (biome === 'ruins') {
    if (d <= 1) return ['skeleton', 'bat', 'goblin', 'rat'];
    if (d === 2) return ['skeleton', 'shaman', 'bat', 'slime', 'cultist'];
    return ['skeleton', 'shaman', 'golem', 'cultist', 'wraith'];
  }
  if (biome === 'marsh') {
    if (d <= 1) return ['spider', 'slime', 'rat', 'bat'];
    if (d === 2) return ['spider', 'cultist', 'slime', 'shaman', 'imp'];
    return ['spider', 'cultist', 'imp', 'golem', 'wraith'];
  }
  if (d <= 2) return ['goblin', 'rat', 'bat'];
  if (d <= 4) return ['skeleton', 'slime', 'shaman', 'goblin', 'mimic'];
  return ['skeleton', 'shaman', 'imp', 'golem', 'wraith'];
}
function mkMon(kind, x, y, depth, rng, opts) {
  const d = MONS[kind] || MONS.rat;
  const o = opts || {};
  const scale = 1 + Math.max(0, (depth || 1) - 1) * 0.16;
  const hp = Math.round(d.hp * (o.boss ? 1 : scale));
  return {
    kind, x, y, hp, maxhp: hp,
    atk: Math.round(d.atk * (1 + Math.max(0, (depth || 1) - 1) * 0.1)),
    def: d.def, xp: d.xp, ai: d.ai, range: d.range || 0,
    fly: !!d.fly, undead: !!d.undead, boss: !!d.boss, shop: !!o.shop, fireImmune: !!d.fireImmune,
    fast: !!d.fast, status: {}, cd: 0, awake: !!o.boss || !!o.shop, state: (!!o.boss || !!o.shop) ? 'chase' : 'sleep',
    alertT: 0, sightLost: 0, lastSeen: null, tele: null, teleCd: 2 + (rng ? rng.int(0, 2) : 0),
    facing: [0, 1],
    ph: rng ? rng.float(0, 6.28) : 0,
    split: !!d.split, slow: !!d.slow, hitFlash: 0, mv: 0
  };
}
function randomItem(depth, rng) {
  const roll = rng.r();
  if (roll < 0.25) return { t: 'potion', k: rng.pick(POTIONS).k, n: 1 };
  if (roll < 0.44) return { t: 'scroll', k: rng.pick(SCROLLS).k, n: 1 };
  if (roll < 0.57) return { t: 'gold', n: rng.int(6, 18) + depth * 3 };
  if (roll < 0.64) return { t: 'food', k: 'ration', n: 1 };
  if (roll < 0.70) return { t: 'lockpick', n: rng.int(1, 3) };
  if (roll < 0.77) return { t: 'wand', k: rng.pick(Object.keys(WANDS)), n: 1, charges: rng.int(2, 5) };
  if (roll < 0.88) {
    const wt = rng.pick(WEAPON_TYPES);
    const it = { t: 'weapon', kind: wt.kind, name: wt.name, dmg: wt.dmg, crit: wt.crit, reach: wt.reach || 1, range: wt.range, ranged: !!wt.ranged, plus: 0, n: 1 };
    return dressGear(it, rng, depth, rarityLuck());
  }
  if (roll < 0.94) {
    const a = rng.pick(ARMOR_TYPES);
    return dressGear({ t: 'armor', name: a.name, def: a.def, plus: 0, n: 1 }, rng, depth, rarityLuck());
  }
  return dressGear({ t: 'ring', k: rng.pick(Object.keys(RINGS)), n: 1 }, rng, depth, rarityLuck());
}

/* ---------------------------------------------------------------- spot helpers */
function spotFree(m, x, y) {
  if (!inb(x, y)) return false;
  const t = m.t[y * W + x];
  if (!TILE_WALK[t] || t === T.CHASM) return false;
  if (x === m.start.x && y === m.start.y) return false;
  if (m.objs.some(o => o.x === x && o.y === y)) return false;
  if (m.items.some(o => o.x === x && o.y === y)) return false;
  if (m.mons.some(o => o.x === x && o.y === y)) return false;
  if (m.npcs.some(o => o.x === x && o.y === y)) return false;
  if (m.traps.some(o => o.x === x && o.y === y)) return false;
  if (m.stairs && m.stairs.x === x && m.stairs.y === y) return false;
  if (m.upStairs && m.upStairs.x === x && m.upStairs.y === y) return false;
  return true;
}
function freeSpotIn(m, room, opts) {
  const o = opts || {};
  const minFromStart = o.minFromStart || 0;
  for (let i = 0; i < 80; i++) {
    const x = room.x + Math.floor(Math.random() * room.w);
    const y = room.y + Math.floor(Math.random() * room.h);
    if (!spotFree(m, x, y)) continue;
    if (minFromStart && Math.abs(x - m.start.x) + Math.abs(y - m.start.y) < minFromStart) continue;
    return { x, y };
  }
  return null;
}
function addObj(m, x, y, kind, extra) {
  m.objs.push(Object.assign({ x, y, kind, used: false }, extra || {}));
}
function addItem(m, x, y, it) {
  if (!it) return;
  it.x = x; it.y = y; m.items.push(it);
}
function addMon(m, kind, x, y, depth, rng, opts) {
  m.mons.push(mkMon(kind, x, y, depth, rng, opts));
}

/* =====================================================================
   TOWN HUB — walled town, wide roads, plaza, shops, contract board, gate
   ===================================================================== */
function genTown(seedStr) {
  const rng = RNG(hashStr(seedStr + ':town'));
  const w = 64, h = 48;
  const m = newMap(w, h, 'town', '브라크하벤');
  m.outdoors = true; m.theme = 'town';
  const cx = 32, gateY = h - 4;
  m.start = { x: cx, y: gateY - 3 };

  fillRect(m, 0, 0, w, h, T.DIRT, 0);
  for (let i = 0; i < 30; i++) scatterBlob(m, rng.int(3, w - 4), rng.int(3, h - 4), rng.int(6, 18), T.GRASS, T.DIRT);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (x <= 2 || y <= 2 || x >= w - 3 || y >= h - 3) { m.t[y * W + x] = T.BRICK; m.vari[y * W + x] = (x + y) % 2; }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) m.t[y * W + x] = T.TREE;
  }
  /* crossroads: main street + small plaza so the four shops ring the view */
  const roadMask = new Uint8Array(w * h);
  carveThick(m, cx, gateY + 1, cx, 6, 7, T.ROAD, roadMask);
  carveThick(m, 4, 24, w - 5, 24, 7, T.ROAD, roadMask);
  fillRect(m, 29, 19, 7, 11, T.ROAD, 1);
  for (let y = 19; y <= 29; y++) for (let x = 29; x <= 35; x++) {
    roadMask[y * W + x] = 1;
    m.vari[y * W + x] = (x * 3 + y) % 3;
  }
  fillRect(m, 31, 22, 3, 3, T.CARPET);
  m.t[23 * W + 32] = T.WELL;
  for (const [bx, by] of [[30, 20], [34, 20], [30, 28], [34, 28]]) {
    if (inb(bx, by)) m.t[by * W + bx] = T.BRAZIER;
  }
  for (const [bx, by] of [[29, 19], [35, 19], [29, 29], [35, 29]]) {
    if (inb(bx, by)) m.t[by * W + bx] = rng.chance(0.5) ? T.TREE : T.BUSH;
  }
  /* gate */
  for (let y = h - 4; y < h - 2; y++) for (let x = cx - 3; x <= cx + 3; x++) m.t[y * W + x] = T.GATE;
  for (let x = cx - 4; x <= cx + 4; x++) m.t[(h - 3) * W + x] = T.GATE;
  m.t[(h - 2) * W + cx] = T.GATE;
  for (let y = h - 7; y < h - 2; y++) { m.t[y * W + cx - 5] = T.BRICK; m.t[y * W + cx + 5] = T.BRICK; }
  /* four shops face the plaza directly */
  const build = (bx, by, bw, bh, prop, px, py, label) => {
    fillRect(m, bx, by, bw, bh, T.BRICK, 1);
    for (let x = bx; x < bx + bw; x++) { m.t[by * W + x] = T.WOOD; m.t[(by + 1) * W + x] = T.WOOD; }
    const faceY = py <= by + 1 ? by + bh - 1 : by;
    for (let x = bx; x < bx + bw; x += 3) {
      if (inb(x, faceY) && m.t[faceY * W + x] === T.BRICK) m.t[faceY * W + x] = T.WOOD;
      if (inb(x, faceY - 1) && m.t[(faceY - 1) * W + x] === T.BRICK) m.t[(faceY - 1) * W + x] = T.BANNER;
    }
    if (inb(px, py)) {
      m.t[py * W + px] = T.WOOD;
      if (prop) addObj(m, px, py, prop, { label });
    }
  };
  build(18, 11, 11, 8, 'inn', 28, 18, '여관');
  build(36, 11, 11, 8, 'smith', 36, 18, '대장간');
  build(18, 30, 11, 8, 'herbalist', 28, 30, '약초상');
  build(36, 30, 11, 8, null, 36, 30, null);
  addObj(m, 36, 30, 'merchant', { label: '상점' });
  /* townhouses on the side lanes and the far ends */
  for (const [bx, by] of [[4, 8], [4, 16], [4, 32], [4, 40], [53, 8], [53, 16], [53, 32], [53, 40], [24, 40], [33, 40]]) {
    fillRect(m, bx, by, 7, 6, T.BRICK, 1);
    for (let x = bx; x < bx + 7; x++) m.t[by * W + x] = T.WOOD;
    for (let x = bx + 1; x < bx + 6; x += 2) m.t[by * W + x] = T.BANNER;
  }
  /* plaza furniture */
  addObj(m, 29, 22, 'board', { label: '의뢰' });
  addObj(m, 29, 26, 'notice');
  addObj(m, 35, 22, 'bench');
  addObj(m, 35, 26, 'bench');
  addObj(m, 31, 27, 'crate');
  addObj(m, 33, 27, 'barrel');
  addObj(m, 31, 21, 'crate');
  addObj(m, 33, 21, 'barrel');
  for (const [tx, ty] of [[cx - 3, gateY - 1], [cx + 3, gateY - 1], [29, 18], [35, 18], [29, 30], [35, 30], [28, 19], [36, 19]]) {
    if (inb(tx, ty)) m.torches.push({ x: tx, y: ty, ph: rng.float(0, 6.28) });
  }
  /* NPCs */
  const npc = (x, y, spr, name, line) => m.npcs.push({ x, y, spr, name, line, ph: rng.float(0, 6.28) });
  npc(cx - 2, gateY - 1, 'npcGuard', '경비병 하렌', '문 밖은 위험하네. 의뢰를 받고 나가게.');
  npc(cx + 2, gateY - 1, 'npcGuard', '경비병 미라', '들판에서 돌아오면 게시판에 보고하게.');
  npc(27, 19, 'npcInnkeeper', '여관 주인 도라', '따뜻한 불과 잠자리가 준비되어 있지.');
  npc(37, 19, 'npcSmith', '대장장이 오르반', '무기를 벼려줄까? 모루는 식지 않았네.');
  npc(27, 29, 'npcHerbalist', '약초상 니아', '물약과 자물쇠 따개, 식량 모두 있단다.');
  npc(37, 29, 'npcMerchant', '상인 켈', '값은 흥정하지. 물건은 좋아.');
  npc(32, 26, 'villager', '마을 사람', '요즘 숲에서 늑대가 길을 막는다더군.');
  npc(33, 20, 'villager', '마을 사람', '게시판을 보게. 보상이 꽤 짭짤해.');
  /* greenery inside the walls */
  for (let i = 0; i < 70; i++) {
    const x = rng.int(4, w - 5), y = rng.int(4, h - 5);
    const i0 = y * W + x;
    if (m.t[i0] !== T.GRASS) continue;
    if (m.objs.some(o => o.x === x && o.y === y)) continue;
    if (m.npcs.some(o => o.x === x && o.y === y)) continue;
    if (Math.abs(x - cx) < 7 && Math.abs(y - 24) < 6) continue;
    m.t[i0] = rng.chance(0.5) ? T.TREE : (rng.chance(0.65) ? T.BUSH : T.GRASS);
  }
  m.seen.fill(1);
  m.vis.fill(1);
  return m;
}

/* =====================================================================
   FIELD ZONE — wide outdoor approach: roads, woods, camps, dungeon gate
   ===================================================================== */
function genField(contract, tier, seedStr) {
  const rng = RNG(hashStr(seedStr + ':field:' + contract.id + ':' + tier));
  const w = 80, h = 66;
  const m = newMap(w, h, 'field', BIOMES[contract.biome].field);
  m.outdoors = true; m.biome = contract.biome; m.contract = contract.id;
  m.theme = 'field';
  const ground = BIOMES[contract.biome].ground;
  fillRect(m, 0, 0, w, h, ground);
  if (contract.biome === 'forest') {
    for (let i = 0; i < 30; i++) scatterBlob(m, rng.int(4, w - 5), rng.int(4, h - 5), rng.int(10, 30), T.GRASS, [ground, T.DIRT]);
  } else if (contract.biome === 'marsh') {
    for (let i = 0; i < 22; i++) scatterBlob(m, rng.int(4, w - 5), rng.int(4, h - 5), rng.int(8, 22), T.WATER, ground);
    for (let i = 0; i < 14; i++) scatterBlob(m, rng.int(4, w - 5), rng.int(4, h - 5), rng.int(6, 16), T.MOSS, [ground, T.WATER]);
  } else {
    for (let i = 0; i < 18; i++) scatterBlob(m, rng.int(4, w - 5), rng.int(4, h - 5), rng.int(10, 24), T.RUBBLE, ground);
  }
  /* outer border of trees / stones */
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) m.t[y * W + x] = contract.biome === 'ruins' ? T.BRICK : T.TREE;
  }
  m.start = { x: 5, y: Math.round(h / 2) };
  m.t[m.start.y * W + m.start.x] = T.DIRT;
  /* winding wide road from the west entrance to the dungeon gate (north-east) */
  const roadMask = new Uint8Array(w * h);
  const pts = [
    [5, Math.round(h / 2)],
    [18, Math.round(h / 2) + rng.int(-5, 5)],
    [31, Math.round(h * 0.62) + rng.int(-4, 4)],
    [45, Math.round(h * 0.45) + rng.int(-4, 4)],
    [58, Math.round(h * 0.34) + rng.int(-3, 3)],
    [w - 12, 16]
  ];
  for (let i = 1; i < pts.length; i++) {
    carveThick(m, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 4, T.DIRT, roadMask);
  }
  /* a clearing midway (camp / crossroads) */
  const mid = pts[3];
  fillEllipse(m, mid[0], mid[1], 8, 6, T.DIRT);
  for (let y = mid[1] - 6; y <= mid[1] + 6; y++) for (let x = mid[0] - 8; x <= mid[0] + 8; x++) if (inb(x, y)) roadMask[y * W + x] = 1;
  /* small stream with a plank bridge across the road */
  if (contract.biome !== 'marsh') {
    const sy = pts[2][1] + 7;
    for (let x = 6; x < w - 8; x++) {
      const yy = sy + Math.round(Math.sin(x * 0.11) * 3);
      for (let d = 0; d < 3; d++) {
        if (!inb(x, yy + d)) continue;
        if (m.t[(yy + d) * W + x] === T.DIRT || m.t[(yy + d) * W + x] === T.ROAD) {
          m.t[(yy + d) * W + x] = T.PLANK;
        } else m.t[(yy + d) * W + x] = T.WATER;
      }
    }
  }
  /* woods / ruins clusters, avoiding the road */
  for (let i = 0; i < 260; i++) {
    const x = rng.int(3, w - 4), y = rng.int(3, h - 4);
    const k = y * W + x;
    if (roadMask[k] || m.t[k] !== ground) continue;
    if (Math.abs(x - m.start.x) + Math.abs(y - m.start.y) < 6) continue;
    const nearRoad = DIR8.some(d => inb(x + d[0], y + d[1]) && roadMask[(y + d[1]) * W + x + d[0]]);
    if (nearRoad) continue;
    if (contract.biome === 'forest') m.t[k] = rng.chance(0.8) ? T.TREE : T.BUSH;
    else if (contract.biome === 'ruins') m.t[k] = rng.chance(0.65) ? T.BRICK : T.RUBBLE;
    else m.t[k] = rng.chance(0.5) ? T.BUSH : T.WATER;
  }
  /* dense groves off the road so the forest reads as a forest */
  if (contract.biome === 'forest') {
    for (let i = 0; i < 26; i++) {
      const gx = rng.int(6, w - 7), gy = rng.int(6, h - 7);
      if (roadMask[gy * W + gx]) continue;
      if (Math.abs(gx - m.start.x) + Math.abs(gy - m.start.y) < 9) continue;
      const n = rng.int(4, 11);
      let x = gx, y = gy;
      for (let k = 0; k < n; k++) {
        if (inb(x, y) && !roadMask[y * W + x] && m.t[y * W + x] === ground) m.t[y * W + x] = rng.chance(0.8) ? T.TREE : T.BUSH;
        const d = DIR8[rng.int(0, 7)];
        x = clamp(x + d[0], 3, w - 4); y = clamp(y + d[1], 3, h - 4);
      }
    }
  }
  /* ruined walls / standing stones near the road for landmarks */
  for (let i = 0; i < 5; i++) {
    const p = pts[rng.int(1, pts.length - 2)];
    const ox = p[0] + rng.int(-8, 8), oy = p[1] + rng.int(-7, 7);
    const len = rng.int(4, 9);
    const horiz = rng.chance(0.5);
    for (let k = 0; k < len; k++) {
      const x = ox + (horiz ? k : 0), y = oy + (horiz ? 0 : k);
      if (!inb(x, y) || roadMask[y * W + x]) continue;
      if (Math.abs(x - m.start.x) + Math.abs(y - m.start.y) < 5) continue;
      m.t[y * W + x] = contract.biome === 'ruins' ? T.BRICK : T.COVER;
    }
  }
  /* --- bandit / beast camp at the clearing --- */
  const campC = { x: mid[0] + 3, y: mid[1] - 3 };
  addObj(m, campC.x, campC.y, 'campfire');
  addObj(m, campC.x + 3, campC.y - 1, 'tent');
  addObj(m, campC.x - 3, campC.y - 2, 'tent');
  addObj(m, campC.x + 1, campC.y + 3, 'chest', { opened: false, trapped: rng.chance(0.4) });
  addObj(m, campC.x - 1, campC.y + 3, 'crate');
  addObj(m, campC.x + 4, campC.y + 2, 'barrel');
  addObj(m, campC.x - 4, campC.y + 2, 'barrel');
  for (let i = 0; i < 3; i++) {
    const s = freeSpotIn(m, { x: campC.x - 4, y: campC.y - 3, w: 9, h: 8 });
    if (s) addMon(m, contract.biome === 'forest' ? 'bandit' : contract.biome === 'ruins' ? 'skeleton' : 'cultist', s.x, s.y, tier, rng);
  }
  /* --- dungeon gate: stone arch at the north-east road end --- */
  const gx = w - 11, gy = 15;
  /* a ruined gatehouse: two broken towers flanking a stone approach */
  fillRect(m, gx - 5, gy - 4, 3, 8, T.BRICK, 0);
  fillRect(m, gx + 3, gy - 4, 3, 8, T.BRICK, 1);
  fillRect(m, gx - 2, gy - 4, 7, 2, T.BRICK, 0);
  fillRect(m, gx - 2, gy - 2, 5, 6, T.FLOOR, 0);
  for (let x = gx - 2; x <= gx + 2; x++) { m.t[(gy + 3) * W + x] = T.FLOOR; m.t[(gy + 4) * W + x] = T.DIRT; }
  m.t[(gy + 4) * W + gx - 1] = T.ARCH;
  m.t[(gy + 4) * W + gx + 1] = T.ARCH;
  const stairX = Math.round(gx), stairY = Math.round(gy + 1);
  m.t[stairY * W + stairX] = T.STAIRS;
  m.stairs = { x: stairX, y: stairY, toDungeon: true };
  addObj(m, gx - 3, gy + 4, 'brazier');
  addObj(m, gx + 3, gy + 4, 'brazier');
  addObj(m, gx, gy - 3, 'statue');
  for (const [rx, ry] of [[gx - 6, gy + 3], [gx + 6, gy + 3], [gx - 5, gy - 5], [gx + 5, gy - 5]]) {
    if (inb(rx, ry) && m.t[ry * W + rx] === T.GRASS) m.t[ry * W + rx] = T.RUBBLE;
  }
  for (let y = gy - 5; y <= gy + 4; y++) for (let x = gx - 6; x <= gx + 6; x++) if (inb(x, y)) roadMask[y * W + x] = 1;
  for (let i = 0; i < 4; i++) {
    const s = freeSpotIn(m, { x: gx - 6, y: gy - 2, w: 12, h: 10 });
    if (s) addMon(m, contract.elite, s.x, s.y, tier + 1, rng);
  }
  /* --- foraging & loot across the field --- */
  for (let i = 0; i < 14; i++) {
    const s = freeSpotIn(m, { x: 4, y: 4, w: w - 9, h: h - 9 });
    if (!s) continue;
    if (i < 7) addObj(m, s.x, s.y, rng.chance(0.6) ? 'herb' : 'berry');
    else addObj(m, s.x, s.y, rng.chance(0.5) ? 'bones' : (rng.chance(0.5) ? 'barrel' : 'chest'), { opened: false, trapped: rng.chance(0.3) });
  }
  /* items on the ground */
  for (let i = 0; i < 5; i++) {
    const s = freeSpotIn(m, { x: 4, y: 4, w: w - 9, h: h - 9 });
    if (s) addItem(m, s.x, s.y, randomItem(tier, rng));
  }
  /* --- wandering monsters --- */
  const pool = monsterPool(contract.biome, tier);
  const nMon = 10 + tier * 3;
  for (let i = 0; i < nMon; i++) {
    const s = freeSpotIn(m, { x: 4, y: 4, w: w - 9, h: h - 9 }, { minFromStart: 9 });
    if (s) addMon(m, rng.pick(pool), s.x, s.y, tier, rng, {});
  }
  /* wolves hunt in packs */
  {
    const s = freeSpotIn(m, { x: 8, y: 8, w: w - 16, h: h - 16 }, { minFromStart: 14 });
    if (s) for (let k = 0; k < 3; k++) {
      const nx = s.x + DIR8[k][0], ny = s.y + DIR8[k][1];
      if (spotFree(m, nx, ny)) addMon(m, 'wolf', nx, ny, tier + 1, rng);
    }
  }
  /* road ambushes: beasts and brigands lurking just off the travelled path */
  for (let i = 0; i < 7 + tier * 2; i++) {
    const p0 = pts[rng.int(1, pts.length - 1)];
    const ax = clamp(p0[0] + rng.int(-7, 7), 4, w - 5);
    const ay = clamp(p0[1] + rng.int(-6, 6), 4, h - 5);
    if (Math.abs(ax - m.start.x) + Math.abs(ay - m.start.y) < 8) continue;
    if (!spotFree(m, ax, ay)) continue;
    addMon(m, rng.pick(pool), ax, ay, tier, rng);
  }
  /* traps along the road */
  for (let i = 0; i < 3 + tier; i++) {
    const s = freeSpotIn(m, { x: 6, y: 6, w: w - 12, h: h - 12 }, { minFromStart: 10 });
    if (!s) continue;
    m.traps.push({ x: s.x, y: s.y, kind: rng.pick(['bear', 'dart', 'fire', 'tp']), found: false, armed: true });
  }
  /* sign post at the fork */
  addObj(m, pts[1][0] + 2, pts[1][1] + 3, 'sign');
  /* undergrowth & ground variety so the wide field does not repeat */
  for (let i = 0; i < 90; i++) {
    const x = rng.int(3, w - 4), y = rng.int(3, h - 4);
    const k = y * W + x;
    if (m.t[k] !== ground || roadMask[k]) continue;
    if (Math.abs(x - m.start.x) + Math.abs(y - m.start.y) < 5) continue;
    m.t[k] = rng.chance(0.45) ? T.BUSH : (rng.chance(0.5) ? T.RUBBLE : T.MOSS);
  }
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const k = y * W + x, t = m.t[k];
    if (t === T.GRASS || t === T.DIRT || t === T.ROAD || t === T.WATER || t === T.MUD || t === T.MOSS || t === T.RUBBLE) {
      m.vari[k] = rng.int(0, 2);
    }
  }
  m.vis[m.start.y * W + m.start.x] = 1;
  m.seen.fill(1);
  return m;
}

/* =====================================================================
   GRAND DUNGEON — wide halls, pillared chapels, crypts, vaults, boss hall
   ===================================================================== */
function genDungeon(contract, floorNo, tier, seedStr) {
  const rng = RNG(hashStr(seedStr + ':dungeon:' + contract.id + ':' + floorNo));
  const w = 74, h = 64;
  const biome = contract.biome;
  const names = {
    forest: ['고목 폐허', '이끼 낀 지하 묘역', '뿌리로 뒤덮인 성소'],
    ruins: ['고대 납골당', '잊힌 예배당', '뼈의 왕좌'],
    marsh: ['연금술 지하실', '녹아내린 실험실', '요새의 심장']
  };
  const themeName = (names[biome] || names.ruins)[Math.min(2, floorNo - 1)];
  const m = newMap(w, h, 'dungeon', themeName);
  m.biome = biome; m.contract = contract.id; m.floor = floorNo;
  m.theme = biome === 'marsh' ? 'fort' : biome === 'forest' ? 'ruin' : 'crypt';

  /* --- rooms: large halls, 11~20 wide --- */
  const rooms = [];
  for (let tries = 0; tries < 180 && rooms.length < 7; tries++) {
    const rw = rng.int(11, 19), rh = rng.int(9, 14);
    const x = rng.int(2, w - rw - 3), y = rng.int(2, h - rh - 3);
    let ok = true;
    for (const r of rooms) {
      if (x < r.x + r.w + 4 && x + rw + 4 > r.x && y < r.y + r.h + 4 && y + rh + 4 > r.y) { ok = false; break; }
    }
    if (!ok) continue;
    rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
  }
  if (rooms.length < 4) {
    rooms.length = 0;
    for (let i = 0; i < 5; i++) rooms.push({ x: 4 + i * 13, y: 6 + (i % 2) * 22, w: 12, h: 11, cx: 10 + i * 13, cy: 11 + (i % 2) * 22 });
  }
  /* carve rooms */
  for (const r of rooms) {
    fillRect(m, r.x, r.y, r.w, r.h, T.FLOOR, 0);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m.vari[y * W + x] = rng.int(0, 2);
  }
  /* connect rooms with 3-wide corridors (nearest-neighbour chain + loops) */
  const connected = [rooms[0]];
  const rest = rooms.slice(1);
  while (rest.length) {
    let best = null, bestD = 1e9, bestFrom = null;
    for (const a of connected) for (const b of rest) {
      const d = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
      if (d < bestD) { bestD = d; best = b; bestFrom = a; }
    }
    if (!best) break;
    /* L-shaped corridor, 3 wide */
    const mx = rng.chance(0.5) ? bestFrom.cx : best.cx;
    carveThick(m, bestFrom.cx, bestFrom.cy, mx, bestFrom.cy, 3, T.FLOOR);
    carveThick(m, mx, bestFrom.cy, mx, best.cy, 3, T.FLOOR);
    carveThick(m, mx, best.cy, best.cx, best.cy, 3, T.FLOOR);
    connected.push(best);
    rest.splice(rest.indexOf(best), 1);
  }
  for (let i = 0; i < 2; i++) {
    const a = rng.pick(rooms), b = rng.pick(rooms);
    if (a === b) continue;
    carveThick(m, a.cx, a.cy, rng.chance(0.5) ? b.cx : a.cx, a.cy, 3, T.FLOOR);
    carveThick(m, a.cx, b.cy, b.cx, b.cy, 3, T.FLOOR);
  }
  /* --- water / crypt pools & soil --- */
  const archPool = rooms.slice(1);
  for (const r of archPool) {
    const roll = rng.r();
    if (roll < 0.3) {
      const band = Math.max(3, (r.h / 2) | 0);
      for (let y = r.y + (r.h - band); y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        if ((x - r.x) % 4 === 0) continue; // stepping stones
        if (rng.chance(0.82)) m.t[y * W + x] = T.WATER;
      }
    } else if (roll < 0.55) {
      for (let i = 0; i < 4; i++) {
        const x = r.x + rng.int(1, r.w - 2), y = r.y + rng.int(1, r.h - 2);
        const v = rng.chance(0.5) ? T.BLOOD : T.MOSS;
        for (let yy = y; yy < Math.min(r.y + r.h - 1, y + rng.int(1, 3)); yy++)
          for (let xx = x; xx < Math.min(r.x + r.w - 1, x + rng.int(1, 3)); xx++) m.t[yy * W + xx] = v;
      }
    }
  }
  /* --- pillars inside halls (single columns, wide aisles kept clear) --- */
  for (const r of rooms) {
    if (r.w >= 13 && r.h >= 10) {
      for (let y = r.y + 3; y < r.y + r.h - 2; y += 4) {
        for (let x = r.x + 3; x < r.x + r.w - 2; x += 4) {
          if (m.t[y * W + x] !== T.FLOOR) continue;
          m.t[y * W + x] = T.PILLAR;
        }
      }
    }
    /* a carpet aisle down the middle of every grand hall */
    if (r.w >= 13 && r.h >= 10) {
      for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
        for (let x = r.cx - 1; x <= r.cx + 1; x++) {
          if (inb(x, y) && m.t[y * W + x] === T.FLOOR) m.t[y * W + x] = T.CARPET;
        }
      }
    }
  }
  /* --- start room, stairs down, stairs up --- */
  const startRoom = rooms[0];
  m.start = { x: startRoom.cx, y: startRoom.cy };
  m.t[m.start.y * W + m.start.x] = T.FLOOR;
  m.upStairs = { x: startRoom.x + 1, y: startRoom.y + 1 };
  m.t[m.upStairs.y * W + m.upStairs.x] = T.STAIRS;
  /* clear the immediate area */
  for (let y = startRoom.cy - 2; y <= startRoom.cy + 2; y++) for (let x = startRoom.cx - 2; x <= startRoom.cx + 2; x++) {
    if (inb(x, y) && (m.t[y * W + x] === T.PILLAR || m.t[y * W + x] === T.WATER)) m.t[y * W + x] = T.FLOOR;
  }
  let far = rooms[1] || rooms[0], bestD = -1;
  for (const r of rooms) {
    const d = Math.abs(r.cx - m.start.x) + Math.abs(r.cy - m.start.y);
    if (d > bestD) { bestD = d; far = r; }
  }
  const isBossFloor = floorNo >= 3;
  const bossRoom = isBossFloor ? far : null;
  if (!isBossFloor) {
    m.stairs = { x: far.cx, y: far.cy };
    m.t[m.stairs.y * W + m.stairs.x] = T.STAIRS;
    for (let y = far.cy - 1; y <= far.cy + 1; y++) for (let x = far.cx - 1; x <= far.cx + 1; x++) {
      if (inb(x, y) && m.t[y * W + x] === T.PILLAR) m.t[y * W + x] = T.FLOOR;
    }
  } else {
    m.stairs = null;
    /* grand boss hall: carpet aisle, pillars, braziers, blood */
    const r = bossRoom;
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.cx - 2; x <= r.cx + 2; x++) m.t[y * W + x] = T.CARPET;
    for (let y = r.y + 4; y < r.y + r.h - 2; y += 4) {
      for (const side of [-4, 4]) {
        const x = r.cx + side;
        if (!inb(x, y)) continue;
        m.t[y * W + x] = T.PILLAR;
      }
    }
    for (const [bx, by] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) {
      if (inb(bx, by)) m.t[by * W + bx] = T.BRAZIER;
    }
    m.bossSpawn = { x: r.cx, y: r.y + 4 };
    addMon(m, contract.boss, m.bossSpawn.x, m.bossSpawn.y, tier + 2, rng, { boss: true });
    m.t[r.cy * W + r.cx] = T.CARPET;
  }
  /* --- doors & locked iron gates on some corridors --- */
  let gates = 0;
  for (let y = 2; y < h - 2 && gates < 3; y++) {
    for (let x = 2; x < w - 2 && gates < 3; x++) {
      const i = y * W + x;
      if (m.t[i] !== T.FLOOR) continue;
      const n = m.t[(y - 1) * W + x], s = m.t[(y + 1) * W + x], ww = m.t[y * W + x - 1], e = m.t[y * W + x + 1];
      const vert = TILE_WALK[n] && TILE_WALK[s] && !TILE_WALK[ww] && !TILE_WALK[e];
      const horz = TILE_WALK[ww] && TILE_WALK[e] && !TILE_WALK[n] && !TILE_WALK[s];
      if (!vert && !horz) continue;
      if (Math.abs(x - m.start.x) + Math.abs(y - m.start.y) < 12) continue;
      if (rng.chance(0.055)) { m.t[i] = rng.chance(0.55) ? T.DOOR : T.LOCKED; if (m.t[i] === T.LOCKED) gates++; }
    }
  }
  m.lockGates = gates;
  /* --- secret vault behind a wall --- */
  makeVault(m, rng, tier);
  /* --- props --- */
  const propRoom = (r) => r;
  for (const r of rooms) {
    if (r === startRoom) {
      addObj(m, r.x + 2, r.y + r.h - 2, 'campfire');
      continue;
    }
    if (r === bossRoom) continue;
    const nb = rng.int(1, 3);
    for (let i = 0; i < nb; i++) {
      const s = freeSpotIn(m, r);
      if (s) addObj(m, s.x, s.y, rng.chance(0.6) ? 'barrel' : 'crate');
    }
    for (let i = 0; i < 2; i++) {
      const s = freeSpotIn(m, r);
      if (!s) continue;
      if (rng.chance(0.55)) addObj(m, s.x, s.y, 'chest', { opened: false, trapped: rng.chance(0.3), locked: rng.chance(0.28) });
      else addObj(m, s.x, s.y, 'crate');
    }
    if (rng.chance(0.6)) {
      const s = freeSpotIn(m, r, { minFromStart: 6 });
      if (s) addObj(m, s.x, s.y, rng.pick(['brazier', 'bookshelf', 'statue', 'bones']));
    }
    if (rng.chance(0.35)) {
      const s = freeSpotIn(m, r);
      if (s) addObj(m, s.x, s.y, 'shrine');
    }
    if (rng.chance(0.3)) {
      const s = freeSpotIn(m, r);
      if (s) addObj(m, s.x, s.y, 'anvil');
    }
    if (rng.chance(0.22)) {
      const s = freeSpotIn(m, r);
      if (s) addObj(m, s.x, s.y, 'bones');
    }
  }
  /* a goblin merchant in one hall */
  if (rng.chance(0.5)) {
    const r = rng.pick(rooms.slice(1));
    const s = freeSpotIn(m, r, { minFromStart: 8 });
    if (s) { addObj(m, s.x, s.y, 'merchant'); m.mons.push(mkMon('goblinShop', s.x, s.y, tier, rng, { shop: true })); }
  }
  /* torches on walls */
  for (const r of rooms) {
    for (const [tx, ty] of [[r.cx, r.y - 1], [r.cx, r.y + r.h], [r.x - 1, r.cy], [r.x + r.w, r.cy]]) {
      if (!inb(tx, ty)) continue;
      if (m.t[ty * W + tx] === T.WALL) m.torches.push({ x: tx, y: ty, ph: rng.float(0, 6.28) });
    }
    /* a row of wall torches so the long halls read at a glance */
    for (let tx = r.x + 2; tx < r.x + r.w - 1; tx += 5) {
      const ty = r.y - 1;
      if (inb(tx, ty) && m.t[ty * W + tx] === T.WALL) m.torches.push({ x: tx, y: ty, ph: rng.float(0, 6.28) });
    }
    /* braziers flanking the hall + scattered rubble/blood */
    if (r.w >= 14 && r.h >= 11 && r !== bossRoom) {
      for (const [bx, by] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) {
        if (inb(bx, by) && (m.t[by * W + bx] === T.FLOOR || m.t[by * W + bx] === T.CARPET)) m.t[by * W + bx] = T.BRAZIER;
      }
    }
    /* banners on the north wall */
    for (let bx = r.x + 2; bx < r.x + r.w - 1; bx += 6) {
      const by = r.y - 1;
      if (inb(bx, by) && m.t[by * W + bx] === T.WALL) m.t[by * W + bx] = T.BANNER;
    }
    for (let i = 0; i < 12; i++) {
      const rx = r.x + rng.int(1, r.w - 2), ry = r.y + rng.int(1, r.h - 2);
      const cur = m.t[ry * W + rx];
      if (cur !== T.FLOOR) continue;
      m.t[ry * W + rx] = rng.chance(0.4) ? T.BLOOD : (rng.chance(0.5) ? T.RUBBLE : T.MOSS);
    }
    /* bookshelves and wall niches along the north wall */
    for (let bx = r.x + 3; bx < r.x + r.w - 2; bx += 6) {
      const by = r.y - 1;
      if (inb(bx, by) && m.t[by * W + bx] === T.WALL) m.t[by * W + bx] = T.BOOKSHELF;
    }
  }
  /* --- items & traps --- */
  for (let i = 0; i < 4; i++) {
    const s = freeSpotIn(m, rng.pick(rooms));
    if (s) addItem(m, s.x, s.y, randomItem(tier + floorNo, rng));
  }
  for (let i = 0; i < 3 + tier; i++) {
    const s = freeSpotIn(m, rng.pick(rooms), { minFromStart: 8 });
    if (s) m.traps.push({ x: s.x, y: s.y, kind: rng.pick(['dart', 'fire', 'tp', 'bear']), found: false, armed: true });
  }
  /* --- monsters --- */
  const pool = monsterPool(biome, Math.min(3, tier + floorNo - 1));
  const nMon = 6 + floorNo * 2 + tier;
  for (let i = 0; i < nMon; i++) {
    const r = rng.pick(rooms.slice(1));
    const s = freeSpotIn(m, r, { minFromStart: 7 });
    if (s) addMon(m, rng.pick(pool), s.x, s.y, tier + floorNo, rng);
  }
  /* elite on the middle floor */
  if (floorNo === 2) {
    const r = rng.pick(rooms.slice(1));
    const s = freeSpotIn(m, r, { minFromStart: 8 });
    if (s) {
      const em = mkMon(rng.pick(pool), s.x, s.y, tier + 3, rng);
      em.elite = true; em.hp = Math.round(em.hp * 1.8); em.maxhp = em.hp; em.atk += 1; em.xp = Math.round(em.xp * 2);
      m.mons.push(em);
    }
  }
  /* --- guarantee reachability & no stranded props --- */
  ensureDungeonReach(m);
  m.vis[m.start.y * W + m.start.x] = 1;
  m.seen[m.start.y * W + m.start.x] = 1;
  return m;
}

/* hidden vault behind a secret door */
function makeVault(m, rng, tier) {
  const hosts = [];
  for (const r of m.rooms || []) hosts.push(r);
  /* worldgen rooms aren't registered on the map yet — collect floor pockets instead */
  for (let attempt = 0; attempt < 80; attempt++) {
    const w = 4, h = 4;
    const vx = rng.int(3, W - w - 4), vy = rng.int(3, H - h - 4);
    let ok = true;
    for (let y = vy - 1; y <= vy + h; y++) for (let x = vx - 1; x <= vx + w; x++) {
      if (!inb(x, y)) { ok = false; break; }
      if (x >= vx && x < vx + w && y >= vy && y < vy + h) continue;
      if (m.t[y * W + x] !== T.WALL) { ok = false; break; }
    }
    if (!ok) continue;
    /* must touch a floor tile so the secret door can open into a hall */
    let touch = null;
    for (let y = vy - 1; y <= vy + h && !touch; y++) for (let x = vx - 1; x <= vx + w && !touch; x++) {
      if (x >= vx && x < vx + w && y >= vy && y < vy + h) continue;
      if (m.t[y * W + x] === T.FLOOR) touch = { x, y };
    }
    if (!touch) continue;
    for (let y = vy; y < vy + h; y++) for (let x = vx; x < vx + w; x++) m.t[y * W + x] = T.FLOOR;
    m.t[touch.y * W + touch.x] = T.SECRET;
    const cx = vx + 1, cy = vy + 1;
    addObj(m, cx + 1, cy + 1, 'chest', { opened: false, trapped: rng.chance(0.4), loot: 'vault' });
    addItem(m, cx, cy, { t: 'gold', n: 30 + tier * 12 + rng.int(0, 30) });
    addItem(m, cx, cy + 2, { t: 'scroll', k: 'upgrade', n: 1 });
    m.vault = { x: cx, y: cy };
    return true;
  }
  return false;
}

/* ---------------------------------------------------------------- dungeon reachability */
function reachFrom(m, opts) {
  const o = opts || {};
  const seen = new Uint8Array(W * H);
  const q = [m.start];
  seen[m.start.y * W + m.start.x] = 1;
  const pass = (t) => TILE_WALK[t] || (o.locked && t === T.LOCKED) || (o.secret && t === T.SECRET);
  while (q.length) {
    const p = q.shift();
    for (const d of DIR4) {
      const nx = p.x + d[0], ny = p.y + d[1];
      if (!inb(nx, ny)) continue;
      const k = ny * W + nx;
      if (seen[k]) continue;
      if (!pass(m.t[k])) continue;
      seen[k] = 1;
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}
function ensureDungeonReach(m) {
  const open = reachFrom(m, { locked: true, secret: true });
  const openL = reachFrom(m, { locked: true });
  const reloc = (o) => {
    for (let i = 0; i < 400; i++) {
      const x = 2 + Math.floor(Math.random() * (W - 4)), y = 2 + Math.floor(Math.random() * (H - 4));
      if (!open[y * W + x]) continue;
      if (!TILE_WALK[m.t[y * W + x]] || m.t[y * W + x] === T.CHASM) continue;
      if (x === m.start.x && y === m.start.y) continue;
      if (m.objs.some(z => z.x === x && z.y === y && z !== o)) continue;
      if (m.items.some(z => z.x === x && z.y === y && z !== o)) continue;
      if (m.mons.some(z => z.x === x && z.y === y && z !== o)) continue;
      o.x = x; o.y = y; return true;
    }
    return false;
  };
  for (const it of m.items) if (!open[it.y * W + it.x]) reloc(it);
  for (const mo of m.mons) if (!open[mo.y * W + mo.x]) reloc(mo);
  for (const ob of m.objs) if (!open[ob.y * W + ob.x]) reloc(ob);
  /* stairs down must be reachable with keys */
  if (m.stairs && !openL[m.stairs.y * W + m.stairs.x]) {
    /* carve a line from the start */
    let x = m.start.x, y = m.start.y;
    while (x !== m.stairs.x) { x += Math.sign(m.stairs.x - x); if (m.t[y * W + x] === T.WALL || m.t[y * W + x] === T.BRICK) m.t[y * W + x] = T.FLOOR; }
    while (y !== m.stairs.y) { y += Math.sign(m.stairs.y - y); if (m.t[y * W + x] === T.WALL || m.t[y * W + x] === T.BRICK) m.t[y * W + x] = T.FLOOR; }
    m.t[m.stairs.y * W + m.stairs.x] = T.STAIRS;
  }
  /* a key always exists when a locked gate does */
  if (m.t.includes(T.LOCKED) && !m.items.some(i => i.t === 'key')) {
    const s = freeSpotIn(m, { x: 2, y: 2, w: W - 4, h: H - 4 }, { minFromStart: 3 });
    if (s) m.items.push({ t: 'key', n: 1, x: s.x, y: s.y });
  }
  /* sealed doors become open floor */
  for (let i = 0; i < W * H; i++) {
    const t = m.t[i];
    if (t !== T.DOOR) continue;
    const x = i % W, y = (i / W) | 0;
    const near = DIR4.some(d => inb(x + d[0], y + d[1]) && open[(y + d[1]) * W + x + d[0]]);
    if (!near) m.t[i] = T.FLOOR;
  }
}
