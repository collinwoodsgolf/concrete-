// ============================================================
// POUR DECISIONS — minigames
// Each minigame renders into #app and calls done(result) when finished.
// ============================================================

// ---------- DEMO: bust out the old concrete --------------------------------

function startDemoGame(job, done) {
  const sqft = job.len * job.wid;
  const cols = Math.min(10, Math.max(5, Math.round(job.len / 5)));
  const rows = Math.min(6, Math.max(3, Math.round(job.wid / 5)));
  const tiles = cols * rows;

  // equipment determines hits per tile + area-of-effect
  let hp = 3, aoe = false, tool = 'Rental Breaker (pay-by-the-day special)';
  if (owns('eJack')) { hp = 2; tool = 'Electric Jackhammer'; }
  if (owns('skid')) { hp = 1; tool = 'Skid Steer'; }
  if (owns('skid') && owns('breaker')) { hp = 1; aoe = true; tool = 'Skid Steer + Hydraulic Breaker'; }

  const par = tiles * hp * 0.55; // seconds
  let elapsed = 0, broken = 0, timer = null;
  const grid = Array.from({ length: tiles }, () => hp);

  function tileFace(v) {
    if (v <= 0) return '🟫';
    if (v < hp) return '🩹';
    return '⬜';
  }

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🔨 Demo Day — ${esc(job.name)}</h2>
        <p class="muted">${sqft} sq ft of busted old concrete has to come out. Click slabs to break them up. Tool: <b>${tool}</b>${aoe ? ' (breaks neighbors too!)' : ''}</p>
        <div class="statline">
          <span>⏱️ Labor: <b id="demo-time">0.0s</b> (par ${par.toFixed(0)}s)</span>
          <span>💸 Crew cost: <b id="demo-cost">$0</b></span>
          <span>🧱 Cleared: <b id="demo-prog">0/${tiles}</b></span>
        </div>
        <div class="demo-grid" id="demo-grid" style="grid-template-columns:repeat(${cols},1fr)"></div>
      </div>`;
    const g = document.getElementById('demo-grid');
    grid.forEach((v, i) => {
      const d = document.createElement('button');
      d.className = 'demo-tile';
      d.textContent = tileFace(v);
      d.onclick = () => hit(i);
      g.appendChild(d);
    });
  }

  function hit(i) {
    if (grid[i] <= 0) return;
    const targets = [i];
    if (aoe) {
      const r = Math.floor(i / cols), c = i % cols;
      [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr,cc]) => {
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) targets.push(rr * cols + cc);
      });
    }
    targets.forEach(t => {
      if (grid[t] > 0) {
        grid[t]--;
        if (grid[t] <= 0) broken++;
      }
    });
    refresh();
    if (broken >= tiles) finish();
  }

  function refresh() {
    const g = document.getElementById('demo-grid');
    [...g.children].forEach((el, i) => {
      el.textContent = tileFace(grid[i]);
      el.classList.toggle('done', grid[i] <= 0);
    });
    document.getElementById('demo-prog').textContent = `${broken}/${tiles}`;
  }

  function finish() {
    clearInterval(timer);
    const laborCost = Math.round(elapsed * 1.2);
    let haul = Math.round(sqft * 1.0);
    if (owns('dumpTrailer') || owns('skid')) haul = Math.round(haul * 0.5);
    if (owns('dumpTrailer') && owns('skid')) haul = Math.round(haul * 0.6); // already halved once
    const score = clamp(Math.round(100 - Math.max(0, elapsed - par) / par * 90), 25, 100);
    done({ score, laborCost, haul, elapsed: Math.round(elapsed) });
  }

  render();
  timer = setInterval(() => {
    elapsed += 0.1;
    document.getElementById('demo-time').textContent = elapsed.toFixed(1) + 's';
    document.getElementById('demo-cost').textContent = '$' + Math.round(elapsed * 1.2);
  }, 100);
}

// ---------- FORMS: set elevations & flow lines ------------------------------

function startFormsGame(job, done) {
  const run = Math.max(job.len, job.wid);
  const n = clamp(Math.round(run / 8) + 2, 4, 8);     // stakes
  const spacing = run / (n - 1);
  const slope = 0.25;                                  // in/ft ideal fall
  const targets = Array.from({ length: n }, (_, i) => -(i * spacing * slope)); // inches
  const els = targets.map(t => round8(t + (Math.random() * 2 - 1)));           // start off-grade
  const hasLaser = owns('laser');
  const isInterior = JOB_TYPES[job.type].interior;

  function fmt(v) {
    const sign = v < 0 ? '-' : v > 0 ? '+' : '';
    const a = Math.abs(v); const whole = Math.floor(a); const e = Math.round((a - whole) * 8);
    return `${sign}${whole && e ? whole + ' ' : whole ? whole : ''}${e ? e + '/8' : whole ? '' : '0'}″`;
  }

  function svgProfile() {
    const W = 640, H = 170, pad = 36;
    const x = i => pad + i * (W - 2 * pad) / (n - 1);
    const y = v => 50 + (-v) * 16;
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
        <p class="muted">Set each form stake so the slab falls <b>${slope}″ per foot</b> away from the ${isInterior ? 'door' : 'structure'} — about <b>${fmt(targets[n-1])}</b> over the ${run} ft run. ${hasLaser ? 'Your laser shows exact grade targets.' : 'No laser — eyeball it off the string line (buy a laser for exact numbers).'}</p>
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
  const perClick = owns('powerScreed') ? 3 : 1;

  let truckTime = total * 1.05 + 8;
  if (owns('buggy')) truckTime *= 1.25;
  if (order.slump <= 3) truckTime *= 0.85;       // stiff mud is slow
  if (order.slump >= 6) truckTime *= 1.1;        // soupy moves easy (but weak…)
  truckTime = Math.round(truckTime);

  const filled = Array(total).fill(false);
  let placed = 0, t = truckTime, over = 0, timer = null, finished = false;

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🚛 Pour Day — ${esc(job.name)}</h2>
        <p class="muted">${order.yards} yd³ of <b>${order.specString}</b> coming down the chute. Click to place &amp; screed sections before your unload time runs out — overtime is <b>demurrage at $3/sec</b>.${owns('powerScreed') ? ' Power screed: each click strikes off 3 sections!' : ''}${owns('buggy') ? ' Buggy bonus: +25% truck time.' : ''}</p>
        <div class="statline">
          <span>⏱️ Truck clock: <b id="pour-time" class="ok">${t}s</b></span>
          <span>🟩 Placed: <b id="pour-prog">0/${total}</b></span>
          <span>💸 Demurrage: <b id="pour-fee">$0</b></span>
        </div>
        <div class="demo-grid" id="pour-grid" style="grid-template-columns:repeat(${cols},1fr)"></div>
      </div>`;
    const g = document.getElementById('pour-grid');
    for (let i = 0; i < total; i++) {
      const d = document.createElement('button');
      d.className = 'demo-tile pour-tile';
      d.textContent = '▫️';
      d.onclick = () => place(i);
      g.appendChild(d);
    }
  }

  function place(i) {
    if (finished) return;
    let n = 0;
    for (let k = i; k < total && n < perClick; k++) {
      if (!filled[k]) { filled[k] = true; n++; placed++; }
    }
    if (n === 0) { // clicked filled area: fill next unfilled anywhere
      const j = filled.indexOf(false);
      if (j >= 0) { filled[j] = true; placed++; }
    }
    const g = document.getElementById('pour-grid');
    [...g.children].forEach((el, k) => {
      if (filled[k]) { el.textContent = '🟩'; el.classList.add('done'); }
    });
    document.getElementById('pour-prog').textContent = `${placed}/${total}`;
    if (placed >= total) finish();
  }

  function finish() {
    finished = true;
    clearInterval(timer);
    const demurrage = Math.round(over * 3);
    const frac = placed / total;
    let score = Math.round(70 * frac + 30 * clamp(1 - over / truckTime, 0, 1));
    if (frac >= 1 && over === 0) score = Math.max(score, 90 + Math.round(10 * clamp(t / truckTime, 0, 1)));
    done({ score: clamp(score, 5, 100), demurrage, overtime: Math.round(over), shorted: frac < 1 });
  }

  render();
  timer = setInterval(() => {
    if (t > 0) {
      t--;
      const el = document.getElementById('pour-time');
      el.textContent = t + 's';
      el.className = t < 10 ? 'bad' : 'ok';
    } else {
      over++;
      document.getElementById('pour-fee').textContent = '$' + over * 3;
      document.getElementById('pour-time').textContent = '0s ⚠️';
      if (over > 45) finish(); // driver dumps the rest and leaves
    }
  }, 1000);
}

// ---------- JOINTS: tell the concrete where to crack -------------------------

function startJointsGame(job, sawCut, done) {
  const L = job.len, W = job.wid;
  const maxS = Math.round(job.thick * 2.5);       // ft, rule of thumb
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
    if (sawCut) score += 8; // crisp saw lines
    done({ score: clamp(score, 5, 100), bad, ugly });
  }

  render();
}

// ---------- FINISHING: the timing window dance -------------------------------

function startFinishGame(job, order, weather, done) {
  const interior = !!JOB_TYPES[job.type].interior;
  const hasTrowel = owns('trowel');

  // set speed: hot or accelerated = fast clock, cold without NCA = slow
  let dur = 55;
  if (weather.temp >= 85) dur -= 14;
  if (weather.temp <= 45 && order.nca === 0) dur += 18;
  if (order.nca >= 1 && weather.temp >= 60) dur -= 16;   // hot + NCA: flash set!
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

  const results = {}; let bleedFouls = 0;
  let t = 0, paused = false, timer = null, jointsResult = null;
  const handJoints = !owns('saw');
  if (handJoints) steps.splice(2, 0, { id:'joints', label:'✂️ Tool Control Joints', win:[0.46, 0.78], opens:'joints' });

  function markerSpans() {
    return steps.map(s => `<div class="tl-win" style="left:${s.win[0]*100}%;width:${(s.win[1]-s.win[0])*100}%"></div>`).join('') +
      `<div class="tl-bleed" style="left:${bleed[0]*100}%;width:${(bleed[1]-bleed[0])*100}%"></div>`;
  }

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🪄 Finishing — ${esc(job.name)}</h2>
        <p class="muted">${weather.temp}°F${order.nca ? `, ${order.nca}% NCA in the mix` : ''} — the slab sets ${dur < 40 ? '<b class="bad">FAST</b>' : dur > 60 ? 'slow (long day)' : 'at a normal clip'}. Hit each task inside its window. <b>Don’t finish during bleed water</b> (the 💧 sheen) — bull floating is the only safe move then.</p>
        <div class="timeline"><div class="tl-track">${markerSpans()}<div class="tl-cursor" id="tl-cursor"></div></div>
          <div class="tl-labels"><span>wet</span><span id="bleed-flag"></span><span>set hard</span></div>
        </div>
        <div class="finish-actions" id="finish-actions">
          ${steps.map(s => `<button class="btn act" id="act-${s.id}">${s.label}</button>`).join('')}
        </div>
        <div id="finish-log" class="log"></div>
      </div>`;
    steps.forEach(s => document.getElementById('act-' + s.id).onclick = () => act(s));
  }

  function log(msg, cls) {
    const l = document.getElementById('finish-log');
    l.innerHTML = `<div class="${cls || ''}">${msg}</div>` + l.innerHTML;
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
        render(); restoreDone();
        log(`Joints tooled. ${inBleed ? '💧 Worked through bleed water — surface took a hit!' : ''}`);
      });
      return;
    }
    if (inBleed) { bleedFouls++; results[s.id] = Math.max(5, scoreWindow(p, s.win) - 35); log(`💧 ${s.label} — you finished bleed water back in. Dusting/scaling risk!`, 'bad'); }
    else {
      const sc = scoreWindow(p, s.win);
      results[s.id] = sc;
      log(`${s.label} — ${sc >= 85 ? 'right in the sweet spot! 💪' : sc >= 55 ? 'a little off the window, but workable.' : 'way out of the window. Ouch.'}`, sc >= 85 ? 'ok' : sc >= 55 ? 'warn' : 'bad');
    }
    document.getElementById('act-' + s.id).classList.add('used');
  }

  function restoreDone() {
    steps.forEach(s => { if (results[s.id] !== undefined) document.getElementById('act-' + s.id)?.classList.add('used'); });
  }

  function scoreWindow(p, [a, b]) {
    if (p >= a && p <= b) {
      const c = (a + b) / 2, half = (b - a) / 2;
      return Math.round(100 - Math.abs(p - c) / half * 25);
    }
    const d = p < a ? a - p : p - b;
    return clamp(Math.round(70 - d * 280), 5, 60);
  }

  function tick() {
    if (paused) return;
    t += 0.1;
    const p = clamp(t / dur, 0, 1);
    const cur = document.getElementById('tl-cursor');
    if (cur) cur.style.left = (p * 100) + '%';
    const bf = document.getElementById('bleed-flag');
    if (bf) bf.innerHTML = (p > bleed[0] && p < bleed[1]) ? '💧 bleed water on the surface!' : '';
    if (t >= dur) finish();
  }

  function finish() {
    clearInterval(timer);
    let total = 0, n = 0; const missed = [];
    steps.forEach(s => {
      if (s.penalty) return;
      n++;
      if (results[s.id] === undefined) { missed.push(s.label); total += 0; }
      else total += results[s.id];
    });
    let score = n ? Math.round(total / n) : 50;
    if (interior && !hasTrowel) score = Math.min(score, 55);
    done({ score: clamp(score, 5, 100), missed, bleedFouls, jointsResult,
           handFinishedInterior: interior && !hasTrowel });
  }

  render();
  timer = setInterval(tick, 100);
}
