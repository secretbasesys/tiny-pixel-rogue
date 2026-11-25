/* =====================================================================
   GAME STATE & TURN ENGINE
   ===================================================================== */
const G = {
  state: 'title', zone: 'town', depth: 0, floorNo: 0, turn: 0, m: null, p: null,
  seedStr: '', seed: 0, rng: null, rngW: null,
  floats: [], fx: [], parts: [], logLines: [], logHistory: [],
  target: null, path: null, pathGoal: null, pathPreview: null, pathAt: 0,
  ident: { potion: {}, scroll: {} },
  kills: 0, steps: 0, started: 0, elapsed: 0,
  shop: null, invSel: null, dealer: null,
  preventInput: false, msgTimer: 0, bossDead: false,
  hitFreeze: 0, lastKeyDir: null, waiting: false,
  freeTurn: false, pendingPerks: 0, bounty: null, cursor: null, logHistory2: [],
  contract: null, contracts: [], contractTier: 1, completed: 0, bossKilled: false,
  stash: [], pending: null, pathAggro: false, walkStall: 0, walking: false,
  shake: 0, zoneName: '마을', visited: {}, zoom: 1, dpad: false
};

function log(txt, cls) {
  G.logLines.push({ txt, cls: cls || '' });
  if (G.logLines.length > 3) G.logLines.shift();
  G.logHistory.push({ txt, cls: cls || '', t: G.turn });
  if (G.logHistory.length > 160) G.logHistory.shift();
  renderLog();
}
function renderLog() {
  const el = $('#log'); if (!el) return;
  el.innerHTML = '';
  const tail = G.logLines.slice(-2);
  for (const l of tail) {
    const d = document.createElement('div');
    d.className = 'ln ' + (l.cls || '');
    d.textContent = l.txt;
    el.appendChild(d);
  }
}
function addFloat(x, y, txt, col) {
  G.floats.push({ x, y, txt, col: col || '#fff', t: 0, life: 1.1, vy: -0.03 });
}
function addFx(o) { o.t = 0; G.fx.push(o); }
function shake(a) { G.shake = Math.max(G.shake || 0, a); }

/* ---------------------------------------------------------------- contracts */
function rollContracts() {
  const rng = RNG(hashStr(G.seedStr + ':contracts:' + G.contractTier + ':' + G.completed));
  const pool = rng.shuffle(CONTRACT_TEMPLATES.slice());
  const out = [];
  for (let i = 0; i < 3; i++) {
    const t = pool[i % pool.length];
    const diff = clamp(G.contractTier + (i === 0 ? 0 : i === 1 ? 1 : 2) - 1, 1, 5);
    out.push({
      id: t.id + '-' + G.contractTier + '-' + i,
      tpl: t.id, name: t.name, biome: t.biome, boss: t.boss, bossName: t.bossName,
      desc: t.desc, elite: t.elite, diff,
      gold: 90 + diff * 55 + rng.int(0, 40),
      relic: diff >= 4 ? 'legend' : diff >= 2 ? 'rare' : 'fine',
      state: 'offer'
    });
  }
  return out;
}
function acceptContract(c) {
  G.contract = c;
  c.state = 'active';
  G.contracts = G.contracts.filter(o => o !== c);
  log(`의뢰 수락 — ${c.name} (${'★'.repeat(c.diff)})`, 'gold');
  toast('📜 의뢰를 수락했다');
  SFX.play('ui');
  updateHUD();
}
function contractDone() {
  if (!G.contract) return;
  G.contract.state = 'done';
  G.bossKilled = true;
}

/* ---------------------------------------------------------------- run setup */
function newRun(clsId, seedStr) {
  const cls = CLASSES[clsId];
  if (!cls) return;
  G.cls = clsId;
  G.state = 'play';
  if (typeof hideScreens === 'function') hideScreens();
  if (typeof setGameUI === 'function') setGameUI(true);
  G.zone = 'town'; G.depth = 0; G.floorNo = 0; G.turn = 0; G.kills = 0; G.steps = 0;
  G.logLines = []; G.logHistory = []; G.floats = []; G.fx = []; G.parts = [];
  G.target = null; G.path = null; G.pathPreview = null; G.shop = null; G.invSel = null;
  G.deadCause = null; G.won = false; G.bossDead = false; G.bossKilled = false;
  G.freeTurn = false; G.pendingPerks = 0; G.bounty = null; G.cursor = null;
  G.contract = null; G.contractTier = 1; G.completed = 0; G.stash = []; G.pending = null;
  G.pathAggro = false; G.walkStall = 0;
  G.startedAt = Date.now();
  G.seedStr = (seedStr || makeSeed()).toUpperCase().slice(0, 14);
  G.seed = hashStr(G.seedStr);
  G.rng = RNG(G.seed ^ 0x9e3779b9);
  DB.lastSeed = G.seedStr; saveDB();
  G.contracts = rollContracts();

  const colors = RNG(G.seed ^ 0x1234).shuffle(POTION_COLORS.slice());
  G.ident = { potion: {}, scroll: {} };
  POTIONS.forEach((po, i) => { G.ident.potion[po.k] = { color: colors[i % colors.length].n, c: colors[i % colors.length].c, known: false }; });
  const labels = RNG(G.seed ^ 0x5678).shuffle(SCROLL_LABELS.slice());
  SCROLLS.forEach((sc, i) => { G.ident.scroll[sc.k] = { label: labels[i % labels.length], known: false }; });

  G.p = {
    cls: clsId, name: cls.name, hp: cls.hp, maxhp: cls.hp, mp: cls.mp, maxmp: cls.mp,
    baseMaxhp: cls.hp, baseMp: cls.mp, atk: cls.atk,
    crit: cls.crit, sight: cls.sight, lv: 1, xp: 0, xpNext: 12,
    gold: 25, inv: [], weapon: null, slots: [null, null], slotIdx: 0,
    armor: null, ring: null,
    status: {}, kills: 0, recharge: 0, cds: {}, shieldHp: 0, facing: [0, 1],
    perks: {}, belt: [null, null, null], trapSense: cls.trapSense || 0
  };
  G.p.slots = cls.slots.map(s => Object.assign({ t: 'weapon', rarity: 'common', affixList: [] }, JSON.parse(JSON.stringify(s))));
  G.p.weapon = G.p.slots[0]; G.p.slotIdx = 0;
  G.p.armor = Object.assign({ t: 'armor', rarity: 'common', affixList: [] }, JSON.parse(JSON.stringify(cls.armor)));
  for (const k of cls.kit) {
    const it = Object.assign({}, k);
    it.n = it.n || 1;
    if (it.t === 'potion' || it.t === 'scroll' || it.t === 'food' || it.t === 'lockpick') {
      const ex = G.p.inv.find(o => o.t === it.t && o.k === it.k);
      if (ex) { ex.n += it.n; continue; }
    }
    G.p.inv.push(it);
  }
  recalcStats();
  G.p.hp = G.p.maxhp; G.p.mp = G.p.maxmp;
  beltAutoFill();
  buildTown(true);
  log(`${cls.name}의 여정이 시작된다.`, 'sys');
  log('게시판에서 의뢰를 고르고 마을 문을 나서라.', 'sys');
  log('탭으로 이동 · 스와이프로 한 칸 · R로 무기 교체.', 'sys');
  deathShown = false;
  updateHUD();
  renderAll();
}

/* ---------------------------------------------------------------- zone builders */
function placePlayerAtStart() {
  const p = G.p;
  p.x = G.m.start.x; p.y = G.m.start.y;
  G.path = null; G.pathGoal = null; G.pathPreview = null; G.target = null;
  G.distField = null;
  G.floats = []; G.fx = [];
  computeFOV();
}
function buildTown(first) {
  G.zone = 'town'; G.zoneName = '마을'; G.floorNo = 0; G.depth = 0;
  G.rngW = RNG(hashStr(G.seedStr + ':town'));
  G.m = genTown(G.seedStr);
  G.bossDead = false;
  placePlayerAtStart();
  if (!first) {
    const heal = Math.ceil(G.p.maxhp * 0.15);
    G.p.hp = Math.min(G.p.maxhp, G.p.hp + heal);
    log('마을로 돌아왔다. 성벽의 온기가 반갑다.', 'sys');
  }
  if (typeof updateHUD === 'function') updateHUD();
}
function travelToField() {
  if (!G.contract) {
    log('먼저 게시판에서 의뢰를 골라야 한다.', 'bad');
    toast('📜 의뢰를 먼저 고르세요');
    openContractBoard();
    return;
  }
  G.zone = 'field'; G.zoneName = BIOMES[G.contract.biome].field;
  G.depth = 0; G.floorNo = 0;
  G.rngW = RNG(hashStr(G.seedStr + ':field:' + G.contract.id));
  G.m = genField(G.contract, G.contract.diff, G.seedStr);
  G.bossDead = false;
  placePlayerAtStart();
  G.bounty = makeBounty(G.contract.diff + 1, G.rngW);
  log(`${G.m.name}에 들어섰다. 던전 입구를 찾아라.`, 'sys');
  SFX.play('gate');
  updateHUD(); renderAll();
}
function enterDungeon(floor) {
  G.zone = 'dungeon'; G.floorNo = floor; G.depth = floor;
  G.zoneName = G.contract ? `${G.m ? '' : ''}` : '던전';
  const nameSeed = G.seedStr + ':dungeon:' + (G.contract ? G.contract.id : 'x') + ':' + floor;
  G.rngW = RNG(hashStr(nameSeed));
  G.m = genDungeon(G.contract, floor, G.contract.diff, G.seedStr);
  G.zoneName = G.m.name;
  G.bossDead = false;
  placePlayerAtStart();
  G.bounty = makeBounty(G.contract.diff + floor, G.rngW);
  if (floor === 1) log(`${G.m.name}에 들어섰다. 아래로 내려가라.`, 'sys');
  else log(`${G.m.name} — ${floor}층.`, 'sys');
  if (floor >= 3) { log('층의 주인이 이 홀에 있다. 준비하라.', 'bad'); SFX.play('boss'); }
  SFX.play('stairs');
  updateHUD(); renderAll();
}
function descendDungeon() {
  if (!G.contract) return;
  if (G.floorNo >= 3) return;
  enterDungeon(G.floorNo + 1);
}
function ascendDungeon() {
  if (G.floorNo <= 1) { returnToTown(); return; }
  enterDungeon(G.floorNo - 1);
}
function returnToTown(complete) {
  G.zone = 'town'; G.zoneName = '마을'; G.floorNo = 0; G.depth = 0;
  G.rngW = RNG(hashStr(G.seedStr + ':town'));
  G.m = genTown(G.seedStr);
  G.p.x = G.m.start.x; G.p.y = G.m.start.y;
  G.path = null; G.pathGoal = null; G.pathPreview = null; G.target = null;
  G.floats = []; G.fx = []; G.distField = null;
  computeFOV();
  if (complete) {
    G.completed++;
    G.contractTier = clamp(1 + Math.floor(G.completed / 2), 1, 6);
    G.contracts = rollContracts();
    log('마을로 귀환했다. 게시판에서 보상을 받으라.', 'gold');
  } else {
    log('마을로 돌아왔다.', 'sys');
  }
  SFX.play('gate');
  updateHUD(); renderAll();
}

/* ---------------------------------------------------------------- FOV */
function tileOpaque(x, y, d) {
  const t = G.m.t[y * W + x];
  if (t === T.GRASS || t === T.BUSH) return false;   // concealing ground, not a wall
  if (t === T.TREE && G.m.outdoors) return d > 2;    // canopy overhead blocks only close by
  return !!TILE_OPAQUE[t];
}
const FOV_MULT = [[1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1], [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1]];
function computeFOV() {
  const p = G.p, m = G.m;
  if (!p || !m) return;
  if (m.zone === 'town') { m.vis.fill(1); m.seen.fill(1); return; }
  m.vis.fill(0);
  let R = p.sight + (p.ring && p.ring.k === 'vision' ? 2 : 0) + (p.status.blind ? -4 : 0);
  if (m.outdoors) R += 4;
  R = clamp(R, 2, 16);
  m.vis[p.y * W + p.x] = 1; m.seen[p.y * W + p.x] = 1;
  for (let o = 0; o < 8; o++) {
    const [xx, xy, yx, yy] = FOV_MULT[o];
    castLight(1, 1.0, 0.0, R, xx, xy, yx, yy);
  }
}
function castLight(row, start, end, radius, xx, xy, yx, yy) {
  const p = G.p, m = G.m;
  if (start < end) return;
  const r2 = radius * radius + radius * 0.5;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1, dy = -j, blocked = false;
    while (dx <= 0) {
      dx++;
      const X = p.x + dx * xx + dy * xy, Y = p.y + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      if (inb(X, Y)) {
        const d = Math.max(Math.abs(X - p.x), Math.abs(Y - p.y));
        if (dx * dx + dy * dy <= r2) {
          m.vis[Y * W + X] = 1;
          m.seen[Y * W + X] = 1;
        }
        if (blocked) {
          if (tileOpaque(X, Y, d)) { start = rSlope; }
          else blocked = false;
        } else if (tileOpaque(X, Y, d) && j < radius) {
          blocked = true;
          castLight(j + 1, start, rSlope, radius, xx, xy, yx, yy);
          start = lSlope;
        }
      }
    }
    if (blocked) break;
  }
}

/* ---------------------------------------------------------------- accessors */
function monAt(x, y) { return G.m.mons.find(o => o.x === x && o.y === y && o.hp > 0); }
function npcAt(x, y) { return G.m.npcs.find(o => o.x === x && o.y === y); }
function monName(m0) { return (m0.elite ? '우두머리 ' : '') + (MONS[m0.kind] ? MONS[m0.kind].name : '?'); }
function objAt(x, y) {
  return G.m.objs.find(o => o.x === x && o.y === y && !(o.kind === 'chest' && o.opened));
}
function itemAt(x, y) { return G.m.items.find(o => o.x === x && o.y === y); }
function trapAt(x, y) { return G.m.traps.find(o => o.x === x && o.y === y && o.armed); }
function walkable(x, y) {
  if (!inb(x, y)) return false;
  return !!TILE_WALK[G.m.t[y * W + x]];
}
function isBlockedFor(mon, x, y) {
  if (!inb(x, y)) return true;
  const t = G.m.t[y * W + x];
  if (t === T.CHASM && !mon.fly) return true;
  if (TILE_SOLID[t]) return true;
  if (mon.shop) return true;
  const o = objAt(x, y);
  if (o && BLOCKING_OBJ[o.kind] !== false) return true;
  if (G.p.x === x && G.p.y === y) return true;
  if (G.m.mons.some(o => o !== mon && o.x === x && o.y === y && o.hp > 0)) return true;
  if (G.m.npcs.some(o => o.x === x && o.y === y)) return true;
  return false;
}
function playerDef() {
  let d = (G.p.armor ? G.p.armor.def + (G.p.armor.plus || 0) : 0);
  if (hasPerk('ironwall')) d += 3;
  return d;
}
function weaponDmg() { return G.p.weapon ? G.p.weapon.dmg + (G.p.weapon.plus || 0) : 0; }
function attackPower() {
  const p = G.p;
  let a = p.atk + weaponDmg() + Math.floor(p.lv / 2);
  if (p.status.bless) a += 2;
  if (p.status.curse) a -= 2;
  if (p.status.weak) a -= 2;
  if (hasPerk('berserk') && p.hp <= p.maxhp * 0.4) a = Math.round(a * 1.4);
  return Math.max(1, a);
}
function playerReach() { return weaponRange(G.p.weapon); }

/* ---------------------------------------------------------------- weapon loadout */
function swapWeapon(free) {
  const p = G.p;
  if (G.state !== 'play' || G.preventInput) return;
  if (!p.slots || p.slots.length < 2 || !p.slots[0] || !p.slots[1]) {
    log('보조 무기가 없다. 가방에서 무기를 장착하라.', 'bad');
    return;
  }
  p.slotIdx = p.slotIdx === 0 ? 1 : 0;
  p.weapon = p.slots[p.slotIdx];
  const art = WEAPON_ART[p.weapon.kind];
  log(`${p.slotIdx === 0 ? '주무기' : '보조무기'} — ${J(itemName(p.weapon), 'eul')} 들었다.`, 'good');
  addFloat(p.x, p.y, p.slotIdx === 0 ? 'A' : 'B', '#e9c25c');
  SFX.play('lock');
  recalcStats(); computeFOV(); updateHUD(); renderAll();
  if (!free) finishPlayerTurn(1);
}

/* ---------------------------------------------------------------- lockpicking */
function hasKeyItem() { return G.p.inv.find(o => o.t === 'key'); }
function hasLockpick() { return G.p.inv.find(o => o.t === 'lockpick' && o.n > 0); }
function lockChance() { return G.p.cls === 'rogue' ? 0.88 : 0.6; }
function attemptLockpick(target) {
  // target: {kind:'door', x, y} | {kind:'chest', obj}
  const pick = hasLockpick();
  if (!pick) { log('자물쇠 따개가 없다.', 'bad'); return; }
  const chance = lockChance();
  consumeItem(pick, 1);
  if (Math.random() < chance) {
    if (target.kind === 'door') {
      G.m.t[target.y * W + target.x] = T.DOOR;
      G.path = null;
      log('자물쇠가 딸깍 열렸다.', 'good');
      SFX.play('lock');
    } else {
      target.obj.locked = false;
      log('상자의 자물쇠가 열렸다.', 'good');
      SFX.play('lock');
    }
    finishPlayerTurn(1);
  } else {
    log('따개가 부러졌다! 소리가 울린다.', 'bad');
    SFX.play('bad');
    alertNearby(6);
    finishPlayerTurn(1);
  }
  updateHUD();
}
function bashLock(target) {
  if (target.kind === 'door') {
    G.m.t[target.y * W + target.x] = T.DOOR;
    log('어깨로 문을 부수고 들어갔다!', 'good');
  } else {
    target.obj.locked = false; target.obj.trapKnown = true;
    log('상자의 자물쇠를 부쉈다. 안이 뒤섞였다.', 'good');
  }
  SFX.play('hit'); shake(4);
  alertNearby(8);
  finishPlayerTurn(2);
  updateHUD();
}
function alertNearby(r) {
  let n = 0;
  for (const mon of G.m.mons) {
    if (mon.hp <= 0 || mon.shop) continue;
    if (dist(mon.x, mon.y, G.p.x, G.p.y) <= r) { setMonState(mon, 'chase'); mon.lastSeen = { x: G.p.x, y: G.p.y }; n++; }
  }
  if (n) log(`${n}마리의 적이 소리를 듣고 다가온다!`, 'bad');
}

/* ---------------------------------------------------------------- turn flow */
function finishPlayerTurn(cost) {
  if (G.state !== 'play') return;
  cost = cost == null ? 1 : cost;
  if (G.freeTurn) {
    G.freeTurn = false;
    computeFOV(); updateHUD(); renderAll();
    return;
  }
  const p0 = G.p;
  const hasteChance = (p0.status.haste > 0 ? 0.45 : 0) + (p0.ring && p0.ring.k === 'haste' ? 0.25 : 0)
    + (hasPerk('swift') ? 0.15 : 0) + (hasAffix(p0.weapon, 'swift') ? 0.15 : 0);
  if (cost === 1 && Math.random() < hasteChance) {
    addFloat(p0.x, p0.y, '⚡', '#9fe0ff');
    computeFOV(); updateHUD(); renderAll();
    return;
  }
  for (let i = 0; i < cost; i++) {
    G.turn++;
    envTick();
    if (G.state !== 'play') return;
    monstersAct();
    if (G.state !== 'play') return;
  }
  playerStatusTick();
  if (G.state !== 'play') return;
  G.p.recharge += cost;
  mpRegenTick();
  for (const k in G.p.cds) if (G.p.cds[k] > 0) G.p.cds[k]--;
  G.distField = null;
  computeFOV();
  checkSpot();
  bountyExplore();
  updateHUD();
  renderAll();
  if (G.pending) { const pend = G.pending; G.pending = null; doPending(pend); }
  if (G.pendingPerks > 0) maybeShowPerk();
}
function doPending(pend) {
  if (!pend) return;
  if (pend === 'descend') { descendDungeon(); return; }
  if (pend === 'ascend') { ascendDungeon(); return; }
  if (pend === 'town') { returnToTown(false); return; }
  if (pend === 'field') { travelToField(); return; }
  if (pend === 'portal') {
    log('귀환의 문이 빛난다. 마을로 돌아간다.', 'good');
    if (G.contract && G.contract.state === 'active') contractDone();
    returnToTown(true);
    return;
  }
}
function checkSpot() {
  if (!G.path) return;
  if (G.pathAggro) return;
  for (const o of G.m.mons) {
    if (o.hp <= 0 || o.shop) continue;
    if (monStateOf(o) === 'sleep') continue;
    if (G.m.vis[o.y * W + o.x]) {
      G.path = null; G.pathGoal = null; G.pathPreview = null;
      log(`${J(MONS[o.kind].name, 'iga')} 시야에 들어왔다.`, 'bad');
      return;
    }
  }
}

/* ---------------------------------------------------------------- player actions */
function playerStep(dx, dy) {
  if (G.state !== 'play' || G.preventInput) return;
  const p = G.p;
  if (p.status.freeze > 0) { p.status.freeze--; log('얼어붙어 움직일 수 없다.', 'bad'); finishPlayerTurn(1); return; }
  if (p.status.confuse && Math.random() < 0.3) {
    const d = DIR8[Math.floor(Math.random() * 8)];
    dx = d[0]; dy = d[1];
    log('혼란스러워 엉뚱한 곳으로 걸었다.', 'bad');
  }
  const nx = p.x + dx, ny = p.y + dy;
  if (!inb(nx, ny)) return;
  if (dx || dy) p.facing = [Math.sign(dx), Math.sign(dy)];
  if (!G.walking) { G.path = null; G.pathGoal = null; G.pathPreview = null; }
  const mon = monAt(nx, ny);
  if (mon) {
    if (mon.shop) { openShop(mon); return; }
    attackMonster(mon); return;
  }
  const npc = npcAt(nx, ny);
  if (npc) { talkToNpc(npc); return; }
  const t = G.m.t[ny * W + nx];
  if (t === T.WALL || t === T.SECRET || t === T.BRICK || t === T.TREE) { SFX.play('step'); return; }
  if (t === T.CHASM) { log('구덩이다. 건널 수 없다.', 'bad'); return; }
  if (t === T.LOCKED) {
    const key = hasKeyItem();
    if (key) {
      consumeItem(key); G.m.t[ny * W + nx] = T.DOOR;
      log('열쇠로 문을 열었다.', 'good'); SFX.play('lock'); finishPlayerTurn(1);
    } else {
      askLockedDoor(nx, ny);
    }
    return;
  }
  if (t === T.DOOR) { G.m.t[ny * W + nx] = T.FLOOR; SFX.play('step'); }
  if (t === T.GATE) { askGate(); return; }
  const obj = objAt(nx, ny);
  if (obj && BLOCKING_OBJ[obj.kind] !== false) {
    interactObj(obj);
    return;
  }
  p.x = nx; p.y = ny;
  G.steps++;
  SFX.play('step');
  const nt = G.m.t[ny * W + nx];
  let cost = TILE_COST[nt] || 1;
  if (nt === T.OIL) G.p.status.oil = Math.max(G.p.status.oil || 0, 3);
  onEnterTile(nx, ny);
  if (G.state !== 'play') return;
  finishPlayerTurn(cost);
}
function askLockedDoor(x, y) {
  const pick = hasLockpick();
  const opts = [];
  if (pick) opts.push({ txt: `자물쇠 따기 (따개 ${pick.n})`, fn: () => attemptLockpick({ kind: 'door', x, y }) });
  opts.push({ txt: '힘으로 부순다 (2턴 · 소음)', fn: () => bashLock({ kind: 'door', x, y }) });
  opts.push({ txt: '물러난다', cls: 'flat', fn: () => { } });
  showChoice('잠긴 철문', '굳게 잠긴 철문이다. 열쇠·따개·힘 중 하나가 필요하다.', opts);
}
function askGate() {
  if (G.zone !== 'town') return;
  const c = G.contract;
  if (!c) {
    showChoice('마을 문', '문 밖으로 나가려면 먼저 게시판에서 의뢰를 골라야 한다.', [
      { txt: '게시판 열기', fn: () => openContractBoard() },
      { txt: '돌아간다', cls: 'flat', fn: () => { } }
    ]);
    return;
  }
  showChoice('마을 문', `계약: <b>${c.name}</b> (${'★'.repeat(c.diff)})<br>${BIOMES[c.biome].desc}`, [
    { txt: '들판으로 나선다', fn: () => { G.pending = 'field'; finishPlayerTurn(1); } },
    { txt: '돌아간다', cls: 'flat', fn: () => { } }
  ]);
}
function onEnterTile(x, y) {
  if (G.p.cls === 'rogue' || G.p.trapSense) {
    for (const tr of G.m.traps) {
      if (!tr.found && dist(G.p.x, G.p.y, tr.x, tr.y) <= 1 && Math.random() < (G.p.trapSense || 0.45)) {
        tr.found = true; log('발밑에서 함정의 기척을 느꼈다.', 'sys');
      }
    }
  }
  const gt = G.m.t[y * W + x];
  if (gt === T.WATER || gt === T.MUD) {
    G.p.status.wet = Math.max(G.p.status.wet || 0, 3);
    if (G.p.status.burn) { delete G.p.status.burn; log('물에 들어가 불길을 껐다.', 'good'); }
  }
  if (gt === T.OIL) G.p.status.oil = Math.max(G.p.status.oil || 0, 4);
  if (gt === T.GRASS || gt === T.BUSH) {
    if (Math.random() < 0.22) log('풀숲에 몸을 숨겼다. 적의 눈을 피하기 쉽다.', 'sys');
    addFx({ type: 'rustle', x, y });
  }
  if (gt === T.BLOOD && Math.random() < 0.2) log('핏자국이 발에 밟힌다.', '');
  const it = itemAt(x, y);
  if (it) pickupItem(it);
  if (G.state !== 'play') return;
  if (gt === T.STAIRS && G.m.stairs && x === G.m.stairs.x && y === G.m.stairs.y) {
    if (G.zone === 'field') log('던전 입구다. 들어가려면 오른쪽 버튼을 누르라.', 'sys');
    else if (G.zone === 'dungeon') log('아래로 가는 계단이다.', 'sys');
  }
  if (gt === T.RETURN) log('귀환의 문이 맥동한다.', 'good');
  const tr = trapAt(x, y);
  if (tr) triggerTrap(tr);
}
function playerWait() {
  if (G.state !== 'play' || G.preventInput) return;
  G.path = null; G.pathPreview = null;
  const p = G.p;
  if (p.status.freeze > 0) { p.status.freeze--; log('얼어붙어 움직일 수 없다.', 'bad'); finishPlayerTurn(1); return; }
  const kind = p.weapon ? p.weapon.kind : '';
  if (kind === 'sword') {
    p.status.guard = 2;
    log('방어 태세를 갖추었다. 다음 공격을 막고 반격한다.', 'good');
    addFloat(p.x, p.y, '방어', '#9fe0ff');
    SFX.play('ui');
  } else if (kind === 'spear') {
    p.status.brace = 2;
    log('창을 겨눈 채 숨을 죽인다. 다가오는 적을 저지한다.', 'good');
    addFloat(p.x, p.y, '저지', '#9fe0ff');
    SFX.play('ui');
  } else if (isRangedWeapon(p.weapon)) {
    log('숨을 고르고 조준선을 정리했다.', '');
  } else {
    log('한 숨 돌린다.', '');
  }
  finishPlayerTurn(1);
}
function playerSearch() {
  if (G.state !== 'play' || G.preventInput) return;
  G.path = null; G.pathPreview = null;
  const p = G.p;
  let chance = p.cls === 'rogue' ? 0.95 : 0.55;
  if (hasPerk('hunter')) chance = Math.min(0.98, chance + 0.3);
  let found = 0;
  for (const tr of G.m.traps) {
    if (tr.found) continue;
    if (dist(p.x, p.y, tr.x, tr.y) <= 2 && Math.random() < chance) { tr.found = true; found++; }
  }
  for (let y = p.y - 2; y <= p.y + 2; y++) for (let x = p.x - 2; x <= p.x + 2; x++) {
    if (inb(x, y) && G.m.t[y * W + x] === T.SECRET && Math.random() < chance) {
      G.m.t[y * W + x] = T.DOOR; found++;
      log('숨겨진 문을 발견했다!', 'good');
    }
  }
  for (const o of G.m.objs) {
    if (o.kind === 'chest' && !o.opened && o.trapped && !o.trapKnown && dist(p.x, p.y, o.x, o.y) <= 1 && Math.random() < chance) {
      o.trapKnown = true; found++; log('상자에 덫이 설치되어 있다.', 'bad');
    }
  }
  if (found === 0) log('주변을 수색했지만 아무것도 없다.', '');
  else if (found === 1) log('무언가를 발견했다.', 'good');
  SFX.play('ui');
  finishPlayerTurn(1);
}

/* ---------------------------------------------------------------- combat */
function attackMonster(mon) {
  const p = G.p;
  const w = p.weapon;
  const d = dist(p.x, p.y, mon.x, mon.y);
  const reach = weaponRange(w);
  if (d > reach) {
    pathTo(mon.x, mon.y);
    return;
  }
  if (isRangedWeapon(w) && d > 1) { rangedShot(mon); return; }
  if (reach > 1) {
    const rc = raycast(p.x, p.y, mon.x, mon.y);
    if (!rc.clear) { log('창이 가로막혀 찌를 수 없다.', 'bad'); return; }
  }
  const dirx = Math.sign(mon.x - p.x), diry = Math.sign(mon.y - p.y);
  p.facing = [dirx, diry];
  const kind = w ? w.kind : 'fist';
  const sneak = kind === 'dagger' && playerSneakAttack(mon);
  let critChance = p.crit + (w ? (w.crit || 0) : 0) + (hasPerk('lucky') ? 0.07 : 0);
  if (sneak) critChance = 1;
  if (hasPerk('assassin') && (p.status.stealth > 0 || inGrass(p.x, p.y))) critChance = Math.min(1, critChance + 0.2);
  if (p.status.stealth > 0) critChance = Math.max(critChance, 0.75);
  if (inGrass(p.x, p.y)) critChance = Math.max(critChance, 0.5);
  const crit = Math.random() < critChance;
  const pierce = w && hasAffix(w, 'pierce') ? 2 : 0;
  let base = attackPower() + (Math.random() < 0.5 ? 0 : 1) - Math.max(0, mon.def - pierce);
  if (inGrass(p.x, p.y)) base += 1;
  let dmg = Math.max(1, Math.round(base * (crit ? 2 : 1)));
  if (sneak) dmg += 3;
  if (sneak && hasPerk('assassin')) dmg = Math.round(dmg * 1.6);

  if (sneak) log(`기습! 방심한 ${J(monName(mon), 'eul')} 급소에 꽂았다.`, 'good');
  else if (inGrass(p.x, p.y)) log('풀숲에서 불쑥 찔러 넣었다!', 'good');
  else if (kind === 'dagger') log('단검으로 재빠르게 찔렀다.', '');
  const dealt = applyPlayerHit(mon, dmg, crit, sneak);
  if (dealt <= 0) { finishPlayerTurn(1); return; }

  if (kind === 'spear') {
    const bx = mon.x + dirx, by = mon.y + diry;
    const back = monAt(bx, by);
    if (back && back !== mon && raycast(p.x, p.y, bx, by).clear) {
      const pd = Math.max(1, Math.round(dmg * 0.6));
      log(`창끝이 ${J(monName(back), 'eul')} 꿰뚫었다!`, 'good');
      addFx({ type: 'bolt', x1: mon.x, y1: mon.y, x2: bx, y2: by, color: '#cfd6e2' });
      applyPlayerHit(back, pd, false, false);
    }
  }
  if (kind === 'axe') {
    const side = G.m.mons.filter(o => o !== mon && o.hp > 0 && !o.shop && dist(o.x, o.y, mon.x, mon.y) <= 1);
    if (side.length) {
      log('도끼가 크게 휘둘러져 주변을 함께 벤다!', 'good');
      addFx({ type: 'spin', x: mon.x, y: mon.y });
      for (const o of side.slice(0, 2)) {
        if (o.hp <= 0) continue;
        const ad = Math.max(1, Math.round(dmg * 0.6));
        applyPlayerHit(o, ad, false, false);
      }
    }
  }
  if (p.status.stealth) delete p.status.stealth;
  finishPlayerTurn(1);
}

function applyPlayerHit(mon, dmg, crit, sneak) {
  const p = G.p;
  if (mon.kind === 'wraith' && Math.random() < 0.26) {
    addFloat(mon.x, mon.y, 'MISS', '#b9c2d0');
    log('망령의 몸이 흐릿해진다.', '');
    SFX.play('hit');
    return 0;
  }
  mon.hp -= dmg;
  mon.hitFlash = 0.25;
  if (monStateOf(mon) === 'sleep') { setMonState(mon, 'chase'); alertAllies(mon); }
  else { mon.awake = true; if (monStateOf(mon) !== 'chase') setMonState(mon, 'chase'); }
  mon.lastSeen = { x: p.x, y: p.y };
  mon.sightLost = 0;
  addFloat(mon.x, mon.y, '-' + dmg, crit ? '#ffd24a' : '#ff9d9d');
  addFx({ type: 'slash', x: mon.x, y: mon.y });
  SFX.play(crit ? 'crit' : 'hit');
  if (crit) log(`치명타! ${monName(mon)}에게 ${dmg} 피해.`, 'good');
  else log(`${monName(mon)}에게 ${dmg} 피해.`, '');
  if (p.ring && p.ring.k === 'vampiric') {
    const h = Math.max(1, Math.round(dmg * 0.3));
    healPlayer(h, true);
  }
  if (hasPerk('vamp')) healPlayer(Math.max(1, Math.round(dmg * 0.08)), true);
  if (mon.hp > 0) {
    const w = p.weapon;
    if (w && hasAffix(w, 'flame')) {
      mon.status.burn = Math.max(mon.status.burn || 0, hasPerk('elemental') ? 3 : 2);
      addFloat(mon.x, mon.y, '🔥', '#ff9a3c');
      damageMonster(mon, Math.round(2 * elemMul()), '화염');
    } else if (w && hasAffix(w, 'frost')) {
      mon.status.freeze = Math.max(mon.status.freeze || 0, hasPerk('elemental') ? 2 : 1);
      addFloat(mon.x, mon.y, '❄', '#9fd8ff');
      damageMonster(mon, Math.round(2 * elemMul()), '냉기');
    }
  }
  if (mon.hp > 0 && hasAffix(p.weapon, 'vamp')) healPlayer(Math.max(1, Math.round(dmg * 0.15)), true);
  if (mon.hp > 0) applyShatter(mon, dmg);
  if (mon.hp > 0) oilIgnite(mon);
  if (mon.hp <= 0) killMonster(mon);
  return dmg;
}

function killMonster(mon, silent) {
  const p = G.p;
  mon.hp = 0;
  mon.tele = null;
  G.kills++; p.kills++;
  codexSee(mon.kind);
  const d = MONS[mon.kind];
  if (!silent) {
    log(`${J(monName(mon), 'iga')} 쓰러졌다.`, 'good');
    SFX.play('kill');
    addFx({ type: 'death', x: mon.x, y: mon.y });
  }
  gainXp(mon.xp);
  if (hasPerk('vamp')) healPlayer(3, true);
  G.p.mp = Math.min(G.p.maxmp, G.p.mp + 1);
  if (hasPerk('frenzy') && Math.random() < 0.35) {
    G.freeTurn = true;
    addFloat(p.x, p.y, '연쇄!', '#9fe0ff');
  }
  bountyKill();
  if (mon.boss) {
    G.bossDead = true;
    G.bossKilled = true;
    SFX.play('win');
    shake(10);
    addFloat(mon.x, mon.y, 'BOSS DOWN', '#ffd24a');
    log(`${J(monName(mon), 'eul')} 쓰러뜨렸다! 귀환의 문이 열린다.`, 'gold');
    const bx = mon.x, by = mon.y;
    G.m.t[by * W + bx] = T.RETURN;
    G.m.stairs = { x: bx, y: by, portal: true };
    for (let yy = by - 1; yy <= by + 1; yy++) for (let xx = bx - 1; xx <= bx + 1; xx++) if (inb(xx, yy) && !TILE_SOLID[G.m.t[yy * W + xx]]) G.m.t[yy * W + xx] = T.RETURN;
    for (let i = 0; i < 3; i++) {
      const loot = randomItem((G.contract ? G.contract.diff : 1) + 4, G.rng);
      if (loot) { loot.x = bx + DIR8[i][0]; loot.y = by + DIR8[i][1]; G.m.items.push(loot); }
    }
    G.m.items.push({ t: 'gold', n: 80 + (G.contract ? G.contract.diff : 1) * 40, x: bx, y: by + 1 });
    toast('⬇️ 귀환의 문이 열렸다');
  } else if (Math.random() < 0.22) {
    const loot = randomItem(G.contract ? G.contract.diff : 1, G.rng);
    if (loot) { loot.x = mon.x; loot.y = mon.y; G.m.items.push(loot); }
  }
  if (Math.random() < 0.35) { G.m.items.push({ t: 'gold', n: 2 + Math.floor(Math.random() * (3 + (G.contract ? G.contract.diff : 1) * 2)), x: mon.x, y: mon.y }); }
  if (d.split && mon.maxhp > 4) {
    const spots = DIR4.filter(dd => {
      const nx = mon.x + dd[0], ny = mon.y + dd[1];
      return inb(nx, ny) && !isBlockedFor({ fly: false }, nx, ny);
    });
    const nSplit = Math.min(2, spots.length);
    for (let i = 0; i < nSplit; i++) {
      const s = spots[i];
      const child = mkMon('slime', mon.x + s[0], mon.y + s[1], G.depth, G.rng);
      child.maxhp = Math.max(3, Math.round(mon.maxhp * 0.45));
      child.hp = child.maxhp;
      child.awake = true;
      G.m.mons.push(child);
    }
    if (nSplit) log('슬라임이 둘로 갈라졌다!', 'bad');
  }
  G.m.mons = G.m.mons.filter(o => o !== mon);
}

function gainXp(n) {
  const p = G.p;
  p.xp += n;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.lv++;
    p.xpNext = Math.round(p.xpNext * 1.55);
    p.baseMaxhp = (p.baseMaxhp || p.maxhp) + 6;
    p.baseMp = (p.baseMp || p.maxmp) + 1;
    p.atk += 1;
    G.pendingPerks = (G.pendingPerks || 0) + 1;
    recalcStats();
    p.hp = Math.min(p.maxhp, p.hp + 8);
    p.mp = Math.min(p.maxmp, p.mp + 2);
    log(`레벨 업! Lv.${p.lv} — 최대 HP +6, MP +1, 공격 +1 · 특성 선택`, 'gold');
    SFX.play('level');
    addFloat(p.x, p.y, 'LEVEL UP', '#ffe089');
    addFx({ type: 'levelup', x: p.x, y: p.y });
  }
}

function damagePlayer(n, src, label, attacker) {
  const p = G.p;
  if (G.state !== 'play') return 0;
  if (p.status.guard > 0) {
    delete p.status.guard;
    addFloat(p.x, p.y, 'GUARD', '#9fe0ff');
    log('방어 태세로 공격을 받아냈다!', 'good');
    SFX.play('hit');
    shake(2);
    if (attacker && attacker.hp > 0 && dist(p.x, p.y, attacker.x, attacker.y) <= 1 + playerReach()) {
      const cb = Math.max(1, Math.round(attackPower() * 0.8 - attacker.def));
      log(`반격! ${monName(attacker)}에게 ${cb} 피해.`, 'good');
      addFx({ type: 'slash', x: attacker.x, y: attacker.y });
      damageMonster(attacker, cb, '반격');
    }
    updateHUD();
    return 0;
  }
  let dmg = Math.max(1, Math.round(n - playerDef() * 0.5));
  if (attacker && hasPerk('swift') && Math.random() < 0.12) {
    addFloat(p.x, p.y, 'DODGE', '#9fe0ff');
    log('가볍게 몸을 비켜 공격을 흘렸다.', 'good');
    SFX.play('step');
    updateHUD();
    return 0;
  }
  if (p.status.shield > 0 && p.shieldHp > 0) {
    const absorbed = Math.min(p.shieldHp, dmg);
    p.shieldHp -= absorbed;
    dmg -= absorbed;
    addFloat(p.x, p.y, '-' + absorbed, '#9fd8ff');
    if (p.shieldHp <= 0) { delete p.status.shield; log('마력 보호막이 산산조각 났다.', 'bad'); }
    else log(`보호막이 피해 ${absorbed}을 흡수했다.`, 'sys');
    if (dmg <= 0) { updateHUD(); return 0; }
  }
  p.hp -= dmg;
  G.hitFreeze = 0.22; shake(4);
  addFloat(p.x, p.y, '-' + dmg, '#ff6b6b');
  SFX.play('hurt');
  if (label) log(`${label} ${dmg} 피해!`, 'bad');
  if (p.status.oil > 0 && fireAt(p.x, p.y) > 0) {
    delete p.status.oil;
    addFx({ type: 'boom', x: p.x, y: p.y });
    p.hp -= 6;
    log('옷에 밴 기름이 불붙었다!', 'bad');
  }
  if (attacker && attacker.hp > 0 && G.state === 'play') {
    if (hasAffix(p.armor, 'thorn') || hasAffix(p.ring, 'thorn')) damageMonster(attacker, 3, '가시');
    if (attacker.hp > 0 && hasPerk('counter') && dist(p.x, p.y, attacker.x, attacker.y) <= 1 && Math.random() < 0.3) {
      const cb = Math.max(1, Math.round(attackPower() * 0.6 - attacker.def));
      addFx({ type: 'slash', x: attacker.x, y: attacker.y });
      log(`반격! ${J(monName(attacker), 'e')} ${cb} 피해.`, 'good');
      damageMonster(attacker, cb, '반격');
    }
  }
  if (p.hp <= 0) die(src || '알 수 없는 힘');
  updateHUD();
  return dmg;
}
function healPlayer(n, quiet) {
  const p = G.p;
  const before = p.hp;
  p.hp = Math.min(p.maxhp, p.hp + n);
  const got = Math.round(p.hp - before);
  if (got > 0) addFloat(p.x, p.y, '+' + got, '#8ef19a');
  if (!quiet) SFX.play('heal');
  updateHUD();
}
function playerStatusTick() {
  const p = G.p;
  for (const k in p.status) {
    p.status[k]--;
    if (p.status[k] <= 0) {
      delete p.status[k];
      if (k === 'shield') { p.shieldHp = 0; log('마력 보호막이 걷혔다.', 'sys'); }
    }
  }
  if (p.status.poison) damagePlayer(1 + (p.status.poison > 6 ? 1 : 0), '독');
  if (p.status.burn) {
    damagePlayer(2, '화상');
    if (p.status.oil > 0 && G.state === 'play') {
      delete p.status.oil;
      p.hp -= 5;
      addFx({ type: 'boom', x: p.x, y: p.y });
      log('옷에 밴 기름이 불붙어 크게 탔다!', 'bad');
      addFloat(p.x, p.y, '-5', '#ff6b6b');
      if (p.hp <= 0) die('기름 화염');
    }
  }
  if (p.ring && p.ring.k === 'regen' && G.turn % 3 === 0) healPlayer(1, true);
  if (G.state !== 'play') return;
  if (p.status.freeze > 0) { log('얼어붙어 몸이 움직이지 않는다.', 'bad'); }
}

function die(cause) {
  if (G.state !== 'play') return;
  G.state = 'dead';
  G.target = null; G.path = null; G.pathPreview = null;
  const tb = document.getElementById('targetBar'); if (tb) tb.style.display = 'none';
  G.deadCause = cause;
  SFX.play('dead');
  addFx({ type: 'death', x: G.p.x, y: G.p.y });
  setTimeout(showDeath, 700);
}

/* ---------------------------------------------------------------- monsters */
function monstersAct() {
  const p = G.p;
  computeDistField();
  for (const mon of G.m.mons.slice()) {
    if (G.state !== 'play') return;
    if (!mon || mon.hp <= 0) continue;
    if (mon.shop) continue;
    if (mon.slow && G.turn % 2 === 1) continue;
    const acts = mon.fast && G.turn % 2 === 0 ? 2 : 1;
    for (let a = 0; a < acts; a++) {
      if (mon.hp <= 0 || G.state !== 'play') break;
      monTurn(mon);
    }
  }
}
function monTurn(mon) {
  const p = G.p;
  if (mon.teleCd > 0) mon.teleCd--;
  if (mon.status.freeze > 0) {
    mon.status.freeze--;
    addFloat(mon.x, mon.y, '❄', '#9fe0ff');
    if (mon.tele) cancelTelegraph(mon);
    return;
  }
  if (mon.status.stun > 0) {
    mon.status.stun--;
    addFloat(mon.x, mon.y, '★', '#ffe089');
    if (mon.tele) cancelTelegraph(mon);
    return;
  }
  if (mon.tele) { resolveTelegraph(mon); return; }
  if (mon.status.fear > 0) { mon.status.fear--; fleeStep(mon); return; }
  if (mon.status.confuse > 0) {
    mon.status.confuse--;
    const d = DIR8[Math.floor(Math.random() * 8)];
    stepMonster(mon, d[0], d[1]);
    return;
  }
  const st0 = monStateOf(mon);
  const sees = detectPlayer(mon);
  if (sees) { mon.lastSeen = { x: p.x, y: p.y }; mon.sightLost = 0; }
  else mon.sightLost = (mon.sightLost || 0) + 1;

  if (st0 === 'sleep') {
    if (sees) {
      setMonState(mon, 'alert');
      mon.alertT = 1;
      addFloat(mon.x, mon.y, '!', '#ffb066');
      if (Math.random() < 0.6) log(`${J(monName(mon), 'iga')} 고개를 들고 주위를 살핀다.`, 'bad');
      alertAllies(mon);
      return;
    }
    if (Math.random() < 0.16) wander(mon);
    return;
  }
  if (st0 === 'alert') {
    if (sees) setMonState(mon, 'chase');
    else if (mon.alertT > 0) { mon.alertT--; return; }
    else if (mon.lastSeen && dist(mon.x, mon.y, mon.lastSeen.x, mon.lastSeen.y) > 1) {
      if (mon.ai === 'ranged' && Math.random() < 0.5) wander(mon); else approach(mon);
      return;
    } else {
      if (Math.random() < 0.25) setMonState(mon, 'sleep');
      return;
    }
  }
  if (!sees && mon.sightLost > 5) {
    setMonState(mon, 'alert');
    mon.alertT = 2;
    addFloat(mon.x, mon.y, '?', '#b9c2d0');
    return;
  }
  const d = dist(mon.x, mon.y, p.x, p.y);
  const hasTele = !!(MONS[mon.kind] || {}).tele;

  if (mon.ai === 'erratic') {
    if (sees && d <= 7 && Math.random() < 0.65) {
      if (d === 1) monAttack(mon); else approach(mon);
    } else if (Math.random() < 0.55) {
      if (d === 1) monAttack(mon);
      else { const dd = DIR8[Math.floor(Math.random() * 8)]; stepMonster(mon, dd[0], dd[1]); }
    }
    return;
  }
  if (mon.ai === 'ranged') {
    const lined = raycast(mon.x, mon.y, p.x, p.y).clear;
    if (sees && d <= (mon.range || 5) && lined) {
      if (hasTele && mon.teleCd <= 0 && Math.random() < 0.55) { planTelegraph(mon); return; }
      if (mon.cd <= 0) { monRanged(mon); mon.cd = 2; return; }
    }
    if (mon.cd > 0) mon.cd--;
    if (d > 1) {
      if (sees && d < 3 && Math.random() < 0.6) retreatStep(mon);
      else approach(mon);
    } else monAttack(mon);
    return;
  }
  if (d === 1) {
    if (hasTele && mon.teleCd <= 0 && Math.random() < (mon.boss ? 0.5 : 0.3)) { planTelegraph(mon); return; }
    monAttack(mon);
    return;
  }
  if (hasTele && sees && mon.teleCd <= 0 && d <= 6 && Math.random() < 0.45) { planTelegraph(mon); return; }
  if (d > 1) approach(mon);
  else monAttack(mon);
}

function canSee(x1, y1, x2, y2) {
  const d = euc(x1, y1, x2, y2);
  if (d > 10) return false;
  return sightClear(x1, y1, x2, y2);
}
function wander(mon) {
  const dd = DIR8[Math.floor(Math.random() * 8)];
  stepMonster(mon, dd[0], dd[1]);
}
function retreatStep(mon) {
  const p = G.p;
  let best = null, bestE = -1;
  for (const dd of DIR8) {
    const nx = mon.x + dd[0], ny = mon.y + dd[1];
    if (isBlockedFor(mon, nx, ny)) continue;
    if (dd[0] && dd[1] && (isBlockedFor(mon, mon.x + dd[0], mon.y) || isBlockedFor(mon, mon.x, mon.y + dd[1]))) continue;
    const e = euc(nx, ny, p.x, p.y) - hazardCost(nx, ny, true) * 0.05;
    if (e > bestE) { bestE = e; best = dd; }
  }
  if (best) stepMonster(mon, best[0], best[1]);
}
function fleeStep(mon) { retreatStep(mon); }

function approach(mon) {
  const p = G.p;
  const field = G.distField || computeDistField();
  const cur = field[mon.y * W + mon.x];
  const escaping = fireAt(mon.x, mon.y) > 0 || gasAt(mon.x, mon.y) > 0;
  let best = null, bestV = 1e9;
  for (const dd of DIR8) {
    const nx = mon.x + dd[0], ny = mon.y + dd[1];
    if (isBlockedFor(mon, nx, ny)) continue;
    if (dd[0] && dd[1] && (isBlockedFor(mon, mon.x + dd[0], mon.y) || isBlockedFor(mon, mon.x, mon.y + dd[1]))) continue;
    let v = field[ny * W + nx];
    if (v >= 0x7fffffff) continue;
    if (escaping) v = hazardCost(nx, ny, true) * 10 + v * 0.01;
    else v += hazardCost(nx, ny, true) * 0.6;
    if (v < bestV) { bestV = v; best = { dd, v }; }
  }
  if (!best) { if (Math.random() < 0.3) wander(mon); return; }
  if (!escaping && cur < 0x7fffffff && bestV >= cur && Math.random() < 0.75) {
    if (Math.random() < 0.25) wander(mon);
    return;
  }
  stepMonster(mon, best.dd[0], best.dd[1]);
}
function stepMonster(mon, dx, dy) {
  const nx = mon.x + dx, ny = mon.y + dy;
  if (nx === G.p.x && ny === G.p.y) { monAttack(mon); return; }
  if (isBlockedFor(mon, nx, ny)) return;
  const t = G.m.t[ny * W + nx];
  if (t === T.DOOR || t === T.LOCKED || t === T.GATE) return;
  const p = G.p;
  if (p.status.brace > 0 && p.weapon && p.weapon.kind === 'spear') {
    const dd = dist(nx, ny, p.x, p.y);
    if (dd > 0 && dd <= 2 && raycast(p.x, p.y, nx, ny).clear) {
      const bd = Math.max(1, Math.round(attackPower() * 0.7 - mon.def));
      log(`창의 저지! ${J(monName(mon), 'iga')} 꿰뚫렸다.`, 'good');
      addFx({ type: 'bolt', x1: p.x, y1: p.y, x2: nx, y2: ny, color: '#cfd6e2' });
      damageMonster(mon, bd, '저지');
      if (mon.hp > 0) { mon.status.stun = Math.max(mon.status.stun || 0, 1); mon.mv = 0; }
      delete p.status.brace;
      return;
    }
  }
  mon.facing = [dx, dy];
  mon.x = nx; mon.y = ny; mon.mv = 1;
  if (t === T.WATER) mon.status.wet = Math.max(mon.status.wet || 0, 3);
  if (t === T.OIL) mon.status.oil = Math.max(mon.status.oil || 0, 4);
  if (fireAt(nx, ny) > 0 && !mon.fireImmune) {
    damageMonster(mon, 3, '불길');
    if (mon.hp > 0) mon.status.burn = Math.max(mon.status.burn || 0, 2);
  }
  if (mon.hp > 0) {
    const tr = trapAt2(nx, ny);
    if (tr) triggerTrapOnTile(tr, mon);
  }
  if (mon.hp > 0) oilIgnite(mon);
}
function monAttack(mon) {
  const p = G.p;
  mon.facing = [Math.sign(p.x - mon.x), Math.sign(p.y - mon.y)];
  let dmg = mon.atk + Math.floor(Math.random() * 3) - 1;
  if (p.status.bless) dmg -= 1;
  if (p.status.wet > 0 && (mon.kind === 'shaman' || mon.kind === 'lich' || mon.kind === 'alchemist')) dmg += 1;
  const dealt = damagePlayer(dmg, monName(mon), `${monName(mon)}의 공격!`, mon);
  addFx({ type: 'slash', x: p.x, y: p.y, enemy: true });
  if (dealt > 0 && mon.boss && mon.hp < mon.maxhp * 0.5 && Math.random() < 0.5 && G.state === 'play') {
    setTimeout(() => { if (G.state === 'play') damagePlayer(mon.atk - 1, MONS[mon.kind].name, `분노의 연격!`, mon); }, 160);
  }
  if (mon.kind === 'shaman' && Math.random() < 0.2) p.status.poison = Math.max(p.status.poison || 0, 5);
  if (mon.kind === 'spider' && Math.random() < 0.3) p.status.poison = Math.max(p.status.poison || 0, 4);
  if (mon.kind === 'imp' && Math.random() < 0.25) p.status.burn = Math.max(p.status.burn || 0, 3);
}
function monRanged(mon) {
  const p = G.p;
  const rc = raycast(mon.x, mon.y, p.x, p.y);
  if (!rc.clear) return;
  addFx({ type: 'bolt', x1: mon.x, y1: mon.y, x2: p.x, y2: p.y, color: mon.kind === 'lich' ? '#b07fe0' : '#7fd18a' });
  const dmg = mon.atk + Math.floor(Math.random() * 2);
  damagePlayer(dmg, monName(mon), `${monName(mon)}의 사격!`, mon);
  SFX.play('bow');
}
function damageMonster(mon, n, label) {
  if (!mon || mon.hp <= 0) return;
  mon.hp -= n;
  addFloat(mon.x, mon.y, '-' + n, '#ff9d9d');
  mon.hitFlash = 0.2;
  if (monStateOf(mon) === 'sleep') setMonState(mon, 'chase');
  else mon.awake = true;
  mon.lastSeen = { x: G.p.x, y: G.p.y };
  if (label) log(`${monName(mon)} ${label} 피해 ${n}.`, '');
  if (mon.status.stun > 0 && mon.tele) cancelTelegraph(mon);
  if (mon.hp <= 0) killMonster(mon);
  else oilIgnite(mon);
}

/* ---------------------------------------------------------------- environment */
function envTick() {
  const m = G.m;
  const p = G.p;
  for (let i = 0; i < W * H; i++) {
    if (m.fire[i] > 0) {
      m.fire[i] -= 1;
      if (m.fire[i] <= 0) { m.fire[i] = 0; continue; }
      const x = i % W, y = (i / W) | 0;
      if (p.x === x && p.y === y) damagePlayer(4, '불길');
      for (const mon of m.mons.slice()) if (mon.x === x && mon.y === y && mon.hp > 0) damageMonster(mon, 4, '불길');
      if (m.fire[i] > 1) {
        for (const d of DIR4) {
          const nx = x + d[0], ny = y + d[1];
          if (!inb(nx, ny)) continue;
          const t = m.t[ny * W + nx];
          if (t === T.GRASS || t === T.BUSH) { if (Math.random() < 0.28) { m.t[ny * W + nx] = T.FLOOR; m.fire[ny * W + nx] = 4 + Math.random() * 3; } }
          else if (t === T.OIL) { if (Math.random() < 0.5) { m.t[ny * W + nx] = T.FLOOR; m.fire[ny * W + nx] = 5 + Math.random() * 3; } }
          else if (t === T.WOOD) { if (Math.random() < 0.12) m.fire[ny * W + nx] = 3 + Math.random() * 2; }
        }
      }
      for (const d of DIR4) {
        const nx = x + d[0], ny = y + d[1];
        if (inb(nx, ny) && (m.t[ny * W + nx] === T.WATER)) { if (Math.random() < 0.6) m.fire[i] = 0; }
      }
      if (m.t[i] === T.WATER) m.fire[i] = 0;
    }
    if (m.gas[i] > 0) {
      const x = i % W, y = (i / W) | 0;
      if (m.fire[i] > 0) {
        m.gas[i] = 0;
        m.fire[i] = Math.max(m.fire[i], 3);
        addFx({ type: 'boom', x, y });
        shake(7);
        SFX.play('fire');
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
          if (!inb(xx, yy)) continue;
          if (m.t[yy * W + xx] === T.WALL) continue;
          m.gas[yy * W + xx] = 0;
          if (m.t[yy * W + xx] !== T.WATER) m.fire[yy * W + xx] = Math.max(m.fire[yy * W + xx], 3 + Math.random() * 2);
        }
        for (const mon of m.mons.slice()) if (mon.hp > 0 && dist(mon.x, mon.y, x, y) <= 1) damageMonster(mon, 12, '가스 폭발');
        if (dist(p.x, p.y, x, y) <= 1) damagePlayer(10, '가스 폭발');
        log('독구름에 불이 붙어 폭발했다!', 'bad');
        continue;
      }
      m.gas[i] -= 1;
      if (p.x === x && p.y === y) { p.status.poison = Math.max(p.status.poison || 0, 4); }
      for (const mon of m.mons.slice()) if (mon.x === x && mon.y === y && mon.hp > 0) { mon.status.poison = Math.max(mon.status.poison || 0, 4); }
      if (m.gas[i] > 2 && Math.random() < 0.35) {
        for (const d of DIR4) {
          const nx = x + d[0], ny = y + d[1];
          if (inb(nx, ny) && m.gas[ny * W + nx] <= 0 && m.t[ny * W + nx] !== T.WALL) m.gas[ny * W + nx] = m.gas[i];
        }
      }
    }
  }
  for (const mon of m.mons.slice()) {
    if (mon.hp <= 0) continue;
    if (mon.status.poison > 0) { mon.status.poison--; damageMonster(mon, 2, '독'); }
    if (mon.hp > 0 && mon.status.burn > 0) { mon.status.burn--; damageMonster(mon, 2, '화상'); }
  }
  if (m.gas[p.y * W + p.x] > 0) p.status.poison = Math.max(p.status.poison || 0, 4);
  if (m.t[p.y * W + p.x] === T.WATER) p.status.wet = Math.max(p.status.wet || 0, 2);
  if (m.t[p.y * W + p.x] === T.OIL) p.status.oil = Math.max(p.status.oil || 0, 3);
  for (const mon of m.mons) {
    if (mon.hp <= 0) continue;
    const mt = m.t[mon.y * W + mon.x];
    if (mt === T.WATER) mon.status.wet = Math.max(mon.status.wet || 0, 2);
    if (mt === T.OIL) mon.status.oil = Math.max(mon.status.oil || 0, 3);
    if (mon.status.oil > 0 && m.fire[mon.y * W + mon.x] > 0) oilIgnite(mon);
  }
  if (G.turn % 14 === 0) {
    for (let i = 0; i < W * H; i++) if (m.t[i] === T.ICE && Math.random() < 0.25) m.t[i] = T.WATER;
  }
}

/* ---------------------------------------------------------------- traps */
function triggerTrap(tr) {
  const p = G.p;
  tr.armed = false;
  const names = { dart: '독침 함정', fire: '화염 함정', tp: '전이 함정', bear: '덫' };
  log(`${J(names[tr.kind], 'iga')} 발동했다!`, 'bad');
  if (tr.kind === 'dart') {
    damagePlayer(3 + Math.floor(Math.random() * 3), '독침');
    if (Math.random() < 0.4) p.status.poison = Math.max(p.status.poison || 0, 4);
  } else if (tr.kind === 'fire') {
    damagePlayer(4, '화염');
    G.m.fire[p.y * W + p.x] = 3;
  } else if (tr.kind === 'bear') {
    damagePlayer(2, '덫');
    p.status.freeze = Math.max(p.status.freeze || 0, 1);
    log('덫에 발이 붙잡혔다!', 'bad');
  } else if (tr.kind === 'tp') {
    const spots = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (TILE_WALK[G.m.t[y * W + x]] && !monAt(x, y)) spots.push([x, y]);
    }
    if (spots.length) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      p.x = s[0]; p.y = s[1];
      addFx({ type: 'blink', x: p.x, y: p.y });
      log('공간이 뒤틀리며 다른 곳으로 옮겨졌다.', 'bad');
    }
  }
  SFX.play('bad');
  computeFOV();
}
