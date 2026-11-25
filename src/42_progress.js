/* =====================================================================
   PROGRESS — equipment rarity & affixes, level-up perks, area bounties
   ===================================================================== */

/* ---------------------------------------------------------------- rarity */
const RARITY = {
  common: { id: 'common', name: '일반', color: '#b9b3a4', affixes: 0, mul: 1.00, price: 1.00 },
  fine:   { id: 'fine',   name: '고급', color: '#7fd18a', affixes: 1, mul: 1.10, price: 1.35 },
  rare:   { id: 'rare',   name: '희귀', color: '#6fb4f0', affixes: 2, mul: 1.24, price: 1.95 },
  legend: { id: 'legend', name: '전설', color: '#f0a63c', affixes: 3, mul: 1.42, price: 2.90 }
};
const RARITY_ORDER = ['common', 'fine', 'rare', 'legend'];
function rarityOf(it) { return (it && RARITY[it.rarity]) || RARITY.common; }
function rarityRank(it) { return RARITY_ORDER.indexOf((it && it.rarity) || 'common'); }

/* ---------------------------------------------------------------- affixes */
const AFFIXES = {
  flame:  { id: 'flame',  name: '화염의', desc: '공격 시 화상 부여, 화염 피해 +2', color: '#ff8a3c' },
  frost:  { id: 'frost',  name: '빙결의', desc: '공격 시 빙결 부여, 냉기 피해 +2', color: '#9fd8ff' },
  vamp:   { id: 'vamp',   name: '흡혈의', desc: '가한 피해의 15%를 회복', color: '#e4585c' },
  swift:  { id: 'swift',  name: '신속의', desc: '가끔 한 번 더 행동 (가속 +15%)', color: '#7fd18a' },
  pierce: { id: 'pierce', name: '관통의', desc: '적의 방어를 2 무시', color: '#e9c25c' },
  thorn:  { id: 'thorn',  name: '가시의', desc: '피격 시 공격자에게 3 피해', color: '#b07fe0' },
  vital:  { id: 'vital',  name: '생명의', desc: '최대 HP +6', color: '#7fd1b0' },
  arcane: { id: 'arcane', name: '비전의', desc: '최대 MP +5', color: '#7fb6e8' }
};
const AFFIX_POOL = {
  weapon: ['flame', 'frost', 'vamp', 'swift', 'pierce', 'arcane'],
  armor:  ['thorn', 'vital', 'arcane', 'swift'],
  ring:   ['vamp', 'thorn', 'vital', 'arcane', 'swift', 'flame', 'frost', 'pierce']
};
function affixList(it) { return (it && it.affixList) || []; }
function hasAffix(it, id) { return affixList(it).indexOf(id) >= 0; }
function affixName(it) {
  const a = affixList(it)[0];
  return a && AFFIXES[a] ? AFFIXES[a].name : '';
}

function rollRarity(rng, depth, luck) {
  const r = rng.r() + (luck || 0) + Math.max(0, depth - 1) * 0.008;
  if (r > 0.955) return 'legend';
  if (r > 0.845) return 'rare';
  if (r > 0.615) return 'fine';
  return 'common';
}
function dressGear(it, rng, depth, luck) {
  if (!it) return it;
  const slot = it.t === 'weapon' ? 'weapon' : it.t === 'armor' ? 'armor' : it.t === 'ring' ? 'ring' : null;
  if (!slot) return it;
  const rid = rollRarity(rng, depth, luck);
  const R = RARITY[rid];
  it.rarity = rid;
  it.affixList = [];
  const pool = rng.shuffle((AFFIX_POOL[slot] || []).slice());
  for (let i = 0; i < R.affixes && i < pool.length; i++) it.affixList.push(pool[i]);
  if (it.t === 'weapon') {
    it.dmg = Math.max(1, Math.round(it.dmg * R.mul));
    if (rid === 'rare' || rid === 'legend') it.plus = (it.plus || 0) + 1;
    if (rid === 'legend') it.crit = (it.crit || 0) + 0.05;
  } else if (it.t === 'armor') {
    it.def = Math.max(1, Math.round(it.def * R.mul));
    if (rid === 'rare' || rid === 'legend') it.plus = (it.plus || 0) + 1;
  }
  return it;
}
function imbueGear(it, rng) {
  if (!it || !it.t) return null;
  const slot = it.t === 'weapon' ? 'weapon' : it.t === 'armor' ? 'armor' : 'ring';
  const pool = (AFFIX_POOL[slot] || []).filter(a => !hasAffix(it, a));
  if (!pool.length) return null;
  const a = pool[Math.floor(rng.r() * pool.length)];
  it.affixList = (it.affixList || []).concat([a]);
  return a;
}

/* ---------------------------------------------------------------- derived stats */
function recalcStats() {
  const p = G.p;
  if (!p) return;
  let hp = p.baseMaxhp != null ? p.baseMaxhp : p.maxhp;
  let mp = p.baseMp != null ? p.baseMp : p.maxmp;
  for (const slot of ['weapon', 'armor', 'ring']) {
    const it = p[slot];
    if (!it) continue;
    for (const a of affixList(it)) {
      if (a === 'vital') hp += 6;
      else if (a === 'arcane') mp += 5;
    }
  }
  if (p.ring && p.ring.k === 'mana') mp += 6;
  const k = p.perks || {};
  if (k.ironwall) hp += 10;
  if (k.vitality) hp += 18;
  if (k.manaflow) mp += 8;
  p.maxhp = hp;
  p.maxmp = mp;
  p.hp = Math.min(p.hp, p.maxhp);
  p.mp = Math.min(p.mp == null ? p.maxmp : p.mp, p.maxmp);
}
function manaRegenEvery() {
  const p = G.p;
  let n = p.cls === 'mage' ? 2 : 3;
  if (hasPerk('manaflow')) n = 1;
  else if (p.ring && p.ring.k === 'mana') n = Math.max(1, n - 1);
  return n;
}
function mpRegenTick() {
  const p = G.p;
  if (!p) return;
  const every = manaRegenEvery();
  if (every <= 1 || G.turn % every === 0) {
    if (p.mp < p.maxmp) p.mp = Math.min(p.maxmp, p.mp + 1);
  }
}
function spendMp(n) {
  const p = G.p;
  if (n <= 0) return true;
  if (p.mp < n) { log(`마나가 부족하다. (MP ${Math.floor(p.mp)}/${n})`, 'bad'); return false; }
  p.mp -= n;
  updateHUD();
  return true;
}

/* ---------------------------------------------------------------- perks */
const PERKS = {
  vamp: { id: 'vamp', name: '흡혈 본능', icon: '🩸', tag: '생존', lv: 1, desc: '적을 쓰러뜨릴 때마다 HP 3을 회복하고, 근접 피해의 8%를 되찾는다.' },
  frenzy: { id: 'frenzy', name: '연쇄 처치 가속', icon: '⚡', tag: '속도', lv: 1, desc: '적을 처치하면 35% 확률로 그 행동의 턴을 소모하지 않는다.' },
  assassin: { id: 'assassin', name: '은신 암살자', icon: '🗡', tag: '암살', lv: 2, desc: '기습 피해 +60%. 은신·풀숲에서 치명타 확률이 20% 오른다.' },
  ironwall: { id: 'ironwall', name: '강철 방벽', icon: '🛡', tag: '방어', lv: 2, desc: '방어력 +3, 최대 HP +10. 정면에서 버티는 힘이 생긴다.' },
  manaflow: { id: 'manaflow', name: '마나 순환', icon: '🌀', tag: '마법', lv: 1, desc: '최대 MP +8. 마나가 매 턴 회복된다.' },
  hunter: { id: 'hunter', name: '보물 사냥꾼', icon: '💎', tag: '탐험', lv: 2, desc: '상자 금화 +60%, 아이템 등급 확률 상승, 수색 성공률 +30%.' },
  counter: { id: 'counter', name: '반격의 달인', icon: '↩', tag: '전투', lv: 3, desc: '근접 공격을 받으면 30% 확률로 공격력 60%의 반격을 날린다.' },
  berserk: { id: 'berserk', name: '광전사', icon: '💢', tag: '전투', lv: 3, desc: 'HP가 40% 이하일 때 공격력이 40% 오른다.' },
  swift: { id: 'swift', name: '신속한 발놀림', icon: '👟', tag: '회피', lv: 1, desc: '12% 확률로 적의 공격을 회피하고, 한 번 더 행동할 확률 +15%.' },
  lucky: { id: 'lucky', name: '행운아', icon: '🍀', tag: '행운', lv: 1, desc: '치명타 확률 +7%, 더 좋은 전리품이 떨어진다.' },
  vitality: { id: 'vitality', name: '불굴의 육체', icon: '❤️', tag: '생존', lv: 1, desc: '최대 HP +18, 즉시 그만큼 회복한다.' },
  elemental: { id: 'elemental', name: '원소 마스터', icon: '🔥', tag: '마법', lv: 3, desc: '불·냉기·번개 피해가 50% 증가하고 상태이상이 더 오래 간다.' }
};
const PERK_IDS = Object.keys(PERKS);
function hasPerk(id) { return !!(G.p && G.p.perks && G.p.perks[id]); }
function perkChoices(n) {
  const p = G.p;
  const pool = PERK_IDS.filter(id => !hasPerk(id) && PERKS[id].lv <= p.lv);
  const rng = RNG((G.turn + p.lv * 977 + G.kills * 31) >>> 0);
  rng.shuffle(pool);
  return pool.slice(0, n || 3);
}
function takePerk(id) {
  const p = G.p;
  if (!p || !PERKS[id] || hasPerk(id)) return;
  p.perks[id] = 1;
  if (id === 'vitality') { recalcStats(); p.hp = Math.min(p.maxhp, p.hp + 18); }
  recalcStats();
  log(`특성 획득 — ${PERKS[id].name}`, 'gold');
  SFX.play('level');
  updateHUD();
}
function elemMul() { return hasPerk('elemental') ? 1.5 : 1; }
function rarityLuck() { return (hasPerk('hunter') ? 0.09 : 0) + (hasPerk('lucky') ? 0.05 : 0); }

/* ---------------------------------------------------------------- area bounties */
function makeBounty(depth, rng) {
  const roll = rng.r();
  let b;
  if (roll < 0.5) {
    const need = 4 + Math.floor(depth * 0.7) + rng.int(0, 2);
    b = { type: 'slay', need, prog: 0, label: `적 ${need}마리 처치` };
  } else if (roll < 0.78) {
    const need = depth >= 4 ? 3 : 2;
    b = { type: 'chest', need, prog: 0, label: `상자 ${need}개 열기` };
  } else {
    b = { type: 'explore', need: 0.8, prog: 0, label: '이 지역 80% 탐험' };
  }
  b.gold = 35 + depth * 14 + rng.int(0, 20);
  b.xp = 8 + depth * 3;
  b.done = false;
  return b;
}
function bountyText() {
  const b = G.bounty;
  if (!b) return G.contract && G.contract.state === 'active' ? '📜 ' + G.contract.name : '';
  if (b.done) return '🎯 완료';
  if (b.type === 'explore') return `🎯 탐험 ${Math.round(b.prog * 100)}%`;
  return `🎯 ${b.prog}/${b.need}`;
}
function bountyLabel() {
  const b = G.bounty;
  if (!b) return '';
  return b.label;
}
function bountyKill() { bountyAdvance('slay', 1); }
function bountyChest() { bountyAdvance('chest', 1); }
function bountyAdvance(type, n) {
  const b = G.bounty;
  if (!b || b.done) return;
  if (b.type !== type) return;
  b.prog += n;
  if (b.prog >= b.need) completeBounty();
  updateHUD();
}
function bountyExplore() {
  const b = G.bounty;
  if (!b || b.done || b.type !== 'explore') return;
  const m = G.m;
  let total = 0, seen = 0;
  for (let i = 0; i < W * H; i++) {
    const t = m.t[i];
    if (t === T.WALL || t === T.PILLAR || t === T.COVER || t === T.BRICK || t === T.TREE) continue;
    total++;
    if (m.seen[i]) seen++;
  }
  b.prog = total ? seen / total : 0;
  updateHUD();
  if (b.prog >= b.need) completeBounty();
}
function completeBounty() {
  const b = G.bounty;
  if (!b || b.done) return;
  b.done = true;
  G.p.gold += b.gold;
  addFloat(G.p.x, G.p.y, '목표 달성', '#ffe089');
  log(`지역 목표 달성! 금화 ${b.gold}개와 경험치를 얻었다.`, 'gold');
  toast('🎯 지역 목표 달성!');
  SFX.play('level');
  gainXp(b.xp);
  updateHUD();
}
