/* =====================================================================
   RENDERER v4 — full-bleed camera, zoom, wide-world tiles, path preview
   ===================================================================== */
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let DPR = 1, CW = 0, CH = 0;
const VIEW = { x: 0, y: 0, w: 0, h: 0 };
let TILE = 34, BASE_TILE = 34;
const CAM = { x: 0, y: 0 };
let animT = 0, camSnap = true;
const SAFE = { t: 0, b: 0, l: 0, r: 0 };

function readSafe() {
  try {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);visibility:hidden;';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    SAFE.t = parseFloat(cs.paddingTop) || 0;
    SAFE.r = parseFloat(cs.paddingRight) || 0;
    SAFE.b = parseFloat(cs.paddingBottom) || 0;
    SAFE.l = parseFloat(cs.paddingLeft) || 0;
    el.remove();
  } catch (e) { }
}
function zoomLevel() { return G.zoom || DB.ui.zoom || 1; }
function resize() {
  DPR = Math.min(2.5, window.devicePixelRatio || 1);
  CW = window.innerWidth; CH = window.innerHeight;
  cv.width = Math.floor(CW * DPR);
  cv.height = Math.floor(CH * DPR);
  cv.style.width = CW + 'px';
  cv.style.height = CH + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  /* full-bleed: the canvas is the whole screen, HUD floats over it */
  VIEW.x = 0; VIEW.y = 0; VIEW.w = CW; VIEW.h = CH;
  const z = zoomLevel();
  /* ~11.5 x 9.5 tiles visible at 1x on a phone, wider on desktop */
  const unit = Math.min(CW / 11.6, CH / 9.2);
  BASE_TILE = clamp(unit, 18, 54);
  TILE = clamp(Math.round(BASE_TILE * z), 16, 120);
  camSnap = true;
  draw();
}
function tileToScreen(x, y) {
  return { x: VIEW.x + x * TILE - CAM.x, y: VIEW.y + y * TILE - CAM.y, s: TILE };
}
function screenToTile(px, py) {
  return {
    x: Math.floor((px - VIEW.x + CAM.x) / TILE),
    y: Math.floor((py - VIEW.y + CAM.y) / TILE)
  };
}
function focusPoint() {
  const hud = document.getElementById('hud');
  const dock = document.getElementById('dock');
  const hudH = hud ? hud.getBoundingClientRect().height : 70;
  const dockH = dock ? dock.getBoundingClientRect().height : 60;
  return { x: CW / 2, y: hudH + (CH - dockH - hudH) / 2 };
}
function updateCamera() {
  if (!G.p) return;
  const mapW = W * TILE, mapH = H * TILE;
  const f = focusPoint();
  const px = G.p.x * TILE + TILE / 2, py = G.p.y * TILE + TILE / 2;
  let cx = px - f.x, cy = py - f.y;
  if (mapW <= VIEW.w) cx = (mapW - VIEW.w) / 2;
  else cx = clamp(cx, 0, mapW - VIEW.w);
  if (mapH <= VIEW.h) cy = (mapH - VIEW.h) / 2;
  else cy = clamp(cy, -40, mapH - VIEW.h + 40);
  if (camSnap) { CAM.x = cx; CAM.y = cy; camSnap = false; return; }
  CAM.x += (cx - CAM.x) * 0.35;
  CAM.y += (cy - CAM.y) * 0.35;
  if (Math.abs(cx - CAM.x) < 0.5) CAM.x = cx;
  if (Math.abs(cy - CAM.y) < 0.5) CAM.y = cy;
}

/* ---------------------------------------------------------------- draw */
function draw() {
  if (!G.p || !G.m) return;
  animT += 1;
  updateCamera();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CW, CH);
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  if (G.zone === 'dungeon') { bg.addColorStop(0, '#0a0b11'); bg.addColorStop(1, '#04050a'); }
  else if (G.zone === 'town') { bg.addColorStop(0, '#161420'); bg.addColorStop(1, '#0a0a10'); }
  else { const sky = (BIOMES[G.m.biome] || BIOMES.forest).sky; bg.addColorStop(0, sky); bg.addColorStop(1, '#080a0c'); }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);

  ctx.save();
  ctx.beginPath(); ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h); ctx.clip();
  ctx.fillStyle = G.zone === 'dungeon' ? '#05060a' : '#0b0d10';
  ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

  const x0 = Math.max(0, Math.floor(CAM.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(CAM.y / TILE) - 1);
  const x1 = Math.min(W - 1, Math.ceil((CAM.x + VIEW.w) / TILE));
  const y1 = Math.min(H - 1, Math.ceil((CAM.y + VIEW.h) / TILE));
  const m = G.m;
  const waterFrame = Math.floor(animT / 26) % 2;
  const outdoor = G.zone !== 'dungeon';

  /* --- terrain --- */
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!m.seen[i]) continue;
      const vis = m.vis[i];
      const spr = tileSprite(x, y, waterFrame);
      const sx = Math.round(VIEW.x + x * TILE - CAM.x);
      const sy = Math.round(VIEW.y + y * TILE - CAM.y);
      ctx.globalAlpha = vis ? 1 : (outdoor ? 0.78 : 0.44);
      ctx.drawImage(spr, sx, sy, TILE, TILE);
      if (vis) {
        const above0 = y - 1 >= 0 ? m.t[(y - 1) * W + x] : T.WALL;
        const solidNow = !!TILE_SOLID[m.t[i]];
        const solidAbove = !!TILE_SOLID[above0];
        if (solidNow && !solidAbove) {
          ctx.fillStyle = 'rgba(180,196,220,.22)';
          ctx.fillRect(sx, sy, TILE, Math.max(1, TILE * 0.1));
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.fillRect(sx, sy + TILE * 0.1, TILE, Math.max(1, TILE * 0.05));
        }
        const below = y + 1 < H ? m.t[(y + 1) * W + x] : T.WALL;
        if (solidNow && !TILE_SOLID[below]) {
          const g = ctx.createLinearGradient(0, sy + TILE * 0.7, 0, sy + TILE * 1.15);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
          ctx.fillStyle = g; ctx.fillRect(sx, sy + TILE * 0.7, TILE, TILE * 0.45);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  /* --- A* path preview (drawn on the ground before the walk) --- */
  if (G.pathPreview && G.pathPreview.length && (G.state === 'play')) {
    const info = pathPreviewInfo(G.pathPreview);
    const col = info && info.safe ? '140,241,154' : '233,162,74';
    const t0 = (typeof performance !== 'undefined' ? performance.now() : 0) - G.pathAt;
    const fade = clamp(1 - t0 / 5000, 0.35, 1);
    for (let k = 0; k < G.pathPreview.length; k++) {
      const t = G.pathPreview[k];
      if (!m.seen[t.y * W + t.x]) continue;
      const sx = Math.round(VIEW.x + t.x * TILE - CAM.x + TILE / 2);
      const sy = Math.round(VIEW.y + t.y * TILE - CAM.y + TILE / 2);
      const r = Math.max(2, TILE * 0.085);
      ctx.globalAlpha = fade * (0.5 + 0.5 * (1 - k / Math.max(1, G.pathPreview.length)));
      ctx.fillStyle = `rgba(${col},.95)`;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill();
      if (k > 0) {
        const pv = G.pathPreview[k - 1];
        const px2 = VIEW.x + pv.x * TILE - CAM.x + TILE / 2;
        const py2 = VIEW.y + pv.y * TILE - CAM.y + TILE / 2;
        ctx.strokeStyle = `rgba(${col},.45)`;
        ctx.lineWidth = Math.max(1.5, TILE * 0.045);
        ctx.beginPath(); ctx.moveTo(px2, py2); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
    const goal = G.pathPreview[G.pathPreview.length - 1];
    if (goal) {
      const sx = Math.round(VIEW.x + goal.x * TILE - CAM.x);
      const sy = Math.round(VIEW.y + goal.y * TILE - CAM.y);
      const pulse = 0.6 + 0.4 * Math.sin(animT * 0.2);
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = `rgba(${col},${0.7 * pulse + 0.2})`;
      ctx.lineWidth = Math.max(2, TILE * 0.06);
      ctx.strokeRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;
  }

  /* --- torches & braziers light --- */
  for (const tc of m.torches) {
    const i = tc.y * W + tc.x;
    if (!m.seen[i]) continue;
    const sx = Math.round(VIEW.x + tc.x * TILE - CAM.x);
    const sy = Math.round(VIEW.y + tc.y * TILE - CAM.y);
    ctx.globalAlpha = m.vis[i] ? 1 : 0.4;
    ctx.drawImage(SP.torch, sx, sy, TILE, TILE);
    if (m.vis[i]) {
      const fl = 0.72 + 0.28 * Math.sin(animT * 0.19 + tc.ph) + 0.06 * Math.sin(animT * 0.7 + tc.ph * 3);
      const g = ctx.createRadialGradient(sx + TILE / 2, sy + TILE * 0.35, 1, sx + TILE / 2, sy + TILE * 0.35, TILE * 2.6 * fl);
      g.addColorStop(0, 'rgba(255,170,70,.26)');
      g.addColorStop(0.45, 'rgba(255,140,50,.07)');
      g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.beginPath();
      ctx.arc(sx + TILE / 2, sy + TILE * 0.35, TILE * 2.6 * fl, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  /* --- brazier glow --- */
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (m.t[i] !== T.BRAZIER || !m.vis[i]) continue;
      const sx = VIEW.x + x * TILE - CAM.x + TILE / 2;
      const sy = VIEW.y + y * TILE - CAM.y + TILE * 0.4;
      const fl = 0.8 + 0.2 * Math.sin(animT * 0.23 + x * 1.3 + y * 0.7);
      const g = ctx.createRadialGradient(sx, sy, 1, sx, sy, TILE * 3.3 * fl);
      g.addColorStop(0, 'rgba(255,170,80,.26)');
      g.addColorStop(0.4, 'rgba(255,140,60,.10)');
      g.addColorStop(1, 'rgba(255,110,30,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, TILE * 3.3 * fl, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* --- traps (found) --- */
  for (const tr of m.traps) {
    if (!tr.found) continue;
    const i = tr.y * W + tr.x;
    if (!m.seen[i]) continue;
    const sx = VIEW.x + tr.x * TILE - CAM.x, sy = VIEW.y + tr.y * TILE - CAM.y;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = tr.armed ? '#c25b5b' : '#5a5a5a';
    const tw = Math.max(2, TILE * 0.09);
    ctx.fillRect(sx + TILE * 0.2, sy + TILE * 0.2, tw, TILE * 0.6);
    ctx.fillRect(sx + TILE * 0.45, sy + TILE * 0.2, tw, TILE * 0.6);
    ctx.fillRect(sx + TILE * 0.7, sy + TILE * 0.2, tw, TILE * 0.6);
    ctx.globalAlpha = 1;
  }

  /* --- objects --- */
  for (const o of m.objs) {
    const i = o.y * W + o.x;
    if (!m.seen[i]) continue;
    if (!m.vis[i]) continue;
    const sx = Math.round(VIEW.x + o.x * TILE - CAM.x);
    const sy = Math.round(VIEW.y + o.y * TILE - CAM.y);
    const spr = objSprite(o);
    ctx.globalAlpha = 1;
    if (spr) ctx.drawImage(spr, sx, sy, TILE, TILE);
    const ui = OBJ_UI[o.kind];
    if (ui && o.kind !== 'chest' && o.kind !== 'barrel' && o.kind !== 'crate') {
      const p2 = 0.55 + 0.45 * Math.sin(animT * (o.kind === 'campfire' || o.kind === 'inn' ? 0.22 : 0.09) + (o.ph || 0));
      const g = ctx.createRadialGradient(sx + TILE / 2, sy + TILE * 0.55, 1, sx + TILE / 2, sy + TILE * 0.55, TILE * 1.2);
      g.addColorStop(0, rgba(ui.glow, 0.18 * p2));
      g.addColorStop(1, rgba(ui.glow, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx + TILE / 2, sy + TILE * 0.55, TILE * 1.2, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if ((o.kind === 'board' || o.kind === 'inn' || o.kind === 'smith' || o.kind === 'herbalist' || o.kind === 'merchant') && TILE >= 26) {
      const label = { board: '의뢰', inn: '여관', smith: '대장간', herbalist: '약초', merchant: '상점' }[o.kind];
      ctx.font = `900 ${Math.max(8, TILE * 0.26)}px -apple-system,'Apple SD Gothic Neo',sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      const w = ctx.measureText(label).width + 6;
      ctx.fillRect(sx + TILE / 2 - w / 2, sy - TILE * 0.26, w, TILE * 0.3);
      ctx.fillStyle = '#ffe1a0';
      ctx.fillText(label, sx + TILE / 2, sy - TILE * 0.05);
      ctx.textAlign = 'left';
    }
  }

  /* --- items --- */
  for (const it of m.items) {
    const i = it.y * W + it.x;
    if (!m.seen[i] || !m.vis[i]) continue;
    const sx = VIEW.x + it.x * TILE - CAM.x, sy = VIEW.y + it.y * TILE - CAM.y;
    const bob = Math.sin(animT * 0.09 + it.x * 0.7) * TILE * 0.05;
    const spr = itemSprite(it);
    if (spr) ctx.drawImage(spr, sx + TILE * 0.12, sy + TILE * 0.12 + bob, TILE * 0.76, TILE * 0.76);
    const g = ctx.createRadialGradient(sx + TILE / 2, sy + TILE / 2, 1, sx + TILE / 2, sy + TILE / 2, TILE * 0.8);
    g.addColorStop(0, 'rgba(255,230,150,.15)');
    g.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx + TILE / 2, sy + TILE / 2, TILE * 0.8, 0, 6.2832); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  /* --- fire & gas --- */
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!m.vis[i]) continue;
      const sx = VIEW.x + x * TILE - CAM.x, sy = VIEW.y + y * TILE - CAM.y;
      if (m.fire[i] > 0) {
        const f = 0.6 + 0.4 * Math.sin(animT * 0.35 + x * 1.7 + y * 0.9);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(sx + TILE / 2, sy + TILE * 0.6, 1, sx + TILE / 2, sy + TILE * 0.6, TILE * 1.1);
        g.addColorStop(0, `rgba(255,190,80,${0.5 * f})`);
        g.addColorStop(0.5, `rgba(255,110,30,${0.25 * f})`);
        g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx + TILE / 2, sy + TILE * 0.6, TILE * 1.1, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        for (let k = 0; k < 3; k++) {
          const fx = sx + TILE * (0.25 + k * 0.25) + Math.sin(animT * 0.3 + k + x) * TILE * 0.05;
          const fh = TILE * (0.28 + 0.16 * Math.sin(animT * 0.4 + k * 2 + y));
          ctx.fillStyle = k % 2 ? 'rgba(255,150,50,.9)' : 'rgba(255,210,90,.85)';
          ctx.beginPath();
          ctx.moveTo(fx, sy + TILE * 0.85);
          ctx.lineTo(fx + TILE * 0.09, sy + TILE * 0.85 - fh);
          ctx.lineTo(fx + TILE * 0.18, sy + TILE * 0.85);
          ctx.closePath(); ctx.fill();
        }
      }
      if (m.gas[i] > 0) {
        const a = Math.min(0.32, m.gas[i] * 0.04) * (0.75 + 0.25 * Math.sin(animT * 0.05 + x));
        ctx.fillStyle = `rgba(120,200,90,${a})`;
        ctx.beginPath(); ctx.arc(sx + TILE / 2, sy + TILE / 2, TILE * 0.55, 0, 6.2832); ctx.fill();
      }
    }
  }

  /* --- telegraphs --- */
  for (const mon of m.mons) {
    if (!mon.tele || mon.hp <= 0) continue;
    const tk = TELE_KINDS[mon.tele.kind] || { color: '#ff5a4a', icon: '!' };
    for (const t of mon.tele.tiles) {
      const i = t.y * W + t.x;
      if (!m.seen[i]) continue;
      const sx = VIEW.x + t.x * TILE - CAM.x, sy = VIEW.y + t.y * TILE - CAM.y;
      const pulse = 0.5 + 0.5 * Math.sin(animT * 0.28 + t.x * 0.7);
      ctx.globalAlpha = m.vis[i] ? 1 : 0.35;
      ctx.fillStyle = `rgba(255,54,44,${0.18 + 0.24 * pulse})`;
      ctx.fillRect(sx, sy, TILE, TILE);
      ctx.strokeStyle = `rgba(255,140,110,${0.35 + 0.45 * pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
      ctx.lineWidth = 1;
      ctx.globalAlpha = (m.vis[i] ? 0.9 : 0.4) * (0.55 + 0.45 * pulse);
      ctx.fillStyle = tk.color;
      ctx.font = `900 ${Math.max(10, TILE * 0.36)}px -apple-system,'Apple SD Gothic Neo',sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(tk.icon, sx + TILE / 2, sy + TILE * 0.62);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  /* --- monsters --- */
  for (const mon of m.mons) {
    if (mon.hp <= 0) continue;
    const i = mon.y * W + mon.x;
    if (!m.vis[i]) continue;
    const spr = SP.ch[(MONS[mon.kind] || {}).spr] || SP.ch.rat;
    const bob = Math.sin(animT * 0.12 + mon.ph) * TILE * 0.03;
    drawActor(spr, mon.x, mon.y, bob, mon.elite ? TILE * 1.08 : TILE);
    if (mon.hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.8, mon.hitFlash * 3);
      const sx = VIEW.x + mon.x * TILE - CAM.x, sy = VIEW.y + mon.y * TILE - CAM.y;
      ctx.drawImage(spr, sx, sy + bob, TILE, TILE);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (mon.hp < mon.maxhp || mon.boss) {
      const sx = VIEW.x + mon.x * TILE - CAM.x, sy = VIEW.y + mon.y * TILE - CAM.y;
      const w = TILE * (mon.boss ? 0.9 : 0.76), h = Math.max(2.5, TILE * 0.085);
      const bx = sx + (TILE - w) / 2, by = sy - h - 3;
      const pct = clamp(mon.hp / mon.maxhp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.85)';
      ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
      ctx.fillStyle = mon.boss ? '#e07f36' : pct > 0.5 ? '#e4585c' : pct > 0.25 ? '#e07f36' : '#c2302f';
      ctx.fillRect(bx, by, w * pct, h);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(bx, by, w * pct, 1);
    }
    /* status & awareness badges */
    const badges = [];
    const st0 = monStateOf(mon);
    if (st0 === 'sleep') badges.push('💤');
    else if (mon.tele) badges.push('❗');
    else if (st0 === 'alert') badges.push('❓');
    if (mon.status.burn > 0) badges.push('🔥');
    if (mon.status.freeze > 0) badges.push('❄');
    if (mon.status.poison > 0) badges.push('☠');
    if (mon.status.stun > 0) badges.push('⚡');
    if (mon.status.confuse > 0) badges.push('💫');
    if (mon.status.fear > 0) badges.push('😱');
    if (mon.status.wet > 0) badges.push('💧');
    if (badges.length) {
      const BADGE_TONE = { '💤': '#6f8cba', '❗': '#d94b3a', '❓': '#c9853a', '🔥': '#d4642a', '❄': '#5aa6d8', '☠': '#8fbf58', '⚡': '#d8b52e', '💫': '#a271c8', '😱': '#b8569f', '💧': '#4a90c8' };
      const sx = VIEW.x + mon.x * TILE - CAM.x, sy = VIEW.y + mon.y * TILE - CAM.y;
      const fs = Math.max(10, TILE * 0.34);
      ctx.font = `${fs}px -apple-system,'Apple Color Emoji','Noto Color Emoji',sans-serif`;
      ctx.textAlign = 'left';
      const show = badges.slice(0, 4);
      const bobA = Math.sin(animT * 0.09 + mon.ph) * TILE * 0.02;
      for (let k = 0; k < show.length; k++) {
        const bx = sx + TILE * 0.01 + k * fs * 0.94;
        const by = sy + TILE * 0.02 + bobA;
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = BADGE_TONE[show[k]] || '#39424f';
        ctx.fillRect(bx - 0.5, by - 0.5, fs * 0.92, fs * 0.92);
        ctx.globalAlpha = 0.98;
        ctx.fillText(show[k], bx, by + fs * 0.84);
      }
      ctx.globalAlpha = 1;
    }
    if (mon.status.freeze > 0) {
      const sx = VIEW.x + mon.x * TILE - CAM.x, sy = VIEW.y + mon.y * TILE - CAM.y;
      ctx.fillStyle = 'rgba(150,220,255,.28)'; ctx.fillRect(sx, sy, TILE, TILE);
    }
    if (mon.status.poison > 0) {
      const sx = VIEW.x + mon.x * TILE - CAM.x, sy = VIEW.y + mon.y * TILE - CAM.y;
      ctx.fillStyle = 'rgba(120,220,110,.20)'; ctx.fillRect(sx, sy, TILE, TILE);
    }
    if (mon.status.oil > 0) {
      const sx = VIEW.x + mon.x * TILE - CAM.x, sy = VIEW.y + mon.y * TILE - CAM.y;
      ctx.fillStyle = 'rgba(130,95,200,.18)'; ctx.fillRect(sx, sy, TILE, TILE);
    }
  }

  /* --- townsfolk --- */
  for (const npc of m.npcs) {
    const i = npc.y * W + npc.x;
    if (!m.seen[i]) continue;
    const spr = SP.ch[npc.spr] || SP.ch.villager;
    const bob = Math.sin(animT * 0.08 + (npc.ph || 0)) * TILE * 0.025;
    drawActor(spr, npc.x, npc.y, bob, TILE);
    if (m.vis[i] && TILE >= 24) {
      const sx = VIEW.x + npc.x * TILE - CAM.x, sy = VIEW.y + npc.y * TILE - CAM.y;
      ctx.font = `800 ${Math.max(8, TILE * 0.24)}px -apple-system,'Apple SD Gothic Neo',sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      const w = ctx.measureText(npc.name).width + 6;
      ctx.fillRect(sx + TILE / 2 - w / 2, sy - TILE * 0.2, w, TILE * 0.26);
      ctx.fillStyle = '#cfe0ff';
      ctx.fillText(npc.name, sx + TILE / 2, sy - TILE * 0.005);
      ctx.textAlign = 'left';
    }
  }

  /* --- player --- */
  {
    const p = G.p;
    const spr = SP.ch[p.cls] || SP.ch.warrior;
    const bob = Math.sin(animT * 0.11) * TILE * 0.035;
    if (p.hp > 0) {
      const stealthed = p.status.stealth > 0 || inGrass(p.x, p.y);
      drawActor(spr, p.x, p.y, bob, TILE, stealthed ? 0.72 : 1);
      const sx = VIEW.x + p.x * TILE - CAM.x, sy = VIEW.y + p.y * TILE - CAM.y;
      if (p.status.burn > 0 || p.status.poison > 0) {
        const a = 0.16 + 0.1 * Math.sin(animT * 0.3);
        ctx.fillStyle = p.status.burn ? `rgba(255,140,50,${a})` : `rgba(120,220,110,${a})`;
        ctx.fillRect(sx, sy, TILE, TILE);
      }
      const px = sx + TILE / 2, py = sy + TILE / 2;
      if (p.status.guard > 0 || p.status.brace > 0) {
        ctx.strokeStyle = p.status.guard > 0 ? 'rgba(159,224,255,.75)' : 'rgba(207,214,226,.65)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, TILE * 0.46, -2.4, 0.6); ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (p.status.shield > 0) {
        const a = 0.25 + 0.12 * Math.sin(animT * 0.16);
        ctx.strokeStyle = `rgba(150,200,255,${a + 0.25})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, TILE * 0.55, 0, 6.2832); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = `rgba(120,180,255,${a * 0.5})`;
        ctx.beginPath(); ctx.arc(px, py, TILE * 0.55, 0, 6.2832); ctx.fill();
      }
      if (p.status.stealth > 0) {
        ctx.fillStyle = 'rgba(40,20,60,.28)';
        ctx.beginPath(); ctx.arc(px, py, TILE * 0.5, 0, 6.2832); ctx.fill();
      }
      /* weapon slot marker */
      if (p.slots && p.slots[1]) {
        ctx.font = `900 ${Math.max(8, TILE * 0.2)}px -apple-system,sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(sx + TILE * 0.66, sy + TILE * 0.72, TILE * 0.28, TILE * 0.24);
        ctx.fillStyle = '#ffe1a0';
        ctx.fillText(p.slotIdx === 0 ? 'A' : 'B', sx + TILE * 0.8, sy + TILE * 0.9);
        ctx.textAlign = 'left';
      }
    }
  }

  /* --- tile cursor --- */
  if (G.cursor) {
    const age = (animT - G.cursor.t0) / 45;
    if (age > 1 || !G.m.seen[G.cursor.y * W + G.cursor.x]) G.cursor = null;
    else {
      const a = 1 - age;
      const sx = Math.round(VIEW.x + G.cursor.x * TILE - CAM.x);
      const sy = Math.round(VIEW.y + G.cursor.y * TILE - CAM.y);
      ctx.strokeStyle = `rgba(255,238,170,${0.55 * a + 0.25})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1.5, sy + 1.5, TILE - 3, TILE - 3);
      const L = TILE * 0.22;
      ctx.strokeStyle = `rgba(255,248,200,${0.9 * a})`;
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy + 2 + L); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx + 2 + L, sy + 2);
      ctx.moveTo(sx + TILE - 2, sy + TILE - 2 - L); ctx.lineTo(sx + TILE - 2, sy + TILE - 2); ctx.lineTo(sx + TILE - 2 - L, sy + TILE - 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  /* --- target mode --- */
  if (G.target) {
    const p = G.p;
    let range = 6;
    if (G.target.mode === 'wand') range = WANDS[G.target.item.k].range;
    else if (G.target.mode === 'skill') range = G.target.skill.range;
    for (let y = p.y - range; y <= p.y + range; y++) {
      for (let x = p.x - range; x <= p.x + range; x++) {
        if (!inb(x, y)) continue;
        const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
        if (d > range) continue;
        const sx = VIEW.x + x * TILE - CAM.x, sy = VIEW.y + y * TILE - CAM.y;
        ctx.fillStyle = 'rgba(255,220,120,.05)';
        ctx.fillRect(sx, sy, TILE, TILE);
      }
    }
    const hov = G.target.hover;
    if (hov && inb(hov.x, hov.y)) {
      const rc = raycast(p.x, p.y, hov.x, hov.y);
      for (let i = 0; i < rc.tiles.length; i++) {
        const t = rc.tiles[i];
        if (t.x === p.x && t.y === p.y) continue;
        const sx = VIEW.x + t.x * TILE - CAM.x, sy = VIEW.y + t.y * TILE - CAM.y;
        const isBlock = rc.block && rc.block.x === t.x && rc.block.y === t.y;
        ctx.fillStyle = isBlock ? 'rgba(255,70,60,.30)' : (rc.clear ? 'rgba(140,255,180,.20)' : 'rgba(255,120,90,.14)');
        ctx.fillRect(sx + TILE * 0.22, sy + TILE * 0.22, TILE * 0.56, TILE * 0.56);
      }
      const sx = VIEW.x + hov.x * TILE - CAM.x, sy = VIEW.y + hov.y * TILE - CAM.y;
      ctx.strokeStyle = rc.clear ? '#ffd24a' : '#ff6b5c';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
      ctx.lineWidth = 1;
    }
  }

  /* --- fx --- */
  for (const f of G.fx) drawFx(f);

  /* --- floats --- */
  for (const fl of G.floats) {
    const sx = VIEW.x + fl.x * TILE - CAM.x + TILE / 2;
    const sy = VIEW.y + fl.y * TILE - CAM.y + TILE * 0.25 + fl.vy * 60 * fl.t * 60;
    const a = clamp(1 - fl.t / fl.life, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `900 ${Math.max(11, TILE * 0.4)}px -apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(fl.txt, sx, sy - fl.t * 16);
    ctx.fillStyle = fl.col;
    ctx.fillText(fl.txt, sx, sy - fl.t * 16);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  drawParticles();

  /* --- lighting --- */
  const p = G.p;
  const psx = VIEW.x + p.x * TILE - CAM.x + TILE / 2;
  const psy = VIEW.y + p.y * TILE - CAM.y + TILE / 2;
  if (G.zone === 'dungeon') {
    const flick = 0.9 + 0.1 * Math.sin(animT * 0.07) + 0.04 * Math.sin(animT * 0.31);
    const rad = TILE * 7.6 * flick;
    const vg = ctx.createRadialGradient(psx, psy, TILE * 1.2, psx, psy, rad);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.55, 'rgba(2,3,6,.14)');
    vg.addColorStop(1, 'rgba(0,0,0,.58)');
    ctx.fillStyle = vg; ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(psx, psy, 1, psx, psy, TILE * 4.6);
    lg.addColorStop(0, 'rgba(255,220,160,.13)');
    lg.addColorStop(0.5, 'rgba(255,190,120,.05)');
    lg.addColorStop(1, 'rgba(255,180,100,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(psx, psy, TILE * 4.6, 0, 6.2832); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else {
    /* outdoor: soft tint + edge fog */
    const vg = ctx.createRadialGradient(CW / 2, CH * 0.5, Math.min(CW, CH) * 0.34, CW / 2, CH * 0.5, Math.max(CW, CH) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, G.zone === 'town' ? 'rgba(6,6,12,.36)' : 'rgba(4,6,8,.32)');
    ctx.fillStyle = vg; ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    if (G.zone === 'town') {
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(psx, psy, 1, psx, psy, TILE * 3.2);
      lg.addColorStop(0, 'rgba(255,205,140,.07)');
      lg.addColorStop(1, 'rgba(255,180,90,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(psx, psy, TILE * 3.2, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  ctx.restore();

  if (G.shake > 0.2) G.shake *= 0.85; else G.shake = 0;
}

/* ---------------------------------------------------------------- sprite choice */
function tileSprite(x, y, waterFrame) {
  const m = G.m, i = y * W + x, t = m.t[i], v = m.vari[i];
  switch (t) {
    case T.WALL: return SP.wall;
    case T.FLOOR: return SP.floor[v % 3];
    case T.ROAD: return SP.road[v % 3];
    case T.DIRT: return SP.dirt[v % 3];
    case T.WOOD: return SP.wood[v % 2];
    case T.WATER: return SP.water[waterFrame];
    case T.GRASS: return SP.grass[v % 3];
    case T.BUSH: return SP.bush;
    case T.TREE: return SP.tree[v % 3];
    case T.OIL: return SP.oil;
    case T.CHASM: return SP.chasm;
    case T.STAIRS: return SP.stairs;
    case T.DOOR: return SP.door;
    case T.LOCKED: return SP.locked;
    case T.SECRET: return SP.wall;
    case T.ICE: return SP.ice;
    case T.RUBBLE: return SP.rubble;
    case T.PILLAR: return SP.pillar;
    case T.COVER: return SP.cover;
    case T.FENCE: return SP.fence;
    case T.BRICK: return SP.brick[v % 2];
    case T.BANNER: return SP.banner;
    case T.BRAZIER: return SP.brazier;
    case T.BOOKSHELF: return SP.bookshelf;
    case T.WELL: return SP.well;
    case T.STATUE: return SP.statue;
    case T.TENT: return SP.tent;
    case T.RETURN: return SP.portal;
    case T.BLOOD: return SP.blood;
    case T.GATE: return SP.gate;
    case T.PLANK: return SP.plank;
    case T.CARPET: return SP.carpet;
    case T.MUD: return SP.mud;
    case T.MOSS: return SP.moss;
    case T.ARCH: return SP.arch;
    default: return SP.floor[0];
  }
}
function objSprite(o) {
  if (o.kind === 'inn') return SP.prop.inn;
  if (o.kind === 'smith') return SP.prop.smith;
  if (o.kind === 'herbalist') return SP.prop.herbalist;
  if (o.kind === 'board') return SP.prop.board;
  if (o.kind === 'fountain') return SP.prop.fountain;
  if (o.kind === 'merchant') return SP.prop.stall;
  switch (o.kind) {
    case 'barrel': case 'crate': return SP.barrel;
    case 'chest': return o.opened ? SP.chestOpen : SP.chest;
    case 'shrine': return SP.shrine;
    case 'anvil': return SP.anvil;
    case 'statue': return SP.statue;
    case 'bones': return SP.bones;
    case 'campfire': return SP.campfire;
    case 'herb': return SP.herb;
    case 'berry': return SP.berry;
    case 'sign': case 'notice': return SP.sign;
    case 'tent': return SP.tent;
    case 'bench': return SP.cover;
    case 'well': return SP.well;
  }
  return SP.chest;
}
function drawActor(spr, x, y, bob, size, alpha) {
  const s = size || TILE;
  const sx = Math.round(VIEW.x + x * TILE - CAM.x - (s - TILE) / 2);
  const sy = Math.round(VIEW.y + y * TILE - CAM.y + (bob || 0) - (s - TILE));
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(sx + s / 2, sy + s * 0.88, s * 0.3, s * 0.12, 0, 0, 6.2832);
  ctx.fill();
  ctx.drawImage(spr, sx, sy, s, s);
  ctx.globalAlpha = 1;
}
function drawFx(f) {
  f.t += 1 / 60;
  const life = f.type === 'boom' ? 0.5 : f.type === 'bolt' ? 0.28 : f.type === 'arc' ? 0.32 : f.type === 'death' ? 0.6 : 0.35;
  const a = clamp(1 - f.t / life, 0, 1);
  if (a <= 0) return;
  if (f.type === 'slash') {
    const sx = VIEW.x + f.x * TILE - CAM.x, sy = VIEW.y + f.y * TILE - CAM.y;
    ctx.strokeStyle = f.enemy ? `rgba(255,90,90,${a})` : `rgba(255,245,200,${a})`;
    ctx.lineWidth = Math.max(2, TILE * 0.1);
    ctx.beginPath();
    ctx.arc(sx + TILE / 2, sy + TILE / 2, TILE * (0.35 + f.t), -0.9, 0.9);
    ctx.stroke();
    ctx.lineWidth = 1;
  } else if (f.type === 'bolt' || f.type === 'arc') {
    const x1 = f.x1 !== undefined ? VIEW.x + f.x1 * TILE - CAM.x + TILE / 2 : VIEW.x + f.x * TILE - CAM.x + TILE / 2;
    const y1 = f.y1 !== undefined ? VIEW.y + f.y1 * TILE - CAM.y + TILE / 2 : VIEW.y + f.y * TILE - CAM.y + TILE / 2;
    const x2 = VIEW.x + f.x2 * TILE - CAM.x + TILE / 2, y2 = VIEW.y + f.y2 * TILE - CAM.y + TILE / 2;
    ctx.strokeStyle = f.color || '#fff';
    ctx.globalAlpha = a;
    ctx.lineWidth = Math.max(2, TILE * 0.12);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineWidth = Math.max(1, TILE * 0.04); ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  } else if (f.type === 'boom') {
    const sx = VIEW.x + f.x * TILE - CAM.x + TILE / 2, sy = VIEW.y + f.y * TILE - CAM.y + TILE / 2;
    const r = TILE * (0.4 + f.t * 3.2);
    const g = ctx.createRadialGradient(sx, sy, 1, sx, sy, r);
    g.addColorStop(0, `rgba(255,240,190,${a * 0.9})`);
    g.addColorStop(0.5, `rgba(255,150,60,${a * 0.5})`);
    g.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill();
  } else if (f.type === 'blink') {
    const sx = VIEW.x + f.x * TILE - CAM.x + TILE / 2, sy = VIEW.y + f.y * TILE - CAM.y + TILE / 2;
    ctx.strokeStyle = `rgba(180,140,255,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, TILE * (0.2 + f.t * 1.6), 0, 6.2832); ctx.stroke();
    ctx.lineWidth = 1;
  } else if (f.type === 'levelup') {
    const sx = VIEW.x + f.x * TILE - CAM.x + TILE / 2, sy = VIEW.y + f.y * TILE - CAM.y + TILE / 2;
    for (let i = 0; i < 8; i++) {
      const ang = i / 8 * 6.2832 + f.t;
      const r = TILE * (0.4 + f.t * 2.4);
      ctx.fillStyle = `rgba(255,225,140,${a})`;
      ctx.fillRect(sx + Math.cos(ang) * r - 2, sy + Math.sin(ang) * r - 2, 4, 4);
    }
  } else if (f.type === 'spin') {
    const sx = VIEW.x + f.x * TILE - CAM.x + TILE / 2, sy = VIEW.y + f.y * TILE - CAM.y + TILE / 2;
    ctx.strokeStyle = `rgba(255,245,200,${a})`;
    ctx.lineWidth = Math.max(2, TILE * 0.08);
    for (let i = 0; i < 2; i++) {
      const r = TILE * (0.3 + f.t * 2.2 + i * 0.22);
      ctx.beginPath(); ctx.arc(sx, sy, r, i * 2.1 + f.t * 6, i * 2.1 + f.t * 6 + 2.4); ctx.stroke();
    }
    ctx.lineWidth = 1;
  } else if (f.type === 'rustle') {
    const sx = VIEW.x + f.x * TILE - CAM.x + TILE / 2, sy = VIEW.y + f.y * TILE - CAM.y + TILE / 2;
    for (let i = 0; i < 4; i++) {
      const ang = i / 4 * 6.2832 + f.t * 2;
      const r = TILE * (0.18 + f.t * 0.9);
      ctx.fillStyle = `rgba(120,190,110,${a * 0.8})`;
      ctx.fillRect(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r - f.t * 8, 3, 3);
    }
  } else if (f.type === 'death') {
    const sx = VIEW.x + f.x * TILE - CAM.x + TILE / 2, sy = VIEW.y + f.y * TILE - CAM.y + TILE / 2;
    for (let i = 0; i < 6; i++) {
      const ang = i / 6 * 6.2832;
      const r = TILE * (0.2 + f.t * 2);
      ctx.fillStyle = `rgba(220,60,60,${a * 0.8})`;
      ctx.fillRect(sx + Math.cos(ang) * r - 2, sy + Math.sin(ang) * r - 2 + f.t * 20, 4, 4);
    }
  }
}

/* ---------------------------------------------------------------- particles */
function initParticles() {
  G.parts = [];
  for (let i = 0; i < 46; i++) {
    G.parts.push({
      x: Math.random() * CW, y: Math.random() * CH,
      vx: (Math.random() - 0.5) * 0.12, vy: -0.05 - Math.random() * 0.12,
      s: 1 + Math.random() * 1.6, a: 0.12 + Math.random() * 0.3, ph: Math.random() * 6.28
    });
  }
}
function drawParticles() {
  if (!G.parts.length) initParticles();
  ctx.save();
  ctx.beginPath(); ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h); ctx.clip();
  for (const p of G.parts) {
    p.x += p.vx; p.y += p.vy;
    if (p.y < VIEW.y) { p.y = VIEW.y + VIEW.h; p.x = VIEW.x + Math.random() * VIEW.w; }
    if (p.x < VIEW.x) p.x = VIEW.x + VIEW.w;
    if (p.x > VIEW.x + VIEW.w) p.x = VIEW.x;
    const a = p.a * (0.5 + 0.5 * Math.sin(animT * 0.03 + p.ph));
    ctx.fillStyle = G.zone === 'dungeon' ? `rgba(255,225,170,${a})` : `rgba(220,235,255,${a * 0.7})`;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- title backdrop */
let titleParts = [];
function drawTitleBg() {
  if (!titleParts.length) {
    for (let i = 0; i < 70; i++) titleParts.push({
      x: Math.random() * CW, y: Math.random() * CH,
      vx: (Math.random() - 0.5) * 0.18, vy: -0.12 - Math.random() * 0.22,
      s: 1 + Math.random() * 2.2, a: 0.06 + Math.random() * 0.22, ph: Math.random() * 6.28
    });
  }
  animT++;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g0 = ctx.createLinearGradient(0, 0, 0, CH);
  g0.addColorStop(0, '#0b0d14'); g0.addColorStop(0.55, '#080a10'); g0.addColorStop(1, '#04050a');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 3; i++) {
    const tx = CW * (0.2 + i * 0.3) + Math.sin(animT * 0.006 + i) * 20;
    const ty = CH * 0.32 + Math.cos(animT * 0.004 + i * 2) * 14;
    const fl = 0.8 + 0.2 * Math.sin(animT * 0.05 + i * 2);
    const rr = Math.min(CW, CH) * 0.34 * fl;
    const gg = ctx.createRadialGradient(tx, ty, 1, tx, ty, rr);
    gg.addColorStop(0, 'rgba(255,170,70,.10)');
    gg.addColorStop(0.5, 'rgba(255,140,50,.035)');
    gg.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(tx, ty, rr, 0, 6.2832); ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const p of titleParts) {
    p.x += p.vx; p.y += p.vy;
    if (p.y < -10) { p.y = CH + 10; p.x = Math.random() * CW; }
    if (p.x < -10) p.x = CW + 10;
    if (p.x > CW + 10) p.x = -10;
    const a = p.a * (0.45 + 0.55 * Math.sin(animT * 0.02 + p.ph));
    ctx.fillStyle = `rgba(255,200,130,${a})`;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.globalCompositeOperation = 'source-over';
  const vg = ctx.createRadialGradient(CW / 2, CH * 0.42, Math.min(CW, CH) * 0.2, CW / 2, CH * 0.5, Math.max(CW, CH) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);
}

/* ---------------------------------------------------------------- loop */
let lastTS = 0;
function loop(ts) {
  if (G.state === 'title') { drawTitleBg(); requestAnimationFrame(loop); return; }
  if (G.state === 'play' || G.state === 'dead' || G.state === 'win') {
    const dt = Math.min(50, ts - lastTS || 16);
    lastTS = ts;
    for (const f of G.floats) f.t += dt / 1000;
    G.floats = G.floats.filter(f => f.t < f.life);
    G.fx = G.fx.filter(f => f.t < 0.65);
    if (G.shake > 0) {
      const s = G.shake;
      ctx.setTransform(DPR, 0, 0, DPR, (Math.random() - .5) * s, (Math.random() - .5) * s);
    }
    draw();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  requestAnimationFrame(loop);
}

/* ---------------------------------------------------------------- HUD */
function rgba(hex, a) {
  const h = (hex || '#ffffff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
function updateHUD() {
  const p = G.p;
  if (!p) return;
  const hpPct = clamp(p.hp / p.maxhp, 0, 1) * 100;
  $('#hpFill').style.width = hpPct + '%';
  $('#hpText').textContent = `${Math.max(0, Math.ceil(p.hp))}/${p.maxhp}`;
  const mpPct = clamp((p.mp || 0) / (p.maxmp || 1), 0, 1) * 100;
  $('#mpFill').style.width = mpPct + '%';
  $('#mpText').textContent = `${Math.max(0, Math.floor(p.mp || 0))}/${p.maxmp}`;
  $('#xpFill').style.width = clamp(p.xp / p.xpNext, 0, 1) * 100 + '%';
  $('#goldText').textContent = p.gold;
  const zt = $('#zoneTag');
  if (zt) {
    if (G.zone === 'town') zt.textContent = '🏘 마을';
    else if (G.zone === 'field') zt.textContent = '🌲 ' + G.m.name;
    else zt.textContent = `🏰 ${G.floorNo}층`;
  }
  $('#clsTag').textContent = `Lv.${p.lv} ${p.name}`;
  $('#turnText').textContent = G.turn + '턴';
  const st = [];
  for (const k in p.status) if (p.status[k] > 0) st.push(STATUS_NAME[k] || k);
  const stEl = $('#statusText');
  if (stEl) stEl.textContent = st.join(' · ');
  if (typeof updatePills === 'function') updatePills();
  if (typeof renderQuickbelt === 'function') renderQuickbelt();
  if (typeof updateSkillBar === 'function') updateSkillBar();
  if (typeof updateSwapButton === 'function') updateSwapButton();
  if (typeof updateContextButton === 'function') updateContextButton();
  const mb = $('#muteBtn'); if (mb) mb.classList.toggle('off', !SFX.enabled);
  const mapb = $('#mapBtn'); if (mapb) mapb.classList.toggle('on', !!G.mapOn);
  const zb = $('#btnZoom'); if (zb) zb.textContent = zoomLevel() === 0.75 ? '🔍·' : zoomLevel() === 1 ? '🔍' : zoomLevel() === 1.5 ? '🔍¹' : '🔍²';
  const db = $('#btnDpad'); if (db) db.classList.toggle('on', !!G.dpad);
  const bt = $('#bountyTxt');
  if (bt) { bt.textContent = bountyText(); bt.title = bountyLabel(); }
  if (typeof drawMinimap === 'function') drawMinimap();
}
