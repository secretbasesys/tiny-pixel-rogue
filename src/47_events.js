/* =====================================================================
   OBJECTS & TOWN EVENTS — board, inn, smith, herbalist, gate, campfire,
   anvil, statue, remains, foraging, contract rewards, inn stash
   ===================================================================== */

const OBJ_UI = {
  chest:    { icon: '🧰', verb: '상자 열기', glow: '#e9c25c' },
  shrine:   { icon: '🔮', verb: '제단에 바치기', glow: '#7fd8ff' },
  anvil:    { icon: '⚒️', verb: '모루 사용', glow: '#ffb066' },
  statue:   { icon: '🗿', verb: '석상 조사', glow: '#b07fe0' },
  bones:    { icon: '🦴', verb: '유해 뒤지기', glow: '#cfc7b4' },
  campfire: { icon: '🔥', verb: '모닥불에서 쉼', glow: '#ff9a3c' },
  merchant: { icon: '🪙', verb: '거래하기', glow: '#7fd18a' },
  barrel:   { icon: '🛢', verb: '기름통 밀기', glow: '#8a5c33' },
  crate:    { icon: '📦', verb: '상자 부수기', glow: '#8a5c33' },
  board:    { icon: '📜', verb: '의뢰 게시판', glow: '#e9c25c' },
  inn:      { icon: '🔥', verb: '여관 들어가기', glow: '#ff9a3c' },
  smith:    { icon: '⚒️', verb: '대장장이', glow: '#ffb066' },
  herbalist:{ icon: '🧪', verb: '약초상', glow: '#7fd18a' },
  fountain: { icon: '⛲', verb: '물 마시기', glow: '#7fb6e8' },
  gate:     { icon: '🚪', verb: '마을 문', glow: '#e9c25c' },
  herb:     { icon: '🌿', verb: '약초 채집', glow: '#8fd18a' },
  berry:    { icon: '🫐', verb: '열매 따기', glow: '#b07fe0' },
  sign:     { icon: '🪧', verb: '표지판 읽기', glow: '#cfc7b4' },
  notice:   { icon: '📌', verb: '게시물 읽기', glow: '#cfc7b4' },
  bench:    { icon: '🪑', verb: '벤치에 앉기', glow: '#8a6a3c' },
  tent:     { icon: '⛺', verb: '천막 뒤지기', glow: '#8a6a3c' },
  well:     { icon: '🪣', verb: '우물물 긷기', glow: '#7fb6e8' }
};

function interactObj(o) {
  if (!o) return false;
  switch (o.kind) {
    case 'chest': openChest(o); return true;
    case 'shrine': openShrine(o); return true;
    case 'anvil': openSmith(o, true); return true;
    case 'statue': openStatue(o); return true;
    case 'bones': openBones(o); return true;
    case 'campfire': openCampfire(o); return true;
    case 'merchant': openShop(Object.assign(o, { shopKind: 'merchant', shopTitle: '상인 켈' })); return true;
    case 'barrel': case 'crate': bumpBarrel(o); return true;
    case 'board': openContractBoard(); return true;
    case 'inn': openInn(o); return true;
    case 'smith': openSmith(o); return true;
    case 'herbalist': openShop(Object.assign(o, { shopKind: 'herbalist', shopTitle: '약초상 니아' })); return true;
    case 'fountain': drinkFountain(); return true;
    case 'gate': askGate(); return true;
    case 'herb': harvestHerb(o); return true;
    case 'berry': harvestBerry(o); return true;
    case 'sign': readSign(); return true;
    case 'notice': readNotice(); return true;
    case 'bench': sitBench(); return true;
    case 'tent': searchTent(o); return true;
    case 'well': drinkFountain(); return true;
  }
  return false;
}

/* ---------------------------------------------------------------- contract board */
function openContractBoard() {
  if (G.state !== 'play') return;
  renderContracts();
  showScreen('contractScreen');
}
function renderContracts() {
  const list = $('#contractList');
  if (!list) return;
  list.innerHTML = '';
  $('#contractSub').textContent = `◈ ${G.p.gold} · 완수 ${G.completed}`;
  const head = $('#contractHead');
  const c = G.contract;
  let html = '';
  if (c && c.state === 'active') html += `<b style="color:#ffe1a0">진행 중</b> · ${c.name} (${'★'.repeat(c.diff)}) — ${BIOMES[c.biome].desc}`;
  else if (c && c.state === 'done') html += `<b style="color:#8ef19a">완수 보고 가능</b> · ${c.name} — 보상을 받으세요.`;
  else html += '게시판에 새 의뢰가 붙어 있다. 하나를 골라 마을 문을 나서라.';
  if (head) head.innerHTML = html;

  if (c && c.state === 'done') {
    const card = document.createElement('div');
    card.className = 'ct done';
    card.innerHTML = `<div class="top"><span class="ttl">${c.name}</span><span class="tag">완수</span></div>` +
      `<div class="meta">${c.bossName} 처치 완료</div>` +
      `<div class="rw"><span class="g">◈ ${c.gold}</span><span class="r">유물 ${RARITY[c.relic].name}</span></div>`;
    card.onclick = () => claimContractReward();
    list.appendChild(card);
  }
  for (const ct of G.contracts) {
    const el = document.createElement('div');
    el.className = 'ct ' + (ct.diff >= 4 ? 'hard' : ct.diff >= 2 ? 'mid' : '');
    el.innerHTML = `<div class="top"><span class="ttl">${ct.name}</span><span class="sk">${'★'.repeat(ct.diff)}${'☆'.repeat(Math.max(0, 5 - ct.diff))}</span></div>` +
      `<div class="meta">${BIOMES[ct.biome].name} · ${ct.desc}</div>` +
      `<div class="boss">☠ ${ct.bossName}</div>` +
      `<div class="rw"><span class="g">◈ ${ct.gold}</span><span class="r">유물 ${RARITY[ct.relic].name}</span></div>`;
    el.onclick = () => {
      if (G.contract && G.contract.state === 'active') { toast('이미 진행 중인 의뢰가 있습니다'); return; }
      acceptContract(ct);
      renderContracts();
    };
    list.appendChild(el);
  }
  if (!G.contracts.length && !(c && c.state === 'done')) {
    const e = document.createElement('div');
    e.className = 'hint';
    e.textContent = '새 의뢰가 준비 중이다. 마을을 둘러보라.';
    list.appendChild(e);
  }
}
function claimContractReward() {
  const c = G.contract;
  if (!c || c.state !== 'done') return;
  G.p.gold += c.gold;
  const relic = makeRelic(RNG(hashStr(G.seedStr + ':relic:' + G.completed)));
  relic.rarity = c.relic;
  relic.affixList = relic.affixList || [];
  while (relic.affixList.length < RARITY[c.relic].affixes) {
    const a = imbueGear(relic, RNG(hashStr(G.seedStr + ':imbue:' + G.completed + relic.affixList.length)));
    if (!a) break;
  }
  if (!addToInv(relic)) { relic.x = G.p.x; relic.y = G.p.y; G.m.items.push(relic); }
  log(`의뢰 보상! ◈${c.gold}과 ${RARITY[c.relic].name} 유물 — ${itemName(relic)}`, 'gold');
  toast('📜 의뢰 완수 보상!');
  SFX.play('win');
  G.contract = null;
  G.contracts = rollContracts();
  for (const o of G.contracts) o.state = 'offer';
  updateHUD(); renderContracts(); renderAll();
}

/* ---------------------------------------------------------------- inn */
function openInn(o) {
  const p = G.p;
  const cost = 25;
  const hurt = p.hp < p.maxhp || Object.keys(p.status).length > 0;
  showChoice('여관 · 브라크하벤의 불빛',
    `따뜻한 불과 푹신한 침대가 있다.<br><span style="color:#9a9382">HP ${Math.ceil(p.hp)}/${p.maxhp} · MP ${Math.floor(p.mp)}/${p.maxmp} · 상처 ${Object.keys(p.status).length ? '있음' : '없음'}</span>`,
    [
      { txt: `완전한 휴식 (◈${cost})`, fn: () => innRest(cost) },
      { txt: '보관함 (물건 맡기기)', cls: 'flat', fn: () => openStash() },
      { txt: '나간다', cls: 'flat', fn: () => { } }
    ]);
}
function innRest(cost) {
  const p = G.p;
  if (p.gold < cost) { log('금화가 부족하다.', 'bad'); return; }
  p.gold -= cost;
  p.hp = p.maxhp; p.mp = p.maxmp;
  p.status = {};
  p.shieldHp = 0;
  log('푹 잤다. HP·MP가 완전히 회복되고 상처가 사라졌다.', 'good');
  toast('🔥 완전 회복!');
  SFX.play('heal');
  saveDB();
  updateHUD(); renderAll();
}
function openStash() {
  renderStash();
  showScreen('stashScreen');
}
function renderStash() {
  const inv = $('#stashInv'), box = $('#stashBox');
  if (!inv || !box) return;
  $('#stashSub').textContent = `${G.stash.length} / 24`;
  inv.innerHTML = ''; box.innerHTML = '';
  const mk = (it, toStash) => {
    const row = document.createElement('div');
    row.className = 'li rar-' + rarityOf(it).id;
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    c.getContext('2d').drawImage(itemSprite(it), 0, 0);
    row.appendChild(c);
    const nm = document.createElement('div'); nm.className = 'nm';
    nm.innerHTML = `${itemName(it)}${it.n > 1 ? ` ×${it.n}` : ''}<div class="sb">${itemDesc(it)}</div>`;
    row.appendChild(nm);
    row.onclick = () => {
      if (toStash) {
        if (G.stash.length >= 24) { toast('보관함이 가득 찼다'); return; }
        G.p.inv = G.p.inv.filter(z => z !== it);
        G.stash.push(it);
      } else {
        if (G.p.inv.length >= ITEM_CAP) { toast('가방이 가득 찼다'); return; }
        G.stash = G.stash.filter(z => z !== it);
        G.p.inv.push(it);
      }
      SFX.play('ui');
      renderStash(); updateHUD();
    };
    return row;
  };
  const tradables = G.p.inv.filter(it => it !== G.p.weapon && it !== G.p.armor && it !== G.p.ring && (G.p.slots || []).indexOf(it) < 0);
  if (!tradables.length) inv.innerHTML = '<div class="hint">맡길 물건이 없다.</div>';
  for (const it of tradables) inv.appendChild(mk(it, true));
  if (!G.stash.length) box.innerHTML = '<div class="hint">보관함이 비어 있다.</div>';
  for (const it of G.stash) box.appendChild(mk(it, false));
}

/* ---------------------------------------------------------------- smith */
function forgeCost() { return 45 + G.contractTier * 14; }
function imbueCost() { return 80 + G.contractTier * 20; }
function openSmith(o, isAnvil) {
  const p = G.p;
  const wc = forgeCost(), ac = imbueCost();
  const w = p.weapon ? itemName(p.weapon) : '맨손';
  const a = p.armor ? itemName(p.armor) : '없음';
  const opts = [
    { txt: `장비 강화 (◈${wc})`, fn: () => forgeUpgrade('weapon', wc) },
    { txt: `방어구 강화 (◈${wc})`, fn: () => forgeUpgrade('armor', wc) },
    { txt: `마법 부여 (◈${ac})`, fn: () => forgeImbue(ac) }
  ];
  if (!isAnvil) opts.push({ txt: '물건 사고팔기', cls: 'flat', fn: () => openShop({ kind: 'goblinShop', shopKind: 'smith', x: o.x, y: o.y, shopTitle: '대장장이 오르반' }) });
  opts.push({ txt: isAnvil ? '닫기' : '그만둔다', cls: 'flat', fn: () => { } });
  showChoice(isAnvil ? '대장간 모루' : '대장장이 오르반',
    `${isAnvil ? '식지 않은 모루가 은은하게 빛난다.' : '모루가 식지 않았다.'}<br><b>주무기</b> ${w}<br><b>보조</b> ${p.slots[1] ? itemName(p.slots[1]) : '없음'}<br><b>방어구</b> ${a}`,
    opts);
}
function forgeUpgrade(slot, cost) {
  const p = G.p;
  const it = p[slot];
  if (!it) { log('강화할 장비가 없다.', 'bad'); return; }
  if (p.gold < cost) { log('금화가 부족하다.', 'bad'); SFX.play('bad'); return; }
  p.gold -= cost;
  it.plus = (it.plus || 0) + 1;
  if (slot === 'armor') recalcStats();
  log(`${J(itemName(it), 'eul')} 벼렸다. +${it.plus}`, 'gold');
  addFloat(p.x, p.y, '+1', '#ffe089');
  toast(`${itemName(it)} 강화!`);
  SFX.play('level');
  updateHUD(); renderAll();
}
function forgeImbue(cost) {
  const p = G.p;
  const slots = ['weapon', 'armor', 'ring'].filter(s => p[s] && (AFFIX_POOL[p[s].t] || []).some(a => !hasAffix(p[s], a)));
  if (!slots.length) { log('더 새길 마법이 없다.', 'bad'); return; }
  if (p.gold < cost) { log('금화가 부족하다.', 'bad'); SFX.play('bad'); return; }
  const slot = slots[0];
  const it = p[slot];
  const a = imbueGear(it, G.rng);
  if (!a) { log('부여할 수 있는 마법이 없다.', 'bad'); return; }
  p.gold -= cost;
  recalcStats();
  log(`${J(itemName(it), 'e')} ${AFFIXES[a].name} 마법이 깃들었다.`, 'gold');
  addFloat(p.x, p.y, 'IMBUE', '#c9a0ff');
  toast(`⚒️ ${AFFIXES[a].name} 부여!`);
  SFX.play('level');
  updateHUD(); renderAll();
}

/* ---------------------------------------------------------------- relics */
function makeRelic(rng) {
  const roll = rng.r();
  let it;
  if (roll < 0.5) {
    const wd = rng.pick(WEAPON_TYPES);
    it = { t: 'weapon', kind: wd.kind, name: wd.name, dmg: wd.dmg + 2, crit: wd.crit, reach: wd.reach || 1, range: wd.range, ranged: !!wd.ranged, plus: 1, n: 1 };
  } else if (roll < 0.8) {
    const a = rng.pick(ARMOR_TYPES);
    it = { t: 'armor', name: a.name, def: a.def + 1, plus: 1, n: 1 };
  } else {
    it = { t: 'ring', k: rng.pick(Object.keys(RINGS)), n: 1 };
  }
  it.rarity = rng.chance(0.28) ? 'legend' : 'rare';
  const R = RARITY[it.rarity];
  it.affixList = [];
  const pool = rng.shuffle((AFFIX_POOL[it.t] || []).slice());
  for (let i = 0; i < R.affixes && i < pool.length; i++) it.affixList.push(pool[i]);
  if (it.t === 'weapon') it.dmg = Math.max(1, Math.round(it.dmg * R.mul));
  if (it.t === 'armor') it.def = Math.max(1, Math.round(it.def * R.mul));
  return it;
}

/* ---------------------------------------------------------------- cursed statue */
function openStatue(o) {
  showChoice('저주받은 석상', '눈이 보랏빛으로 빛나는 석상이다. 무언가를 내주면 무언가를 돌려받을 것 같다.', [
    {
      txt: '피 8을 바치고 유물을 받는다', cls: 'danger', fn: () => {
        const p = G.p;
        if (p.hp <= 8) { log('피가 부족하다. 석상이 비웃는 듯하다.', 'bad'); return; }
        p.hp -= 8;
        const it = makeRelic(G.rng);
        if (!addToInv(it)) { it.x = p.x; it.y = p.y; G.m.items.push(it); log('가방이 가득 차 유물이 발밑에 떨어졌다.', 'bad'); }
        else log(`${J(itemName(it), 'eul')} 받았다. (${rarityOf(it).name})`, 'gold');
        addFloat(p.x, p.y, 'RELIC', '#c9a0ff');
        SFX.play('level');
        if (Math.random() < 0.3) { p.status.curse = 30; log('대가로 저주가 내린다!', 'bad'); }
        o.used = true; G.m.objs = G.m.objs.filter(z => z !== o);
        updateHUD(); renderAll();
      }
    },
    {
      txt: '금화 25를 바치고 힘을 빈다', fn: () => {
        const p = G.p;
        if (p.gold < 25) { log('금화가 부족하다.', 'bad'); return; }
        p.gold -= 25;
        p.baseMaxhp += 6; recalcStats(); p.hp = Math.min(p.maxhp, p.hp + 6);
        log('석상이 힘을 준다. 최대 HP +6', 'gold');
        SFX.play('level');
        o.used = true; G.m.objs = G.m.objs.filter(z => z !== o);
        updateHUD(); renderAll();
      }
    },
    { txt: '떠난다', cls: 'flat', fn: () => { } }
  ]);
}

/* ---------------------------------------------------------------- remains */
function openBones(o) {
  showChoice('모험가의 유해', '오래전에 쓰러진 모험가의 해골이다. 아직 쓸 만한 것이 남아 있을지도 모른다.', [
    {
      txt: '유해를 뒤진다', fn: () => {
        const p = G.p;
        o.used = true;
        G.m.objs = G.m.objs.filter(z => z !== o);
        const gold = 14 + (G.contract ? G.contract.diff * 6 : 6) + Math.floor(Math.random() * 18);
        p.gold += gold;
        log(`유해에서 금화 ${gold}개를 꺼냈다.`, 'gold');
        if (Math.random() < 0.6) {
          const it = { t: 'scroll', k: G.rng.pick(SCROLLS).k, n: 1 };
          if (addToInv(it)) log('낡은 두루마리도 챙겼다.', 'good');
        }
        if (Math.random() < 0.35) {
          const spots = DIR4.filter(d => !isBlockedFor({ fly: false }, o.x + d[0], o.y + d[1]));
          if (spots.length) {
            const s = spots[Math.floor(Math.random() * spots.length)];
            const pool = monsterPool(G.contract ? G.contract.biome : 'ruins', G.contract ? G.contract.diff : 1);
            const mon = mkMon(G.rng.pick(pool), o.x + s[0], o.y + s[1], G.contract ? G.contract.diff : 1, G.rng);
            mon.state = 'chase'; mon.awake = true;
            G.m.mons.push(mon);
            log('유해가 움직이더니 매복한 적이 튀어나왔다!', 'bad');
            SFX.play('bad'); shake(5);
          }
        }
        SFX.play('gold');
        updateHUD(); computeFOV(); renderAll();
      }
    },
    { txt: '조용히 지나간다', cls: 'flat', fn: () => { } }
  ]);
}

/* ---------------------------------------------------------------- campfire */
function enemiesNear(r) {
  return G.m.mons.filter(mo => mo.hp > 0 && !mo.shop && dist(mo.x, mo.y, G.p.x, G.p.y) <= r && monStateOf(mo) !== 'sleep');
}
function openCampfire(o) {
  const threat = enemiesNear(8);
  if (threat.length) {
    log('주변에 적이 있어 불곁에서 쉴 수 없다.', 'bad');
    SFX.play('bad');
    toast('⚠️ 적이 가까이 있다');
    return;
  }
  const p = G.p;
  const uses = o.uses || 0;
  const left = 2 - uses;
  const food = p.inv.find(z => z.t === 'food');
  const opts = [];
  if (left > 0) {
    opts.push({
      txt: '쉬어간다 (HP 40% · MP 60% 회복)', fn: () => {
        if ((o.uses || 0) >= 2) { log('불이 거의 꺼져간다. 더는 쉴 수 없다.', 'bad'); return; }
        o.uses = (o.uses || 0) + 1;
        const h = Math.ceil(p.maxhp * 0.4), m = Math.ceil(p.maxmp * 0.6);
        healPlayer(h, true);
        p.mp = Math.min(p.maxmp, p.mp + m);
        for (const k in p.status) if (STATUS_TONE[k] === 'bad') delete p.status[k];
        log(`모닥불 곁에서 쉬었다. HP +${h}, MP +${m}`, 'good');
        addFloat(p.x, p.y, 'REST', '#8ef19a');
        SFX.play('heal');
        finishPlayerTurn(2);
        updateHUD(); renderAll();
      }
    });
  }
  if (food) {
    opts.push({
      txt: '식량을 먹는다', cls: 'flat', fn: () => {
        const f = p.inv.find(z => z.t === 'food');
        if (!f) { log('식량이 없다.', 'bad'); return; }
        eatFood(f);
      }
    });
  }
  opts.push({ txt: left > 0 ? '일어난다' : '꺼진 불을 뒤로하고 떠난다', cls: 'flat', fn: () => { } });
  const head = left > 0
    ? `아직 따뜻한 모닥불이다. 잠시 쉬면 기운을 되찾을 수 있다.<br><span style="color:#9a9382">남은 휴식 ${left}회 · HP ${Math.ceil(p.hp)}/${p.maxhp} · MP ${Math.floor(p.mp)}/${p.maxmp}</span>`
    : `불이 거의 꺼져간다. 더는 쉴 수 없다.<br><span style="color:#9a9382">HP ${Math.ceil(p.hp)}/${p.maxhp} · MP ${Math.floor(p.mp)}/${p.maxmp}</span>`;
  showChoice('모닥불', head, opts);
}

/* ---------------------------------------------------------------- town & field flavour */
function drinkFountain() {
  healPlayer(6);
  G.p.mp = Math.min(G.p.maxmp, G.p.mp + 3);
  log('시원한 물을 마셨다. 기운이 돈다.', 'good');
  SFX.play('drink');
  finishPlayerTurn(1);
}
function harvestHerb(o) {
  G.m.objs = G.m.objs.filter(z => z !== o);
  if (Math.random() < 0.6) {
    const it = { t: 'potion', k: 'heal', n: 1 };
    if (addToInv(it)) log('약초를 캐서 회복 물약을 만들었다.', 'good');
    else log('가방이 가득 차 약초를 두고 왔다.', 'bad');
  } else {
    G.p.gold += 4;
    log('약초를 캐서 몇 닢에 팔았다. ◈4', 'gold');
  }
  SFX.play('pick');
  finishPlayerTurn(1);
  updateHUD();
}
function harvestBerry(o) {
  G.m.objs = G.m.objs.filter(z => z !== o);
  healPlayer(5);
  G.p.mp = Math.min(G.p.maxmp, G.p.mp + 2);
  log('달콤한 열매를 따 먹었다.', 'good');
  SFX.play('pick');
  finishPlayerTurn(1);
}
function readSign() {
  const lines = {
    forest: '「검은 숲」 — 북동쪽 폐허에 던전 입구가 있다. 늑대 무리를 조심하라.',
    ruins: '「무너진 옛길」 — 동쪽 성벽 아래 납골당으로 들어가는 계단이 있다.',
    marsh: '「썩은 습지」 — 물길을 따라가면 연금술 요새의 입구가 나온다.'
  };
  const key = G.contract ? G.contract.biome : 'forest';
  showChoice('표지판', lines[key] || lines.forest, [{ txt: '닫기', cls: 'flat', fn: () => { } }]);
}
function readNotice() {
  showChoice('마을 게시물', '「용병 모집 — 들판의 위협을 제거할 자. 게시판의 의뢰를 보라.」<br>「대장장이 오르반 — 장비 강화·마법 부여.」<br>「여관 도라 — 완전한 휴식과 보관함.」', [
    { txt: '닫기', cls: 'flat', fn: () => { } }
  ]);
}
function sitBench() {
  healPlayer(3);
  log('벤치에 앉아 잠시 숨을 골랐다.', '');
  finishPlayerTurn(1);
}
function searchTent(o) {
  if (o.used) { log('이미 뒤진 천막이다.', ''); return; }
  o.used = true;
  const gold = 10 + Math.floor(Math.random() * 25);
  G.p.gold += gold;
  log(`천막 안에서 금화 ${gold}개와 잡동사니를 찾았다.`, 'gold');
  if (Math.random() < 0.5) {
    const it = { t: 'lockpick', n: 2 };
    if (addToInv(it)) log('자물쇠 따개도 챙겼다.', 'good');
  }
  SFX.play('gold');
  finishPlayerTurn(1);
  updateHUD();
}
function talkToNpc(npc) {
  if (!npc) return;
  showChoice(npc.name, npc.line || '...', [
    { txt: '닫기', cls: 'flat', fn: () => { } }
  ]);
}
