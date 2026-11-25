/* =====================================================================
   ITEMS · SHOP · SHRINE · CHESTS · TRAVEL
   ===================================================================== */
const ITEM_CAP = 14;

function potionDef(k) { return POTIONS.find(p => p.k === k) || POTIONS[0]; }
function scrollDef(k) { return SCROLLS.find(s => s.k === k) || SCROLLS[0]; }

function itemName(it) {
  if (!it) return '';
  switch (it.t) {
    case 'potion': {
      const id = G.ident.potion[it.k];
      return id && id.known ? potionDef(it.k).name : (id ? id.color + ' 물약' : '물약');
    }
    case 'scroll': {
      const id = G.ident.scroll[it.k];
      return id && id.known ? scrollDef(it.k).name : (id ? '미지의 두루마리 [' + id.label + ']' : '두루마리');
    }
    case 'wand': return (WANDS[it.k] ? WANDS[it.k].name : '마법봉') + (it.charges > 0 ? ` (${it.charges})` : ' (방전)');
    case 'weapon': return gearName(it);
    case 'armor': return gearName(it);
    case 'ring': return gearName(it);
    case 'food': return '식량';
    case 'key': return '철문 열쇠';
    case 'lockpick': return `자물쇠 따개${it.n > 1 ? ' ×' + it.n : ''}`;
    case 'gold': return '금화 ' + it.n;
  }
  return '아이템';
}
function gearName(it) {
  const pre = affixName(it);
  const base = it.t === 'ring' ? (RINGS[it.k] ? RINGS[it.k].name : '반지') : it.name;
  return (pre ? pre + ' ' : '') + base + (it.plus ? ' +' + it.plus : '');
}
function itemAffixDesc(it) {
  const list = affixList(it).map(a => AFFIXES[a]).filter(Boolean);
  return list.map(a => a.desc).join(' · ');
}
function itemDesc(it) {
  if (!it) return '';
  switch (it.t) {
    case 'potion': {
      const id = G.ident.potion[it.k];
      if (id && id.known) return potionDef(it.k).desc;
      return '정체를 알 수 없는 물약. 마시거나 던져 보면 알 수 있다.';
    }
    case 'scroll': {
      const id = G.ident.scroll[it.k];
      if (id && id.known) return scrollDef(it.k).desc;
      return '알 수 없는 문자가 적힌 두루마리. 읽으면 무슨 일이 일어날지 모른다.';
    }
    case 'wand': return (WANDS[it.k] ? WANDS[it.k].desc : '') + ` MP ${WANDS[it.k] ? WANDS[it.k].mp : 2} 소모 · 남은 충전 ${it.charges}.`;
    case 'weapon': {
      const a = itemAffixDesc(it);
      return `공격 +${it.dmg + (it.plus || 0)} · 치명 ${Math.round((it.crit || 0) * 100)}%` +
        (it.kind === 'spear' ? ' · 2칸 사거리' : '') +
        (it.ranged ? ` · 사거리 ${weaponRange(it)}` : '') + (a ? ` · ${a}` : '');
    }
    case 'armor': {
      const a = itemAffixDesc(it);
      return `방어 +${it.def + (it.plus || 0)}` + (a ? ` · ${a}` : '');
    }
    case 'ring': {
      const base = RINGS[it.k] ? RINGS[it.k].desc : '';
      const a = itemAffixDesc(it);
      return base + (a ? ' · ' + a : '');
    }
    case 'food': return '말린 고기와 빵. 먹으면 HP 10, MP 3을 회복한다.';
    case 'key': return '잠긴 철문을 연다.';
    case 'lockpick': return `잠긴 문·상자를 딴다. 실패하면 하나 부러진다. (도적 성공률 높음) 남은 ${it.n}개.`;
    case 'gold': return '반짝이는 금화.';
  }
  return '';
}
function itemSprite(it) {
  if (!it) return SP.scroll;
  switch (it.t) {
    case 'potion': return SP.potion[(G.ident.potion[it.k] || {}).color || '붉은'];
    case 'scroll': return SP.scroll;
    case 'wand': return SP.wand[it.k] || SP.wand.firebolt;
    case 'weapon': return SP.weapon[it.kind] || SP.weapon.sword;
    case 'armor': return SP.armor;
    case 'ring': return SP.ring;
    case 'food': return SP.food || SP.scroll;
    case 'key': return SP.key;
    case 'lockpick': return SP.lockpick;
    case 'gold': return SP.gold;
  }
  return SP.scroll;
}
function itemCodexId(it) {
  if (it.t === 'potion') return 'potion:' + it.k;
  if (it.t === 'scroll') return 'scroll:' + it.k;
  if (it.t === 'weapon') return 'weapon:' + it.kind;
  if (it.t === 'armor') return 'armor';
  if (it.t === 'ring') return 'ring:' + it.k;
  if (it.t === 'wand') return 'wand:' + it.k;
  return it.t;
}
function pickSpriteTo(cv, it) {
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.imageSmoothingEnabled = false;
  const s = itemSprite(it);
  if (s) g.drawImage(s, 0, 0, cv.width, cv.height);
}
function addToInv(it) {
  if (it.t === 'potion' || it.t === 'scroll' || it.t === 'food' || it.t === 'lockpick') {
    const ex = G.p.inv.find(o => o.t === it.t && o.k === it.k);
    if (ex) { ex.n += it.n || 1; return true; }
  }
  if (G.p.inv.length >= ITEM_CAP) return false;
  it.n = it.n || 1;
  G.p.inv.push(it);
  return true;
}
function consumeItem(it, n) {
  n = n || 1;
  if (it.n > n) { it.n -= n; return; }
  const i = G.p.inv.indexOf(it);
  if (i >= 0) G.p.inv.splice(i, 1);
}
function pickupItem(it) {
  if (!it) return;
  if (it.t === 'gold') {
    G.p.gold += it.n;
    log(`금화 ${it.n}개를 주웠다.`, 'gold');
    SFX.play('gold');
    G.m.items = G.m.items.filter(o => o !== it);
    updateHUD(); return;
  }
  if (!addToInv(it)) { log('가방이 가득 찼다.', 'bad'); return; }
  log(`${J(itemName(it), 'eul')} 주웠다.`, 'good');
  SFX.play('pick');
  G.m.items = G.m.items.filter(o => o !== it);
  if (it.t !== 'potion' && it.t !== 'scroll') codexItem(itemCodexId(it));
  updateHUD();
}
function identifyKind(it) {
  if (it.t === 'potion') { const id = G.ident.potion[it.k]; if (id) id.known = true; codexItem('potion:' + it.k); }
  if (it.t === 'scroll') { const id = G.ident.scroll[it.k]; if (id) id.known = true; codexItem('scroll:' + it.k); }
}

/* ---------------------------------------------------------------- use */
function useItem(it) {
  if (G.state !== 'play' || !it) return;
  if (it.t === 'potion') drinkPotion(it);
  else if (it.t === 'scroll') readScroll(it);
  else if (it.t === 'food') eatFood(it);
  else if (it.t === 'weapon' || it.t === 'armor' || it.t === 'ring') equipItem(it);
  else if (it.t === 'wand') beginWandTarget(it);
  else if (it.t === 'key') log('열쇠는 잠긴 문 앞에서 자동으로 사용된다.', '');
  else if (it.t === 'lockpick') log('자물쇠 앞에서 사용한다. 오른쪽 상황 버튼을 보라.', '');
}
function eatFood(it) {
  consumeItem(it);
  healPlayer(10);
  G.p.mp = Math.min(G.p.maxmp, G.p.mp + 3);
  log('식량을 먹었다. 기운이 돌아온다.', 'good');
  SFX.play('drink');
  afterItemUse();
}
function drinkPotion(it) {
  const wasKnown = G.ident.potion[it.k].known;
  identifyKind(it);
  consumeItem(it);
  const k = it.k;
  if (k === 'heal') {
    healPlayer(16); log('회복 물약을 마셨다. 상처가 아문다.', 'good');
    if (G.p.status.poison) { delete G.p.status.poison; log('독도 함께 해소되었다.', 'good'); }
  } else if (k === 'speed') {
    G.p.status.haste = Math.max(G.p.status.haste || 0, 18);
    log('몸이 가벼워진다! 잠시 빨라진다.', 'good');
  } else if (k === 'mana') {
    G.p.mp = Math.min(G.p.maxmp, G.p.mp + 16);
    log('마나가 차오른다. MP +16', 'good');
    SFX.play('heal');
  } else if (k === 'fire') {
    damagePlayer(4, '화염 물약'); G.p.status.burn = 4;
    log('속에서 불이 타오른다!', 'bad'); SFX.play('fire');
  } else if (k === 'poison') {
    G.p.status.poison = Math.max(G.p.status.poison || 0, 8);
    log('독이 온몸에 퍼진다.', 'bad'); SFX.play('bad');
  } else if (k === 'frost') {
    G.p.status.freeze = 3; damagePlayer(3, '냉기');
    log('몸이 얼어붙는다!', 'bad'); SFX.play('freeze');
  } else if (k === 'confuse') {
    G.p.status.confuse = 8;
    log('세상이 빙글빙글 돈다.', 'bad'); SFX.play('bad');
  }
  if (!wasKnown) log('물약의 정체를 알게 되었다.', 'sys');
  SFX.play('drink');
  G.p.recharge++;
  afterItemUse();
}
function readScroll(it) {
  const wasKnown = G.ident.scroll[it.k].known;
  identifyKind(it);
  consumeItem(it);
  const k = it.k;
  if (k === 'identify') {
    let cnt = 0;
    for (const o of G.p.inv) {
      if (o.t === 'potion' && !G.ident.potion[o.k].known) { identifyKind(o); cnt++; }
      if (o.t === 'scroll' && !G.ident.scroll[o.k].known) { identifyKind(o); cnt++; }
    }
    log(cnt ? `감정의 빛이 아이템 ${cnt}종을 밝혔다.` : '새로 감정할 것이 없다.', cnt ? 'good' : '');
    SFX.play('pick');
  } else if (k === 'teleport') {
    const spots = [];
    const m = G.m, p = G.p;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (TILE_WALK[m.t[y * W + x]] && !monAt(x, y) && dist(x, y, p.x, p.y) > 5) spots.push([x, y]);
    }
    if (spots.length) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      addFx({ type: 'blink', x: s[0], y: s[1] });
      p.x = s[0]; p.y = s[1];
      log('공간이 접히더니 낯선 곳에 서 있다.', 'sys');
    }
    SFX.play('stairs');
  } else if (k === 'mapping') {
    for (let i = 0; i < W * H; i++) {
      const t = G.m.t[i];
      if (TILE_WALK[t] || t === T.DOOR) G.m.seen[i] = 1;
    }
    for (const o of G.m.objs) G.m.seen[o.y * W + o.x] = 1;
    log('이 지역의 지형이 머릿속에 그려진다.', 'good');
    SFX.play('pick');
  } else if (k === 'upgrade') {
    const w = G.p.weapon, a = G.p.armor;
    if (w && (!a || Math.random() < 0.6)) { w.plus = (w.plus || 0) + 1; log(`무기가 강화되었다! ${itemName(w)}`, 'gold'); }
    else if (a) { a.plus = (a.plus || 0) + 1; log(`갑옷이 강화되었다! ${itemName(a)}`, 'gold'); }
    SFX.play('level');
  } else if (k === 'fear') {
    let n = 0;
    for (const mon of G.m.mons) {
      if (dist(mon.x, mon.y, G.p.x, G.p.y) <= 9 && !mon.boss) { mon.status.fear = 8; n++; }
    }
    log(n ? `${n}마리의 적이 공포에 질려 도망친다!` : '아무 일도 일어나지 않았다.', n ? 'good' : '');
    SFX.play('bad');
  }
  if (!wasKnown) log('두루마리의 정체를 알게 되었다.', 'sys');
  afterItemUse();
}

function equipItem(it) {
  const p = G.p;
  if (it.t === 'weapon') {
    let idx = p.slots.findIndex(s => !s);
    if (idx < 0) idx = p.slotIdx;
    const old = p.slots[idx];
    p.slots[idx] = it;
    if (idx === p.slotIdx) p.weapon = it;
    consumeItem(it);
    if (old) addToInv(old);
    log(`${J(itemName(it), 'eul')} ${idx === 0 ? '주무기' : '보조무기'}에 장착했다.`, 'good');
    if (idx === 0) p.weapon = it;
  } else if (it.t === 'armor') {
    const old = p.armor;
    p.armor = it; consumeItem(it);
    if (old) addToInv(old);
    log(`${J(itemName(it), 'eul')} 입었다.`, 'good');
  } else if (it.t === 'ring') {
    const old = p.ring;
    p.ring = it; consumeItem(it);
    if (old) addToInv(old);
    log(`${J(RINGS[it.k].name, 'eul')} 끼었다.`, 'good');
  }
  recalcStats();
  computeFOV();
  SFX.play('pick');
  updateHUD();
  afterItemUse();
}
function afterItemUse() {
  G.invSel = null;
  updateHUD();
  finishPlayerTurn(1);
  renderInv();
}

/* ---------------------------------------------------------------- quick belt */
const BELT_N = 3;
function beltSlots() {
  if (!G.p) return [null, null, null];
  if (!Array.isArray(G.p.belt) || G.p.belt.length !== BELT_N) G.p.belt = new Array(BELT_N).fill(null);
  return G.p.belt;
}
function beltFindItem(desc) {
  if (!desc || !G.p) return null;
  return G.p.inv.find(o => o && o.t === desc.t && (o.k || null) === (desc.k || null)) || null;
}
function beltAssign(it, allowOverwrite) {
  if (!it) return -1;
  const b = beltSlots();
  const desc = { t: it.t, k: it.k || null };
  const at = b.findIndex(d => d && d.t === desc.t && (d.k || null) === desc.k);
  if (at >= 0) return at;
  let idx = b.findIndex(d => !d);
  if (idx < 0) {
    if (!allowOverwrite) return -1;
    idx = 0;
  }
  b[idx] = desc;
  return idx;
}
function beltClearAt(i) { const b = beltSlots(); if (i >= 0 && i < BELT_N) b[i] = null; updateHUD(); }
function beltUse(i) {
  if (G.state !== 'play') return;
  const b = beltSlots();
  const desc = b[i];
  if (!desc) { SFX.play('ui'); openInv(); return; }
  const it = beltFindItem(desc);
  if (!it) { b[i] = null; log('퀵슬롯의 아이템이 없다.', ''); updateHUD(); return; }
  if (G.target) hideTargetBar();
  SFX.unlock();
  if (it.t === 'potion') {
    if (potionDef(it.k).use === 'throw') beginThrow(it);
    else drinkPotion(it);
  } else if (it.t === 'scroll') {
    closeInv(); readScroll(it);
  } else if (it.t === 'wand') {
    beginWandTarget(it);
  } else if (it.t === 'food') {
    eatFood(it);
  } else {
    openInv();
  }
}
function beltAutoFill() {
  const b = beltSlots();
  for (let i = 0; i < BELT_N; i++) b[i] = null;
  const inv = G.p.inv;
  const order = [
    inv.find(o => o.t === 'potion' && o.k === 'heal'),
    inv.find(o => o.t === 'wand' && o.charges > 0),
    inv.find(o => o.t === 'potion' && potionDef(o.k).use === 'throw'),
    inv.find(o => o.t === 'food'),
    inv.find(o => o.t === 'lockpick')
  ];
  for (const it of order) if (it) beltAssign(it, false);
}

/* ---------------------------------------------------------------- throwing */
function beginThrow(it) {
  if (G.state !== 'play') return;
  G.target = { mode: 'throw', item: it };
  closeInv();
  showTargetBar('던질 위치 선택 · 사거리 6');
}
function resolveThrow(it, tx, ty) {
  const p = G.p;
  const d = Math.max(Math.abs(tx - p.x), Math.abs(ty - p.y));
  if (d > 6 || !los(p.x, p.y, tx, ty)) { log('너무 멀거나 시야가 막혀 있다.', 'bad'); return false; }
  identifyKind(it);
  consumeItem(it);
  SFX.play('throwp');
  addFx({ type: 'arc', x1: p.x, y1: p.y, x2: tx, y2: ty, color: (G.ident.potion[it.k] || {}).c || '#fff' });
  const k = it.k;
  const m = G.m;
  const inRad = (x, y, r) => Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= r;

  if (k === 'fire') {
    if (m.t[ty * W + tx] === T.WATER) {
      log('물약이 물에 잠겨 연기만 피어오른다.', '');
    } else {
      for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
        if (!inb(x, y)) continue;
        const tt = m.t[y * W + x];
        if (tt === T.WATER) continue;
        if (tt === T.GRASS) m.t[y * W + x] = T.FLOOR;
        if (tt !== T.WALL && tt !== T.CHASM) m.fire[y * W + x] = Math.max(m.fire[y * W + x], 3 + Math.random() * 3);
      }
      m.fire[ty * W + tx] = 5;
      for (const mon of m.mons.slice()) if (mon.hp > 0 && inRad(mon.x, mon.y, 1)) damageMonster(mon, Math.round(7 * elemMul()), '화염');
      if (inRad(p.x, p.y, 1)) damagePlayer(3, '화염');
      log('화염 물약이 터져 불길이 치솟는다!', 'good');
      SFX.play('fire');
    }
  } else if (k === 'poison') {
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
      if (!inb(x, y) || m.t[y * W + x] === T.WALL) continue;
      if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 2) m.gas[y * W + x] = 8;
    }
    for (const mon of m.mons.slice()) if (mon.hp > 0 && inRad(mon.x, mon.y, 2)) mon.status.poison = Math.max(mon.status.poison || 0, 6);
    log('독구름이 퍼진다!', 'good');
    SFX.play('bad');
  } else if (k === 'frost') {
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
      if (!inb(x, y)) continue;
      if (m.t[y * W + x] === T.WATER) m.t[y * W + x] = T.ICE;
      if (m.fire[y * W + x] > 0) m.fire[y * W + x] = 0;
    }
    for (const mon of m.mons.slice()) if (mon.hp > 0 && inRad(mon.x, mon.y, 2)) { mon.status.freeze = hasPerk('elemental') ? 6 : 4; damageMonster(mon, Math.round(3 * elemMul()), '냉기'); }
    log('모든 것이 얼어붙는다.', 'good');
    SFX.play('freeze');
  } else if (k === 'confuse') {
    for (const mon of m.mons.slice()) if (mon.hp > 0 && inRad(mon.x, mon.y, 2)) mon.status.confuse = 8;
    log('혼란의 연기가 퍼진다.', 'good');
    SFX.play('bad');
  } else if (k === 'heal') {
    let hit = 0;
    for (const mon of m.mons.slice()) {
      if (mon.hp > 0 && inRad(mon.x, mon.y, 1)) {
        if (MONS[mon.kind].undead) { damageMonster(mon, 14, '성수'); hit++; }
      }
    }
    if (inRad(p.x, p.y, 1)) { healPlayer(6); hit++; }
    log(hit ? '회복의 물결이 퍼진다.' : '물약이 바닥에 흩어진다.', '');
    SFX.play('heal');
  } else if (k === 'mana') {
    if (inRad(p.x, p.y, 1)) { G.p.mp = Math.min(G.p.maxmp, G.p.mp + 6); }
    log('마나가 공기 중으로 흩어진다.', '');
    SFX.play('heal');
  } else if (k === 'speed') {
    for (const mon of G.m.mons.slice()) if (mon.hp > 0 && inRad(mon.x, mon.y, 1)) mon.status.haste = 6;
    log('목표가 빨라졌다! 좋은 선택인가?', '');
    SFX.play('drink');
  }
  computeFOV();
  finishPlayerTurn(1);
  updateHUD();
  return true;
}

/* ---------------------------------------------------------------- wands */
function beginWandTarget(it) {
  if (it.charges <= 0) { log('마법봉이 방전되었다.', 'bad'); return; }
  const w = WANDS[it.k];
  if (G.p.mp < (w.mp || 2)) { log(`마나가 부족하다. (MP ${Math.floor(G.p.mp)}/${w.mp || 2})`, 'bad'); SFX.play('bad'); return; }
  G.target = { mode: 'wand', item: it };
  closeInv();
  showTargetBar(`${w.name} · 사거리 ${w.range} · MP ${w.mp || 2}`);
}
function fireWand(it, tx, ty) {
  const p = G.p;
  const w = WANDS[it.k];
  const d = Math.max(Math.abs(tx - p.x), Math.abs(ty - p.y));
  if (d > w.range) { log('사거리를 벗어났다.', 'bad'); return false; }
  if (it.k !== 'blink' && !los(p.x, p.y, tx, ty)) { log('시야가 막혀 있다.', 'bad'); return false; }
  if (p.mp < (w.mp || 2)) { log(`마나가 부족하다. (MP ${Math.floor(p.mp)}/${w.mp || 2})`, 'bad'); return false; }
  const m = G.m;
  const intBonus = (G.p.cls === 'mage' ? 2 : 0) + Math.floor(G.p.lv / 4);
  it.charges--;
  p.mp -= (w.mp || 2);
  SFX.play(it.k === 'lightning' ? 'zap' : 'bolt');

  if (it.k === 'firebolt') {
    addFx({ type: 'bolt', x1: p.x, y1: p.y, x2: tx, y2: ty, color: '#ff8a3c' });
    const mon = monAt(tx, ty);
    if (mon) {
      damageMonster(mon, Math.round((w.dmg + intBonus * 2) * elemMul()), '화염');
      if (mon.hp > 0) oilIgnite(mon);
    }
    if (m.t[ty * W + tx] === T.OIL) { log('기름웅덩이에 불이 옮겨붙었다!', 'bad'); }
    if (m.t[ty * W + tx] === T.GRASS) m.t[ty * W + tx] = T.FLOOR;
    if (m.t[ty * W + tx] !== T.WATER && m.t[ty * W + tx] !== T.WALL && m.t[ty * W + tx] !== T.CHASM) m.fire[ty * W + tx] = Math.max(m.fire[ty * W + tx], 3);
    log('화염탄이 날아갔다!', '');
  } else if (it.k === 'lightning') {
    addFx({ type: 'bolt', x1: p.x, y1: p.y, x2: tx, y2: ty, color: '#9fd8ff' });
    const mon = monAt(tx, ty);
    if (mon) {
      const raw = Math.round((w.dmg + intBonus * 2) * elemMul());
      damageMonster(mon, raw, '번개');
      applyLightningCombo(mon, raw);
    }
    let chainTargets = [];
    if (m.t[ty * W + tx] === T.WATER) chainTargets = waterChain(tx, ty);
    else if (mon) { if (m.t[mon.y * W + mon.x] === T.WATER) chainTargets = waterChain(mon.x, mon.y); }
    let n = 0;
    for (const c of chainTargets) {
      if (c.x === tx && c.y === ty) continue;
      const cm = monAt(c.x, c.y);
      if (cm) { damageMonster(cm, Math.round(6 * elemMul()), '감전'); applyLightningCombo(cm, 6); n++; }
      if (c.x === p.x && c.y === p.y) { damagePlayer(G.p.status.wet ? 6 : 4, '감전'); n++; }
    }
    if (n) log(`번개가 물을 타고 ${n}곳으로 튄다!`, 'good');
  } else if (it.k === 'knockback') {
    const mon = monAt(tx, ty);
    addFx({ type: 'bolt', x1: p.x, y1: p.y, x2: tx, y2: ty, color: '#7fd1b0' });
    if (mon) {
      damageMonster(mon, w.dmg + intBonus, '충격');
      if (mon.hp > 0) {
        const dx = Math.sign(mon.x - p.x) || 1, dy = Math.sign(mon.y - p.y);
        knockbackMonster(mon, dx, dy, 2, { bonus: 1 });
      }
      log('적이 뒤로 밀려났다.', 'good');
    } else log('허공에 충격이 흩어졌다.', '');
  } else if (it.k === 'blink') {
    if (!TILE_WALK[m.t[ty * W + tx]] || monAt(tx, ty)) { log('그곳으로는 갈 수 없다.', 'bad'); it.charges++; return false; }
    addFx({ type: 'blink', x: p.x, y: p.y });
    p.x = tx; p.y = ty;
    addFx({ type: 'blink', x: tx, y: ty });
    log('몸이 접혀 순간이동했다.', 'good');
    onEnterTile(tx, ty);
  }
  if (it.charges <= 0) log('마법봉의 충전이 바닥났다.', 'bad');
  computeFOV();
  finishPlayerTurn(1);
  return true;
}
function waterChain(x, y) {
  const m = G.m;
  const seen = new Set(); const out = [];
  const q = [[x, y]];
  seen.add(y * W + x);
  while (q.length && out.length < 60) {
    const [cx, cy] = q.shift();
    out.push({ x: cx, y: cy });
    for (const d of DIR4) {
      const nx = cx + d[0], ny = cy + d[1];
      if (!inb(nx, ny)) continue;
      const k = ny * W + nx;
      if (seen.has(k)) continue;
      if (m.t[k] === T.WATER) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return out;
}

/* ---------------------------------------------------------------- objects */
function bumpBarrel(o) {
  const dx = Math.sign(o.x - G.p.x), dy = Math.sign(o.y - G.p.y);
  const nx = o.x + dx, ny = o.y + dy;
  if (inb(nx, ny) && TILE_WALK[G.m.t[ny * W + nx]] && !monAt(nx, ny) && !objAt(nx, ny)) {
    o.x = nx; o.y = ny;
    log('기름통을 밀었다.', '');
    SFX.play('step');
    finishPlayerTurn(1);
  } else {
    breakBarrel(o);
  }
}
function breakBarrel(o, noTurn) {
  if (!o || G.m.objs.indexOf(o) < 0) return;
  G.m.objs = G.m.objs.filter(z => z !== o);
  if (G.m.t[o.y * W + o.x] === T.FLOOR) G.m.t[o.y * W + o.x] = T.OIL;
  log('기름통이 부서져 기름이 흥건하게 퍼진다.', '');
  SFX.play('hit');
  if (!noTurn) finishPlayerTurn(1);
}
function explodeBarrel(o) {
  G.m.objs = G.m.objs.filter(z => z !== o);
  for (let y = o.y - 1; y <= o.y + 1; y++) for (let x = o.x - 1; x <= o.x + 1; x++) {
    if (!inb(x, y)) continue;
    const t = G.m.t[y * W + x];
    if (t === T.WALL) continue;
    if (t !== T.WATER) G.m.fire[y * W + x] = Math.max(G.m.fire[y * W + x], 3 + Math.random() * 2);
  }
  addFx({ type: 'boom', x: o.x, y: o.y });
  for (const mon of G.m.mons.slice()) if (mon.hp > 0 && dist(mon.x, mon.y, o.x, o.y) <= 1) damageMonster(mon, 10, '폭발');
  if (dist(G.p.x, G.p.y, o.x, o.y) <= 1) damagePlayer(8, '폭발');
  log('기름통이 펑 하고 터졌다!', 'bad');
  SFX.play('fire'); shake(8);
  finishPlayerTurn(1);
}
function openChest(o) {
  if (o.locked) {
    const pick = hasLockpick();
    const opts = [];
    if (pick) opts.push({ txt: `자물쇠 따기 (따개 ${pick.n})`, fn: () => attemptLockpick({ kind: 'chest', obj: o }) });
    opts.push({ txt: '부순다 (2턴 · 소음)', fn: () => bashLock({ kind: 'chest', obj: o }) });
    opts.push({ txt: '그만둔다', cls: 'flat', fn: () => { } });
    showChoice('잠긴 상자', '튼튼한 자물쇠가 채워져 있다. 따개나 힘이 필요하다.', opts);
    return;
  }
  if (o.mimic) {
    o.opened = true;
    G.m.objs = G.m.objs.filter(z => z !== o);
    const mon = mkMon('mimic', o.x, o.y, (G.contract ? G.contract.diff : 1) + 1, G.rng);
    mon.awake = true;
    G.m.mons.push(mon);
    log('상자가 이빨을 드러냈다! 미믹이다!', 'bad');
    SFX.play('bad'); shake(6);
    finishPlayerTurn(1);
    return;
  }
  if (o.trapped && !o.trapKnown) {
    o.trapKnown = true;
    damagePlayer(3 + Math.floor(Math.random() * 3), '덫');
    log('상자의 덫이 발동했다!', 'bad');
    if (G.p.status) G.p.status.poison = Math.max(G.p.status.poison || 0, 3);
    if (G.state !== 'play') return;
  }
  o.opened = true;
  const vault = o.loot === 'vault';
  const tier = (G.contract ? G.contract.diff : 1);
  let gold = vault ? 45 + tier * 12 + Math.floor(Math.random() * 30) : 12 + Math.floor(Math.random() * (9 + tier * 6));
  if (hasPerk('hunter')) gold = Math.round(gold * 1.6);
  G.p.gold += gold;
  log(`상자를 열었다. 금화 ${gold}개!`, 'gold');
  SFX.play('gold');
  bountyChest();
  if (Math.random() < (vault ? 1 : 0.75) + rarityLuck()) {
    const it = randomItem(vault ? tier + 3 : tier + 1, G.rng);
    if (it) {
      if (it.t === 'gold') { G.p.gold += it.n; }
      else if (!addToInv(it)) { log('가방이 가득 차 아이템을 두고 왔다.', 'bad'); it.x = o.x; it.y = o.y; G.m.items.push(it); }
      else { log(`${J(itemName(it), 'eul')} 얻었다.`, 'good'); }
    }
  }
  if (vault) { log('비밀 금고의 전리품이다!', 'gold'); SFX.play('level'); }
  updateHUD();
  finishPlayerTurn(1);
}

function openShrine(o) {
  showChoice('고대의 제단', '푸른 빛이 흐르는 제단이다. 무언가를 바치면 힘을 얻을 수 있다.', [
    { txt: '피 5를 바친다', cls: 'danger', fn: () => { if (G.p.hp <= 5) { log('피가 부족하다.', 'bad'); } else { G.p.hp -= 5; shrineResult(o); } } },
    { txt: '금화 30을 바친다', fn: () => { if (G.p.gold < 30) { log('금화가 부족하다.', 'bad'); } else { G.p.gold -= 30; shrineResult(o); } } },
    { txt: '아무것도 하지 않는다', cls: 'flat', fn: () => { } }
  ]);
}
function shrineResult(o) {
  o.used = true;
  G.m.objs = G.m.objs.filter(z => z !== o);
  SFX.play('stairs');
  if (Math.random() < 0.68) {
    const r = Math.random();
    if (r < 0.3) { G.p.baseMaxhp += 5; recalcStats(); G.p.hp += 5; log('제단이 축복한다. 최대 HP +5!', 'gold'); }
    else if (r < 0.55) { if (G.p.weapon) { G.p.weapon.plus = (G.p.weapon.plus || 0) + 1; log(`무기에 힘이 깃든다. ${itemName(G.p.weapon)}`, 'gold'); } else { G.p.atk++; log('주먹에 힘이 깃든다. 공격 +1', 'gold'); } }
    else if (r < 0.75) { healPlayer(999); log('온몸의 상처가 아문다.', 'gold'); }
    else if (r < 0.9) { G.p.status.bless = 40; log('축복이 내려와 잠시 강해진다.', 'gold'); }
    else { for (const it of G.p.inv) identifyKind(it); log('가방 속 모든 것이 밝혀진다.', 'gold'); }
    addFx({ type: 'levelup', x: G.p.x, y: G.p.y });
  } else {
    const r = Math.random();
    if (r < 0.3) { G.p.status.curse = 40; log('저주가 내린다! 힘이 빠진다.', 'bad'); }
    else if (r < 0.6) { G.p.status.poison = 10; log('독이 온몸에 퍼진다.', 'bad'); }
    else if (r < 0.85) { G.p.hp = Math.max(1, Math.floor(G.p.hp / 2)); log('생명력이 빨려나간다!', 'bad'); }
    else { if (G.p.weapon && G.p.weapon.plus > 0) { G.p.weapon.plus--; log('무기의 힘이 빠져나간다.', 'bad'); } else { G.p.atk = Math.max(1, G.p.atk - 1); log('힘이 빠져나간다.', 'bad'); } }
    SFX.play('bad'); shake(6);
  }
  updateHUD();
  finishPlayerTurn(1);
}

/* ---------------------------------------------------------------- shop */
function priceOf(it) {
  let base = 15;
  if (it.t === 'potion') base = 22;
  else if (it.t === 'scroll') base = 26;
  else if (it.t === 'wand') base = 48;
  else if (it.t === 'weapon') base = 30 + (it.dmg || 3) * 4;
  else if (it.t === 'armor') base = 28 + (it.def || 2) * 6;
  else if (it.t === 'ring') base = 62;
  else if (it.t === 'food') base = 10;
  else if (it.t === 'key') base = 18;
  else if (it.t === 'lockpick') base = 14;
  return Math.max(4, Math.round(base * rarityOf(it).price));
}
function genShopStock(shopKind) {
  const rng = G.rng;
  const stock = [];
  const add = (it, mul) => {
    if (!it) return;
    it.price = Math.max(3, Math.round(priceOf(it) * (mul || 1) * (0.85 + rng.r() * 0.3)));
    stock.push(it);
  };
  if (shopKind === 'smith') {
    add(dressGear({ t: 'weapon', kind: 'sword', name: '장검', dmg: 5, crit: 0.1, reach: 1, plus: 0, n: 1 }, rng, G.contractTier + 1, 0.18));
    add(dressGear({ t: 'weapon', kind: 'axe', name: '전투 도끼', dmg: 7, crit: 0.06, reach: 1, plus: 0, n: 1 }, rng, G.contractTier + 1, 0.18));
    add(dressGear({ t: 'armor', name: '판금 갑옷', def: 6, plus: 0, n: 1 }, rng, G.contractTier + 1, 0.18));
    add(dressGear({ t: 'weapon', kind: 'crossbow', name: '석궁', dmg: 6, crit: 0.08, range: 4, ranged: true, plus: 0, n: 1 }, rng, G.contractTier + 1, 0.18));
    add({ t: 'lockpick', n: 2 });
  } else if (shopKind === 'herbalist') {
    add({ t: 'potion', k: 'heal', n: 2 });
    add({ t: 'potion', k: 'mana', n: 1 });
    add({ t: 'potion', k: rng.pick(['fire', 'poison', 'frost', 'confuse']), n: 1 });
    add({ t: 'food', k: 'ration', n: 2 });
    add({ t: 'lockpick', n: 2 });
    add({ t: 'scroll', k: rng.pick(['identify', 'mapping', 'upgrade']), n: 1 });
  } else {
    add(randomItem(G.contractTier + 1, rng));
    add({ t: 'potion', k: 'heal', n: 1 });
    add({ t: 'food', k: 'ration', n: 1 });
    add({ t: 'wand', k: rng.pick(Object.keys(WANDS)), n: 1, charges: rng.int(3, 6) });
    add({ t: 'key', n: 1 });
    if (rng.chance(0.6)) add(dressGear({ t: 'weapon', kind: rng.pick(['spear', 'bow', 'dagger']), name: rng.pick(['창', '단궁', '단검']), dmg: 4, crit: 0.1, reach: 1, plus: 0, n: 1 }, rng, G.contractTier + 1, 0.15));
  }
  return stock;
}
function openShop(mon) {
  const kind = mon.shopKind || (mon.kind === 'goblinShop' ? 'goblin' : mon.kind === 'herbalist' ? 'herbalist' : mon.kind === 'smith' ? 'smith' : 'merchant');
  if (!mon.stock) mon.stock = genShopStock(kind);
  G.shop = { mon, tab: 'buy', title: mon.shopTitle || (kind === 'goblin' ? '고블린 상점' : kind === 'smith' ? '대장장이 오르반' : kind === 'herbalist' ? '약초상 니아' : '상인 켈'), kind };
  SFX.play('ui');
  showShop();
}
function buyItem(it) {
  if (!G.shop) return;
  if (G.p.gold < it.price) { log('금화가 부족하다.', 'bad'); SFX.play('bad'); return; }
  const copy = JSON.parse(JSON.stringify(it));
  if (!addToInv(copy)) { log('가방이 가득 찼다.', 'bad'); return; }
  G.p.gold -= it.price;
  G.shop.mon.stock = G.shop.mon.stock.filter(z => z !== it);
  log(`${J(itemName(it), 'eul')} ${it.price}금화에 샀다.`, 'gold');
  SFX.play('gold');
  codexItem(itemCodexId(it));
  updateHUD(); showShop();
}
function sellPrice(it) {
  return Math.max(3, Math.round(priceOf(it) * 0.45));
}
function sellItem(it) {
  const p = G.p;
  if (it === p.weapon || it === p.armor || it === p.ring || (p.slots || []).indexOf(it) >= 0) { log('장착 중인 장비는 팔 수 없다.', 'bad'); return; }
  const price = sellPrice(it);
  p.gold += price;
  consumeItem(it, 1);
  log(`${J(itemName(it), 'eul')} ${price}금화에 팔았다.`, 'gold');
  SFX.play('gold');
  updateHUD(); showShop();
}

/* ---------------------------------------------------------------- travel */
function portalHere() {
  const p = G.p;
  return G.m.t[p.y * W + p.x] === T.RETURN || G.m.t[p.y * W + p.x] === T.STAIRS;
}
function useStairs() {
  const p = G.p;
  const m = G.m;
  if (G.zone === 'field') {
    if (m.stairs && p.x === m.stairs.x && p.y === m.stairs.y) { G.pending = 'descend'; enterDungeon(1); }
    return;
  }
  if (G.zone === 'dungeon') {
    if (m.stairs && m.stairs.portal && p.x === m.stairs.x && p.y === m.stairs.y) { G.pending = 'portal'; finishPlayerTurn(1); return; }
    if (m.stairs && p.x === m.stairs.x && p.y === m.stairs.y) { G.pending = 'descend'; finishPlayerTurn(1); return; }
    if (m.upStairs && p.x === m.upStairs.x && p.y === m.upStairs.y) {
      if (G.floorNo <= 1) { G.pending = 'town'; finishPlayerTurn(1); }
      else { G.pending = 'ascend'; finishPlayerTurn(1); }
      return;
    }
  }
}

function scoreOf() {
  const p = G.p;
  let ident = 0;
  for (const k in G.ident.potion) if (G.ident.potion[k].known) ident++;
  for (const k in G.ident.scroll) if (G.ident.scroll[k].known) ident++;
  return Math.round(p.gold + G.completed * 420 + G.kills * 10 + p.lv * 50 + ident * 6 + (G.contract ? G.contract.diff * 60 : 0));
}
function recordRun() {
  const sc = scoreOf();
  const run = {
    d: new Date().toISOString().slice(0, 10),
    c: CLASSES[G.cls] ? CLASSES[G.cls].name : '?',
    depth: G.zone === 'dungeon' ? G.floorNo : 0,
    score: sc, seed: G.seedStr,
    res: G.state === 'win' ? '승리' : '사망', turns: G.turn, done: G.completed
  };
  DB.runs.unshift(run);
  DB.runs = DB.runs.slice(0, 12);
  if (sc > (DB.best || 0)) DB.best = sc;
  saveDB();
  return run;
}

/* ---------------------------------------------------------------- pathfinding & walking */
function pathTo(tx, ty) {
  let path = findPath(G.p.x, G.p.y, tx, ty);
  if (!path || !path.length) { log('그곳으로는 갈 수 없다.', ''); return; }
  const mi = path.findIndex(t => !!monAt(t.x, t.y));
  if (mi > 0 && !(path[mi].x === tx && path[mi].y === ty)) path = path.slice(0, mi);
  G.path = path;
  G.pathPreview = path;
  G.pathAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  G.walkStall = 0;
  G.pathGoal = { x: tx, y: ty };
  G.pathAggro = !!monAt(tx, ty);
  /* preview first, then step: 90ms gives the eye time to read the route */
  setTimeout(() => {
    if (G.path === path && G.state === 'play') walkNext();
  }, 90);
}
function walkNext() {
  if (!G.path || !G.path.length || G.state !== 'play') { G.path = null; G.pathPreview = null; return; }
  if (G.preventInput) { G.path = null; G.pathGoal = null; G.pathPreview = null; return; }
  const n = G.path.shift();
  const dx = n.x - G.p.x, dy = n.y - G.p.y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) { G.path = null; return; }
  const bx = G.p.x, by = G.p.y;
  G.walking = true;
  playerStep(dx, dy);
  G.walking = false;
  if (G.state !== 'play' || G.preventInput) { G.path = null; G.pathPreview = null; G.pathGoal = null; return; }
  if (G.path && G.path.length) {
    if (G.p.x === bx && G.p.y === by) {
      G.walkStall = (G.walkStall || 0) + 1;
      if (G.walkStall > 3 || !G.pathGoal) { G.path = null; G.pathGoal = null; G.pathPreview = null; G.walkStall = 0; return; }
      const np = findPath(G.p.x, G.p.y, G.pathGoal.x, G.pathGoal.y);
      if (np && np.length) {
        const mi = np.findIndex(t => !!monAt(t.x, t.y));
        G.path = (mi > 0 && !(np[mi].x === G.pathGoal.x && np[mi].y === G.pathGoal.y)) ? np.slice(0, mi) : np;
        G.pathPreview = G.path;
      } else { G.path = null; G.pathGoal = null; G.pathPreview = null; G.walkStall = 0; return; }
    } else G.walkStall = 0;
  }
  if (G.path && G.path.length) {
    setTimeout(walkNext, 58);
  } else {
    G.path = null; G.pathGoal = null; G.pathPreview = null;
  }
}
