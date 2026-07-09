// ============================================================
// POUR DECISIONS — minigames
// Demo, pour and finishing play out on the animated job-site
// canvas (world.js). Forms and joints use precise SVG tools.
// Each minigame calls done(result) when finished.
// ============================================================

// ---------- DEMO: bust out the old concrete --------------------------------

function startDemoGame(job, done) {
  const sqft = job.len * job.wid;
  const cols = Math.min(10, Math.max(5, Math.round(job.len / 5)));
  const rows = Math.min(6, Math.max(3, Math.round(job.wid / 5)));
  const tiles = cols * rows;

  let hp = 3, tool = 'Rental Breaker (pay-by-the-day special)', aoe = false;
  if (owns('eJack')) { hp = 2; tool = 'Electric Jackhammer'; }
  if (owns('skid')) { hp = 1; tool = 'Skid Steer'; }
  if (owns('skid') && owns('breaker')) { hp = 1; aoe = true; tool = 'Skid Steer + Hydraulic Breaker'; }
  const power = 1 + (crewHas('fast') ? 1 : 0);

  const par = tiles * hp * 0.55 / power;
  let elapsed = 0, broken = 0, timer = null, finished = false;
  const grid = Array.from({ length: tiles }, () => hp);
  const R = slabRect(job);
  const state = { dust: [], lastHit: -1, hitT: 0 };

  function chunkRect(i) {
    const r = Math.floor(i / cols), c = i % cols;
    return { x: R.x + c * R.w / cols, y: R.y + r * R.h / rows, w: R.w / cols, h: R.h / rows };
  }

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🔨 Demo Day — ${esc(job.name)}</h2>
        <p class="muted">${sqft} sq ft of busted old concrete has to come out. Click the slab to break it up. Tool: <b>${tool}</b>${aoe ? ' (smashes neighbors too!)' : ''}${crewHas('fast') ? ' · 👷 Fast Hands on the crew: double damage' : ''}</p>
        <div class="statline">
          <span>⏱️ Labor: <b id="demo-time">0.0s</b> (par ${par.toFixed(0)}s)</span>
          <span>💸 Crew cost: <b id="demo-cost">$0</b></span>
          <span>🧱 Cleared: <b id="demo-prog">0/${tiles}</b></span>
        </div>
        <div id="site" class="site-wrap"></div>
      </div>`;
    Stage.mount(document.getElementById('site'), SITE.W, SITE.H);
    Stage.onClick = (x, y) => {
      const c = Math.floor((x - R.x) / (R.w / cols));
      const r = Math.floor((y - R.y) / (R.h / rows));
      if (c >= 0 && c < cols && r >= 0 && r < rows) hit(r * cols + c);
    };
    Stage.draw = (ctx, t) => {
      drawSiteBase(ctx, t, job);
      // old slab chunks
      for (let i = 0; i < tiles; i++) {
        const cr = chunkRect(i);
        if (grid[i] <= 0) {                                   // rubble
          ctx.fillStyle = '#7d6a52';
          ctx.fillRect(cr.x, cr.y, cr.w, cr.h);
          ctx.fillStyle = '#94836b';
          for (let k = 0; k < 4; k++) {
            const rx = cr.x + ((i * 37 + k * 53) % 83) / 83 * (cr.w - 8);
            const ry = cr.y + ((i * 61 + k * 29) % 71) / 71 * (cr.h - 6);
            ctx.fillRect(rx, ry, 7, 5);
          }
        } else {
          ctx.fillStyle = i % 2 ? '#a9a49a' : '#b0aba1';       // tired old concrete
          ctx.fillRect(cr.x, cr.y, cr.w, cr.h);
          ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
          const dmg = hp - grid[i];
          for (let k = 0; k < dmg * 2 + 1; k++) {              // crack lines grow with damage
            const sx = cr.x + ((i * 17 + k * 41) % 97) / 97 * cr.w;
            const sy = cr.y + ((i * 23 + k * 31) % 89) / 89 * cr.h;
            ctx.beginPath(); ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (k % 2 ? 14 : -12), sy + 10);
            ctx.lineTo(sx + (k % 2 ? 20 : -18), sy + 22);
            ctx.stroke();
          }
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
      ctx.strokeRect(R.x, R.y, R.w, R.h);
      // machines & crew
      if (owns('skid')) drawSkid(ctx, 120, R.y + 40, 90);
      const crew = (G.crew || []);
      crew.forEach((c, k) => drawWorker(ctx, R.x - 40, R.y - 24 + k * 48, 34, t, 'shovel', c.skin));
      // you, hammering at the last hit chunk
      const pos = state.lastHit >= 0 ? chunkRect(state.lastHit) : { x: R.x + R.w / 2, y: R.y - 40, w: 0, h: 0 };
      drawWorker(ctx, pos.x + pos.w / 2, pos.y + pos.h / 2 - 14, 38, t, elapsed - state.hitT < 0.7 ? 'jack' : 'idle');
      drawDust(ctx, state);
    };
  }

  function hit(i) {
    if (finished || grid[i] <= 0) return;
    const targets = [i];
    if (aoe) {
      const r = Math.floor(i / cols), c = i % cols;
      [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr2, cc]) => {
        if (rr2 >= 0 && rr2 < rows && cc >= 0 && cc < cols) targets.push(rr2 * cols + cc);
      });
    }
    targets.forEach(ti => {
      if (grid[ti] > 0) {
        grid[ti] = Math.max(0, grid[ti] - power);
        if (grid[ti] <= 0) broken++;
        const cr = chunkRect(ti);
        siteDust(state, cr.x + cr.w / 2, cr.y + cr.h / 2);
      }
    });
    state.lastHit = i; state.hitT = elapsed;
    const prog = document.getElementById('demo-prog');
    if (prog) prog.textContent = `${broken}/${tiles}`;
    if (broken >= tiles) finish();
  }
  window.__demoHit = hit;   // test hook

  function finish() {
    finished = true;
    clearInterval(timer);
    delete window.__demoHit;
    const laborCost = Math.round(elapsed * 1.2);
    let haul = Math.round(sqft * 1.0);
    if (owns('dumpTrailer') || owns('skid')) haul = Math.round(haul * 0.5);
    const score = clamp(Math.round(100 - Math.max(0, elapsed - par) / par * 90), 25, 100);
    done({ score, laborCost, haul, elapsed: Math.round(elapsed) });
  }

  render();
  timer = setInterval(() => {
    elapsed += 0.1;
    const te = document.getElementById('demo-time'), ce = document.getElementById('demo-cost');
    if (te) te.textContent = elapsed.toFixed(1) + 's';
    if (ce) ce.textContent = '$' + Math.round(elapsed * 1.2);
  }, 100);
}

// ---------- FORMS: set elevations & flow lines ------------------------------

function startFormsGame(job, done) {
  const run = Math.max(job.len, job.wid);
  const n = clamp(Math.round(run / 8) + 2, 4, 8);
  const spacing = run / (n - 1);
  const slope = 0.25;
  const targets = Array.from({ length: n }, (_, i) => -(i * spacing * slope));
  const els = targets.map(t => round8(t + (Math.random() * 2 - 1)));
  const hasLaser = owns('laser');
  const steady = crewHas('steady');
  const isInterior = JOB_TYPES[job.type].interior;

  function fmt(v) {
    const sign = v < 0 ? '-' : v > 0 ? '+' : '';
    const a = Math.abs(v); const whole = Math.floor(a);
    let num = Math.round((a - whole) * 8), den = 8;
    while (num && num % 2 === 0) { num /= 2; den /= 2; }
    return `${sign}${whole && num ? whole + ' ' : whole ? whole : ''}${num ? num + '/' + den : whole ? '' : '0'}″`;
  }

  function svgProfile() {
    const W = 640, H = 170, pad = 36;
    const x = i => pad + i * (W - 2 * pad) / (n - 1);
    const drop = Math.abs(targets[n - 1]) + 1.5;
    const scale = Math.min(16, (H - 60) / drop);
    const y = v => 50 + (-v) * scale;
    const cur = els.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const ideal = targets.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" class="forms-svg">
      <text x="${pad}" y="20" class="svg-label">🏠 ${isInterior ? 'door' : 'structure'} (high side)</text>
      <text x="${W - pad}" y="20" text-anchor="end" class="svg-label">street / drain (low side) 💧</text>
      <polyline points="${ideal}" class="line-ideal"/>
      <polyline points="${cur}" class="line-form"/>
      ${els.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="5" class="stake-dot"/>`).join('')}
    </svg>`;
  }

  function render() {
    const devs = els.map((v, i) => v - targets[i]);
    app.innerHTML = `
      <div class="panel">
        <h2>📐 Setting Forms — ${esc(job.name)}</h2>
        <p class="muted">Set each form stake so the slab falls <b>${slope}″ per foot</b> away from the ${isInterior ? 'door' : 'structure'} — about <b>${fmt(targets[n-1])}</b> over the ${run} ft run. ${hasLaser ? 'Your laser shows exact grade targets.' : steady ? 'Your steady hand on the crew reads the string line close.' : 'No laser — eyeball it off the string line (buy a laser for exact numbers).'}</p>
        ${svgProfile()}
        <div class="stakes">
          ${els.map((v, i) => `
            <div class="stake">
              <div class="stake-d">${Math.round(i * spacing)} ft</div>
              <button class="mini" onclick="window.__stake(${i},1)">▲</button>
              <div class="stake-v">${fmt(v)}</div>
              <button class="mini" onclick="window.__stake(${i},-1)">▼</button>
              <div class="stake-hint">${
                hasLaser ? `🎯 ${fmt(targets[i])}` :
                steady ? (Math.abs(devs[i]) > 0.2 ? (devs[i] > 0 ? '⬇ a hair high' : '⬆ a hair low') : '✅ on the string') :
                Math.abs(devs[i]) > 0.375 ? (devs[i] > 0 ? '⬇ looks high' : '⬆ looks low') : '〰️ close'
              }</div>
            </div>`).join('')}
        </div>
        <button class="btn primary" id="forms-done">✅ Stake It Off — Pour Ready</button>
      </div>`;
    document.getElementById('forms-done').onclick = finish;
  }

  window.__stake = (i, dir) => { els[i] = round8(els[i] + dir * 0.125); render(); };

  function finish() {
    delete window.__stake;
    const devs = els.map((v, i) => Math.abs(v - targets[i]));
    const avgEighths = devs.reduce((a, b) => a + b, 0) / n / 0.125;
    let score = clamp(Math.round(100 - avgEighths * 16), 10, 100);
    let birdbath = false;
    for (let i = 1; i < n; i++) if (els[i] > els[i - 1] + 0.01) birdbath = true;
    if (birdbath) score = Math.max(5, score - 25);
    done({ score, birdbath });
  }

  render();
}

// ---------- POUR: place & screed against the truck clock --------------------

function startPourGame(job, order, done) {
  const sqft = job.len * job.wid;
  const cells = clamp(Math.round(sqft / 12), 18, 60);
  const cols = Math.min(10, Math.max(6, Math.round(Math.sqrt(cells * 1.6))));
  const rowsN = Math.ceil(cells / cols);
  const total = cols * rowsN;
  const perClick = (owns('powerScreed') ? 3 : 1) + (crewHas('screed') ? 1 : 0);

  let truckTime = total * 1.05 + 8;
  if (owns('buggy')) truckTime *= 1.25;
  if (order.slump <= 3) truckTime *= 0.85;
  if (order.slump >= 6) truckTime *= 1.1;
  truckTime = Math.round(truckTime);

  const filled = Array(total).fill(false);
  const fillT = Array(total).fill(0);
  let placed = 0, t = truckTime, over = 0, timer = null, finished = false, clock = 0;
  const R = slabRect(job);
  const state = { dust: [] };

  function cellRect(i) {
    const r = Math.floor(i / cols), c = i % cols;
    return { x: R.x + c * R.w / cols, y: R.y + r * R.h / rowsN, w: R.w / cols, h: R.h / rowsN };
  }

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🚛 Pour Day — ${esc(job.name)}</h2>
        <p class="muted">${order.yards} yd³ of <b>${order.specString}</b> coming down the chute. Click the forms to place &amp; screed sections before the unload window closes — overtime is <b>demurrage at $3/sec</b>.${owns('powerScreed') ? ' Power screed: 3 sections a pass!' : ''}${crewHas('screed') ? ' 👷 Screed Wizard: +1 section.' : ''}</p>
        <div class="statline">
          <span>⏱️ Truck clock: <b id="pour-time" class="ok">${t}s</b></span>
          <span>🟩 Placed: <b id="pour-prog">0/${total}</b></span>
          <span>💸 Demurrage: <b id="pour-fee">$0</b></span>
        </div>
        <div id="site" class="site-wrap"></div>
      </div>`;
    Stage.mount(document.getElementById('site'), SITE.W, SITE.H);
    Stage.onClick = (x, y) => {
      const c = Math.floor((x - R.x) / (R.w / cols));
      const r = Math.floor((y - R.y) / (R.h / rowsN));
      if (c >= 0 && c < cols && r >= 0 && r < rowsN) place(r * cols + c);
    };
    Stage.draw = (ctx, tt) => {
      drawSiteBase(ctx, tt, job);
      // base gravel inside forms
      ctx.fillStyle = '#8f8574';
      ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      for (let k = 0; k < 60; k++)
        ctx.fillRect(R.x + (k * 53 % 97) / 97 * R.w, R.y + (k * 31 % 89) / 89 * R.h, 3, 2);
      // wet concrete cells
      for (let i = 0; i < total; i++) {
        if (!filled[i]) continue;
        const cr = cellRect(i);
        const age = clock - fillT[i];
        ctx.fillStyle = age < 0.6 ? '#6f6b64' : '#9a958c';
        ctx.fillRect(cr.x, cr.y, cr.w, cr.h);
        if (age >= 0.6) {                                 // screeded sheen
          ctx.fillStyle = 'rgba(255,255,255,.10)';
          ctx.fillRect(cr.x, cr.y + cr.h * ((tt * 0.4 + i * 0.13) % 1) * 0.8, cr.w, 3);
        }
      }
      drawSlabOutline(ctx, R);
      // mixer + chute aimed at first unfilled cell
      drawMixer(ctx, 118, R.y + 26, 120, tt);
      const target = filled.indexOf(false);
      if (target >= 0 && !finished) {
        const cr = cellRect(target);
        ctx.strokeStyle = '#c9c9c2'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(178, R.y + 16);
        ctx.quadraticCurveTo((178 + cr.x) / 2, R.y - 46, cr.x + cr.w / 2, cr.y + 6);
        ctx.stroke();
        ctx.fillStyle = '#6f6b64';                        // mud stream
        ctx.beginPath(); ctx.arc(cr.x + cr.w / 2, cr.y + 10, 5 + Math.sin(tt * 12) * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      // crew screeding along the pour front
      const frontRow = Math.min(rowsN - 1, Math.floor(placed / cols));
      const fy = R.y + (frontRow + 0.5) * R.h / rowsN;
      (G.crew || []).forEach((c, k) =>
        drawWorker(ctx, R.x + R.w + 34, fy - 20 + k * 40, 34, tt, 'screed', c.skin));
      drawWorker(ctx, R.x - 36, fy - 8, 38, tt, 'screed');
      drawDust(ctx, state);
    };
  }

  function place(i) {
    if (finished) return;
    let nPlaced = 0;
    for (let k = i; k < total && nPlaced < perClick; k++) {
      if (!filled[k]) { filled[k] = true; fillT[k] = clock; nPlaced++; placed++; }
    }
    if (nPlaced === 0) {
      const j = filled.indexOf(false);
      if (j >= 0) { filled[j] = true; fillT[j] = clock; placed++; }
    }
    const prog = document.getElementById('pour-prog');
    if (prog) prog.textContent = `${placed}/${total}`;
    if (placed >= total) finish();
  }
  window.__pourCell = place;   // test hook

  function finish() {
    finished = true;
    clearInterval(timer);
    delete window.__pourCell;
    const demurrage = Math.round(over * 3);
    const frac = placed / total;
    let score = Math.round(70 * frac + 30 * clamp(1 - over / truckTime, 0, 1));
    if (frac >= 1 && over === 0) score = Math.max(score, 90 + Math.round(10 * clamp(t / truckTime, 0, 1)));
    done({ score: clamp(score, 5, 100), demurrage, overtime: Math.round(over), shorted: frac < 1 });
  }

  render();
  timer = setInterval(() => {
    clock += 1;
    if (t > 0) {
      t--;
      const el = document.getElementById('pour-time');
      if (el) { el.textContent = t + 's'; el.className = t < 10 ? 'bad' : 'ok'; }
    } else {
      over++;
      const fee = document.getElementById('pour-fee'), te = document.getElementById('pour-time');
      if (fee) fee.textContent = '$' + over * 3;
      if (te) te.textContent = '0s ⚠️';
      if (over > 45) finish();
    }
  }, 1000);
}

// ---------- JOINTS: tell the concrete where to crack -------------------------

function startJointsGame(job, sawCut, done) {
  const L = job.len, W = job.wid;
  const maxS = Math.round(job.thick * 2.5);
  const vCuts = new Set(), hCuts = new Set();
  const SW = 640, SH = Math.max(120, Math.min(280, W * (560 / L))) + 40;
  const sx = f => 40 + f * (SW - 80) / L;
  const sy = f => 20 + f * (SH - 60) / W;

  function panels() {
    const xs = [0, ...[...vCuts].sort((a, b) => a - b), L];
    const ys = [0, ...[...hCuts].sort((a, b) => a - b), W];
    const out = [];
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++)
        out.push([xs[i + 1] - xs[i], ys[j + 1] - ys[j]]);
    return out;
  }

  function grade() {
    const ps = panels();
    let bad = 0, ugly = 0;
    ps.forEach(([a, b]) => {
      if (Math.max(a, b) > maxS) bad++;
      else if (Math.max(a, b) / Math.min(a, b) > 1.6) ugly++;
    });
    return { ps, bad, ugly };
  }

  function render() {
    const { ps, bad, ugly } = grade();
    const vBtns = [];
    for (let f = 2; f <= L - 2; f++) vBtns.push(f);
    const hBtns = [];
    if (W > maxS) for (let f = 2; f <= W - 2; f++) hBtns.push(f);

    app.innerHTML = `
      <div class="panel">
        <h2>${sawCut ? '🪚 Saw-Cutting Joints (next morning, nice and calm)' : '✂️ Tooling Control Joints'} — ${esc(job.name)}</h2>
        <p class="muted">Slab is <b>${L}×${W} ft, ${job.thick}″ thick</b>. Rule of thumb: max spacing ≈ 2.5 × thickness → <b>${maxS} ft</b>, panels close to square. Click the slab edge marks to toggle joints.</p>
        <svg viewBox="0 0 ${SW} ${SH}" class="joint-svg">
          <rect x="${sx(0)}" y="${sy(0)}" width="${sx(L) - sx(0)}" height="${sy(W) - sy(0)}" class="slab-rect"/>
          ${[...vCuts].map(f => `<line x1="${sx(f)}" y1="${sy(0)}" x2="${sx(f)}" y2="${sy(W)}" class="joint-line"/>`).join('')}
          ${[...hCuts].map(f => `<line x1="${sx(0)}" y1="${sy(f)}" x2="${sx(L)}" y2="${sy(f)}" class="joint-line"/>`).join('')}
          ${vBtns.map(f => `<circle cx="${sx(f)}" cy="${sy(0) - 9}" r="6" class="joint-btn ${vCuts.has(f) ? 'on' : ''}" onclick="window.__jv(${f})"/>`).join('')}
          ${hBtns.map(f => `<circle cx="${sx(0) - 9}" cy="${sy(f)}" r="6" class="joint-btn ${hCuts.has(f) ? 'on' : ''}" onclick="window.__jh(${f})"/>`).join('')}
          <text x="${SW / 2}" y="${SH - 4}" text-anchor="middle" class="svg-label">${L} ft</text>
        </svg>
        <div class="statline">
          <span>Panels: <b>${ps.length}</b></span>
          <span class="${bad ? 'bad' : 'ok'}">${bad ? `⚠️ ${bad} panel(s) over ${maxS} ft — WILL crack randomly` : '✅ all panels within spacing'}</span>
          <span class="${ugly ? 'warn' : 'ok'}">${ugly ? `${ugly} long skinny panel(s)` : '✅ shapes look good'}</span>
        </div>
        <button class="btn primary" id="joints-done">✅ ${sawCut ? 'Make the Cuts' : 'Tool the Joints'}</button>
      </div>`;
    document.getElementById('joints-done').onclick = finish;
  }

  window.__jv = f => { vCuts.has(f) ? vCuts.delete(f) : vCuts.add(f); render(); };
  window.__jh = f => { hCuts.has(f) ? hCuts.delete(f) : hCuts.add(f); render(); };

  function finish() {
    delete window.__jv; delete window.__jh;
    const { ps, bad, ugly } = grade();
    let score = 100 - Math.round(bad / ps.length * 110) - Math.round(ugly / ps.length * 35);
    if (sawCut) score += 8;
    done({ score: clamp(score, 5, 100), bad, ugly,
           vCuts: [...vCuts], hCuts: [...hCuts] });
  }

  render();
}

// ---------- FINISHING: the timing window dance -------------------------------

function startFinishGame(job, order, weather, done) {
  const interior = !!JOB_TYPES[job.type].interior;
  const hasTrowel = owns('trowel');
  const widen = crewHas('finisher') ? 1.15 : 1;

  let dur = 55;
  if (weather.temp >= 85) dur -= 14;
  if (weather.temp <= 45 && order.nca === 0) dur += 18;
  if (order.nca >= 1 && weather.temp >= 60) dur -= 16;
  if (order.nca >= 2 && weather.temp >= 60) dur -= 6;
  dur = Math.max(26, dur);

  const bleed = [0.15, 0.45];
  let steps = interior && hasTrowel ? [
    { id:'bull',  label:'🛶 Bull Float',          win:[0.00, 0.20] },
    { id:'edge',  label:'📐 Run the Edger',        win:[0.48, 0.72] },
    { id:'pan',   label:'🚁 Trowel — Float Pass',  win:[0.50, 0.68] },
    { id:'burn',  label:'🚁 Trowel — Finish Pass', win:[0.74, 0.94] },
  ] : [
    { id:'bull',  label:'🛶 Bull Float',          win:[0.00, 0.20] },
    { id:'edge',  label:'📐 Run the Edger',        win:[0.48, 0.75] },
    { id:'broom', label:'🧹 Broom Finish',         win:[0.60, 0.88] },
  ];
  if (interior && !hasTrowel) {
    steps.push({ id:'hand', label:'😩 Hand-Mag the Whole Floor', win:[0.55, 0.9], penalty: true });
  }
  const handJoints = !owns('saw');
  if (handJoints) steps.splice(2, 0, { id:'joints', label:'✂️ Tool Control Joints', win:[0.46, 0.78], opens:'joints' });

  const results = {}; let bleedFouls = 0;
  let t = 0, paused = false, timer = null, jointsResult = null;
  const R = slabRect(job);
  const state = { dust: [] };
  // the dog event — exterior pours only, and only if there's time to react
  const dog = (!interior && Math.random() < 0.45 && dur > 32)
    ? { at: 0.3 + Math.random() * 0.35, active: false, resolved: false, x: -40, pawprints: false }
    : null;

  function markerSpans() {
    return steps.map(s => `<div class="tl-win" style="left:${s.win[0]*100}%;width:${(s.win[1]-s.win[0])*100}%"></div>`).join('') +
      `<div class="tl-bleed" style="left:${bleed[0]*100}%;width:${(bleed[1]-bleed[0])*100}%"></div>`;
  }

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🪄 Finishing — ${esc(job.name)}</h2>
        <p class="muted">${weather.temp}°F${order.nca ? `, ${order.nca}% NCA in the mix` : ''} — the slab sets ${dur < 40 ? '<b class="bad">FAST</b>' : dur > 60 ? 'slow (long day)' : 'at a normal clip'}. Hit each task inside its window. <b>Don’t finish during bleed water</b> (the 💧 sheen) — bull floating is the only safe move then.${crewHas('finisher') ? ' 👷 Old Pro on the crew: wider windows.' : ''}</p>
        <div id="site" class="site-wrap"></div>
        <div class="timeline"><div class="tl-track">${markerSpans()}<div class="tl-cursor" id="tl-cursor"></div></div>
          <div class="tl-labels"><span>wet</span><span id="bleed-flag"></span><span>set hard</span></div>
        </div>
        <div class="finish-actions" id="finish-actions">
          ${steps.map(s => `<button class="btn act" id="act-${s.id}">${s.label}</button>`).join('')}
        </div>
        <div id="finish-log" class="log"></div>
      </div>`;
    steps.forEach(s => {
      const b = document.getElementById('act-' + s.id);
      b.onclick = () => act(s);
      if (results[s.id] !== undefined) b.classList.add('used');
    });
    mountSite();
  }

  function mountSite() {
    Stage.mount(document.getElementById('site'), SITE.W, 360);
    Stage.draw = (ctx, tt) => {
      drawSiteBase(ctx, tt, job);
      const p = clamp(t / dur, 0, 1);
      // slab surface: darkens as it sets
      const grey = Math.round(122 + p * 40);
      ctx.fillStyle = `rgb(${grey},${grey - 4},${grey - 10})`;
      ctx.fillRect(R.x, R.y, R.w, R.h);
      // bleed water sheen
      if (p > bleed[0] && p < bleed[1]) {
        const sh = ctx.createLinearGradient(R.x, R.y, R.x + R.w, R.y + R.h);
        const c = 0.5 + Math.sin(tt * 2) * 0.15;
        sh.addColorStop(0, 'rgba(255,255,255,0)');
        sh.addColorStop(c, 'rgba(220,235,255,.28)');
        sh.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sh; ctx.fillRect(R.x, R.y, R.w, R.h);
      }
      // completed work leaves marks
      if (results.edge !== undefined) {
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
        ctx.strokeRect(R.x + 6, R.y + 6, R.w - 12, R.h - 12);
      }
      if (jointsResult) {
        ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
        (jointsResult.vCuts || []).forEach(f => {
          const x = R.x + f / job.len * R.w;
          ctx.beginPath(); ctx.moveTo(x, R.y); ctx.lineTo(x, R.y + R.h); ctx.stroke();
        });
        (jointsResult.hCuts || []).forEach(f => {
          const y = R.y + f / job.wid * R.h;
          ctx.beginPath(); ctx.moveTo(R.x, y); ctx.lineTo(R.x + R.w, y); ctx.stroke();
        });
      }
      if (results.broom !== undefined) {
        ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 1;
        for (let x = R.x + 4; x < R.x + R.w; x += 5) {
          ctx.beginPath(); ctx.moveTo(x, R.y + 2); ctx.lineTo(x, R.y + R.h - 2); ctx.stroke();
        }
      }
      if (results.pan !== undefined || results.burn !== undefined) {
        ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2;
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.arc(R.x + (k * 89 % 97) / 97 * R.w, R.y + (k * 53 % 89) / 89 * R.h, 16, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      drawSlabOutline(ctx, R);
      // crew on the edges, working when an action just fired
      (G.crew || []).forEach((c, k) =>
        drawWorker(ctx, R.x - 40, R.y + 20 + k * 52, 34, tt, 'float', c.skin));
      drawWorker(ctx, R.x + R.w + 38, R.y + R.h / 2, 38, tt,
        results.broom === undefined ? 'float' : 'broom');
      if (interior && hasTrowel && p > 0.45) {                 // power trowel on deck
        ctx.font = '30px sans-serif';
        ctx.fillText('🚁', R.x + R.w / 2 + Math.sin(tt) * R.w * 0.3 - 15, R.y + R.h / 2);
      }
      // THE DOG
      if (dog && dog.active && !dog.resolved) {
        dog.x += 3.4;
        ctx.font = '30px sans-serif';
        ctx.fillText('🐕', dog.x, R.y + R.h / 2);
        if (dog.x > R.x + R.w / 2) {                           // he made it to the mud
          dog.resolved = true; dog.pawprints = true;
          const b = document.getElementById('act-dog'); if (b) b.remove();
          log('🐾 The dog got in the slab! Pawprints across your finish. The customer thinks it’s adorable. It is NOT adorable.', 'bad');
        }
      }
      if (dog && dog.pawprints) {
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.font = '13px sans-serif';
        for (let k = 0; k < 7; k++) ctx.fillText('🐾', R.x + 20 + k * (R.w - 40) / 7, R.y + R.h * 0.45 + (k % 2) * 14);
      }
      drawDust(ctx, state);
    };
  }

  function log(msg, cls) {
    const l = document.getElementById('finish-log');
    if (l) l.innerHTML = `<div class="${cls || ''}">${msg}</div>` + l.innerHTML;
  }

  function scoreWindow(p, [a, b]) {
    const c = (a + b) / 2, half = ((b - a) / 2) * widen;
    if (Math.abs(p - c) <= half) return Math.round(100 - Math.abs(p - c) / half * 25);
    const d = Math.abs(p - c) - half;
    return clamp(Math.round(70 - d * 280), 5, 60);
  }

  function act(s) {
    if (results[s.id] !== undefined || paused) return;
    const p = t / dur;
    const inBleed = p > bleed[0] && p < bleed[1] && s.id !== 'bull';
    if (s.opens === 'joints') {
      paused = true;
      startJointsGame(job, false, jr => {
        jointsResult = jr; paused = false;
        results[s.id] = scoreWindow(p, s.win) - (inBleed ? 30 : 0);
        render();
        log(`Joints tooled. ${inBleed ? '💧 Worked through bleed water — surface took a hit!' : ''}`);
      });
      return;
    }
    if (inBleed) {
      bleedFouls++;
      results[s.id] = Math.max(5, scoreWindow(p, s.win) - 35);
      log(`💧 ${s.label} — you finished bleed water back in. Dusting/scaling risk!`, 'bad');
    } else {
      const sc = scoreWindow(p, s.win);
      results[s.id] = sc;
      log(`${s.label} — ${sc >= 85 ? 'right in the sweet spot! 💪' : sc >= 55 ? 'a little off the window, but workable.' : 'way out of the window. Ouch.'}`, sc >= 85 ? 'ok' : sc >= 55 ? 'warn' : 'bad');
    }
    const b = document.getElementById('act-' + s.id);
    if (b) b.classList.add('used');
  }
  window.__finishAct = id => { const s = steps.find(x => x.id === id); if (s) act(s); };
  window.__finishState = () => ({ p: t / dur, paused });

  function shooDog() {
    if (!dog || dog.resolved) return;
    dog.resolved = true;
    const b = document.getElementById('act-dog'); if (b) b.remove();
    log('🐕 SHOO! The dog veers off into the neighbor’s yard. Crisis averted.', 'ok');
  }

  function tick() {
    if (paused) return;
    t += 0.1;
    const p = clamp(t / dur, 0, 1);
    const cur = document.getElementById('tl-cursor');
    if (cur) cur.style.left = (p * 100) + '%';
    const bf = document.getElementById('bleed-flag');
    if (bf) bf.innerHTML = (p > bleed[0] && p < bleed[1]) ? '💧 bleed water on the surface!' : '';
    if (dog && !dog.active && !dog.resolved && p >= dog.at) {
      dog.active = true; dog.x = -30;
      const row = document.getElementById('finish-actions');
      if (row) {
        const b = document.createElement('button');
        b.className = 'btn act dog'; b.id = 'act-dog'; b.textContent = '🐕 SHOO THE DOG!';
        b.onclick = shooDog;
        row.appendChild(b);
      }
      log('🐕 A dog is charging the wet slab!!', 'warn');
    }
    if (t >= dur) finish();
  }

  function finish() {
    clearInterval(timer);
    delete window.__finishAct; delete window.__finishState;
    let total = 0, n = 0; const missed = [];
    steps.forEach(s => {
      if (s.penalty) return;
      n++;
      if (results[s.id] === undefined) missed.push(s.label);
      else total += results[s.id];
    });
    let score = n ? Math.round(total / n) : 50;
    if (interior && !hasTrowel) score = Math.min(score, 55);
    if (dog && dog.pawprints) score = Math.max(5, score - 12);
    done({ score: clamp(score, 5, 100), missed, bleedFouls, jointsResult,
           dogPrints: !!(dog && dog.pawprints),
           handFinishedInterior: interior && !hasTrowel });
  }

  render();
  timer = setInterval(tick, 100);
}
