/* =====================================================================
   TACTICS — hazard-aware pathfinding, raycasting, awareness, telegraphs,
   weapon arts (melee & ranged), knockback and class skills.
   ===================================================================== */

/* ---------------------------------------------------------------- basics */
function tileAt(x, y) { return inb(x, y) ? G.m.t[y * W + x] : T.WALL; }
function inGrass(x, y) { const t = tileAt(x, y); return t === T.GRASS || t === T.BUSH; }
function inWater(x, y) { return tileAt(x, y) === T.WATER; }
function fireAt(x, y) { return inb(x, y) ? G.m.fire[y * W + x] : 0; }
function gasAt(x, y) { return inb(x, y) ? G.m.gas[y * W + x] : 0; }
function trapAt2(x, y) { return G.m.traps.find(t => t.x === x && t.y === y && t.armed); }
function isSolidTile(x, y) { return !inb(x, y) || !!TILE_SOLID[tileAt(x, y)]; }
function blocksProj(x, y) { return !inb(x, y) || !!TILE_PROJ[tileAt(x, y)]; }

/* extra cost so routes bend around things that hurt */
function hazardCost(x, y, forMon) {
  let c = 0;
  if (fireAt(x, y) > 0) c += 46;
  if (gasAt(x, y) > 0) c += 20;
  const tr = trapAt2(x, y);
  if (tr) c += tr.found ? 34 : 0;
  if (tileAt(x, y) === T.CHASM) c += 200;
  return c;
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    this.k.push(k); this.p.push(p);
    let i = this.k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (this.p[par] <= this.p[i]) break;
      [this.k[par], this.k[i]] = [this.k[i], this.k[par]];
      [this.p[par], this.p[i]] = [this.p[i], this.p[par]];
      i = par;
    }
  }
  pop() {
    const top = this.k[0];
    const lk = this.k.pop(), lp = this.p.pop();
    if (this.k.length) {
      this.k[0] = lk; this.p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.k.length && this.p[l] < this.p[m]) m = l;
        if (r < this.k.length && this.p[r] < this.p[m]) m = r;
        if (m === i) break;
        [this.k[m], this.k[i]] = [this.k[i], this.k[m]];
        [this.p[m], this.p[i]] = [this.p[i], this.p[m]];
        i = m;
      }
    }
    return top;
  }
}

/* ---------------------------------------------------------------- raycast */
function raycast(x1, y1, x2, y2, opts) {
  const o = opts || {};
  const tiles = [{ x: x1, y: y1 }];
  if (x1 === x2 && y1 === y2) return { clear: true, block: null, tiles, target: true };
  const dx = x2 - x1, dy = y2 - y1;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const sx = Math.sign(dx), sy = Math.sign(dy);
  let x = x1, y = y1;
  let tMaxX = ax ? 0.5 / ax : Infinity;
  let tMaxY = ay ? 0.5 / ay : Infinity;
  const tDX = ax ? 1 / ax : Infinity;
  const tDY = ay ? 1 / ay : Infinity;
  const blocks = o.sight ? (bx, by) => (!inb(bx, by) || tileOpaqueForSight(bx, by)) : blocksProj;
  let guard = 0;
  while (guard++ < 500) {
    if (tMaxX < tMaxY - 1e-9) { x += sx; tMaxX += tDX; }
    else if (tMaxY < tMaxX - 1e-9) { y += sy; tMaxY += tDY; }
    else {
      const cx = x + sx, cy = y + sy;
      if (blocks(cx, y) || blocks(x, cy)) {
        return { clear: false, block: { x: cx, y: cy }, tiles, corner: true };
      }
      x = cx; y = cy; tMaxX += tDX; tMaxY += tDY;
      tiles.push({ x, y });
      if (x === x2 && y === y2) return { clear: true, block: null, tiles, target: true };
      if (blocks(x, y)) return { clear: false, block: { x, y }, tiles };
      continue;
    }
    tiles.push({ x, y });
    if (x === x2 && y === y2) {
      if (o.sight) return { clear: true, block: null, tiles, target: true };
      return { clear: !blocksProj(x, y), block: blocksProj(x, y) ? { x, y } : null, tiles, target: true };
    }
    if (blocks(x, y)) return { clear: false, block: { x, y }, tiles };
  }
  return { clear: false, block: null, tiles };
}
function tileOpaqueForSight(x, y) {
  const t = G.m.t[y * W + x];
  if (t === T.GRASS || t === T.BUSH) return false;   // concealing ground does not wall off sight
  return !!TILE_OPAQUE[t];
}
function los(x1, y1, x2, y2) { return raycast(x1, y1, x2, y2).clear; }
function sightClear(x1, y1, x2, y2) { return raycast(x1, y1, x2, y2, { sight: true }).clear; }

/* ---------------------------------------------------------------- A* path */
function canPickLocks() {
  const p = G.p;
  if (!p) return false;
  return p.inv.some(o => o.t === 'lockpick' && o.n > 0) || p.inv.some(o => o.t === 'key');
}
function walkableForPath(x, y, opts) {
  if (!inb(x, y)) return false;
  const t = G.m.t[y * W + x];
  if (t === T.CHASM || t === T.SECRET) return false;
  if (t === T.LOCKED) return !!(opts && (opts.canOpen || opts.hasKey));
  if (t === T.DOOR) return true;
  return !!TILE_WALK[t];
}
function avoidCorners(x, y, nx, ny, opts) {
  if (x === nx || y === ny) return true;
  const a = walkableForPath(nx, y, opts), b = walkableForPath(x, ny, opts);
  return a && b;
}
/* opts: {canOpen, ignoreHazard} */
function findPath(sx, sy, tx, ty, opts) {
  const o = Object.assign({ canOpen: canPickLocks() }, opts || {});
  if (!inb(tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  const mon = monAt(tx, ty);
  const goalHazard = fireAt(tx, ty) > 0 || gasAt(tx, ty) > 0 || !!trapAt2(tx, ty);
  if (!walkableForPath(tx, ty, o) && !mon && !(goalHazard && tileAt(tx, ty) !== T.CHASM)) return null;
  const N = W * H;
  const gScore = new Int32Array(N).fill(0x7fffffff);
  const came = new Int32Array(N).fill(-1);
  const start = sy * W + sx, goal = ty * W + tx;
  const heap = new MinHeap();
  gScore[start] = 0;
  heap.push(start, 0);
  const h = (x, y) => (Math.abs(x - tx) > Math.abs(y - ty) ? Math.abs(x - tx) : Math.abs(y - ty));
  let found = false, guard = 0;
  while (heap.size && guard++ < 40000) {
    const cur = heap.pop();
    if (cur === goal) { found = true; break; }
    const cx = cur % W, cy = (cur / W) | 0;
    const base = gScore[cur];
    for (const d of DIR8) {
      const nx = cx + d[0], ny = cy + d[1];
      if (!inb(nx, ny)) continue;
      if (nx === tx && ny === ty) {
        /* enemy tile is walkable as the goal */
      } else if (!walkableForPath(nx, ny, o)) continue;
      if (!avoidCorners(cx, cy, nx, ny, o)) continue;
      let monCost = 0;
      const blocker = monAt(nx, ny);
      if (blocker && !(nx === tx && ny === ty)) { if (blocker.shop) continue; monCost = 9; }
      let objCost = 0;
      const ob = objAt(nx, ny);
      if (ob) {
        if (BLOCKING_OBJ[ob.kind] !== false) {
          if (!(nx === tx && ny === ty)) continue;
          objCost = 4;
        } else if (ob.kind === 'herb' || ob.kind === 'berry' || ob.kind === 'bones') objCost = 2;
      }
      if (!(nx === tx && ny === ty) && G.m.npcs.some(o => o.x === nx && o.y === ny)) continue;
      const t = G.m.t[ny * W + nx];
      let step = TILE_COST[t] || 1;
      if (!(nx === tx && ny === ty)) step += hazardCost(nx, ny, false);
      if (t === T.LOCKED) step += 6;
      step += monCost + objCost;
      const ng = base + step;
      const k = ny * W + nx;
      if (ng < gScore[k]) {
        gScore[k] = ng; came[k] = cur;
        heap.push(k, ng + h(nx, ny));
      }
    }
  }
  if (!found) return null;
  const path = [];
  let cur = goal;
  let safety = 0;
  while (cur !== start && safety++ < 6000) {
    path.push({ x: cur % W, y: (cur / W) | 0 });
    cur = came[cur];
    if (cur < 0) return null;
  }
  path.reverse();
  return path;
}
function objBlocking(x, y) {
  const o = objAt(x, y);
  if (!o) return false;
  return BLOCKING_OBJ[o.kind] !== false;
}
const BLOCKING_OBJ = {
  barrel: true, crate: true, shrine: true, anvil: true, statue: true, bones: true,
  campfire: true, merchant: true, tent: true, bench: true, notice: true, sign: true,
  board: true, inn: true, smith: true, herbalist: true, fountain: true, brazier: true,
  bookshelf: true, chest: true, well: true, herb: false, berry: false
};
/* path preview helper for the renderer */
function pathPreviewInfo(path) {
  if (!path || !path.length) return null;
  let hazardCostSum = 0;
  for (const t of path) {
    hazardCostSum += hazardCost(t.x, t.y, false);
    if (tileAt(t.x, t.y) === T.WATER || tileAt(t.x, t.y) === T.MUD) hazardCostSum += 1;
  }
  return { safe: hazardCostSum === 0, cost: path.length + hazardCostSum };
}

/* ---------------------------------------------------------------- distance field */
function computeDistField() {
  const N = W * H;
  const d = new Int32Array(N).fill(0x7fffffff);
  const p = G.p;
  const start = p.y * W + p.x;
  d[start] = 0;
  const heap = new MinHeap();
  heap.push(start, 0);
  let guard = 0;
  while (heap.size && guard++ < 12000) {
    const cur = heap.pop();
    const cx = cur % W, cy = (cur / W) | 0;
    const base = d[cur];
    for (const dd of DIR8) {
      const nx = cx + dd[0], ny = cy + dd[1];
      if (!inb(nx, ny)) continue;
      if (!walkableForPath(nx, ny, { canOpen: false })) continue;
      if (!avoidCorners(cx, cy, nx, ny, { canOpen: false })) continue;
      if (monAt(nx, ny)) continue;
      if (objBlocking(nx, ny)) continue;
      const t = G.m.t[ny * W + nx];
      let step = TILE_COST[t] || 1;
      step += hazardCost(nx, ny, true);
      const k = ny * W + nx;
      const ng = base + step;
      if (ng < d[k]) { d[k] = ng; heap.push(k, ng); }
    }
  }
  G.distField = d;
  return d;
}

/* ---------------------------------------------------------------- awareness */
function monStateOf(mon) { return mon.state || (mon.awake ? 'chase' : 'sleep'); }
function setMonState(mon, s) {
  mon.state = s;
  mon.awake = s !== 'sleep';
  if (s === 'sleep') { mon.alertT = 0; mon.sightLost = 0; }
  if (s === 'chase') mon.sightLost = 0;
}
function detectPlayer(mon) {
  const p = G.p;
  const d = dist(mon.x, mon.y, p.x, p.y);
  if (d <= 1) return true;
  if (!p || p.status.stealth > 0) return false;
  const sleeping = monStateOf(mon) === 'sleep';
  let range = mon.boss ? 10 : sleeping ? 4.5 : 7;
  if (inGrass(p.x, p.y)) range = Math.min(range, 2.4);
  if (p.status.blind) range -= 2;
  if (euc(mon.x, mon.y, p.x, p.y) > range) return false;
  return sightClear(mon.x, mon.y, p.x, p.y);
}
function alertAllies(mon) {
  let n = 0;
  for (const o of G.m.mons) {
    if (o === mon || o.hp <= 0 || o.shop) continue;
    if (monStateOf(o) !== 'sleep') continue;
    if (dist(o.x, o.y, mon.x, mon.y) > 7) continue;
    if (!sightClear(mon.x, mon.y, o.x, o.y)) continue;
    setMonState(o, 'alert');
    o.alertT = 1;
    o.lastSeen = { x: G.p.x, y: G.p.y };
    n++;
    addFloat(o.x, o.y, '!', '#ffb066');
  }
  if (n) log(`${monName(mon)}의 외침에 주변 적이 깨어난다!`, 'bad');
}
function awarenessIcon(mon) {
  const st = monStateOf(mon);
  if (st === 'sleep') return 'zZ';
  if (st === 'alert') return '!';
  if (mon.tele) return '!!';
  return '';
}

/* ---------------------------------------------------------------- telegraphs */
function teleCooldown(mon) {
  const d = MONS[mon.kind] || {};
  return (mon.teleCd == null ? 2 : mon.teleCd) + (d.teleCd || 3);
}
function planTelegraph(mon) {
  const kind = (MONS[mon.kind] || {}).tele;
  if (!kind) return false;
  const p = G.p;
  const tiles = [];
  const add = (x, y) => {
    if (!inb(x, y)) return;
    if (G.m.t[y * W + x] === T.WALL || G.m.t[y * W + x] === T.SECRET) return;
    if (!tiles.some(t => t.x === x && t.y === y)) tiles.push({ x, y });
  };
  const dirx = Math.sign(p.x - mon.x), diry = Math.sign(p.y - mon.y);
  if (kind === 'hex') {
    add(p.x, p.y);
  } else if (kind === 'quake') {
    add(p.x, p.y);
    for (const d of DIR4) add(p.x + d[0], p.y + d[1]);
  } else if (kind === 'firebomb') {
    for (let i = 1; i <= 3; i++) add(mon.x + dirx * i, mon.y + diry * i);
    add(p.x, p.y);
  } else if (kind === 'cleave') {
    for (let i = 1; i <= 3; i++) {
      add(mon.x + dirx * i, mon.y + diry * i);
      if (i === 1) { add(mon.x + dirx + diry, mon.y + diry + dirx); add(mon.x + dirx - diry, mon.y + diry - dirx); }
    }
  } else if (kind === 'deathwave') {
    for (let y = mon.y - 2; y <= mon.y + 2; y++) for (let x = mon.x - 2; x <= mon.x + 2; x++) {
      if (Math.max(Math.abs(x - mon.x), Math.abs(y - mon.y)) === 2) add(x, y);
    }
  }
  if (!tiles.length) return false;
  mon.tele = { kind, tiles, t: 1 };
  mon.teleCd = teleCooldown(mon);
  SFX.play('bad');
  log(`${J(monName(mon), 'iga')} ${J(TELE_KINDS[kind].name, 'eul')} 예고한다! 붉은 타일에서 벗어나라.`, 'bad');
  addFloat(mon.x, mon.y, '!', '#ff6b6b');
  return true;
}
function cancelTelegraph(mon, quiet) {
  if (!mon.tele) return;
  mon.tele = null;
  if (!quiet) log(`${monName(mon)}의 전조가 흐트러졌다!`, 'good');
}
function resolveTelegraph(mon) {
  const tele = mon.tele;
  mon.tele = null;
  if (!tele) return;
  const kind = tele.kind;
  const p = G.p;
  const my = (x, y) => tele.tiles.some(t => t.x === x && t.y === y);
  addFx({ type: 'boom', x: tele.tiles[0].x, y: tele.tiles[0].y });
  shake(7);
  const tdef = TELE_KINDS[kind] || { name: '공격' };
  if (my(p.x, p.y)) {
    const dmgTable = { hex: 7, quake: 9, firebomb: 8, cleave: 11, deathwave: 12 };
    damagePlayer(dmgTable[kind] || 8, tdef.name, `${tdef.name}에 휩쓸렸다!`);
    if (kind === 'hex') p.status.poison = Math.max(p.status.poison || 0, 5);
    if (kind === 'firebomb') p.status.burn = Math.max(p.status.burn || 0, 3);
  }
  for (const t of tele.tiles) {
    if (kind === 'firebomb') {
      if (G.m.t[t.y * W + t.x] !== T.WATER) G.m.fire[t.y * W + t.x] = Math.max(G.m.fire[t.y * W + t.x], 4);
      if (G.m.t[t.y * W + t.x] === T.GRASS) G.m.t[t.y * W + t.x] = T.FLOOR;
    }
    if (kind === 'quake' && G.m.t[t.y * W + t.x] === T.GRASS) G.m.t[t.y * W + t.x] = T.FLOOR;
    for (const o of G.m.mons.slice()) {
      if (o === mon || o.hp <= 0) continue;
      if (o.x === t.x && o.y === t.y) damageMonster(o, 4, '아군의 공격');
    }
    const tr = trapAt2(t.x, t.y);
    if (tr && (kind === 'quake' || kind === 'cleave')) triggerTrapOnTile(tr, null);
  }
  SFX.play(kind === 'firebomb' ? 'fire' : 'zap');
  log(`${monName(mon)}의 ${tdef.name}이(가) 터졌다!`, 'bad');
  computeFOV();
}

/* ---------------------------------------------------------------- knockback */
function knockbackMonster(mon, dx, dy, steps, opts) {
  const o = opts || {};
  const res = { moved: 0, slam: false, fell: false, hazard: false, stopped: false };
  if (!mon || mon.hp <= 0) return res;
  if (!dx && !dy) return res;
  for (let i = 0; i < steps; i++) {
    const nx = mon.x + dx, ny = mon.y + dy;
    if (!inb(nx, ny)) { res.slam = true; break; }
    const t = G.m.t[ny * W + nx];
    if (t === T.CHASM) {
      if (mon.fly) { mon.x = nx; mon.y = ny; res.moved++; continue; }
      mon.x = nx; mon.y = ny; res.moved++; res.fell = true; break;
    }
    if (t === T.WALL || t === T.PILLAR || t === T.COVER || t === T.SECRET || t === T.LOCKED
      || t === T.BRICK || t === T.TREE || t === T.TENT || t === T.BOOKSHELF || t === T.STATUE) { res.slam = true; break; }
    if (t === T.DOOR) { res.slam = true; break; }
    const other = monAt(nx, ny);
    if (other) { res.stopped = true; break; }
    const ob = objAt(nx, ny);
    if (ob) {
      if (ob.kind === 'barrel' || ob.kind === 'crate') { breakBarrel(ob, true); }
      else { res.slam = true; break; }
    }
    mon.x = nx; mon.y = ny; res.moved++;
    if (fireAt(nx, ny) > 0) {
      res.hazard = true;
      damageMonster(mon, 5, '불길');
      mon.status.burn = Math.max(mon.status.burn || 0, 3);
      if (!mon.hp) break;
    }
    const tr = trapAt2(nx, ny);
    if (tr) { res.hazard = true; triggerTrapOnTile(tr, mon); if (!mon.hp) break; }
    if (t === T.WATER) { mon.status.wet = Math.max(mon.status.wet || 0, 3); }
  }
  if (res.fell) {
    log(`${J(monName(mon), 'iga')} 구덩이로 떨어져 사라졌다!`, 'good');
    addFloat(mon.x, mon.y, '추락!', '#ffd24a');
    killMonster(mon, true);
    return res;
  }
  if (res.slam && mon.hp > 0) {
    const bonus = 4 + (o.bonus || 0);
    damageMonster(mon, bonus, '충돌');
    if (mon.hp > 0) {
      mon.status.stun = Math.max(mon.status.stun || 0, 2);
      if (mon.tele) cancelTelegraph(mon);
      addFloat(mon.x, mon.y, '기절!', '#ffe089');
      log(`${J(monName(mon), 'iga')} 벽에 부딪혀 기절했다!`, 'good');
    }
  }
  return res;
}

/* traps apply to any body that steps on them */
function triggerTrapOnTile(tr, mon) {
  const onMon = !!mon;
  tr.armed = false;
  const names = { dart: '독침 함정', fire: '화염 함정', tp: '전이 함정', bear: '덫' };
  if (!onMon) {
    triggerTrap(tr);
    return;
  }
  log(`${J(monName(mon), 'iga')} ${J(names[tr.kind], 'eul')} 밟았다!`, 'good');
  if (tr.kind === 'dart') { damageMonster(mon, 4, '독침'); if (mon.hp) mon.status.poison = Math.max(mon.status.poison || 0, 4); }
  else if (tr.kind === 'fire') { damageMonster(mon, 5, '화염'); G.m.fire[mon.y * W + mon.x] = 4; }
  else if (tr.kind === 'bear') { damageMonster(mon, 2, '덫'); if (mon.hp) { mon.status.stun = Math.max(mon.status.stun || 0, 1); mon.mv = 0; } }
  else if (tr.kind === 'tp') { damageMonster(mon, 1, '전이'); if (mon.hp) teleportMonster(mon); }
  addFx({ type: 'boom', x: tr.x, y: tr.y });
  SFX.play('bad');
}
function teleportMonster(mon) {
  for (let i = 0; i < 80; i++) {
    const x = 1 + Math.floor(Math.random() * (W - 2)), y = 1 + Math.floor(Math.random() * (H - 2));
    if (TILE_WALK[G.m.t[y * W + x]] && !monAt(x, y) && !(x === G.p.x && y === G.p.y)) {
      mon.x = x; mon.y = y; return;
    }
  }
}

/* ---------------------------------------------------------------- weapon arts */
function monFlanked(mon, ax, ay) {
  if (mon.status.stun > 0) return true;
  if (!mon.facing) return false;
  const vx = Math.sign(ax - mon.x), vy = Math.sign(ay - mon.y);
  const dot = vx * mon.facing[0] + vy * mon.facing[1];
  return dot < 0;
}
function playerSneakAttack(mon) {
  const st = monStateOf(mon);
  if (st !== 'chase' && st !== 'alert') return true;
  if (mon.status.stun > 0) return true;
  if (mon.status.freeze > 0) return true;
  if (G.p.status.stealth > 0) return true;
  return monFlanked(mon, G.p.x, G.p.y);
}

/* ---------------------------------------------------------------- ranged weapons */
function activeWeapon() { return G.p ? G.p.weapon : null; }
function isRangedWeapon(w) { return !!(w && (w.ranged || w.kind === 'bow' || w.kind === 'crossbow')); }
function weaponRange(w) {
  if (!w) return 1;
  if (isRangedWeapon(w)) return w.range || 4;
  return w.kind === 'spear' ? 2 : 1;
}
function rangedShot(mon) {
  const p = G.p, w = p.weapon;
  if (!isRangedWeapon(w)) return false;
  const d = dist(p.x, p.y, mon.x, mon.y);
  if (d > weaponRange(w)) return false;
  if (!raycast(p.x, p.y, mon.x, mon.y).clear) { log('사선이 막혀 있다.', 'bad'); return false; }
  const kind = w.kind;
  p.facing = [Math.sign(mon.x - p.x), Math.sign(mon.y - p.y)];
  let dmg = attackPower() - Math.max(0, mon.def);
  if (d === 1) dmg = Math.round(dmg * 0.55);
  if (kind === 'bow') {
    if (d >= 3) dmg += 3;
    log(d >= 3 ? '숨을 고르고 조준 사격! 화살이 멀리 날아간다.' : '활시위를 당겨 쐈다.', 'good');
  } else {
    dmg += 2;
    log('석궁을 쏘았다. 볼트가 낮게 날아간다.', 'good');
  }
  const critChance = p.crit + (w.crit || 0) + (hasPerk('lucky') ? 0.07 : 0);
  const crit = Math.random() < critChance;
  const final = Math.max(1, Math.round(dmg * (crit ? 2 : 1)));
  addFx({ type: 'bolt', x1: p.x, y1: p.y, x2: mon.x, y2: mon.y, color: kind === 'bow' ? '#e9d8a8' : '#cfd6e2' });
  SFX.play('bow');
  applyPlayerHit(mon, final, crit, false);
  if (kind === 'crossbow') {
    /* pierce the next enemy in line */
    const dx = Math.sign(mon.x - p.x), dy = Math.sign(mon.y - p.y);
    for (let i = 1; i <= 4; i++) {
      const bx = mon.x + dx * i, by = mon.y + dy * i;
      if (!inb(bx, by) || blocksProj(bx, by)) break;
      const back = monAt(bx, by);
      if (back) {
        const pd = Math.max(1, Math.round(final * 0.55) - Math.max(0, back.def));
        log(`볼트가 ${J(monName(back), 'eul')} 꿰뚫었다!`, 'good');
        addFx({ type: 'bolt', x1: mon.x, y1: mon.y, x2: bx, y2: by, color: '#cfd6e2' });
        applyPlayerHit(back, pd, false, false);
        break;
      }
    }
  }
  finishPlayerTurn(1);
  return true;
}

/* ---------------------------------------------------------------- class skills */
function skillReady(id) {
  const p = G.p;
  if (!p || !p.cds) return false;
  return (p.cds[id] || 0) <= 0;
}
function skillCdLeft(id) {
  const p = G.p;
  return p && p.cds ? (p.cds[id] || 0) : 0;
}
function skillsOf(cls) { return SKILLS[cls] || SKILLS.warrior; }

function beginSkill(id) {
  if (G.state !== 'play' || G.preventInput) return;
  const s = SKILL_BY_ID[id];
  if (!s) return;
  if (!skillReady(id)) { log(`${s.name}은(는) 아직 준비되지 않았다. (${skillCdLeft(id)}턴)`, 'bad'); return; }
  if (G.p.mp < (s.mp || 0)) { log(`마나가 부족하다. ${s.name}에는 MP ${s.mp}이 필요하다.`, 'bad'); SFX.play('bad'); return; }
  if (s.mode === 'self') { castSkill(id); return; }
  G.target = { mode: 'skill', id, skill: s };
  showTargetBar(`${s.name} · 사거리 ${s.range} · MP ${s.mp || 0} · 취소는 ESC`);
  draw();
}
function castSkill(id, tx, ty) {
  const s = SKILL_BY_ID[id];
  if (!s) return false;
  if (!skillReady(id)) { log('아직 준비되지 않았다.', 'bad'); return false; }
  if (G.p.mp < (s.mp || 0)) { log(`마나가 부족하다. (MP ${Math.floor(G.p.mp)}/${s.mp})`, 'bad'); return false; }
  let ok = false;
  if (id === 'bash') ok = skillBash(tx, ty);
  else if (id === 'whirl') ok = skillWhirl();
  else if (id === 'shadow') ok = skillShadow(tx, ty);
  else if (id === 'throw') ok = skillThrow(tx, ty);
  else if (id === 'pulse') ok = skillPulse();
  else if (id === 'shield') ok = skillShield();
  if (!ok) return false;
  if (s.mp) G.p.mp = Math.max(0, G.p.mp - s.mp);
  G.p.cds[id] = s.cd + 1;
  G.p.recharge++;
  finishPlayerTurn(1);
  return true;
}
function skillBash(tx, ty) {
  const p = G.p;
  const mon = monAt(tx, ty);
  if (!mon) { log('밀칠 대상이 없다.', 'bad'); return false; }
  if (dist(p.x, p.y, mon.x, mon.y) > 1) { log('너무 멀다. 붙어서 써야 한다.', 'bad'); return false; }
  const dx = Math.sign(mon.x - p.x), dy = Math.sign(mon.y - p.y);
  const dmg = Math.round(attackPower() * 0.6) + 3;
  log(`방패로 ${J(monName(mon), 'eul')} 밀쳐냈다!`, 'good');
  addFx({ type: 'slash', x: mon.x, y: mon.y });
  addFx({ type: 'boom', x: mon.x, y: mon.y });
  shake(4);
  damageMonster(mon, dmg, '방패');
  if (mon.hp > 0) knockbackMonster(mon, dx, dy, 1, { bonus: 2 });
  p.status.stealth = 0;
  SFX.play('crit');
  computeFOV();
  return true;
}
function skillWhirl() {
  const p = G.p;
  const targets = G.m.mons.filter(m => m.hp > 0 && !m.shop && dist(p.x, p.y, m.x, m.y) <= 1);
  if (!targets.length) { log('휘두를 대상이 없다.', ''); return false; }
  log('회전 베기! 주변을 한 번에 벤다.', 'good');
  addFx({ type: 'spin', x: p.x, y: p.y });
  SFX.play('crit');
  shake(5);
  for (const m of targets.slice()) {
    if (m.hp <= 0) continue;
    const dmg = Math.max(1, Math.round(attackPower() * 0.85 + 1 - m.def));
    damageMonster(m, dmg, '회전 베기');
    if (m.hp > 0) { m.status.stun = Math.max(m.status.stun || 0, 1); if (m.tele) cancelTelegraph(m); }
  }
  computeFOV();
  return true;
}
function skillShadow(tx, ty) {
  const p = G.p;
  if (!inb(tx, ty)) return false;
  const d = dist(p.x, p.y, tx, ty);
  if (d < 1 || d > 3) { log('3칸 안의 위치만 가능하다.', 'bad'); return false; }
  if (!raycast(p.x, p.y, tx, ty).clear) { log('그 너머로는 그림자가 닿지 않는다.', 'bad'); return false; }
  const mon = monAt(tx, ty);
  if (mon) {
    if (mon.shop) { log('상인과는 자리를 바꿀 수 없다.', 'bad'); return false; }
    if (mon.boss) { log('거대한 적과는 자리를 바꿀 수 없다.', 'bad'); return false; }
    const ox = p.x, oy = p.y;
    addFx({ type: 'blink', x: ox, y: oy });
    p.x = tx; p.y = ty;
    mon.x = ox; mon.y = oy;
    mon.facing = [Math.sign(tx - ox), Math.sign(ty - oy)];
    mon.state = 'alert'; mon.awake = true; mon.sightLost = 0;
    addFloat(mon.x, mon.y, '?', '#b07fe0');
    p.status.stealth = 3;
    addFx({ type: 'blink', x: p.x, y: p.y });
    log(`${J(monName(mon), 'gwa')} 자리를 바꿔 등 뒤로 파고들었다. 은신!`, 'good');
    SFX.play('throwp');
    onEnterTile(p.x, p.y);
    computeFOV();
    return true;
  }
  if (!TILE_WALK[G.m.t[ty * W + tx]] || G.m.t[ty * W + tx] === T.CHASM) { log('그곳으로는 이동할 수 없다.', 'bad'); return false; }
  if (objBlocking(tx, ty)) { log('무언가 막고 있다.', 'bad'); return false; }
  addFx({ type: 'blink', x: p.x, y: p.y });
  p.x = tx; p.y = ty;
  p.status.stealth = 3;
  addFx({ type: 'blink', x: tx, y: ty });
  log('그림자 속으로 미끄러져 들어갔다. 은신!', 'good');
  SFX.play('throwp');
  onEnterTile(tx, ty);
  computeFOV();
  return true;
}
function skillThrow(tx, ty) {
  const p = G.p;
  const mon = monAt(tx, ty);
  if (!mon) { log('던질 대상이 없다.', 'bad'); return false; }
  if (dist(p.x, p.y, tx, ty) > 5) { log('사거리를 벗어났다.', 'bad'); return false; }
  const rc = raycast(p.x, p.y, tx, ty);
  if (!rc.clear) { log('가로막혀 단검이 닿지 않는다.', 'bad'); return false; }
  const sneak = playerSneakAttack(mon);
  const crit = sneak || Math.random() < 0.4;
  let dmg = Math.max(1, Math.round((attackPower() * 0.7 + 4) * (crit ? 2 : 1)) - mon.def);
  addFx({ type: 'bolt', x1: p.x, y1: p.y, x2: tx, y2: ty, color: '#cfd6e2' });
  mon.hp -= dmg;
  mon.hitFlash = 0.25;
  mon.awake = true;
  if (monStateOf(mon) === 'sleep') setMonState(mon, 'alert');
  addFloat(mon.x, mon.y, '-' + dmg, crit ? '#ffd24a' : '#ff9d9d');
  log(crit ? `투척 단검이 급소에 꽂혔다! ${monName(mon)}에게 ${dmg} 피해.` : `투척 단검 명중! ${monName(mon)}에게 ${dmg} 피해.`, 'good');
  addFx({ type: 'slash', x: mon.x, y: mon.y });
  SFX.play(crit ? 'crit' : 'throwp');
  if (mon.hp <= 0) killMonster(mon);
  computeFOV();
  return true;
}
function skillPulse() {
  const p = G.p;
  const targets = G.m.mons.filter(m => m.hp > 0 && !m.shop && dist(p.x, p.y, m.x, m.y) <= 1);
  log('충격파가 사방으로 터진다!', 'good');
  addFx({ type: 'boom', x: p.x, y: p.y });
  addFx({ type: 'spin', x: p.x, y: p.y });
  shake(6);
  SFX.play('zap');
  const intBonus = (p.cls === 'mage' ? 2 : 0) + Math.floor(p.lv / 4);
  for (const m of targets.slice()) {
    if (m.hp <= 0) continue;
    const dmg = 5 + intBonus + Math.floor(Math.random() * 3);
    damageMonster(m, dmg, '충격파');
    if (m.hp > 0) {
      const dx = Math.sign(m.x - p.x) || (Math.random() < 0.5 ? 1 : -1);
      const dy = Math.sign(m.y - p.y);
      knockbackMonster(m, dx, dy, 2, { bonus: 1 });
    }
  }
  if (!targets.length) log('허공에 파동이 흩어졌다.', '');
  computeFOV();
  return true;
}
function skillShield() {
  const p = G.p;
  p.status.shield = 5;
  p.shieldHp = 12 + Math.floor(p.lv / 2) * 2;
  addFx({ type: 'levelup', x: p.x, y: p.y });
  log('마력 보호막이 몸을 감쌌다.', 'good');
  SFX.play('heal');
  return true;
}

/* ---------------------------------------------------------------- element combos */
function applyLightningCombo(mon, dmg) {
  if (!mon || mon.hp <= 0) return dmg;
  if (mon.status.wet > 0) {
    const extra = Math.round(dmg * 0.5);
    mon.hp -= extra;
    mon.status.stun = Math.max(mon.status.stun || 0, 2);
    delete mon.status.wet;
    addFloat(mon.x, mon.y, '감전!', '#9fd8ff');
    log(`젖은 몸에 번개가 타고 흐른다! 추가 ${extra} 피해와 기절.`, 'good');
    if (mon.hp <= 0) killMonster(mon);
    return dmg + extra;
  }
  return dmg;
}
function applyShatter(mon, dmg) {
  if (!mon || mon.hp <= 0) return dmg;
  if (mon.status.freeze > 0 && dmg >= 6) {
    const extra = Math.round(dmg * 0.5);
    mon.hp -= extra;
    delete mon.status.freeze;
    addFloat(mon.x, mon.y, '쇄빙!', '#bfe9ff');
    log(`얼어붙은 몸이 깨져 추가 ${extra} 피해!`, 'good');
    if (mon.hp <= 0) killMonster(mon);
    return dmg + extra;
  }
  return dmg;
}
function oilIgnite(mon) {
  if (!mon || mon.hp <= 0) return;
  if (mon.status.oil > 0 && (fireAt(mon.x, mon.y) > 0 || mon.status.burn > 0)) {
    delete mon.status.oil;
    const x = mon.x, y = mon.y;
    addFx({ type: 'boom', x, y });
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
      if (!inb(xx, yy)) continue;
      if (G.m.t[yy * W + xx] !== T.WATER && G.m.t[yy * W + xx] !== T.WALL) G.m.fire[yy * W + xx] = Math.max(G.m.fire[yy * W + xx], 3);
    }
    for (const o of G.m.mons.slice()) if (o.hp > 0 && dist(o.x, o.y, x, y) <= 1) damageMonster(o, 6, '기름 폭발');
    if (dist(G.p.x, G.p.y, x, y) <= 1) damagePlayer(5, '기름 폭발');
    log('기름에 불이 붙어 폭발했다!', 'bad');
    shake(5);
  }
}
