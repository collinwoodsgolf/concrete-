// ============================================================
// POUR DECISIONS — world renderer
// Procedural 2D canvas scenes: the town map and the job site.
// Everything is drawn in code — no image assets.
// ============================================================

const Stage = {
  canvas: null, ctx: null, raf: null, t: 0,
  draw: null,          // (ctx, t) per-frame scene painter
  onClick: null,       // (x, y) in canvas coords

  mount(container, w, h) {
    this.unmount();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.className = 'stage';
    container.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext && c.getContext('2d');   // null in jsdom — logic still runs
    c.addEventListener('click', e => {
      if (!this.onClick) return;
      const r = c.getBoundingClientRect();
      this.onClick((e.clientX - r.left) * (w / r.width), (e.clientY - r.top) * (h / r.height));
    });
    if (this.ctx && typeof requestAnimationFrame === 'function') {
      const loop = () => {
        this.t += 1 / 60;
        if (this.draw) { try { this.draw(this.ctx, this.t); } catch (e) { /* keep looping */ } }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    return c;
  },

  unmount() {
    if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf);
    this.raf = null; this.draw = null; this.onClick = null;
    this.canvas = null; this.ctx = null;
  },
};

// ---------- palettes ---------------------------------------------------------

// per-chapter season: sky, grass, accents, particles
const SEASONS = {
  1: { sky:['#8ec8e8','#cde8f4'], grass:'#6aa84f', grassDark:'#5c9444', particle:null,   name:'spring' },
  2: { sky:['#7fb8e8','#d8ecf6'], grass:'#5f9e46', grassDark:'#52893c', particle:'leaf', name:'summer' },
  3: { sky:['#9aa7b5','#cfd6dd'], grass:'#8a8a5e', grassDark:'#77774f', particle:'snow', name:'late fall' },
  4: { sky:['#8ec8e8','#d5ebf5'], grass:'#6aa84f', grassDark:'#5c9444', particle:null,   name:'spring' },
  5: { sky:['#7fc0ea','#dff0f8'], grass:'#63a349', grassDark:'#568e3e', particle:null,   name:'summer' },
};
function season() { return SEASONS[Math.min(G && G.chapter || 1, 5)]; }

const HOUSE_PALETTES = [
  { wall:'#c9b18c', roof:'#6e4f37', door:'#7a3b2e' },
  { wall:'#a8bcc4', roof:'#4d5a63', door:'#37454d' },
  { wall:'#d8d3c5', roof:'#8a5a44', door:'#3f5d43' },
  { wall:'#b6c7a5', roof:'#5d6e50', door:'#6e4f37' },
  { wall:'#d4b8b0', roof:'#75463f', door:'#4a3730' },
  { wall:'#e0d6a8', roof:'#6e5a37', door:'#2f4858' },
  { wall:'#bcaecf', roof:'#5a4d6e', door:'#3d3450' },
  { wall:'#c4d4d8', roof:'#54696e', door:'#7a3b2e' },
];

// ---------- primitive sprites ------------------------------------------------

function rr(ctx, x, y, w, h, r) { // rounded rect path
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHouse(ctx, x, y, w, h, pal, opts = {}) {
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 4, w * 0.55, 7, 0, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = pal.wall;
  ctx.fillRect(x, y, w, h);
  // roof
  ctx.fillStyle = pal.roof;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.08, y);
  ctx.lineTo(x + w * 0.5, y - h * 0.55);
  ctx.lineTo(x + w * 1.08, y);
  ctx.closePath(); ctx.fill();
  if (opts.garage) {
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(x + w * 0.52, y + h * 0.3, w * 0.4, h * 0.7);
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x + w * 0.52, y + h * (0.3 + 0.7 * i / 4));
      ctx.lineTo(x + w * 0.92, y + h * (0.3 + 0.7 * i / 4)); ctx.stroke();
    }
    ctx.fillStyle = pal.door;
    ctx.fillRect(x + w * 0.12, y + h * 0.42, w * 0.16, h * 0.58);
  } else {
    ctx.fillStyle = pal.door;
    ctx.fillRect(x + w * 0.42, y + h * 0.42, w * 0.16, h * 0.58);
    ctx.fillStyle = '#e8f2f8';
    ctx.fillRect(x + w * 0.1, y + h * 0.25, w * 0.2, h * 0.28);
    ctx.fillRect(x + w * 0.68, y + h * 0.25, w * 0.2, h * 0.28);
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    ctx.strokeRect(x + w * 0.1, y + h * 0.25, w * 0.2, h * 0.28);
    ctx.strokeRect(x + w * 0.68, y + h * 0.25, w * 0.2, h * 0.28);
  }
}

function drawCityHall(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 4, w * 0.6, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9d4c8';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#b8b2a4';
  ctx.beginPath();
  ctx.moveTo(x - 6, y); ctx.lineTo(x + w / 2, y - h * 0.5); ctx.lineTo(x + w + 6, y);
  ctx.closePath(); ctx.fill();
  // columns
  ctx.fillStyle = '#eeeae0';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + w * (0.12 + i * 0.22), y + h * 0.22, w * 0.09, h * 0.78);
  // dome flag
  ctx.strokeStyle = '#888'; ctx.beginPath();
  ctx.moveTo(x + w / 2, y - h * 0.5); ctx.lineTo(x + w / 2, y - h * 0.5 - 16); ctx.stroke();
  ctx.fillStyle = '#c33'; ctx.fillRect(x + w / 2, y - h * 0.5 - 16, 12, 7);
}

function drawShop(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 4, w * 0.6, 7, 0, 0, Math.PI * 2); ctx.fill();
  // steel building
  ctx.fillStyle = '#9aa6b0';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#7c8894';
  ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + w / 2, y - h * 0.4); ctx.lineTo(x + w + 5, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5d6a75';
  ctx.fillRect(x + w * 0.15, y + h * 0.28, w * 0.45, h * 0.72);   // roll door
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  for (let i = 1; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + h * (0.28 + 0.72 * i / 5));
    ctx.lineTo(x + w * 0.6, y + h * (0.28 + 0.72 * i / 5)); ctx.stroke();
  }
  // sign
  ctx.fillStyle = '#f5b82e';
  rr(ctx, x + w * 0.64, y + h * 0.3, w * 0.34, h * 0.3, 3); ctx.fill();
  ctx.fillStyle = '#1a1408';
  ctx.font = `bold ${Math.round(h * 0.14)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('SHOP', x + w * 0.81, y + h * 0.5);
  ctx.textAlign = 'left';
}

function drawTree(ctx, x, y, s, colors) {
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath(); ctx.ellipse(x, y + 2, s * 0.8, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6e4f37';
  ctx.fillRect(x - s * 0.08, y - s * 0.5, s * 0.16, s * 0.55);
  ctx.fillStyle = colors[0];
  ctx.beginPath(); ctx.arc(x, y - s * 0.85, s * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors[1];
  ctx.beginPath(); ctx.arc(x - s * 0.3, y - s * 0.65, s * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + s * 0.32, y - s * 0.68, s * 0.38, 0, Math.PI * 2); ctx.fill();
}
function treeColors() {
  return G && G.chapter === 3 ? ['#b0803c', '#c1954e'] : ['#4e8a3a', '#5c9c46'];
}

function drawPickup(ctx, x, y, s, angle = 0) {  // side view, s ~ length
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.16, s * 0.55, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a2f26';                       // the rusty work truck
  rr(ctx, -s * 0.5, -s * 0.12, s * 0.62, s * 0.2, 3); ctx.fill();     // bed+body
  rr(ctx, s * 0.08, -s * 0.26, s * 0.3, s * 0.34, 3); ctx.fill();     // cab
  ctx.fillStyle = '#bcd6e4';
  rr(ctx, s * 0.13, -s * 0.22, s * 0.18, s * 0.14, 2); ctx.fill();    // glass
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-s * 0.28, s * 0.12, s * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.26, s * 0.12, s * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.arc(-s * 0.28, s * 0.12, s * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.26, s * 0.12, s * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMixer(ctx, x, y, s, t) {   // side view mixer truck, drum spins with t
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * 0.62, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  // chassis
  ctx.fillStyle = '#d8d8d8';
  rr(ctx, -s * 0.55, 0, s * 1.1, s * 0.1, 2); ctx.fill();
  // cab
  ctx.fillStyle = '#e8e8e8';
  rr(ctx, s * 0.32, -s * 0.26, s * 0.24, s * 0.3, 3); ctx.fill();
  ctx.fillStyle = '#a8ccdd';
  rr(ctx, s * 0.37, -s * 0.22, s * 0.14, s * 0.12, 2); ctx.fill();
  // drum
  ctx.save();
  ctx.translate(-s * 0.08, -s * 0.22);
  ctx.rotate(-0.12);
  ctx.fillStyle = '#e0dcd2';
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.36, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f5b82e'; ctx.lineWidth = s * 0.035;
  const ph = (t * 2.4) % (Math.PI * 2);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.36, s * 0.2, 0, ph + i * 2.1, ph + i * 2.1 + 0.7);
    ctx.stroke();
  }
  ctx.restore();
  // wheels
  ctx.fillStyle = '#222';
  for (const wx of [-0.42, -0.22, 0.38]) {
    ctx.beginPath(); ctx.arc(s * wx, s * 0.14, s * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(s * wx, s * 0.14, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
  }
  ctx.restore();
}

function drawSkid(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * 0.5, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5b82e';
  rr(ctx, -s * 0.3, -s * 0.22, s * 0.55, s * 0.34, 3); ctx.fill();
  ctx.fillStyle = '#333';
  rr(ctx, -s * 0.18, -s * 0.18, s * 0.26, s * 0.2, 2); ctx.fill();
  // arm + bucket
  ctx.strokeStyle = '#c79212'; ctx.lineWidth = s * 0.06;
  ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.1); ctx.lineTo(-s * 0.48, s * 0.06); ctx.stroke();
  ctx.fillStyle = '#7c8894';
  ctx.beginPath();
  ctx.moveTo(-s * 0.62, s * 0.0); ctx.lineTo(-s * 0.42, s * 0.0);
  ctx.lineTo(-s * 0.42, s * 0.18); ctx.lineTo(-s * 0.66, s * 0.18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222';
  for (const wx of [-0.18, 0.14]) {
    ctx.beginPath(); ctx.arc(s * wx, s * 0.14, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(s * wx, s * 0.14, s * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
  }
  ctx.restore();
}

// a little worker: hard hat, hi-vis, jeans. pose: 'idle'|'jack'|'screed'|'float'|'broom'
function drawWorker(ctx, x, y, s, t, pose = 'idle', skin = '#c8956c', vest = '#f5871f') {
  ctx.save(); ctx.translate(x, y);
  const bob = pose === 'jack' ? Math.sin(t * 28) * s * 0.05 : Math.sin(t * 3 + x) * s * 0.03;
  ctx.translate(0, bob);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.52, s * 0.3, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  // legs
  ctx.fillStyle = '#3b4a63';
  ctx.fillRect(-s * 0.16, s * 0.14, s * 0.13, s * 0.38);
  ctx.fillRect(s * 0.03, s * 0.14, s * 0.13, s * 0.38);
  // torso (hi-vis)
  ctx.fillStyle = vest;
  rr(ctx, -s * 0.2, -s * 0.18, s * 0.4, s * 0.36, s * 0.08); ctx.fill();
  ctx.strokeStyle = '#dfe66a'; ctx.lineWidth = s * 0.05;
  ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.16); ctx.lineTo(-s * 0.1, s * 0.16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.16); ctx.lineTo(s * 0.1, s * 0.16); ctx.stroke();
  // head + hard hat
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -s * 0.32, s * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5b82e';
  ctx.beginPath(); ctx.arc(0, -s * 0.36, s * 0.16, Math.PI, 0); ctx.fill();
  ctx.fillRect(-s * 0.2, -s * 0.37, s * 0.4, s * 0.04);
  // tool by pose
  ctx.strokeStyle = '#8b8b8b'; ctx.lineWidth = s * 0.06;
  if (pose === 'jack') {
    ctx.beginPath(); ctx.moveTo(s * 0.14, -s * 0.05); ctx.lineTo(s * 0.3, s * 0.5); ctx.stroke();
    ctx.fillStyle = '#555'; ctx.fillRect(s * 0.24, s * 0.28, s * 0.12, s * 0.22);
  } else if (pose === 'screed' || pose === 'float' || pose === 'broom') {
    ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.1); ctx.lineTo(s * 0.55, s * 0.42); ctx.stroke();
    ctx.fillStyle = pose === 'broom' ? '#b58a3c' : '#c0c8cc';
    ctx.fillRect(s * 0.42, s * 0.4, s * 0.3, s * 0.07);
  } else if (pose === 'shovel') {
    ctx.beginPath(); ctx.moveTo(s * 0.14, -s * 0.08); ctx.lineTo(s * 0.34, s * 0.46); ctx.stroke();
    ctx.fillStyle = '#777';
    ctx.beginPath(); ctx.ellipse(s * 0.36, s * 0.5, s * 0.1, s * 0.07, 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const WORKER_SKINS = ['#c8956c', '#8a5a3c', '#e0b090', '#6e452c', '#d4a276'];

// ---------- ambient particles -------------------------------------------------

function makeParticles(kind, W, H, n = 40) {
  if (!kind) return null;
  const ps = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: kind === 'snow' ? 0.3 + Math.random() * 0.5 : 0.5 + Math.random() * 0.8,
    vy: kind === 'snow' ? 0.5 + Math.random() * 0.7 : 0.3 + Math.random() * 0.5,
    r: kind === 'snow' ? 1.2 + Math.random() * 1.8 : 2 + Math.random() * 2,
    ph: Math.random() * 6.28,
  }));
  return { kind, ps, W, H };
}
function drawParticles(ctx, P, t) {
  if (!P) return;
  for (const p of P.ps) {
    p.x += p.vx + Math.sin(t + p.ph) * 0.3;
    p.y += p.vy;
    if (p.y > P.H + 4 || p.x > P.W + 4) { p.y = -4; p.x = Math.random() * P.W; }
    if (P.kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(193,149,78,.8)';
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 2 + p.ph);
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
    }
  }
}

// ============================================================
// TOWN MAP
// ============================================================

const TOWN = { W: 960, H: 540 };
// 10 lots: 5 above the street, 5 below. Lot 0 = your shop. Lot 4 = City Hall.
const LOTS = Array.from({ length: 10 }, (_, i) => {
  const top = i < 5;
  const col = i % 5;
  return {
    i, top,
    x: 60 + col * 180, y: top ? 118 : 402,     // house anchor
    w: 104, h: 62,
    pal: HOUSE_PALETTES[(i * 3 + 1) % HOUSE_PALETTES.length],
  };
});
const STREET_Y = 245, STREET_H = 66;

function lotMarkerPos(lot) { return { x: lot.x + lot.w / 2, y: lot.y - (lot.i === 4 ? 52 : 42) }; }

function drawTown(ctx, t, state) {
  const S = season();
  const { W, H } = TOWN;
  // sky + grass
  const g = ctx.createLinearGradient(0, 0, 0, 90);
  g.addColorStop(0, S.sky[0]); g.addColorStop(1, S.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 90);
  ctx.fillStyle = S.grass; ctx.fillRect(0, 90, W, H - 90);
  // mowed stripes
  ctx.fillStyle = 'rgba(0,0,0,.04)';
  for (let y = 90; y < H; y += 26) ctx.fillRect(0, y, W, 13);
  if (G && G.chapter === 3) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, 90, W, H - 90); }

  // street + sidewalks
  ctx.fillStyle = '#c9c9c2'; ctx.fillRect(0, STREET_Y - 14, W, 14);
  ctx.fillStyle = '#c9c9c2'; ctx.fillRect(0, STREET_Y + STREET_H, W, 14);
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {   // sidewalk joints — of course
    ctx.beginPath(); ctx.moveTo(x, STREET_Y - 14); ctx.lineTo(x, STREET_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, STREET_Y + STREET_H); ctx.lineTo(x, STREET_Y + STREET_H + 14); ctx.stroke();
  }
  ctx.fillStyle = '#4b4f54'; ctx.fillRect(0, STREET_Y, W, STREET_H);
  ctx.strokeStyle = '#e8c93e'; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  ctx.beginPath(); ctx.moveTo(0, STREET_Y + STREET_H / 2); ctx.lineTo(W, STREET_Y + STREET_H / 2); ctx.stroke();
  ctx.setLineDash([]);

  // driveways
  for (const lot of LOTS) {
    if (lot.i === 4) continue;
    ctx.fillStyle = '#b9b6ad';
    const dx = lot.x + lot.w * 0.6;
    if (lot.top) ctx.fillRect(dx, lot.y + lot.h, 34, STREET_Y - 14 - (lot.y + lot.h));
    else ctx.fillRect(dx, STREET_Y + STREET_H + 14, 34, lot.y - 8 - (STREET_Y + STREET_H + 14));
  }

  // lots
  for (const lot of LOTS) {
    if (lot.i === 0) {
      drawShop(ctx, lot.x, lot.y, lot.w + 16, lot.h);
      if (owns('skid')) drawSkid(ctx, lot.x + lot.w + 44, lot.y + lot.h - 6, 40);
    } else if (lot.i === 4) {
      drawCityHall(ctx, lot.x - 10, lot.y - 14, lot.w + 30, lot.h + 14);
    } else {
      drawHouse(ctx, lot.x, lot.y, lot.w, lot.h, lot.pal, { garage: lot.i % 3 === 0 });
    }
  }
  // trees
  const tc = treeColors();
  for (const [tx, ty, ts] of [[190, 108, 26], [560, 100, 30], [880, 112, 24], [30, 500, 30], [420, 512, 26], [740, 508, 30]])
    drawTree(ctx, tx, ty, ts, tc);

  // job markers
  for (const m of state.markers) {
    const lot = LOTS[m.lot];
    const p = lotMarkerPos(lot);
    const bounce = Math.sin(t * 4 + m.lot) * 4;
    ctx.save(); ctx.translate(p.x, p.y + bounce);
    ctx.fillStyle = m.story ? '#f5b82e' : '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(0, 22); ctx.lineTo(6, 12); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = m.story ? '#1a1408' : '#2e7d32';
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m.story ? '★' : '$', 0, 1);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';

  // your truck (parked at shop, or driving)
  const tr = state.truck;
  drawPickup(ctx, tr.x, tr.y, 62);

  drawParticles(ctx, state.particles, t);
}

// build the clickable-marker + truck state for the town scene
function townState() {
  const markers = [];
  const used = new Set([0, 4]);
  // story job marker
  const ch = chapterDef();
  if (!G.storyDone[ch.id]) {
    const lot = STORY_LOTS[ch.id] || 2;
    markers.push({ lot, story: true });
    used.add(lot);
  }
  for (const lead of G.leads) {
    if (lead.lot === undefined || used.has(lead.lot)) {
      const free = LOTS.map(l => l.i).filter(i => !used.has(i));
      lead.lot = free.length ? free[Math.floor(Math.random() * free.length)] : 6;
    }
    used.add(lead.lot);
    markers.push({ lot: lead.lot, story: false, job: lead });
  }
  return {
    markers,
    truck: { x: 108, y: STREET_Y + STREET_H + 34, parked: true },
    particles: makeParticles(season().particle, TOWN.W, TOWN.H),
  };
}

// animate the truck from the shop to a lot, then cb()
function driveTruckTo(state, lotIndex, cb) {
  if (!Stage.ctx) return cb();       // jsdom: skip animation
  const lot = LOTS[lotIndex];
  const destX = lot.x + lot.w * 0.6 + 17;
  const laneY = lot.top ? STREET_Y + 18 : STREET_Y + STREET_H - 18;
  const start = { ...state.truck };
  const legs = [
    { x: start.x, y: STREET_Y + STREET_H - 18 },
    { x: destX, y: laneY },
    { x: destX, y: lot.top ? STREET_Y - 20 : STREET_Y + STREET_H + 40 },
  ];
  let leg = 0, p = 0;
  const from = { ...start };
  const step = () => {
    const target = legs[leg];
    const dx = target.x - from.x, dy = target.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    p += 4.5 / dist * 60 * (1 / 60) * 60;   // ~270px/s
    if (p >= 1) { from.x = target.x; from.y = target.y; leg++; p = 0; }
    else { state.truck.x = from.x + dx * p; state.truck.y = from.y + dy * p; }
    if (leg >= legs.length) { setTimeout(cb, 250); return; }
    setTimeout(step, 16);
  };
  step();
}

// ============================================================
// JOB SITE scene — shared backdrop for demo / pour / finish
// ============================================================

const SITE = { W: 960, H: 430 };

// compute the slab rect on the site canvas for a job
function slabRect(job) {
  const margin = 40;
  const availW = SITE.W - 2 * margin - 240;    // leave room for trucks at left
  const availH = 190;
  const ar = job.len / job.wid;
  let w = availW, h = w / ar;
  if (h > availH) { h = availH; w = h * ar; }
  if (w < 260) w = 260;
  return { x: (SITE.W - w) / 2 + 90, y: 205, w, h };
}

// site: sky, house at top, yard, fence, slab area handled by caller
function drawSiteBase(ctx, t, job, opts = {}) {
  const S = season();
  const { W, H } = SITE;
  const g = ctx.createLinearGradient(0, 0, 0, 120);
  g.addColorStop(0, S.sky[0]); g.addColorStop(1, S.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 120);
  ctx.fillStyle = S.grass; ctx.fillRect(0, 120, W, H - 120);
  ctx.fillStyle = 'rgba(0,0,0,.04)';
  for (let y = 120; y < H; y += 24) ctx.fillRect(0, y, W, 12);
  if (G && G.chapter === 3) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(0, 120, W, H - 120); }

  // house across the top (customer's place)
  const pal = HOUSE_PALETTES[(job.name || '').length % HOUSE_PALETTES.length];
  drawHouse(ctx, W / 2 - 130, 46, 260, 84, pal, { garage: JOB_TYPES[job.type].interior });
  drawTree(ctx, 96, 158, 34, treeColors());
  drawTree(ctx, W - 80, 150, 28, treeColors());
  // picket fence sides
  ctx.fillStyle = '#e8e2d2';
  for (let x = 8; x < W; x += 26) {
    if (x > W / 2 - 160 && x < W / 2 + 160) continue;
    ctx.fillRect(x, 120, 8, 26);
    ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x + 4, 112); ctx.lineTo(x + 8, 120); ctx.closePath(); ctx.fill();
  }
  // customer watching from the porch
  ctx.font = '22px sans-serif';
  ctx.fillText('🧓', W / 2 + 96, 124);
}

function drawSlabOutline(ctx, R) {
  // form boards
  ctx.strokeStyle = '#b58a3c'; ctx.lineWidth = 6;
  ctx.strokeRect(R.x - 4, R.y - 4, R.w + 8, R.h + 8);
  // stakes
  ctx.fillStyle = '#8a6a2c';
  const n = Math.round(R.w / 60);
  for (let i = 0; i <= n; i++) {
    ctx.fillRect(R.x - 7 + (R.w + 8) * i / n, R.y - 10, 5, 10);
    ctx.fillRect(R.x - 7 + (R.w + 8) * i / n, R.y + R.h + 2, 5, 10);
  }
}

function siteDust(state, x, y) {
  state.dust.push({ x, y, r: 4, a: 0.8, vy: -0.6 });
}
function drawDust(ctx, state) {
  state.dust = state.dust.filter(d => d.a > 0.03);
  for (const d of state.dust) {
    d.r += 0.9; d.a *= 0.92; d.y += d.vy;
    ctx.fillStyle = `rgba(200,195,180,${d.a})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
}
