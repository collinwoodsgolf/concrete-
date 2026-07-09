// ============================================================
// POUR DECISIONS — world renderer (top-down, GTA-style)
// Gritty bird's-eye 2D: procedural noise textures, sun-cast
// shadows, top-down vehicles/roofs/people. No image assets.
// ============================================================

const Stage = {
  canvas: null, ctx: null, raf: null, t: 0,
  draw: null,
  onClick: null,

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

// sun from the upper-left; shadows fall down-right
const SUN = { dx: 10, dy: 8 };

// deterministic PRNG for stable textures/details
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- procedural texture tiles (lazy, browser-only) --------------------

const TEX = {};
function makeTile(size, seed, painter) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  painter(x, mulberry(seed), size);
  return c;
}
function pat(ctx, name) {
  if (!TEX[name]) {
    const builders = {
      grass: () => makeTile(128, 7, (x, rnd, s) => {
        x.fillStyle = '#4a6b31'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 2600; i++) {
          const g = 84 + rnd() * 50;
          x.fillStyle = `rgba(${g * 0.55},${g},${g * 0.38},${0.25 + rnd() * 0.4})`;
          x.fillRect(rnd() * s, rnd() * s, 1.5, 2 + rnd() * 2);
        }
        for (let i = 0; i < 26; i++) {           // dry patches
          x.fillStyle = `rgba(122,110,60,${0.05 + rnd() * 0.07})`;
          x.beginPath(); x.arc(rnd() * s, rnd() * s, 4 + rnd() * 9, 0, 7); x.fill();
        }
      }),
      grassCold: () => makeTile(128, 8, (x, rnd, s) => {
        x.fillStyle = '#6d6b52'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 2200; i++) {
          const g = 96 + rnd() * 60;
          x.fillStyle = `rgba(${g},${g * 0.96},${g * 0.68},${0.2 + rnd() * 0.35})`;
          x.fillRect(rnd() * s, rnd() * s, 1.5, 2 + rnd() * 2);
        }
        for (let i = 0; i < 40; i++) {           // frost
          x.fillStyle = `rgba(230,235,240,${0.05 + rnd() * 0.1})`;
          x.beginPath(); x.arc(rnd() * s, rnd() * s, 3 + rnd() * 8, 0, 7); x.fill();
        }
      }),
      asphalt: () => makeTile(128, 11, (x, rnd, s) => {
        x.fillStyle = '#33363a'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 2400; i++) {
          const g = 40 + rnd() * 70;
          x.fillStyle = `rgba(${g},${g},${g + 4},${0.2 + rnd() * 0.35})`;
          x.fillRect(rnd() * s, rnd() * s, 1.4, 1.4);
        }
        for (let i = 0; i < 12; i++) {           // patch blotches
          x.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
          x.beginPath(); x.arc(rnd() * s, rnd() * s, 6 + rnd() * 14, 0, 7); x.fill();
        }
      }),
      concrete: () => makeTile(128, 17, (x, rnd, s) => {
        x.fillStyle = '#b3b0a8'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 2000; i++) {
          const g = 140 + rnd() * 80;
          x.fillStyle = `rgba(${g},${g - 3},${g - 8},${0.15 + rnd() * 0.3})`;
          x.fillRect(rnd() * s, rnd() * s, 1.3, 1.3);
        }
      }),
      oldConcrete: () => makeTile(128, 23, (x, rnd, s) => {
        x.fillStyle = '#9d9a90'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 2000; i++) {
          const g = 110 + rnd() * 80;
          x.fillStyle = `rgba(${g},${g - 4},${g - 10},${0.15 + rnd() * 0.3})`;
          x.fillRect(rnd() * s, rnd() * s, 1.4, 1.4);
        }
        for (let i = 0; i < 16; i++) {           // stains
          x.fillStyle = `rgba(60,55,45,${0.04 + rnd() * 0.09})`;
          x.beginPath(); x.arc(rnd() * s, rnd() * s, 5 + rnd() * 16, 0, 7); x.fill();
        }
      }),
      wetConcrete: () => makeTile(128, 29, (x, rnd, s) => {
        x.fillStyle = '#75726b'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 1400; i++) {
          const g = 95 + rnd() * 45;
          x.fillStyle = `rgba(${g},${g - 3},${g - 9},${0.15 + rnd() * 0.28})`;
          x.fillRect(rnd() * s, rnd() * s, 1.6, 1.6);
        }
      }),
      gravel: () => makeTile(128, 31, (x, rnd, s) => {
        x.fillStyle = '#867e6d'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 1500; i++) {
          const g = 90 + rnd() * 90;
          x.fillStyle = `rgba(${g},${g * 0.94},${g * 0.8},${0.3 + rnd() * 0.4})`;
          const r = 1 + rnd() * 2.4;
          x.beginPath(); x.arc(rnd() * s, rnd() * s, r, 0, 7); x.fill();
        }
      }),
      rubble: () => makeTile(128, 37, (x, rnd, s) => {
        x.fillStyle = '#5f574a'; x.fillRect(0, 0, s, s);
        for (let i = 0; i < 240; i++) {
          const g = 100 + rnd() * 80;
          x.fillStyle = `rgba(${g},${g - 5},${g - 14},.9)`;
          const px = rnd() * s, py = rnd() * s, r = 2 + rnd() * 5;
          x.beginPath();
          x.moveTo(px + r, py);
          for (let k = 1; k < 6; k++) {
            const a = k / 6 * Math.PI * 2;
            x.lineTo(px + Math.cos(a) * r * (0.6 + rnd() * 0.6), py + Math.sin(a) * r * (0.6 + rnd() * 0.6));
          }
          x.closePath(); x.fill();
          x.fillStyle = `rgba(0,0,0,.25)`;
          x.fillRect(px + 1, py + r * 0.7, r, 1.5);
        }
      }),
    };
    TEX[name] = builders[name] ? builders[name]() : null;
  }
  return TEX[name] ? ctx.createPattern(TEX[name], 'repeat') : '#888';
}

function grassPat(ctx) { return pat(ctx, (G && G.chapter === 3) ? 'grassCold' : 'grass'); }

// ---------- seasons -----------------------------------------------------------

const SEASONS = {
  1: { particle: null,   grade: null,                      name: 'spring' },
  2: { particle: 'leaf', grade: 'rgba(255,196,96,0.045)',  name: 'summer' },
  3: { particle: 'snow', grade: 'rgba(140,160,190,0.10)',  name: 'late fall' },
  4: { particle: null,   grade: null,                      name: 'spring' },
  5: { particle: null,   grade: 'rgba(255,214,120,0.04)',  name: 'summer' },
};
function season() { return SEASONS[Math.min(G && G.chapter || 1, 5)]; }

const ROOFS = ['#4a4440', '#5a5148', '#3e444a', '#57504a', '#484138', '#50463e', '#3f4a42', '#544a50'];
const CARS = ['#5a6570', '#7a3b34', '#33424f', '#7d7466', '#42503b', '#222528'];

// grade + vignette pass — call last in every scene
function gradeAndVignette(ctx, W, H) {
  const s = season();
  if (s.grade) { ctx.fillStyle = s.grade; ctx.fillRect(0, 0, W, H); }
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function castShadow(ctx, drawPath, alpha = 0.28) {
  ctx.save();
  ctx.translate(SUN.dx, SUN.dy);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  drawPath(); ctx.fill();
  ctx.restore();
}

// ---------- top-down buildings -------------------------------------------------

// gable roof seen from above: two slopes + ridge, shingle rows, chimney
function drawRoof(ctx, x, y, w, h, color, seed = 1) {
  const rnd = mulberry(seed * 97 + 13);
  castShadow(ctx, () => { rr(ctx, x, y, w, h, 3); });
  rr(ctx, x, y, w, h, 3);
  ctx.fillStyle = color; ctx.fill();
  const horiz = w >= h;
  // slope shading: sun side lighter
  ctx.save(); rr(ctx, x, y, w, h, 3); ctx.clip();
  if (horiz) {
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x, y + h / 2, w, h / 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(x, y, w / 2, h);
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x + w / 2, y, w / 2, h);
  }
  // shingle courses
  ctx.strokeStyle = 'rgba(0,0,0,.13)'; ctx.lineWidth = 1;
  if (horiz) for (let yy = y + 5; yy < y + h; yy += 6) {
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  } else for (let xx = x + 5; xx < x + w; xx += 6) {
    ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke();
  }
  ctx.restore();
  // ridge
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
  ctx.beginPath();
  if (horiz) { ctx.moveTo(x + 3, y + h / 2); ctx.lineTo(x + w - 3, y + h / 2); }
  else { ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2, y + h - 3); }
  ctx.stroke();
  // chimney
  const cx = x + w * (0.2 + rnd() * 0.5), cy = y + (horiz ? h * 0.28 : h * (0.2 + rnd() * 0.5));
  ctx.fillStyle = '#6b5648'; ctx.fillRect(cx, cy, 8, 8);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeRect(cx, cy, 8, 8);
}

// 2.5D: south-facing facade extruded below a roof — the GTA-style depth pass
function drawFacade(ctx, x, y, w, hgt, opts = {}) {
  const rnd = mulberry((opts.seed || 1) * 53 + 29);
  // wall
  ctx.fillStyle = opts.wall || '#b7ab90';
  ctx.fillRect(x, y, w, hgt);
  // siding courses
  ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1;
  for (let yy = y + 4; yy < y + hgt; yy += 5) {
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  }
  // eave shadow under the roofline
  const eg = ctx.createLinearGradient(0, y, 0, y + hgt * 0.5);
  eg.addColorStop(0, 'rgba(0,0,0,.38)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eg; ctx.fillRect(x, y, w, hgt * 0.5);
  if (opts.garage) {
    // garage door
    ctx.fillStyle = '#ddd8cc';
    ctx.fillRect(x + w * 0.52, y + hgt * 0.22, w * 0.38, hgt * 0.78);
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    for (let k = 1; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(x + w * 0.52, y + hgt * (0.22 + 0.78 * k / 4));
      ctx.lineTo(x + w * 0.9, y + hgt * (0.22 + 0.78 * k / 4)); ctx.stroke();
    }
    ctx.fillStyle = opts.door || '#5c3a2e';
    ctx.fillRect(x + w * 0.14, y + hgt * 0.3, w * 0.12, hgt * 0.7);
  } else {
    // door + windows
    ctx.fillStyle = opts.door || '#5c3a2e';
    ctx.fillRect(x + w * 0.44, y + hgt * 0.3, w * 0.12, hgt * 0.7);
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.strokeRect(x + w * 0.44, y + hgt * 0.3, w * 0.12, hgt * 0.7);
    for (const wx of [0.12, 0.68]) {
      const win = ctx.createLinearGradient(x + w * wx, y, x + w * (wx + 0.16), y + hgt);
      win.addColorStop(0, '#a9c8d8'); win.addColorStop(1, '#5d7886');
      ctx.fillStyle = win;
      ctx.fillRect(x + w * wx, y + hgt * 0.3, w * 0.16, hgt * 0.42);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x + w * wx, y + hgt * 0.3, w * 0.16, hgt * 0.42);
      ctx.beginPath();
      ctx.moveTo(x + w * (wx + 0.08), y + hgt * 0.3);
      ctx.lineTo(x + w * (wx + 0.08), y + hgt * 0.72); ctx.stroke();
    }
  }
  // foundation line
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x, y + hgt - 2, w, 2);
}

// full 2.5D house: facade below, roof on top (roof overhangs slightly)
function drawHouse25(ctx, x, y, w, h, roofColor, seed, opts = {}) {
  const hgt = opts.hgt || 24;
  const rnd = mulberry(seed * 71 + 3);
  const walls = ['#b7ab90', '#a8b0b6', '#c4b8a0', '#9fae9a', '#c0aca4'];
  castShadow(ctx, () => { ctx.beginPath(); ctx.rect(x, y + 4, w, h + hgt - 4); }, 0.3);
  drawFacade(ctx, x + 3, y + h, w - 6, hgt, { seed, wall: walls[seed % walls.length], garage: opts.garage });
  drawRoof(ctx, x, y, w, h, roofColor, seed);
}

function drawShopTop(ctx, x, y, w, h) {
  const hgt = 22;
  castShadow(ctx, () => { ctx.beginPath(); ctx.rect(x, y + 4, w, h + hgt - 4); }, 0.3);
  // steel facade with roll door
  ctx.fillStyle = '#7d858d';
  ctx.fillRect(x + 2, y + h, w - 4, hgt);
  ctx.strokeStyle = 'rgba(0,0,0,.2)';
  for (let xx = x + 8; xx < x + w - 4; xx += 8) {
    ctx.beginPath(); ctx.moveTo(xx, y + h); ctx.lineTo(xx, y + h + hgt); ctx.stroke();
  }
  ctx.fillStyle = '#5d666f';
  ctx.fillRect(x + w * 0.18, y + h + hgt * 0.2, w * 0.42, hgt * 0.8);
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  for (let k = 1; k < 4; k++) {
    ctx.beginPath(); ctx.moveTo(x + w * 0.18, y + h + hgt * (0.2 + 0.8 * k / 4));
    ctx.lineTo(x + w * 0.6, y + h + hgt * (0.2 + 0.8 * k / 4)); ctx.stroke();
  }
  const eg = ctx.createLinearGradient(0, y + h, 0, y + h + hgt * 0.5);
  eg.addColorStop(0, 'rgba(0,0,0,.35)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eg; ctx.fillRect(x + 2, y + h, w - 4, hgt * 0.5);
  // roof
  rr(ctx, x, y, w, h, 2);
  ctx.fillStyle = '#8a929a'; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, 2); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x, y, w, h / 2);
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1.5;
  for (let xx = x + 6; xx < x + w; xx += 9) {          // metal ribs
    ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke();
  }
  ctx.restore();
  // painted sign on the roof
  ctx.fillStyle = 'rgba(245,184,46,.9)';
  ctx.font = `bold ${Math.round(h * 0.3)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('CONCRETE', x + w / 2, y + h / 2 + h * 0.1);
  ctx.textAlign = 'left';
}

function drawCityHallTop(ctx, x, y, w, h) {
  const hgt = 30;
  castShadow(ctx, () => { ctx.beginPath(); ctx.rect(x, y + 4, w, h + hgt - 4); }, 0.34);
  // stone facade with columns
  ctx.fillStyle = '#b5af9f';
  ctx.fillRect(x + 2, y + h, w - 4, hgt);
  const ceg = ctx.createLinearGradient(0, y + h, 0, y + h + hgt * 0.45);
  ceg.addColorStop(0, 'rgba(0,0,0,.35)'); ceg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ceg; ctx.fillRect(x + 2, y + h, w - 4, hgt * 0.45);
  for (let k = 0; k < 5; k++) {
    const cx = x + w * (0.1 + k * 0.185);
    ctx.fillStyle = '#d5cfbf';
    ctx.fillRect(cx, y + h + 3, 7, hgt - 3);
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(cx + 5, y + h + 3, 2, hgt - 3);
  }
  ctx.fillStyle = '#4a4038';
  ctx.fillRect(x + w * 0.42, y + h + hgt * 0.35, w * 0.16, hgt * 0.65);
  rr(ctx, x, y, w, h, 2);
  ctx.fillStyle = '#a9a396'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x, y, w, h / 2);
  // dome
  const dg = ctx.createRadialGradient(x + w / 2 - 5, y + h / 2 - 5, 2, x + w / 2, y + h / 2, h * 0.42);
  dg.addColorStop(0, '#d8d2c2'); dg.addColorStop(1, '#8f8a7c');
  castShadow(ctx, () => { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.4, 0, 7); }, 0.25);
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.4, 0, 7); ctx.fill();
}

function drawTreeTop(ctx, x, y, s, seed = 1) {
  const rnd = mulberry(seed * 31 + 7);
  const fall = G && G.chapter === 3;
  castShadow(ctx, () => { ctx.beginPath(); ctx.arc(x, y, s, 0, 7); }, 0.22);
  const base = fall ? [150, 96, 42] : [52, 92, 40];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * 6.28, d = rnd() * s * 0.5;
    const r = s * (0.45 + rnd() * 0.4);
    const l = 0.85 + rnd() * 0.45;
    ctx.fillStyle = `rgb(${base[0] * l},${base[1] * l},${base[2] * l})`;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 0.25, s * 0.4, 0, 7); ctx.fill();
}

// ---------- top-down vehicles ---------------------------------------------------

function drawPickup(ctx, x, y, s, angle = Math.PI / 2) {   // s = length
  const w = s * 0.42;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  castShadow(ctx, () => { rr(ctx, -s / 2, -w / 2, s, w, 5); }, 0.3);
  // body
  rr(ctx, -s / 2, -w / 2, s, w, 5);
  ctx.fillStyle = '#7a2f27'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  // bed
  rr(ctx, -s / 2 + 3, -w / 2 + 3, s * 0.44, w - 6, 3);
  ctx.fillStyle = '#4c2721'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-s / 2 + 3 + k * s * 0.1, -w / 2 + 3); ctx.lineTo(-s / 2 + 3 + k * s * 0.1, w / 2 - 3); ctx.stroke(); }
  // cab roof
  rr(ctx, -s * 0.02, -w / 2 + 2.5, s * 0.3, w - 5, 3);
  ctx.fillStyle = '#8d3a30'; ctx.fill();
  // windshield + rear glass
  ctx.fillStyle = 'rgba(150,190,210,.85)';
  rr(ctx, s * 0.28, -w / 2 + 3.5, s * 0.09, w - 7, 2); ctx.fill();
  rr(ctx, -s * 0.06, -w / 2 + 4, s * 0.05, w - 8, 2); ctx.fill();
  // hood shading
  rr(ctx, s * 0.37, -w / 2 + 2, s * 0.13, w - 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fill();
  // mirrors
  ctx.fillStyle = '#333';
  ctx.fillRect(s * 0.24, -w / 2 - 2.5, 4, 3); ctx.fillRect(s * 0.24, w / 2 - 0.5, 4, 3);
  ctx.restore();
}

function drawCar(ctx, x, y, s, angle, color) {
  const w = s * 0.44;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  castShadow(ctx, () => { rr(ctx, -s / 2, -w / 2, s, w, 6); }, 0.26);
  rr(ctx, -s / 2, -w / 2, s, w, 6);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
  ctx.fillStyle = 'rgba(150,190,210,.8)';
  rr(ctx, -s * 0.16, -w / 2 + 3, s * 0.1, w - 6, 2); ctx.fill();     // rear glass
  rr(ctx, s * 0.12, -w / 2 + 3, s * 0.1, w - 6, 2); ctx.fill();      // windshield
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  rr(ctx, -s * 0.06, -w / 2 + 2.5, s * 0.18, w - 5, 2); ctx.fill();  // roof
  ctx.fillStyle = 'rgba(255,255,255,.09)';
  rr(ctx, s * 0.24, -w / 2 + 2, s * 0.2, w - 4, 2); ctx.fill();      // hood
  ctx.restore();
}

function drawMixer(ctx, x, y, s, t, angle = 0) {   // top-down mixer truck
  const w = s * 0.4;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  castShadow(ctx, () => { rr(ctx, -s / 2, -w / 2, s, w, 4); }, 0.32);
  // chassis
  rr(ctx, -s / 2, -w / 2, s, w, 4);
  ctx.fillStyle = '#cfcac0'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  // cab
  rr(ctx, s * 0.3, -w / 2 + 2, s * 0.18, w - 4, 3);
  ctx.fillStyle = '#e6e2d8'; ctx.fill();
  ctx.fillStyle = 'rgba(150,190,210,.85)';
  rr(ctx, s * 0.28, -w / 2 + 3, s * 0.05, w - 6, 2); ctx.fill();
  // drum (from above): long capsule with rotating spiral stripes
  const dl = s * 0.62, dw = w * 0.85, dx = -s * 0.12;
  castShadow(ctx, () => { rr(ctx, dx - dl / 2, -dw / 2, dl, dw, dw / 2); }, 0.18);
  rr(ctx, dx - dl / 2, -dw / 2, dl, dw, dw / 2);
  const dg = ctx.createLinearGradient(0, -dw / 2, 0, dw / 2);
  dg.addColorStop(0, '#d9d4c8'); dg.addColorStop(0.5, '#f2eee4'); dg.addColorStop(1, '#b5b0a4');
  ctx.fillStyle = dg; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
  ctx.save();
  rr(ctx, dx - dl / 2, -dw / 2, dl, dw, dw / 2); ctx.clip();
  ctx.strokeStyle = 'rgba(190,90,40,.55)'; ctx.lineWidth = 3.5;
  const roll = (t * 40) % 14;
  for (let k = -3; k < 8; k++) {
    const sx = dx - dl / 2 + k * 14 + roll;
    ctx.beginPath(); ctx.moveTo(sx, -dw / 2); ctx.lineTo(sx + 10, dw / 2); ctx.stroke();
  }
  ctx.restore();
  // hopper at rear
  ctx.fillStyle = '#8f8a80';
  ctx.beginPath(); ctx.arc(-s / 2 + 6, 0, w * 0.22, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.stroke();
  ctx.restore();
}

function drawSkid(ctx, x, y, s, angle = 0) {
  const w = s * 0.6;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  castShadow(ctx, () => { rr(ctx, -s / 2, -w / 2, s, w, 3); }, 0.28);
  // tracks
  ctx.fillStyle = '#2e2e2e';
  rr(ctx, -s * 0.34, -w / 2, s * 0.68, w * 0.18, 2); ctx.fill();
  rr(ctx, -s * 0.34, w / 2 - w * 0.18, s * 0.68, w * 0.18, 2); ctx.fill();
  // body
  rr(ctx, -s * 0.3, -w * 0.3, s * 0.6, w * 0.6, 3);
  ctx.fillStyle = '#d9a516'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  rr(ctx, -s * 0.14, -w * 0.18, s * 0.26, w * 0.36, 2); ctx.fill();  // cage
  // arms + bucket (front = +x)
  ctx.fillStyle = '#b5890f';
  ctx.fillRect(s * 0.05, -w * 0.32, s * 0.3, w * 0.1);
  ctx.fillRect(s * 0.05, w * 0.22, s * 0.3, w * 0.1);
  ctx.fillStyle = '#8f8a80';
  rr(ctx, s * 0.34, -w * 0.42, s * 0.16, w * 0.84, 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
  ctx.restore();
}

// ---------- top-down people -----------------------------------------------------

// worker seen from above: hard hat disc, hi-vis shoulders, tool
function drawWorker(ctx, x, y, s, t, pose = 'idle', skin = '#c8956c', vest = '#e87b12') {
  ctx.save(); ctx.translate(x, y);
  const jig = pose === 'jack' ? Math.sin(t * 30) * 1.6 : 0;
  const sway = Math.sin(t * 2.2 + x * 0.13) * 1.2;
  ctx.translate(jig, sway * 0.4);
  ctx.rotate(Math.sin(t * 1.4 + y * 0.11) * 0.08);
  castShadow(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.32, 0, 0, 7); }, 0.3);
  // shoulders / torso
  ctx.fillStyle = vest;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.38, s * 0.3, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = 'rgba(238,238,120,.85)'; ctx.lineWidth = s * 0.07;   // hi-vis stripes
  ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.1); ctx.lineTo(s * 0.3, -s * 0.1); ctx.stroke();
  // arms
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(-s * 0.38, s * 0.08, s * 0.09, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.38, s * 0.08, s * 0.09, 0, 7); ctx.fill();
  // hard hat
  const hg = ctx.createRadialGradient(-s * 0.06, -s * 0.06, 1, 0, 0, s * 0.24);
  hg.addColorStop(0, '#ffd95e'); hg.addColorStop(1, '#c79212');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.21, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
  // tool
  if (pose === 'jack') {
    ctx.strokeStyle = '#555'; ctx.lineWidth = s * 0.09;
    ctx.beginPath(); ctx.moveTo(0, s * 0.1); ctx.lineTo(0, s * 0.62); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(-s * 0.08, s * 0.55, s * 0.16, s * 0.14);
  } else if (pose === 'screed' || pose === 'float' || pose === 'broom') {
    ctx.strokeStyle = '#8b8b8b'; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.05); ctx.lineTo(s * 0.85, s * 0.4); ctx.stroke();
    ctx.fillStyle = pose === 'broom' ? '#a87f38' : '#c8ccd0';
    ctx.save(); ctx.translate(s * 0.85, s * 0.4); ctx.rotate(-0.5);
    ctx.fillRect(-s * 0.3, -s * 0.05, s * 0.6, s * 0.1); ctx.restore();
  } else if (pose === 'shovel') {
    ctx.strokeStyle = '#8b8b8b'; ctx.lineWidth = s * 0.06;
    ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.05); ctx.lineTo(-s * 0.7, s * 0.42); ctx.stroke();
    ctx.fillStyle = '#777';
    ctx.beginPath(); ctx.ellipse(-s * 0.72, s * 0.46, s * 0.14, s * 0.1, 0.6, 0, 7); ctx.fill();
  }
  ctx.restore();
}

const WORKER_SKINS = ['#c8956c', '#8a5a3c', '#e0b090', '#6e452c', '#d4a276'];

// a civilian from above (the customer on the porch)
function drawPerson(ctx, x, y, s, t, shirt = '#7d8a99') {
  ctx.save(); ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.1 + x) * 0.06);
  castShadow(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.36, s * 0.28, 0, 0, 7); }, 0.28);
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.34, s * 0.26, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
  ctx.fillStyle = '#bfb9ac';                       // gray hair
  ctx.beginPath(); ctx.arc(0, 0, s * 0.17, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.stroke();
  ctx.restore();
}

// the menace, from above
function drawDog(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y);
  const lope = Math.sin(t * 14) * 0.12;
  ctx.rotate(lope * 0.5);
  castShadow(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.22, 0, 0, 7); }, 0.28);
  // body
  ctx.fillStyle = '#8a6a42';
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.46, s * 0.2, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.stroke();
  // head + ears + snout
  ctx.fillStyle = '#7a5b36';
  ctx.beginPath(); ctx.arc(s * 0.42, 0, s * 0.17, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.56, 0, s * 0.09, 0, 7); ctx.fill();
  ctx.fillStyle = '#5f4527';
  ctx.beginPath(); ctx.ellipse(s * 0.36, -s * 0.14, s * 0.08, s * 0.05, 0.5, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * 0.36, s * 0.14, s * 0.08, s * 0.05, -0.5, 0, 7); ctx.fill();
  // wagging tail
  ctx.strokeStyle = '#7a5b36'; ctx.lineWidth = s * 0.07;
  ctx.beginPath(); ctx.moveTo(-s * 0.44, 0);
  ctx.quadraticCurveTo(-s * 0.6, Math.sin(t * 16) * s * 0.25, -s * 0.72, Math.sin(t * 16 + 1) * s * 0.3);
  ctx.stroke();
  // legs scrambling
  ctx.strokeStyle = '#6e5230'; ctx.lineWidth = s * 0.06;
  for (const [lx, ph] of [[-s * 0.24, 0], [-s * 0.1, 2], [s * 0.12, 4], [s * 0.26, 1]]) {
    ctx.beginPath(); ctx.moveTo(lx, 0);
    ctx.lineTo(lx + Math.sin(t * 14 + ph) * s * 0.1, s * 0.28); ctx.stroke();
  }
  ctx.restore();
}

// ---------- the foreman: walk-around player -------------------------------------

function makePlayer(x, y) {
  return { x, y, tx: x, ty: y, speed: 155, pose: 'idle', pending: null, workT: 0, moving: false };
}
function updatePlayer(pl, dt = 1 / 60) {
  const dx = pl.tx - pl.x, dy = pl.ty - pl.y;
  const d = Math.hypot(dx, dy);
  if (d > 3) {
    pl.x += dx / d * pl.speed * dt;
    pl.y += dy / d * pl.speed * dt;
    pl.moving = true;
    return false;
  }
  pl.moving = false;
  return true;   // arrived
}
function drawPlayer(ctx, pl, t) {
  // the foreman: lime hi-vis + white hard hat so you always spot yourself
  ctx.save();
  if (pl.moving) ctx.translate(0, Math.sin(t * 16) * 1.5);   // hustle bob
  drawWorker(ctx, pl.x, pl.y, 42, t, pl.pose, '#c8956c', '#b9cc1e');
  ctx.fillStyle = '#f2f0e8';
  ctx.beginPath(); ctx.arc(pl.x, pl.y + (pl.moving ? Math.sin(t * 16) * 1.5 : 0), 8, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
  ctx.restore();
}

// the inspector: khakis, clipboard, judgment
function drawInspector(ctx, x, y, s, t) {
  drawPerson(ctx, x, y, s, t, '#7c7460');
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#c9b98a';                       // clipboard
  ctx.fillRect(s * 0.28, -s * 0.1, s * 0.3, s * 0.42);
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeRect(s * 0.28, -s * 0.1, s * 0.3, s * 0.42);
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath(); ctx.moveTo(s * 0.31, -s * 0.1 + k * s * 0.1);
    ctx.lineTo(s * 0.54, -s * 0.1 + k * s * 0.1); ctx.stroke();
  }
  ctx.restore();
}

// rain squall
function makeRain(W, H, n = 130) {
  return { ps: Array.from({ length: n }, () => ({ x: Math.random() * (W + 100) - 50, y: Math.random() * H, v: 9 + Math.random() * 5 })), W, H };
}
function drawRain(ctx, R2) {
  if (!R2) return;
  ctx.fillStyle = 'rgba(40,50,70,.18)';
  ctx.fillRect(0, 0, R2.W, R2.H);
  ctx.strokeStyle = 'rgba(190,210,235,.5)'; ctx.lineWidth = 1.4;
  for (const p of R2.ps) {
    p.x += p.v * 0.35; p.y += p.v;
    if (p.y > R2.H) { p.y = -12; p.x = Math.random() * (R2.W + 100) - 50; }
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3.5, p.y + 11); ctx.stroke();
  }
}

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
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(160,112,44,.75)';
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 2 + p.ph);
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 7); ctx.fill(); ctx.restore();
    }
  }
}

// ============================================================
// TOWN MAP — bird's-eye neighborhood
// ============================================================

const TOWN = { W: 960, H: 540 };
const LOTS = Array.from({ length: 10 }, (_, i) => {
  const top = i < 5;
  const col = i % 5;
  return {
    i, top,
    x: 60 + col * 180, y: top ? 118 : 402,
    w: 104, h: 62,
    roof: ROOFS[(i * 3 + 1) % ROOFS.length],
  };
});
const STREET_Y = 245, STREET_H = 66;

function lotMarkerPos(lot) { return { x: lot.x + lot.w / 2, y: lot.y - (lot.i === 4 ? 52 : 42) }; }

function drawRoad(ctx, W) {
  const y = STREET_Y, h = STREET_H;
  // sidewalks with joints
  ctx.fillStyle = pat(ctx, 'concrete');
  ctx.fillRect(0, y - 16, W, 16);
  ctx.fillRect(0, y + h, W, 16);
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 42) {
    ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + 16); ctx.stroke();
  }
  // curbs
  ctx.fillStyle = '#8f8c84';
  ctx.fillRect(0, y - 3, W, 3); ctx.fillRect(0, y + h, W, 3);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.fillRect(0, y - 3, W, 1); ctx.fillRect(0, y + h, W, 1);
  // asphalt
  ctx.fillStyle = pat(ctx, 'asphalt');
  ctx.fillRect(0, y, W, h);
  // wear tracks in each lane
  ctx.fillStyle = 'rgba(0,0,0,.13)';
  for (const ly of [y + h * 0.22, y + h * 0.42, y + h * 0.6, y + h * 0.8])
    ctx.fillRect(0, ly - 2.5, W, 5);
  // center line (faded yellow dashes)
  ctx.strokeStyle = 'rgba(214,182,74,.75)'; ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath(); ctx.moveTo(0, y + h / 2); ctx.lineTo(W, y + h / 2); ctx.stroke();
  ctx.setLineDash([]);
  // manholes, patches, cracks
  ctx.fillStyle = '#26282b';
  ctx.beginPath(); ctx.arc(260, y + h * 0.3, 7, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(700, y + h * 0.72, 7, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.5;
  const crk = mulberry(5);
  for (let k = 0; k < 7; k++) {
    let cx = crk() * W, cy = y + 6 + crk() * (h - 12);
    ctx.beginPath(); ctx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) { cx += 8 + crk() * 14; cy += (crk() - 0.5) * 12; ctx.lineTo(cx, cy); }
    ctx.stroke();
  }
  // crosswalk at right
  ctx.fillStyle = 'rgba(230,230,225,.5)';
  for (let k = 0; k < 6; k++) ctx.fillRect(880, y + 5 + k * (h - 10) / 6, 34, (h - 10) / 9);
}

function drawTown(ctx, t, state) {
  const { W, H } = TOWN;
  // ground
  ctx.fillStyle = grassPat(ctx);
  ctx.fillRect(0, 0, W, H);
  // mow stripes
  ctx.fillStyle = 'rgba(0,0,0,.045)';
  for (let y = 0; y < H; y += 30) ctx.fillRect(0, y, W, 15);

  drawRoad(ctx, W);

  // driveways + front walks
  for (const lot of LOTS) {
    if (lot.i === 4) continue;
    const dx = lot.x + lot.w * 0.6;
    const dw = 34;
    ctx.fillStyle = pat(ctx, lot.i % 2 ? 'oldConcrete' : 'concrete');
    let dy0, dy1;
    if (lot.top) { dy0 = lot.y + lot.h; dy1 = STREET_Y - 16; }
    else { dy0 = STREET_Y + STREET_H + 16; dy1 = lot.y; }
    ctx.fillRect(dx, Math.min(dy0, dy1), dw, Math.abs(dy1 - dy0));
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1;
    ctx.strokeRect(dx, Math.min(dy0, dy1), dw, Math.abs(dy1 - dy0));
    // cracked joints on the old ones
    if (lot.i % 2) {
      ctx.beginPath(); ctx.moveTo(dx + 4, (dy0 + dy1) / 2); ctx.lineTo(dx + dw - 3, (dy0 + dy1) / 2 + 5); ctx.stroke();
    }
  }

  // buildings
  for (const lot of LOTS) {
    if (lot.i === 0) {
      // shop: gravel yard + metal building + stock
      ctx.fillStyle = pat(ctx, 'gravel');
      ctx.fillRect(lot.x - 22, lot.y - 20, lot.w + 70, lot.h + 46);
      drawShopTop(ctx, lot.x, lot.y, lot.w + 12, lot.h);
      // lumber stacks
      ctx.fillStyle = '#9c7a48';
      ctx.fillRect(lot.x + lot.w + 22, lot.y + 6, 26, 9);
      ctx.fillRect(lot.x + lot.w + 22, lot.y + 18, 26, 9);
      ctx.strokeStyle = 'rgba(0,0,0,.3)';
      ctx.strokeRect(lot.x + lot.w + 22, lot.y + 6, 26, 9);
      ctx.strokeRect(lot.x + lot.w + 22, lot.y + 18, 26, 9);
      if (owns('skid')) drawSkid(ctx, lot.x + lot.w + 36, lot.y + lot.h - 12, 34, -0.4);
    } else if (lot.i === 4) {
      drawCityHallTop(ctx, lot.x - 10, lot.y - 14, lot.w + 30, lot.h + 14);
    } else {
      drawHouse25(ctx, lot.x, lot.y, lot.w, lot.h - 14, lot.roof, lot.i, { garage: lot.i % 3 === 0, hgt: 22 });
      // parked car on some driveways
      if (lot.i % 3 === 1) {
        const cy = lot.top ? lot.y + lot.h + 26 : lot.y - 26;
        drawCar(ctx, lot.x + lot.w * 0.6 + 17, cy, 44, Math.PI / 2, CARS[lot.i % CARS.length]);
      }
    }
  }

  // trees
  for (const [tx, ty, ts, sd] of [[190, 78, 26, 1], [560, 66, 30, 2], [860, 70, 22, 3], [30, 500, 30, 4], [420, 512, 26, 5], [740, 508, 30, 6], [320, 190, 16, 7], [640, 350, 15, 8]])
    drawTreeTop(ctx, tx, ty, ts, sd);

  // job markers
  for (const m of state.markers) {
    const lot = LOTS[m.lot];
    const p = lotMarkerPos(lot);
    const bounce = Math.sin(t * 4 + m.lot) * 4;
    ctx.save(); ctx.translate(p.x, p.y + bounce);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    ctx.fillStyle = m.story ? '#f5b82e' : '#f4f2ec';
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(0, 22); ctx.lineTo(6, 12); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = m.story ? '#1a1408' : '#2e7d32';
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(m.story ? '★' : '$', 0, 1);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

  // your truck
  const tr = state.truck;
  drawPickup(ctx, tr.x, tr.y, 54, tr.angle ?? 0);

  drawParticles(ctx, state.particles, t);
  gradeAndVignette(ctx, W, H);
}

function townState() {
  const markers = [];
  const used = new Set([0, 4]);
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
    truck: { x: 150, y: STREET_Y + STREET_H + 40, angle: Math.PI, parked: true },
    particles: makeParticles(season().particle, TOWN.W, TOWN.H),
  };
}

function driveTruckTo(state, lotIndex, cb) {
  if (!Stage.ctx) return cb();
  const lot = LOTS[lotIndex];
  const destX = lot.x + lot.w * 0.6 + 17;
  const laneY = lot.top ? STREET_Y + 18 : STREET_Y + STREET_H - 18;
  const start = { ...state.truck };
  const legs = [
    { x: start.x, y: STREET_Y + STREET_H - 18 },
    { x: destX, y: laneY },
    { x: destX, y: lot.top ? STREET_Y - 24 : STREET_Y + STREET_H + 44 },
  ];
  let leg = 0, p = 0;
  const from = { ...start };
  const step = () => {
    const target = legs[leg];
    const dx = target.x - from.x, dy = target.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    p += 4.5 / dist * 60;
    if (dist > 2) state.truck.angle = Math.atan2(dy, dx);
    if (p >= 1) { from.x = target.x; from.y = target.y; leg++; p = 0; }
    else { state.truck.x = from.x + dx * p; state.truck.y = from.y + dy * p; }
    if (leg >= legs.length) { setTimeout(cb, 250); return; }
    setTimeout(step, 16);
  };
  step();
}

// ============================================================
// JOB SITE — bird's-eye view of the lot
// ============================================================

const SITE = { W: 960, H: 430 };

function slabRect(job) {
  const margin = 40;
  const availW = SITE.W - 2 * margin - 240;
  const availH = 200;
  const ar = job.len / job.wid;
  let w = availW, h = w / ar;
  if (h > availH) { h = availH; w = h * ar; }
  if (w < 260) w = 260;
  return { x: (SITE.W - w) / 2 + 90, y: 190, w, h };
}

function drawSiteBase(ctx, t, job, opts = {}) {
  const { W, H } = SITE;
  // lawn
  ctx.fillStyle = grassPat(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,.045)';
  for (let y = 0; y < H; y += 28) ctx.fillRect(0, y, W, 14);

  // the customer's house: 2.5D along the top edge
  const seed = (job.name || '').length;
  drawHouse25(ctx, W / 2 - 150, -60, 300, 110, ROOFS[seed % ROOFS.length], seed,
    { garage: JOB_TYPES[job.type].interior, hgt: 34 });
  // front walk from the porch
  ctx.fillStyle = pat(ctx, 'concrete');
  ctx.fillRect(W / 2 - 22, 84, 44, 66);
  ctx.strokeStyle = 'rgba(0,0,0,.15)';
  for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(W / 2 - 22, 84 + k * 22); ctx.lineTo(W / 2 + 22, 84 + k * 22); ctx.stroke(); }
  // porch stoop + the customer watching
  ctx.fillStyle = pat(ctx, 'oldConcrete');
  ctx.fillRect(W / 2 - 34, 84, 68, 14);
  drawPerson(ctx, W / 2 + 48, 104, 24, t, '#8a7f6a');

  // hedge property lines
  const hs = mulberry(3);
  for (let y = 20; y < H - 10; y += 24) {
    drawTreeTop(ctx, 14 + hs() * 8, y, 12 + hs() * 5, y);
    drawTreeTop(ctx, W - 14 - hs() * 8, y + 12, 12 + hs() * 5, y + 99);
  }
  drawTreeTop(ctx, 92, 152, 30, 41);
  drawTreeTop(ctx, W - 88, 148, 26, 43);

  // your truck parked on the street edge (bottom-left), gear staged
  drawPickup(ctx, 96, H - 46, 58, -0.12);
  ctx.fillStyle = '#9c7a48';                          // form lumber stack
  ctx.fillRect(150, H - 34, 40, 8);
  ctx.fillRect(150, H - 24, 40, 8);
  ctx.strokeStyle = 'rgba(0,0,0,.3)';
  ctx.strokeRect(150, H - 34, 40, 8); ctx.strokeRect(150, H - 24, 40, 8);
  // wheelbarrow
  ctx.fillStyle = '#535d66';
  ctx.beginPath(); ctx.ellipse(214, H - 40, 12, 7, 0.3, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.stroke();
}

// grade/vignette pass for the site — minigames call this LAST each frame
function siteGrade(ctx) { gradeAndVignette(ctx, SITE.W, SITE.H); }

function drawSlabOutline(ctx, R) {
  // 2x lumber forms with wood tone + stakes
  ctx.strokeStyle = '#8a6a34'; ctx.lineWidth = 6;
  ctx.strokeRect(R.x - 4, R.y - 4, R.w + 8, R.h + 8);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
  ctx.strokeRect(R.x - 5.5, R.y - 5.5, R.w + 11, R.h + 11);
  ctx.fillStyle = '#6e5426';
  const n = Math.round(R.w / 60);
  for (let i = 0; i <= n; i++) {
    ctx.fillRect(R.x - 8 + (R.w + 8) * i / n, R.y - 12, 6, 8);
    ctx.fillRect(R.x - 8 + (R.w + 8) * i / n, R.y + R.h + 5, 6, 8);
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
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
  }
}
