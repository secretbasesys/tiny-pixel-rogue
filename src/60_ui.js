/* =====================================================================
   UI · INPUT · SCREENS  (v4 direct-touch controls, zoom, compact dock)
   ===================================================================== */
const SCREENS = ['titleScreen', 'helpScreen', 'invScreen', 'shopScreen', 'deadScreen', 'codexScreen',
  'logScreen', 'perkScreen', 'contractScreen', 'stashScreen'];
function showScreen(id) {
  for (const s of SCREENS) {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  }
  setGameUI(id === null);
}
function hideScreens() {
  for (const s of SCREENS) { const el = document.getElementById(s); if (el) el.classList.add('hidden'); }
  setGameUI(true);
}
function setGameUI(on) {
  for (const id of ['hud', 'log', 'dock']) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = on ? 'visible' : 'hidden';
  }
  const dp = document.getElementById('dpad');
  if (dp) dp.classList.toggle('on', on && !!G.dpad);
  const mw = document.getElementById('mapWrap');
  if (mw) mw.classList.toggle('on', on && !!G.mapOn);
  const cb = document.getElementById('ctxBtn');
  if (cb && !on) cb.classList.remove('on');
}

let toastTimer = null;
function toast(txt) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = txt;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 1600);
}
function makeSeed() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ---------------------------------------------------------------- title */
let titleCls = 'warrior';
function renderTitle() {
  const cards = $('#classCards');
  cards.innerHTML = '';
  for (const k of ['warrior', 'rogue', 'mage']) {
    const c = CLASSES[k];
    const d = document.createElement('div');
    d.className = 'cc' + (titleCls === k ? ' sel' : '');
    const preview = document.createElement('canvas');
    preview.width = 16; preview.height = 16;
    preview.getContext('2d').drawImage(SP.ch[k], 0, 0);
    d.appendChild(preview);
    const box = document.createElement('div');
    box.style.flex = '1';
    box.innerHTML = `<div class="n">${c.name}</div><div class="d">${c.desc}</div><div class="st">${c.stats}</div>`;
    d.appendChild(box);
    d.onclick = () => { titleCls = k; SFX.play('ui'); renderTitle(); };
    cards.appendChild(d);
  }
  const best = DB.best || 0;
  $('#bestLine').textContent = best ? `최고 기록 ${best.toLocaleString()}점 · ${DB.runs.length}회 도전` : '아직 기록이 없습니다';
  if (!$('#seedInput').value) $('#seedInput').value = DB.lastSeed || makeSeed();
}
function startFromTitle() {
  SFX.unlock();
  let s = ($('#seedInput').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length < 3) s = makeSeed();
  $('#seedInput').value = s;
  hideScreens();
  G.zoom = DB.ui.zoom || 1;
  G.dpad = !!DB.ui.dpad;
  G.mapOn = DB.ui.map !== false;
  newRun(titleCls, s);
  camSnap = true;
  resize();
  SFX.play('stairs');
  updateHUD();
  draw();
}

/* ---------------------------------------------------------------- zoom / dpad */
function toggleZoom() {
  const order = [0.75, 1, 1.5, 2];
  const i = order.indexOf(zoomLevel());
  G.zoom = order[(i + 1) % order.length];
  DB.ui.zoom = G.zoom; saveDB();
  camSnap = true;
  resize();
  toast(`🔍 ${G.zoom}x`);
  SFX.play('ui');
}
function setZoom(z) {
  G.zoom = z; DB.ui.zoom = z; saveDB();
  camSnap = true; resize(); updateHUD();
}
function toggleDpad() {
  G.dpad = !G.dpad;
  DB.ui.dpad = G.dpad; saveDB();
  const dp = $('#dpad');
  if (dp) dp.classList.toggle('on', G.dpad && G.state === 'play');
  toast(G.dpad ? '✛ D-pad 켜짐' : '✛ D-pad 꺼짐');
  SFX.play('ui');
  updateHUD();
}

/* ---------------------------------------------------------------- inventory */
function openInv() {
  if (G.state !== 'play') return;
  G.invSel = null;
  renderInv();
  showScreen('invScreen');
}
function closeInv() {
  const el = document.getElementById('invScreen');
  if (el) el.classList.add('hidden');
  G.invSel = null;
  if (G.state === 'play') setGameUI(true);
}
function gearStats(it) {
  if (!it) return [];
  if (it.t === 'weapon') return [
    { label: '공격', v: it.dmg + (it.plus || 0) },
    { label: '치명', v: Math.round((it.crit || 0) * 100), u: '%' }
  ];
  if (it.t === 'armor') return [{ label: '방어', v: it.def + (it.plus || 0) }];
  return [];
}
function cmpRows(it) {
  const p = G.p;
  const slot = it.t === 'weapon' ? null : it.t === 'armor' ? 'armor' : it.t === 'ring' ? 'ring' : undefined;
  let cur;
  if (it.t === 'weapon') cur = p.weapon;
  else if (slot) cur = p[slot];
  else return '';
  if (!cur || cur === it) return '<span style="color:#7f8778">현재 장착 중</span>';
  const a = gearStats(cur), b = gearStats(it), out = [];
  for (let i = 0; i < b.length; i++) {
    const av = a[i] ? a[i].v : 0, bv = b[i].v, d = bv - av;
    const u = b[i].u || '';
    out.push(`${b[i].label} ${av}${u} → <b>${bv}${u}</b> <span class="dlt ${d >= 0 ? 'up' : 'down'}">(${d >= 0 ? '+' : ''}${d}${u})</span>`);
  }
  const na = affixList(cur).length, nb = affixList(it).length;
  if (nb !== na) out.push(`마법 부여 ${na} → <b>${nb}</b>`);
  if (it.rarity && cur.rarity && it.rarity !== cur.rarity) {
    out.push(`등급 <span class="rar-${cur.rarity}">${rarityOf(cur).name}</span> → <span class="rar-${it.rarity}">${rarityOf(it).name}</span>`);
  }
  return out.join('<br>');
}
function renderGearPanel() {
  const box = $('#gearPanel');
  if (!box) return;
  const p = G.p;
  const slot = (label, it, valTxt, active) => {
    const R = rarityOf(it || {});
    return `<div class="gslot" ${active ? 'style="border-color:rgba(233,194,92,.5)"' : ''}><div class="gl">${label}</div>` +
      `<div class="gn ${it ? 'rar-' + R.id : ''}">${it ? itemName(it) : '없음'}</div>` +
      `<div class="gv">${valTxt || ''}</div></div>`;
  };
  const wA = p.slots[0], wB = p.slots[1];
  box.innerHTML =
    slot('주무기 A', wA, wA ? `공격 +${wA.dmg + (wA.plus || 0)}` : '맨손', p.slotIdx === 0) +
    slot('보조 B', wB, wB ? `공격 +${wB.dmg + (wB.plus || 0)}` : '없음', p.slotIdx === 1) +
    slot('방어구', p.armor, p.armor ? `방어 +${p.armor.def + (p.armor.plus || 0)}` : '맨몸') +
    slot('반지', p.ring, p.ring ? (RINGS[p.ring.k] ? RINGS[p.ring.k].name : '반지') : '없음');
}
function renderInv() {
  if (!G.p) return;
  const p = G.p;
  const list = $('#invList');
  list.innerHTML = '';
  $('#invSub').textContent = `${p.inv.length} / ${ITEM_CAP} · ◈ ${p.gold} · MP ${Math.floor(p.mp)}/${p.maxmp}`;
  renderGearPanel();
  const mkRow = (it, equipped) => {
    const R = rarityOf(it);
    const row = document.createElement('div');
    row.className = 'li rar-' + R.id + (equipped ? ' eq' : '');
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    c.getContext('2d').drawImage(itemSprite(it), 0, 0);
    row.appendChild(c);
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.innerHTML = `<span class="rar-${R.id}">${itemName(it)}</span>` +
      (it.n > 1 ? ` <span style="color:#9a9382">×${it.n}</span>` : '') +
      `<div class="sb">${equipped ? '장착 중 · ' : ''}${itemDesc(it)}</div>`;
    row.appendChild(nm);
    row.onclick = () => { G.invSel = it; SFX.play('ui'); renderInv(); renderItemSheet(it, equipped); };
    return row;
  };
  if (p.slots[0]) list.appendChild(mkRow(p.slots[0], true));
  if (p.slots[1]) list.appendChild(mkRow(p.slots[1], p.slotIdx === 1));
  if (p.armor) list.appendChild(mkRow(p.armor, true));
  if (p.ring) list.appendChild(mkRow(p.ring, true));
  for (const it of p.inv) list.appendChild(mkRow(it, false));
  if (!p.inv.length) {
    const e = document.createElement('div');
    e.className = 'hint'; e.textContent = '가방이 비어 있다.';
    list.appendChild(e);
  }
  const first = p.inv[0] || p.weapon;
  if (first) { G.invSel = first; renderItemSheet(first, first === p.weapon || first === p.armor || first === p.ring); }
  else $('#itemSheet').style.display = 'none';
}
function renderItemSheet(it, equipped) {
  const sheet = $('#itemSheet');
  sheet.style.display = '';
  const c = $('#sheetIcon'); c.width = 16; c.height = 16;
  c.getContext('2d').clearRect(0, 0, 16, 16);
  c.getContext('2d').drawImage(itemSprite(it), 0, 0);
  const R = rarityOf(it);
  $('#sheetName').innerHTML = `<span class="rar-${R.id}">${itemName(it)}</span><span class="rtag rar-${R.id}">${R.name}</span>` +
    (equipped ? ' <span style="font-size:10px;color:#9a9382">장착 중</span>' : '');
  $('#sheetDesc').textContent = itemDesc(it);
  const aff = affixList(it);
  const cmp = cmpRows(it);
  $('#sheetCmp').innerHTML =
    (aff.length ? '<div class="affixrow">' + aff.map(a => `<span style="color:${AFFIXES[a].color}">${AFFIXES[a].name}</span>`).join('') + '</div>' : '') +
    (cmp ? `<div style="margin-top:5px">${cmp}</div>` : '');
  const acts = $('#sheetActs');
  acts.innerHTML = '';
  const addBtn = (txt, cls, fn) => {
    const b = document.createElement('button');
    b.textContent = txt; if (cls) b.className = cls;
    b.onclick = (e) => { e.stopPropagation(); fn(); };
    acts.appendChild(b);
  };
  const beltIdx = beltSlots().findIndex(d => d && d.t === it.t && (d.k || null) === (it.k || null));
  const canBelt = ['potion', 'scroll', 'wand', 'food', 'lockpick'].indexOf(it.t) >= 0;
  if (equipped) {
    addBtn('해제', '', () => {
      if (it === G.p.weapon) {
        const idx = G.p.slotIdx;
        G.p.slots[idx] = null;
        G.p.weapon = G.p.slots[1 - idx] || null;
        if (G.p.weapon) { G.p.slotIdx = 1 - idx; }
      }
      if (it === G.p.armor) G.p.armor = null;
      if (it === G.p.ring) G.p.ring = null;
      addToInv(it); recalcStats(); log('장비를 해제했다.', ''); SFX.play('ui');
      computeFOV(); updateHUD(); renderInv(); finishPlayerTurn(0);
    });
  } else if (it.t === 'potion') {
    addBtn('마시기', '', () => { closeInv(); drinkPotion(it); });
    addBtn('던지기', '', () => { beginThrow(it); });
  } else if (it.t === 'scroll') {
    addBtn('읽기', '', () => { closeInv(); readScroll(it); });
  } else if (it.t === 'wand') {
    addBtn(it.charges > 0 ? `발사 (${it.charges})` : '방전됨', '', () => { if (it.charges > 0) beginWandTarget(it); else log('충전이 없다.', 'bad'); });
  } else if (it.t === 'food') {
    addBtn('먹기', '', () => { closeInv(); eatFood(it); });
  } else if (it.t === 'weapon') {
    addBtn('주무기 A에 장착', '', () => { closeInv(); equipWeaponAt(it, 0); });
    addBtn('보조 B에 장착', '', () => { closeInv(); equipWeaponAt(it, 1); });
  } else if (it.t === 'armor' || it.t === 'ring') {
    addBtn('장착', '', () => { closeInv(); equipItem(it); });
  } else if (it.t === 'key') {
    addBtn('정보', '', () => log('열쇠는 잠긴 철문 앞에서 자동으로 쓰인다.', ''));
  } else if (it.t === 'lockpick') {
    addBtn('정보', '', () => log('잠긴 문·상자 앞에서 오른쪽 버튼으로 사용한다.', ''));
  }
  if (canBelt) {
    if (beltIdx >= 0) addBtn(`퀵슬롯 ${beltIdx + 1} 해제`, '', () => { beltClearAt(beltIdx); toast('퀵슬롯에서 뺐다.'); renderItemSheet(it, equipped); });
    else addBtn('퀵슬롯 등록', '', () => {
      const i = beltAssign(it, true);
      SFX.play('ui');
      renderQuickbelt();
      toast(i >= 0 ? `퀵슬롯 ${i + 1}에 등록` : '퀵슬롯이 가득 찼다');
      renderItemSheet(it, equipped);
    });
  }
  if (!equipped) addBtn('버리기', 'danger', () => { dropItem(it); });
}
function equipWeaponAt(it, idx) {
  const p = G.p;
  const old = p.slots[idx];
  p.slots[idx] = it;
  consumeItem(it);
  if (old) addToInv(old);
  if (idx === p.slotIdx) p.weapon = it;
  log(`${J(itemName(it), 'eul')} ${idx === 0 ? '주무기' : '보조무기'}에 넣었다.`, 'good');
  recalcStats(); computeFOV(); SFX.play('pick'); updateHUD();
  afterItemUse();
}
function dropItem(it) {
  if (!it) return;
  const p = G.p;
  if (it === p.weapon || it === p.armor || it === p.ring || (p.slots || []).indexOf(it) >= 0) return;
  const copy = JSON.parse(JSON.stringify(it));
  copy.x = p.x; copy.y = p.y;
  if (!copy.n) copy.n = 1;
  G.m.items.push(copy);
  log(`${J(itemName(it), 'eul')} 내려놓았다.`, '');
  consumeItem(it, it.n || 1);
  SFX.play('ui');
  renderInv(); updateHUD();
}

/* ---------------------------------------------------------------- targeting */
function showTargetBar(txt) {
  const el = $('#targetTxt');
  el.dataset.base = txt || '대상을 선택하세요';
  el.textContent = el.dataset.base;
  $('#targetBar').style.display = 'flex';
  draw();
}
function hideTargetBar() {
  $('#targetBar').style.display = 'none';
  G.target = null;
  draw();
}
function tileNameAt(x, y) {
  const n = {
    [T.WALL]: '벽', [T.PILLAR]: '돌기둥', [T.COVER]: '반엄폐물', [T.DOOR]: '문', [T.LOCKED]: '잠긴 문',
    [T.SECRET]: '벽', [T.CHASM]: '구덩이', [T.WATER]: '물', [T.ICE]: '얼음', [T.TREE]: '나무', [T.BRICK]: '성벽'
  };
  return n[tileAt(x, y)] || '장애물';
}
function updateTargetPreview(tx, ty) {
  if (!G.target) return;
  const el = $('#targetTxt');
  if (!el) return;
  const base = el.dataset.base || '대상 선택';
  if (!inb(tx, ty)) { el.textContent = base; return; }
  const p = G.p;
  const mon = monAt(tx, ty);
  const rc = raycast(p.x, p.y, tx, ty);
  const d = dist(p.x, p.y, tx, ty);
  const range = G.target.mode === 'wand' ? WANDS[G.target.item.k].range
    : G.target.mode === 'skill' ? G.target.skill.range : 6;
  let s;
  if (d === 0) s = '현재 위치';
  else if (d > range) s = `사거리 초과 ${d}/${range}`;
  else if (!rc.clear) s = `가로막힘 · ${rc.block ? tileNameAt(rc.block.x, rc.block.y) : '장애물'}`;
  else if (mon) s = `명중 · ${monName(mon)} HP ${Math.max(0, mon.hp)}`;
  else s = '사선 확보';
  el.textContent = `${base} · ${s}`;
}
function confirmTarget(x, y) {
  if (!G.target) return;
  const t = G.target;
  let ok = false;
  if (t.mode === 'throw') ok = resolveThrow(t.item, x, y);
  else if (t.mode === 'wand') ok = fireWand(t.item, x, y);
  else if (t.mode === 'skill') {
    ok = castSkill(t.id, x, y);
    if (!ok) { updateTargetPreview(x, y); return; }
  }
  hideTargetBar();
  if (ok) { G.path = null; G.pathPreview = null; }
}

/* ---------------------------------------------------------------- dock */
function updateSkillBar() {
  if (!G.p) return;
  const list = skillsOf(G.p.cls);
  const btns = [document.getElementById('btnSkill1'), document.getElementById('btnSkill2')];
  for (let i = 0; i < 2; i++) {
    const b = btns[i], s = list[i];
    if (!b) continue;
    if (!s) { b.style.display = 'none'; continue; }
    b.style.display = '';
    b.dataset.skill = s.id;
    const icon = b.querySelector('span');
    const lab = b.querySelector('.lab');
    const cd = b.querySelector('.cdn');
    const mpc = b.querySelector('.mpc');
    if (icon) icon.textContent = s.icon;
    if (lab) lab.textContent = s.name;
    const left = skillCdLeft(s.id);
    if (cd) cd.textContent = left > 0 ? left : '';
    const cost = s.mp || 0;
    if (mpc) mpc.textContent = cost ? cost : '';
    const noMana = G.p.mp < cost;
    b.classList.toggle('cool', left > 0 || noMana);
    b.classList.toggle('nomana', noMana);
  }
}
function useSkillSlot(i) {
  if (G.state !== 'play') return;
  const s = skillsOf(G.p.cls)[i];
  if (!s) return;
  if (G.target) hideTargetBar();
  beginSkill(s.id);
}
function updateSwapButton() {
  const b = $('#btnSwap');
  if (!b || !G.p) return;
  const a = G.p.slots[0], s = G.p.slots[1];
  const sa = b.querySelector('.sa'), lab = b.querySelector('.lab'), sb = b.querySelector('.sb2');
  if (sa) sa.textContent = G.p.slotIdx === 0 ? 'A' : 'B';
  if (lab) lab.textContent = G.p.weapon ? (G.p.weapon.name + (G.p.weapon.plus ? '+' + G.p.weapon.plus : '')) : '맨손';
  if (sb) sb.textContent = s ? ((G.p.slotIdx === 0 ? 'B ' : 'A ') + (G.p.slotIdx === 0 ? s.name : (a ? a.name : '없음'))) : '보조 없음';
}

/* ---------------------------------------------------------------- tile taps */
function handleTileTap(x, y) {
  if (G.state !== 'play') return;
  if (G.preventInput) return;
  if (!inb(x, y)) return;
  const p = G.p;
  if (!G.m.seen[y * W + x]) return;

  if (G.target) { confirmTarget(x, y); return; }
  if (x === p.x && y === p.y) { inspect(p.x, p.y); return; }

  const mon = monAt(x, y);
  if (mon && G.m.vis[y * W + x] && !mon.shop) {
    const d = dist(p.x, p.y, mon.x, mon.y);
    if (d <= 1 || (isRangedWeapon(p.weapon) && d <= weaponRange(p.weapon) && raycast(p.x, p.y, mon.x, mon.y).clear)) {
      attackMonster(mon); return;
    }
    pathTo(mon.x, mon.y); return;
  }
  if (mon && mon.shop && G.m.vis[y * W + x]) {
    if (dist(p.x, p.y, mon.x, mon.y) <= 1) { openShop(mon); return; }
    pathTo(mon.x, mon.y); return;
  }
  const npc = npcAt(x, y);
  if (npc && G.m.vis[y * W + x]) {
    if (dist(p.x, p.y, x, y) <= 1) { talkToNpc(npc); return; }
    pathTo(x, y); return;
  }
  /* stairs / portal / gate / locked iron gates */
  const t = G.m.t[y * W + x];
  if (t === T.LOCKED) {
    if (dist(p.x, p.y, x, y) <= 1) { askLockedDoor(x, y); return; }
    for (const d of DIR8) {
      const nx = x + d[0], ny = y + d[1];
      if (inb(nx, ny) && walkableForPath(nx, ny, { canOpen: false }) && G.m.seen[ny * W + nx]) { pathTo(nx, ny); return; }
    }
    log('잠긴 문까지 갈 길이 없다.', 'bad');
    return;
  }
  if (t === T.STAIRS || t === T.RETURN || t === T.GATE) {
    if (dist(p.x, p.y, x, y) <= 1) {
      if (t === T.GATE) { askGate(); return; }
      useStairsAt(x, y); return;
    }
    pathTo(x, y); return;
  }
  const obj = objAt(x, y);
  if (obj && BLOCKING_OBJ[obj.kind] !== false) {
    if (dist(p.x, p.y, x, y) <= 1) { interactObj(obj); return; }
    pathTo(x, y); return;
  }
  pathTo(x, y);
}
function useStairsAt(x, y) {
  const m = G.m;
  if (G.zone === 'field' && m.stairs && x === m.stairs.x && y === m.stairs.y) {
    if (!G.contract) { log('의뢰 없이 던전에 들어갈 수 없다.', 'bad'); return; }
    enterDungeon(1);
    return;
  }
  if (G.zone === 'dungeon') {
    if (m.stairs && m.stairs.portal && x === m.stairs.x && y === m.stairs.y) {
      log('귀환의 문으로 들어간다.', 'good');
      if (G.contract && G.contract.state === 'active') contractDone();
      returnToTown(true);
      return;
    }
    if (m.stairs && x === m.stairs.x && y === m.stairs.y) { descendDungeon(); return; }
    if (m.upStairs && x === m.upStairs.x && y === m.upStairs.y) { ascendDungeon(); return; }
  }
}

/* ---------------------------------------------------------------- inspect */
let infoTimer = null;
function inspect(x, y) {
  const el = $('#info');
  const p = G.p, m = G.m;
  if (!inb(x, y)) return;
  const mon = monAt(x, y);
  if (mon && m.vis[y * W + x]) {
    let intent = '';
    const dd = dist(p.x, p.y, mon.x, mon.y);
    const stt = monStateOf(mon);
    if (mon.shop) intent = '거래 중';
    else if (mon.tele) intent = `${TELE_KINDS[mon.tele.kind].name} 예고 중!`;
    else if (mon.status.stun > 0) intent = '기절 상태';
    else if (mon.ai === 'ranged' && dd <= (mon.range || 5) && mon.cd <= 0) intent = '사격을 준비 중';
    else if (dd === 1) intent = '공격할 태세';
    else if (stt === 'chase') intent = '쫓아오는 중';
    else if (stt === 'alert') intent = '경계하며 살피는 중';
    else intent = '잠들어 있다';
    const st = Object.keys(mon.status).filter(k => mon.status[k] > 0).map(k => STATUS_NAME[k] || k).join(' · ');
    const awName = stt === 'sleep' ? '수면' : stt === 'alert' ? '경계' : '추적';
    el.innerHTML = `<b>${monName(mon)}</b>${mon.boss ? ' <span style="color:#ffb066">BOSS</span>' : ''}${mon.elite ? ' <span style="color:#e9c25c">ELITE</span>' : ''}<br>` +
      `<span style="color:#cfc7b4">HP ${Math.max(0, mon.hp)}/${mon.maxhp} · 공격 ${mon.atk} · ${awName} · ${intent}</span>` +
      (mon.tele ? `<br><span style="color:#ff9a8a">${mon.tele.tiles.length}칸에 공격 예고 — 이번 턴에 벗어나라</span>` : '') +
      (st ? `<br><span style="color:#9fe0ff">${st}</span>` : '') +
      `<div class="hpbar"><i style="width:${clamp(mon.hp / mon.maxhp, 0, 1) * 100}%"></i></div>`;
    el.style.display = 'block';
  } else if (x === p.x && y === p.y) {
    const w = p.weapon ? `${itemName(p.weapon)}` : '맨손';
    const art = p.weapon && WEAPON_ART[p.weapon.kind] ? WEAPON_ART[p.weapon.kind] : null;
    const a = p.armor ? `${itemName(p.armor)}` : '없음';
    const r = p.ring ? RINGS[p.ring.k].name : '없음';
    el.innerHTML = `<b>${p.name} Lv.${p.lv}</b><br><span style="color:#cfc7b4">HP ${Math.ceil(p.hp)}/${p.maxhp} · 공격 ${attackPower()} · 방어 ${playerDef()}</span><br>` +
      `<span style="color:#9a9382">A ${w}${p.slots[1] ? ' / B ' + itemName(p.slots[1]) : ''} · ${a} · 반지 ${r}</span>` +
      (art ? `<br><span style="color:#8fa8c8">${art.name} — ${art.desc}</span>` : '');
    el.style.display = 'block';
  } else {
    const npc = npcAt(x, y);
    const t = m.t[y * W + x];
    const names = {
      [T.FLOOR]: '돌바닥', [T.WALL]: '벽', [T.WATER]: '물', [T.GRASS]: '풀숲', [T.OIL]: '기름', [T.CHASM]: '구덩이',
      [T.STAIRS]: '계단', [T.DOOR]: '문', [T.LOCKED]: '잠긴 문', [T.SECRET]: '벽', [T.ICE]: '얼음', [T.RUBBLE]: '잔해',
      [T.PILLAR]: '돌기둥', [T.COVER]: '반엄폐물', [T.ROAD]: '자갈길', [T.DIRT]: '흙길', [T.WOOD]: '마루',
      [T.TREE]: '나무', [T.BUSH]: '덤불', [T.FENCE]: '울타리', [T.BRICK]: '성벽', [T.BOOKSHELF]: '책장',
      [T.WELL]: '우물', [T.STATUE]: '석상', [T.TENT]: '천막', [T.RETURN]: '귀환의 문', [T.BLOOD]: '핏자국',
      [T.GATE]: '마을 문', [T.CARPET]: '융단', [T.PLAIN]: '바닥', [T.MUD]: '진흙', [T.MOSS]: '이끼'
    };
    const it = itemAt(x, y);
    let txt = npc ? `<b>${npc.name}</b><br><span style="color:#cfe0ff">${npc.line || ''}</span>` : `<b>${names[t] || '바닥'}</b>`;
    if (t === T.PILLAR) txt += `<br><span style="color:#8fa8c8">시야·이동·투사체를 모두 막는다</span>`;
    if (t === T.COVER) txt += `<br><span style="color:#8fa8c8">이동과 투사체를 막지만 시야는 통해 뒤에서 쏠 수 있다</span>`;
    if (t === T.GRASS || t === T.BUSH) txt += `<br><span style="color:#8fd18a">은신 · 적의 발각 거리 감소</span>`;
    if (t === T.STAIRS) txt += `<br><span style="color:#ffd98a">${G.zone === 'field' ? '던전으로 들어가는 입구' : '아래층으로'}</span>`;
    if (t === T.RETURN) txt += `<br><span style="color:#c9a0ff">마을로 돌아가는 문</span>`;
    if (it) txt += `<br><span style="color:#ffe1a0">${itemName(it)}</span>`;
    if (m.fire[y * W + x] > 0) txt += `<br><span style="color:#ff9a3c">불타고 있다</span>`;
    if (m.gas[y * W + x] > 0) txt += `<br><span style="color:#9fe08a">독구름</span>`;
    el.innerHTML = txt;
    el.style.display = 'block';
  }
  clearTimeout(infoTimer);
  infoTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
}

/* ---------------------------------------------------------------- shop UI */
function showShop() {
  if (!G.shop) return;
  renderShop();
  showScreen('shopScreen');
}
function renderShop() {
  const shop = G.shop;
  if (!shop) return;
  $('#shopGold').textContent = G.p.gold;
  $('#shopTitle').textContent = shop.title || '상인';
  const hint = $('#shopHint');
  if (hint) {
    hint.textContent = shop.kind === 'goblin' ? '고블린은 바가지를 씌웁니다.' :
      shop.kind === 'smith' ? '강화는 대화 메뉴에서, 물건은 여기서 사고팔 수 있습니다.' :
        shop.kind === 'herbalist' ? '약초상은 물약·식량·자물쇠 따개를 넉넉히 갖고 있습니다.' : '값을 잘 보세요.';
  }
  $$('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === shop.tab));
  const list = $('#shopList');
  list.innerHTML = '';
  if (shop.tab === 'buy') {
    if (!shop.mon.stock || !shop.mon.stock.length) {
      const e = document.createElement('div'); e.className = 'hint'; e.textContent = '다 팔렸다.'; list.appendChild(e);
    }
    for (const it of (shop.mon.stock || [])) {
      const R = rarityOf(it);
      const row = document.createElement('div');
      row.className = 'li rar-' + R.id + (G.p.gold < it.price ? ' dis' : '');
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.getContext('2d').drawImage(itemSprite(it), 0, 0);
      row.appendChild(c);
      const nm = document.createElement('div'); nm.className = 'nm';
      const cmp = cmpRows(it).replace(/<br>/g, ' · ');
      nm.innerHTML = `<span class="rar-${R.id}">${itemName(it)}</span><span class="rtag rar-${R.id}">${R.name}</span>` +
        `<div class="sb">${itemDesc(it)}</div>` + (cmp ? `<div class="sb" style="color:#8fa8c8">${cmp}</div>` : '');
      row.appendChild(nm);
      const val = document.createElement('div'); val.className = 'val'; val.textContent = '◈' + it.price;
      row.appendChild(val);
      row.onclick = () => buyItem(it);
      list.appendChild(row);
    }
  } else {
    const tradables = G.p.inv.filter(it => it !== G.p.weapon && it !== G.p.armor && it !== G.p.ring && (G.p.slots || []).indexOf(it) < 0);
    if (!tradables.length) {
      const e = document.createElement('div'); e.className = 'hint'; e.textContent = '팔 것이 없다.'; list.appendChild(e);
    }
    for (const it of tradables) {
      const R = rarityOf(it);
      const row = document.createElement('div');
      row.className = 'li rar-' + R.id;
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.getContext('2d').drawImage(itemSprite(it), 0, 0);
      row.appendChild(c);
      const nm = document.createElement('div'); nm.className = 'nm';
      nm.innerHTML = `<span class="rar-${R.id}">${itemName(it)}</span>` +
        (it.n > 1 ? ` ×${it.n}` : '') + `<div class="sb">${itemDesc(it)}</div>`;
      row.appendChild(nm);
      const val = document.createElement('div'); val.className = 'val'; val.textContent = '◈' + sellPrice(it);
      row.appendChild(val);
      row.onclick = () => sellItem(it);
      list.appendChild(row);
    }
  }
}

/* ---------------------------------------------------------------- choice modal */
function showChoice(title, desc, options) {
  const old = document.getElementById('choiceScreen');
  if (old) old.remove();
  const scr = document.createElement('div');
  scr.className = 'screen';
  scr.id = 'choiceScreen';
  scr.innerHTML = `<div class="wrap" style="max-width:420px">
    <div class="hrow"><h2>${title}</h2></div>
    <div class="panel helptxt">${desc}</div>
    <div class="actgrid" id="choiceActs" style="grid-template-columns:1fr"></div>
  </div>`;
  document.getElementById('app').appendChild(scr);
  G.preventInput = true;
  const close = () => { scr.remove(); G.preventInput = false; };
  const box = scr.querySelector('#choiceActs');
  for (const o of options) {
    const b = document.createElement('button');
    b.textContent = o.txt;
    if (o.cls) b.className = o.cls;
    b.onclick = () => { close(); SFX.play('ui'); o.fn(); updateHUD(); renderAll(); };
    box.appendChild(b);
  }
  scr.addEventListener('click', e => { if (e.target === scr) close(); });
}

/* ---------------------------------------------------------------- death / win */
let deathShown = false;
function showDeath() {
  if (deathShown) return;
  deathShown = true;
  G.target = null; G.path = null; G.pathPreview = null;
  const tb = document.getElementById('targetBar'); if (tb) tb.style.display = 'none';
  const run = recordRun();
  const win = G.state === 'win';
  $('#deadIcon').textContent = win ? '👑' : '💀';
  const t = $('#deadTitle');
  t.textContent = win ? '귀환' : '당신은 죽었다';
  t.className = (win ? 'death win' : 'death');
  const p = G.p;
  const depthTxt = G.zone === 'dungeon' ? `${G.floorNo}층` : G.zone === 'field' ? '들판' : '마을';
  $('#deadStats').innerHTML = `
    <div><b>${run.score.toLocaleString()}</b><i>점수</i></div>
    <div><b>${depthTxt}</b><i>도달</i></div>
    <div><b>${G.completed}</b><i>의뢰</i></div>
    <div><b>Lv.${p.lv}</b><i>레벨</i></div>`;
  const cause = win ? '모든 의뢰를 마치고 귀환했다.' : `${G.deadCause || '알 수 없는 힘'}에 쓰러졌다.`;
  $('#deadInfo').innerHTML = `${cause}<br>시드 <b style="color:#e9c25c">${G.seedStr}</b> · ${G.turn}턴 · ◈${p.gold} · 처치 ${G.kills}<br>` +
    `<span style="color:#8d8577">최고 기록 ${(DB.best || 0).toLocaleString()}점</span>`;
  showScreen('deadScreen');
  updateHUD();
}

/* ---------------------------------------------------------------- codex */
function renderCodex() {
  const mon = $('#codexMon');
  mon.innerHTML = '';
  for (const k in MONS) {
    const seen = DB.codexM[k] || 0;
    const d = document.createElement('div');
    d.className = 'cx' + (seen ? '' : ' dim');
    d.innerHTML = `<b>${seen ? MONS[k].name : '???'}</b><span>${seen ? MONS[k].desc + ' ×' + seen : '아직 만나지 못함'}</span>`;
    mon.appendChild(d);
  }
  const items = $('#codexItem');
  items.innerHTML = '';
  const add = (label, known) => {
    const d = document.createElement('div');
    d.className = 'cx' + (known ? '' : ' dim');
    d.innerHTML = `<b>${known || label}</b>`;
    items.appendChild(d);
  };
  for (const po of POTIONS) add(po.name, DB.codexI['potion:' + po.k]);
  for (const sc of SCROLLS) add(sc.name, DB.codexI['scroll:' + sc.k]);
  for (const k in RINGS) add(RINGS[k].name, DB.codexI['ring:' + k]);
  for (const k in WANDS) add(WANDS[k].name, DB.codexI['wand:' + k]);
  add('금화', 1); add('철문 열쇠', 1); add('자물쇠 따개', 1);
  const runs = $('#runList');
  runs.innerHTML = '';
  if (!DB.runs.length) runs.innerHTML = '<div class="r"><span>기록 없음</span></div>';
  for (const r of DB.runs.slice(0, 6)) {
    const d = document.createElement('div');
    d.className = 'r';
    d.innerHTML = `<span>${r.d} · ${r.c} · ${r.depth ? 'B' + r.depth + 'F' : '마을'} · 의뢰 ${r.done || 0}</span><b>${r.score.toLocaleString()}</b>`;
    runs.appendChild(d);
  }
  $('#codexSub').textContent = `최고 ${(DB.best || 0).toLocaleString()}점`;
  showScreen('codexScreen');
}

/* ---------------------------------------------------------------- menu */
function openMenu() {
  showChoice('메뉴', `${G.zone === 'town' ? '마을' : G.zone === 'field' ? '들판' : G.floorNo + '층'} · ${G.turn}턴 · ◈${G.p.gold} · MP ${Math.floor(G.p.mp)}/${G.p.maxmp}` +
    `<br><span style="color:#8d8577">의뢰 ${G.completed}건 완수 · 특성: ${Object.keys(G.p.perks || {}).map(k => PERKS[k] ? PERKS[k].name : k).join(', ') || '없음'}</span>`, [
    { txt: '계속하기', cls: 'flat', fn: () => { } },
    { txt: `확대 ${zoomLevel()}x → ${[0.75, 1, 1.5, 2][([0.75, 1, 1.5, 2].indexOf(zoomLevel()) + 1) % 4]}x`, cls: 'flat', fn: () => { toggleZoom(); } },
    { txt: G.dpad ? 'D-pad 끄기' : 'D-pad 켜기', cls: 'flat', fn: () => { toggleDpad(); } },
    { txt: '조작법 보기', cls: 'flat', fn: () => { showScreen('helpScreen'); } },
    { txt: G.mapOn ? '미니맵 끄기' : '미니맵 켜기', cls: 'flat', fn: () => { toggleMap(); } },
    { txt: '기록 보기', cls: 'flat', fn: () => { openLog(); } },
    { txt: SFX.enabled ? '소리 끄기' : '소리 켜기', cls: 'flat', fn: () => { toggleMute(); } },
    { txt: '타이틀로 (기록 저장)', cls: 'danger', fn: () => { recordRun(); G.state = 'title'; hideScreens(); renderTitle(); showScreen('titleScreen'); updateHUD(); } }
  ]);
}
function toggleMute() {
  SFX.setEnabled(!SFX.enabled);
  DB.muted = !SFX.enabled; saveDB();
  $('#muteBtn').classList.toggle('off', !SFX.enabled);
  $('#btnMute2').textContent = SFX.enabled ? '소리 켜짐' : '소리 꺼짐';
  if (SFX.enabled) SFX.play('ui');
}

/* ---------------------------------------------------------------- status pills */
function updatePills() {
  const box = $('#pills');
  if (!box || !G.p) return;
  const p = G.p;
  const arr = [];
  for (const k in p.status) if (p.status[k] > 0) arr.push([k, p.status[k]]);
  arr.sort((a, b) => b[1] - a[1]);
  const shown = arr.slice(0, 5);
  let html = shown.map(([k, v]) =>
    `<span class="pill ${STATUS_TONE[k] || ''}">${STATUS_ICON[k] || ''}${STATUS_NAME[k] || k}<b>${Math.ceil(v)}</b></span>`).join('');
  if (arr.length > shown.length) html += `<span class="pill">+${arr.length - shown.length}</span>`;
  box.innerHTML = html;
}

/* ---------------------------------------------------------------- quick belt */
function renderQuickbelt() {
  const box = $('#quickbelt');
  if (!box) return;
  const b = beltSlots();
  box.innerHTML = '';
  for (let i = 0; i < BELT_N; i++) {
    const d = b[i];
    const el = document.createElement('div');
    el.className = 'qslot' + (d ? '' : ' empty');
    const it = d ? beltFindItem(d) : null;
    if (it) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.getContext('2d').drawImage(itemSprite(it), 0, 0);
      el.appendChild(c);
      if (it.n > 1) {
        const n = document.createElement('span'); n.className = 'qn'; n.textContent = '×' + it.n; el.appendChild(n);
      }
      el.title = itemName(it);
    } else if (d) {
      el.innerHTML = '<span class="qi">·</span>';
    } else {
      el.innerHTML = '<span class="qi">＋</span>';
    }
    el.dataset.slot = i;
    el.onclick = (e) => { e.stopPropagation(); beltUse(i); };
    el.oncontextmenu = (e) => { e.preventDefault(); beltClearAt(i); };
    box.appendChild(el);
  }
}

/* ---------------------------------------------------------------- minimap */
const MM_ZOOM = 1;
function toggleMap() {
  G.mapOn = !G.mapOn;
  DB.ui.map = G.mapOn; saveDB();
  const mw = $('#mapWrap');
  if (mw) mw.classList.toggle('on', G.mapOn && G.state === 'play');
  SFX.play('ui');
  drawMinimap();
}
function drawMinimap() {
  const cv2 = $('#mm');
  if (!cv2 || !G.m || !G.p) return;
  const g = cv2.getContext('2d');
  const w = cv2.width, h = cv2.height;
  const m = G.m, p = G.p;
  const TS = 4;
  const cols = Math.floor(w / TS), rows = Math.floor(h / TS);
  const ox = Math.round(clamp(p.x - cols / 2, 0, Math.max(0, W - cols)));
  const oy = Math.round(clamp(p.y - rows / 2, 0, Math.max(0, H - rows)));
  g.fillStyle = '#080a10';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const mx = ox + x, my = oy + y;
      if (!inb(mx, my)) continue;
      const i = my * W + mx;
      if (!m.seen[i]) continue;
      const t = m.t[i], vis = m.vis[i];
      let col;
      if (t === T.STAIRS) col = '#ffd257';
      else if (t === T.RETURN) col = '#b07fe0';
      else if (t === T.WALL || t === T.SECRET || t === T.BRICK) col = vis ? '#4e5c72' : '#2a3242';
      else if (t === T.TREE) col = vis ? '#2f5a33' : '#1e3a22';
      else if (t === T.WATER) col = vis ? '#3a7fb0' : '#2a5577';
      else if (t === T.GRASS || t === T.BUSH) col = vis ? '#4a8a4e' : '#356138';
      else if (t === T.ROAD) col = vis ? '#8d93a2' : '#4a5060';
      else if (t === T.DIRT) col = vis ? '#7a6244' : '#4a3c2c';
      else if (t === T.WOOD) col = vis ? '#7a5430' : '#4a3018';
      else if (t === T.MUD) col = vis ? '#4a3d2f' : '#33291f';
      else if (t === T.CHASM) col = '#04050a';
      else if (t === T.PILLAR || t === T.COVER) col = vis ? '#5a6478' : '#39414f';
      else col = vis ? '#93a6be' : '#48556b';
      g.fillStyle = col;
      g.fillRect(x * TS, y * TS, TS, TS);
    }
  }
  const dot = (x, y, col, r) => {
    const px2 = (x - ox) * TS, py2 = (y - oy) * TS;
    if (x < ox || y < oy || x >= ox + cols || y >= oy + rows) return;
    g.fillStyle = col;
    g.fillRect(px2 + TS / 2 - r, py2 + TS / 2 - r, r * 2, r * 2);
  };
  for (const o of m.objs) {
    const i = o.y * W + o.x;
    if (!m.seen[i]) continue;
    if (o.kind === 'shrine') dot(o.x, o.y, '#7fd8ff', 3);
    else if (o.kind === 'anvil' || o.kind === 'smith') dot(o.x, o.y, '#ffb066', 3);
    else if (o.kind === 'campfire' || o.kind === 'inn') dot(o.x, o.y, '#ff9a3c', 3);
    else if (o.kind === 'statue') dot(o.x, o.y, '#c9a0ff', 3);
    else if (o.kind === 'merchant' || o.kind === 'herbalist') dot(o.x, o.y, '#7fd18a', 3);
    else if (o.kind === 'board') dot(o.x, o.y, '#ffe066', 3);
    else if (o.kind === 'chest' && !o.opened) dot(o.x, o.y, '#e9c25c', 2);
  }
  for (const mo of m.mons) {
    if (mo.hp <= 0) continue;
    if (!m.vis[mo.y * W + mo.x]) continue;
    dot(mo.x, mo.y, mo.shop ? '#7fd18a' : (mo.boss ? '#ff9030' : '#ff4d4d'), mo.boss ? 4 : 3);
  }
  for (const np of m.npcs) {
    if (!m.seen[np.y * W + np.x]) continue;
    dot(np.x, np.y, '#8fd0ff', 2);
  }
  const px2 = (p.x - ox) * TS, py2 = (p.y - oy) * TS;
  g.fillStyle = '#ffffff';
  g.fillRect(px2 + 1, py2 + 1, TS - 2, TS - 2);
  g.strokeStyle = 'rgba(255,255,255,.55)';
  g.lineWidth = 2;
  g.strokeRect(px2 - 1.5, py2 - 1.5, TS + 3, TS + 3);
}

/* ---------------------------------------------------------------- contextual button */
function contextFor() {
  const p = G.p;
  if (!p || !G.m) return null;
  const t = G.m.t[p.y * W + p.x];
  if (t === T.RETURN) return { icon: '🌀', label: '귀환의 문', fn: () => useStairsAt(p.x, p.y) };
  if (t === T.STAIRS) {
    if (G.zone === 'field') return { icon: '🏰', label: '던전으로', fn: () => useStairsAt(p.x, p.y) };
    if (G.zone === 'dungeon') {
      if (G.m.stairs && p.x === G.m.stairs.x && p.y === G.m.stairs.y) return { icon: '⬇️', label: `${G.floorNo + 1}층으로`, fn: () => useStairsAt(p.x, p.y) };
      if (G.m.upStairs && p.x === G.m.upStairs.x && p.y === G.m.upStairs.y) return { icon: '⬆️', label: G.floorNo <= 1 ? '마을로' : `${G.floorNo - 1}층으로`, fn: () => useStairsAt(p.x, p.y) };
    }
  }
  if (t === T.GATE) return { icon: '🚪', label: '마을 문', fn: () => askGate() };
  for (const d of DIR8) {
    const nx = p.x + d[0], ny = p.y + d[1];
    if (inb(nx, ny) && G.m.t[ny * W + nx] === T.GATE) return { icon: '🚪', label: '마을 문', fn: () => askGate() };
  }
  /* an adjacent locked iron gate can always be tried (lockpick / bash) */
  for (const d of DIR8) {
    const nx = p.x + d[0], ny = p.y + d[1];
    if (inb(nx, ny) && G.m.t[ny * W + nx] === T.LOCKED) {
      return { icon: '🔒', label: hasLockpick() ? '자물쇠 따기' : '문 부수기', fn: () => askLockedDoor(nx, ny) };
    }
  }
  const npc = G.m.npcs.find(o => dist(o.x, o.y, p.x, p.y) <= 1);
  if (npc) return { icon: '💬', label: npc.name, fn: () => talkToNpc(npc) };
  const shopMon = G.m.mons.find(mo => mo.shop && mo.hp > 0 && dist(mo.x, mo.y, p.x, p.y) <= 1);
  if (shopMon) return { icon: '🪙', label: '상점', fn: () => openShop(shopMon) };
  let best = null, bestScore = -1;
  const score = { board: 9, inn: 8, smith: 8, herbalist: 7, merchant: 7, campfire: 6, chest: 5, shrine: 5, statue: 4, bones: 3, herb: 3, berry: 3, tent: 3, sign: 2, notice: 2, bench: 1, barrel: 1, crate: 1, fountain: 2, well: 1 };
  for (const o of G.m.objs) {
    if (dist(o.x, o.y, p.x, p.y) > 1) continue;
    if (o.kind === 'chest' && o.opened) continue;
    if (!OBJ_UI[o.kind]) continue;
    const sc = score[o.kind] || 0;
    if (sc > bestScore) { bestScore = sc; best = o; }
  }
  if (best) {
    const ui = OBJ_UI[best.kind];
    let label = ui.verb;
    if (best.kind === 'chest' && best.locked) label = '잠긴 상자 열기';
    return { icon: ui.icon, label, fn: () => interactObj(best) };
  }
  const gi = itemAt(p.x, p.y);
  if (gi) return { icon: '✋', label: `${itemName(gi)} 줍기`, fn: () => pickupItem(gi) };
  return null;
}
function updateContextButton() {
  const btn = $('#ctxBtn');
  if (!btn) return;
  if (G.state !== 'play' || G.preventInput) { btn.classList.remove('on'); return; }
  const a = contextFor();
  if (!a) { btn.classList.remove('on'); return; }
  const txt = $('#ctxTxt');
  if (txt && txt.textContent !== a.label) txt.textContent = a.label;
  const ic = btn.querySelector('.ci');
  if (ic && ic.textContent !== a.icon) ic.textContent = a.icon;
  btn.classList.add('on');
}

/* ---------------------------------------------------------------- log history */
function openLog() {
  if (!G.p) return;
  renderLogScreen();
  showScreen('logScreen');
}
function renderLogScreen() {
  const list = $('#logList');
  if (!list) return;
  list.innerHTML = '';
  const items = G.logHistory.slice(-90).reverse();
  if (!items.length) {
    const e = document.createElement('div'); e.className = 'hint'; e.textContent = '아직 기록이 없다.';
    list.appendChild(e);
  }
  for (const l of items) {
    const d = document.createElement('div');
    d.className = 'ln ' + (l.cls || '');
    const tt = document.createElement('span');
    tt.className = 'tt';
    tt.textContent = l.t + 'T';
    d.appendChild(tt);
    d.appendChild(document.createTextNode(l.txt));
    list.appendChild(d);
  }
  const sub = $('#logSub');
  if (sub) sub.textContent = `${G.logHistory.length}개 기록`;
}

/* ---------------------------------------------------------------- perks */
function maybeShowPerk() {
  if (!G.p || G.pendingPerks <= 0 || G.state !== 'play') return;
  for (const s of SCREENS) {
    const el = document.getElementById(s);
    if (el && !el.classList.contains('hidden')) return;
  }
  if (document.getElementById('choiceScreen')) return;
  showPerkScreen();
}
function showPerkScreen() {
  const ids = perkChoices(3);
  if (!ids.length) { G.pendingPerks = 0; return; }
  G.preventInput = true;
  const box = $('#perkCards');
  box.innerHTML = '';
  const sub = $('#perkSub');
  if (sub) sub.textContent = `Lv.${G.p.lv} · 하나를 고른다${G.pendingPerks > 1 ? ` (남은 선택 ${G.pendingPerks})` : ''}`;
  for (const id of ids) {
    const P = PERKS[id];
    const b = document.createElement('button');
    b.className = 'perk';
    b.innerHTML = `<div class="pi">${P.icon}</div><div style="flex:1;min-width:0"><div class="pn">${P.name}</div><div class="pd">${P.desc}</div></div><div class="pt">${P.tag}</div>`;
    b.onclick = () => {
      takePerk(id);
      G.pendingPerks = Math.max(0, G.pendingPerks - 1);
      SFX.play('ui');
      if (G.pendingPerks > 0) { showPerkScreen(); }
      else {
        G.preventInput = false;
        hideScreens();
        draw(); updateHUD();
      }
    };
    box.appendChild(b);
  }
  showScreen('perkScreen');
}

/* ---------------------------------------------------------------- input */
function bindInput() {
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      const ch = document.getElementById('choiceScreen');
      if (ch) { ch.remove(); G.preventInput = false; updateHUD(); return; }
      if (!$('#perkScreen').classList.contains('hidden')) return;
      if (!$('#logScreen').classList.contains('hidden')) { hideScreens(); draw(); return; }
      if (!$('#invScreen').classList.contains('hidden')) { closeInv(); return; }
      if (!$('#shopScreen').classList.contains('hidden')) { $('#shopScreen').classList.add('hidden'); G.shop = null; setGameUI(true); draw(); return; }
      if (!$('#contractScreen').classList.contains('hidden')) { hideScreens(); draw(); return; }
      if (!$('#stashScreen').classList.contains('hidden')) { hideScreens(); draw(); return; }
      if (!$('#helpScreen').classList.contains('hidden')) { $('#helpScreen').classList.add('hidden'); if (G.state === 'play') { setGameUI(true); draw(); } else showScreen('titleScreen'); return; }
      if (!$('#codexScreen').classList.contains('hidden')) { $('#codexScreen').classList.add('hidden'); showScreen('titleScreen'); return; }
      if (G.target) { hideTargetBar(); return; }
      if (G.state === 'play') openMenu();
      return;
    }
    if (G.state !== 'play') return;
    if (!$('#titleScreen').classList.contains('hidden')) return;
    for (const s of SCREENS) {
      const el = document.getElementById(s);
      if (el && !el.classList.contains('hidden')) return;
    }
    if (document.getElementById('choiceScreen')) return;
    const dirs = {
      w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
      arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0],
      k: [0, -1], h: [-1, 0], j: [0, 1], l: [1, 0],
      y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1]
    };
    if (dirs[k]) {
      e.preventDefault();
      if (G.target) return;
      playerStep(dirs[k][0], dirs[k][1]);
      return;
    }
    if (k === ' ' || k === '.') { e.preventDefault(); playerWait(); return; }
    if (k === 'i') { e.preventDefault(); openInv(); return; }
    if (k === 'f') { e.preventDefault(); playerSearch(); return; }
    if (k === 'q') { e.preventDefault(); quickWand(); return; }
    if (k === 'r') { e.preventDefault(); swapWeapon(); return; }
    if (k === 'z') { e.preventDefault(); toggleZoom(); return; }
    if (k === '1' || k === '2') { e.preventDefault(); useSkillSlot(k === '1' ? 0 : 1); return; }
    if (k === '3' || k === '4' || k === '5') { e.preventDefault(); beltUse(parseInt(k, 10) - 3); return; }
    if (k === 'g') { e.preventDefault(); toggleMap(); return; }
    if (k === 'l') { e.preventDefault(); openLog(); return; }
    if (k === 'm') { toggleMute(); return; }
  });

  /* pointer: tap = preview+walk, swipe = 1 step, long-press = inspect */
  const pointers = new Map();
  let downT = 0, downX = 0, downY = 0, longTimer = null, moved = false, swipeDone = false, pinchBase = 0, pinchCool = 0;

  function localPt(e) { return { x: e.clientX, y: e.clientY }; }
  cv.addEventListener('pointerdown', e => {
    if (G.state !== 'play') return;
    pointers.set(e.pointerId, localPt(e));
    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinchBase = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchCool = 0;
      return;
    }
    if (pointers.size > 2) return;
    downT = Date.now(); downX = e.clientX; downY = e.clientY; moved = false; swipeDone = false;
    const t = screenToTile(e.clientX, e.clientY);
    if (e.clientY < 40 || e.clientY > CH - 60) return;
    if (inb(t.x, t.y) && G.m.seen[t.y * W + t.x]) G.cursor = { x: t.x, y: t.y, t0: animT };
    if (G.target && inb(t.x, t.y)) { G.target.hover = t; draw(); }
    clearTimeout(longTimer);
    longTimer = setTimeout(() => {
      if (!moved) { inspect(t.x, t.y); longTimer = null; }
    }, 460);
  });
  cv.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    if (pointers.size === 2) {
      pointers.set(e.pointerId, localPt(e));
      const pts = Array.from(pointers.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (Math.abs(d - pinchBase) > 46 && Date.now() > pinchCool) {
        pinchCool = Date.now() + 500;
        const order = [0.75, 1, 1.5, 2];
        const i = order.indexOf(zoomLevel());
        setZoom(order[clamp(i + (d > pinchBase ? 1 : -1), 0, 3)]);
        pinchBase = d;
        toast(`🔍 ${zoomLevel()}x`);
      }
      return;
    }
    if (Math.abs(e.clientX - downX) > 12 || Math.abs(e.clientY - downY) > 12) moved = true;
    if (G.target && e.clientY >= 0 && e.clientY <= CH) {
      const t = screenToTile(e.clientX, e.clientY);
      if (inb(t.x, t.y)) {
        G.target.hover = t;
        if (G.m.seen[t.y * W + t.x]) G.cursor = { x: t.x, y: t.y, t0: animT };
        updateTargetPreview(t.x, t.y);
        draw();
      }
      return;
    }
    if (e.pointerType === 'mouse' && G.state === 'play') {
      const t = screenToTile(e.clientX, e.clientY);
      if (inb(t.x, t.y) && G.m.seen[t.y * W + t.x]) {
        if (!G.cursor || G.cursor.x !== t.x || G.cursor.y !== t.y) G.cursor = { x: t.x, y: t.y, t0: animT };
      }
    }
  });
  cv.addEventListener('pointerup', e => {
    clearTimeout(longTimer);
    const wasTwo = pointers.size === 2;
    pointers.delete(e.pointerId);
    if (wasTwo) return;
    if (G.state !== 'play' || G.preventInput) return;
    const dx = e.clientX - downX, dy = e.clientY - downY;
    const dur = Date.now() - downT;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    /* swipe → one deliberate step */
    if (dur < 420 && Math.max(adx, ady) > 26 && !swipeDone) {
      let sx = 0, sy = 0;
      if (adx > ady * 1.6) sx = Math.sign(dx);
      else if (ady > adx * 1.6) sy = Math.sign(dy);
      else { sx = Math.sign(dx); sy = Math.sign(dy); }
      if (G.target) { G.target.hover = null; hideTargetBar(); }
      playerStep(sx, sy);
      moved = true;
      return;
    }
    if (moved) return;
    if (dur > 460) return; // long press already inspected
    const t = screenToTile(e.clientX, e.clientY);
    handleTileTap(t.x, t.y);
  });
  cv.addEventListener('pointercancel', () => { clearTimeout(longTimer); pointers.clear(); });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  /* compact d-pad */
  for (const b of $$('.dbtn')) {
    const dir = b.dataset.dir;
    const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    b.addEventListener('click', e => {
      e.preventDefault();
      if (G.state !== 'play' || G.target) return;
      SFX.unlock();
      playerStep(map[dir][0], map[dir][1]);
    });
  }
  const wb = $('#btnWait');
  if (wb) wb.onclick = () => { SFX.unlock(); if (G.target) hideTargetBar(); playerWait(); };
  $('#btnSearch').onclick = () => { SFX.unlock(); if (G.target) hideTargetBar(); playerSearch(); };
  $('#btnInv').onclick = () => { SFX.unlock(); if (G.target) hideTargetBar(); openInv(); };
  $('#btnWand').onclick = () => { SFX.unlock(); quickWand(); };
  $('#btnSkill1').onclick = () => { SFX.unlock(); useSkillSlot(0); };
  $('#btnSkill2').onclick = () => { SFX.unlock(); useSkillSlot(1); };
  $('#btnSwap').onclick = () => { SFX.unlock(); if (G.target) hideTargetBar(); swapWeapon(); };
  $('#targetCancel').onclick = () => hideTargetBar();
  $('#muteBtn').onclick = () => { SFX.unlock(); toggleMute(); };
  $('#helpBtn').onclick = () => { showScreen('helpScreen'); };
  $('#menuBtn').onclick = () => openMenu();
  $('#mapBtn').onclick = () => { SFX.unlock(); toggleMap(); };
  $('#btnZoom').onclick = () => { SFX.unlock(); toggleZoom(); };
  $('#btnDpad').onclick = () => { SFX.unlock(); toggleDpad(); };
  $('#log').onclick = () => { SFX.unlock(); openLog(); };
  $('#logClose').onclick = () => { if (G.state === 'play') { hideScreens(); draw(); updateHUD(); } else showScreen('titleScreen'); };
  $('#ctxBtn').onclick = () => {
    SFX.unlock();
    const a = contextFor();
    if (!a) return;
    if (G.target) hideTargetBar();
    a.fn();
    updateHUD();
  };

  /* title */
  $('#btnStart').onclick = () => startFromTitle();
  $('#btnReroll').onclick = () => { $('#seedInput').value = makeSeed(); SFX.play('ui'); };
  $('#seedInput').addEventListener('keydown', e => { if (e.key === 'Enter') startFromTitle(); });
  $('#btnCodex').onclick = () => renderCodex();
  $('#btnHelp2').onclick = () => showScreen('helpScreen');
  $('#btnHelpClose').onclick = () => { if (G.state === 'play') { hideScreens(); draw(); } else showScreen('titleScreen'); };
  $('#btnMute2').onclick = () => toggleMute();
  $('#codexClose').onclick = () => showScreen('titleScreen');

  /* inventory / shop / contracts / stash */
  $('#invClose').onclick = () => closeInv();
  $('#shopClose').onclick = () => { $('#shopScreen').classList.add('hidden'); G.shop = null; if (G.state === 'play') setGameUI(true); draw(); };
  $$('#shopTabs button').forEach(b => {
    b.onclick = () => { if (G.shop) { G.shop.tab = b.dataset.tab; SFX.play('ui'); renderShop(); } };
  });
  $('#contractClose').onclick = () => { hideScreens(); draw(); updateHUD(); };
  $('#stashClose').onclick = () => { hideScreens(); draw(); updateHUD(); };

  /* death */
  $('#btnRetry').onclick = () => {
    deathShown = false;
    hideScreens();
    newRun(G.cls, makeSeed());
    camSnap = true;
    resize();
    draw();
  };
  $('#btnToTitle').onclick = () => {
    deathShown = false;
    G.state = 'title';
    hideScreens();
    renderTitle();
    showScreen('titleScreen');
  };

  window.addEventListener('resize', () => { resize(); });
  window.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
  window.addEventListener('keydown', () => SFX.unlock(), { once: true });
}

function quickWand() {
  if (G.state !== 'play') return;
  const wands = G.p.inv.filter(o => o.t === 'wand' && o.charges > 0);
  if (!wands.length) { log('사용할 마법봉이 없다.', ''); return; }
  if (wands.length === 1) { beginWandTarget(wands[0]); return; }
  showChoice('마법봉 선택', '어떤 마법봉을 사용할까?', wands.map(w => ({
    txt: `${WANDS[w.k].name} (${w.charges})`, cls: 'flat', fn: () => beginWandTarget(w)
  })).concat([{ txt: '취소', cls: 'flat', fn: () => { } }]));
}

/* ---------------------------------------------------------------- boot */
function renderAll() {
  draw();
  updateHUD();
}
function boot() {
  loadDB();
  buildSprites();
  readSafe();
  SFX.setEnabled(!DB.muted);
  $('#muteBtn').classList.toggle('off', !SFX.enabled);
  $('#btnMute2').textContent = SFX.enabled ? '소리 켜짐' : '소리 꺼짐';
  titleCls = 'warrior';
  G.mapOn = DB.ui.map !== false;
  G.zoom = DB.ui.zoom || 1;
  G.dpad = !!DB.ui.dpad;
  renderTitle();
  resize();
  initParticles();
  bindInput();
  showScreen('titleScreen');
  requestAnimationFrame(loop);
  G.state = 'title';
}
boot();
