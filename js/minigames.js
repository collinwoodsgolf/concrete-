// ============================================================
// POUR DECISIONS — minigames
// Demo, pour and finishing play out on the bird's-eye job site
// (world.js). You ARE the foreman: click where you want to work
// and he walks over and does it. Forms and joints use SVG tools.
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

  const par = tiles * ((hp / power) * 0.5 + 0.5);   // swing time + walking
  let elapsed = 0, broken = 0, timer = null, finished = false;
  const grid = Array.from({ length: tiles }, () => hp);
  let site = null, swingTarget = null, atTarget = false, swingT = 0;

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🔨 Demo Day — ${esc(job.name)}</h2>
        <p class="muted">${sqft} sq ft of busted old concrete has to come out. <b>Click the slab — your foreman walks over and breaks it out.</b> Tool: <b>${tool}</b>${aoe ? ' (smashes neighbors too!)' : ''}${crewHas('fast') ? ' · Fast Hands on the crew: double damage' : ''}</p>
        <div class="statline">
          <span>⏱️ Labor: <b id="demo-time">0.0s</b> (par ${par.toFixed(0)}s)</span>
          <span>💸 Crew cost: <b id="demo-cost">$0</b></span>
          <span>🧱 Cleared: <b id="demo-prog">0/${tiles}</b></span>
        </div>
        <div id="site" class="site-wrap"></div>
      </div>`;
    site = Site3D.create(document.getElementById('site'), job);
    if (!site) return;
    site.demoInit(cols, rows, hp);
    if (owns('skid')) {
      const sk = buildSkid();
      sk.position.set(-job.len / 2 - 14, 0, -job.wid / 2 - 6);
      sk.rotation.y = 0.9;
      W3.scene.add(sk);
    }
    window.__site = site;
    W3.onClick = ray => {
      if (finished) return;
      const pt = site.groundPoint(ray);
      if (!pt) return;
      const i = site.cellAt(pt, cols, rows);
      if (i >= 0 && grid[i] > 0) {
        swingTarget = i; atTarget = false;
        const c = site.cellCenter(i, cols, rows);
        site.movePlayer(c.clone().add(new THREE.Vector3(-1.5, 0, 1.5)), () => {
          atTarget = true;
          site.playerPose('jack');
        });
      } else {
        swingTarget = null; atTarget = false;
        site.movePlayer(pt, () => site.playerPose('idle'));
      }
    };
  }

  function swing(i) {
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
        if (site) { site.demoSet(ti, grid[ti], hp); site.puffAt(ti, cols, rows); }
      }
    });
    const prog = document.getElementById('demo-prog');
    if (prog) prog.textContent = `${broken}/${tiles}`;
    if (broken >= tiles) finish();
  }
  window.__demoHit = swing;   // test hook (works without WebGL too)

  function finish() {
    finished = true;
    clearInterval(timer);
    delete window.__demoHit; delete window.__site;
    const laborCost = Math.round(elapsed * 1.2);
    let haul = Math.round(sqft * 1.0);
    if (owns('dumpTrailer') || owns('skid')) haul = Math.round(haul * 0.5);
    const score = clamp(Math.round(100 - Math.max(0, elapsed - par) / par * 90), 25, 100);
    done({ score, laborCost, haul, elapsed: Math.round(elapsed) });
  }

  render();
  timer = setInterval(() => {
    elapsed += 0.1;
    // foreman swings while parked on a live chunk
    if (site && atTarget && swingTarget !== null && !finished) {
      swingT += 0.1;
      if (swingT >= 0.34) {
        swingT = 0;
        swing(swingTarget);
        if (grid[swingTarget] <= 0) { swingTarget = null; atTarget = false; site.playerPose('idle'); }
      }
    }
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

  let truckTime = total * 1.05 + 8 + total * 0.4;      // includes walking allowance
  if (owns('buggy')) truckTime *= 1.25;
  if (order.slump <= 3) truckTime *= 0.85;
  if (order.slump >= 6) truckTime *= 1.1;
  truckTime = Math.round(truckTime);

  const filled = Array(total).fill(false);
  let placed = 0, t = truckTime, over = 0, timer = null, finished = false, clock = 0;
  let site = null, raining = false;

  // weather roll: summer squalls are real (never in the chapter-3 cold snap)
  const rainRisk = G.chapter === 2 ? 0.35 : G.chapter === 3 ? 0 : 0.15;
  const rainAt = Math.random() < rainRisk ? Math.round(truckTime * (0.35 + Math.random() * 0.3)) : -1;
  let unfilledAtRain = 0;

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🚛 Pour Day — ${esc(job.name)}</h2>
        <p class="muted">${order.yards} yd³ of <b>${order.specString}</b> coming down the chute. <b>Click the forms — the foreman walks over, places and screeds.</b> Overtime is <b>demurrage at $3/sec</b>.${owns('powerScreed') ? ' Power screed: 3 sections a pass!' : ''}${crewHas('screed') ? ' Screed Wizard: +1 section.' : ''}</p>
        <div class="statline">
          <span>⏱️ Truck clock: <b id="pour-time" class="ok">${t}s</b></span>
          <span>🟩 Placed: <b id="pour-prog">0/${total}</b></span>
          <span>💸 Demurrage: <b id="pour-fee">$0</b></span>
          <span id="pour-wx"></span>
        </div>
        <div id="site" class="site-wrap"></div>
      </div>`;
    site = Site3D.create(document.getElementById('site'), job);
    if (!site) return;
    site.pourInit(cols, rowsN);
    site.pourTarget(0, cols, rowsN);
    window.__site = site;
    W3.onClick = ray => {
      if (finished) return;
      const pt = site.groundPoint(ray);
      if (!pt) return;
      const i = site.cellAt(pt, cols, rowsN);
      if (i >= 0) {
        const c = site.cellCenter(i, cols, rowsN);
        site.movePlayer(c.clone().add(new THREE.Vector3(-1.2, 0, 1.5)), () => {
          site.playerPose('screed');
          place(i);
        });
      } else {
        site.movePlayer(pt, () => site.playerPose('idle'));
      }
    };
  }

  function place(i) {
    if (finished) return;
    let nPlaced = 0;
    for (let k = i; k < total && nPlaced < perClick; k++) {
      if (!filled[k]) { filled[k] = true; nPlaced++; placed++; if (site) site.pourSet(k, true); }
    }
    if (nPlaced === 0) {
      const j = filled.indexOf(false);
      if (j >= 0) { filled[j] = true; placed++; if (site) site.pourSet(j, true); }
    }
    if (site) site.pourTarget(filled.indexOf(false), cols, rowsN);
    const prog = document.getElementById('pour-prog');
    if (prog) prog.textContent = `${placed}/${total}`;
    if (placed >= total) finish();
  }
  window.__pourCell = place;   // test hook

  function finish() {
    finished = true;
    clearInterval(timer);
    delete window.__pourCell; delete window.__site;
    const demurrage = Math.round(over * 3);
    const frac = placed / total;
    let score = Math.round(70 * frac + 30 * clamp(1 - over / truckTime, 0, 1));
    if (frac >= 1 && over === 0) score = Math.max(score, 90 + Math.round(10 * clamp(t / truckTime, 0, 1)));
    let rainPenalty = 0;
    if (raining) rainPenalty = clamp(Math.round(unfilledAtRain * 0.6), 0, 15);
    score -= rainPenalty;
    done({ score: clamp(score, 5, 100), demurrage, overtime: Math.round(over), shorted: frac < 1,
           rainHit: raining, rainPenalty });
  }

  render();
  timer = setInterval(() => {
    clock += 1;
    if (rainAt > 0 && clock === rainAt && !finished) {
      raining = true;
      unfilledAtRain = total - placed;
      if (site) site.rain(true);
      const wx = document.getElementById('pour-wx');
      if (wx) wx.innerHTML = '<b class="bad">🌧️ RAIN ROLLING IN — get it placed and covered!</b>';
    }
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
    { id:'bull',  label:'🛶 Bull Float',          win:[0.00, 0.20], pose:'float' },
    { id:'edge',  label:'📐 Run the Edger',        win:[0.48, 0.72], pose:'float' },
    { id:'pan',   label:'Power Trowel — Float Pass',  win:[0.50, 0.68], pose:'float' },
    { id:'burn',  label:'Power Trowel — Finish Pass', win:[0.74, 0.94], pose:'float' },
  ] : [
    { id:'bull',  label:'🛶 Bull Float',          win:[0.00, 0.20], pose:'float' },
    { id:'edge',  label:'📐 Run the Edger',        win:[0.48, 0.75], pose:'float' },
    { id:'broom', label:'🧹 Broom Finish',         win:[0.60, 0.88], pose:'broom' },
  ];
  if (interior && !hasTrowel) {
    steps.push({ id:'hand', label:'😩 Hand-Mag the Whole Floor', win:[0.55, 0.9], penalty: true, pose:'float' });
  }
  const handJoints = !owns('saw');
  if (handJoints) steps.splice(2, 0, { id:'joints', label:'✂️ Tool Control Joints', win:[0.46, 0.78], opens:'joints', pose:'float' });

  const results = {}; let bleedFouls = 0;
  let t = 0, paused = false, timer = null, jointsResult = null;
  let site = null;
  // the dog event — exterior pours only, and only if there's time to react
  const dog = (!interior && Math.random() < 0.45 && dur > 32)
    ? { at: 0.3 + Math.random() * 0.35, active: false, resolved: false, x01: 0, pawprints: false }
    : null;
  // the inspector shows up on story jobs once you're past the tutorial
  const inspector = job.story && job.chapter >= 2 ? { at: 0.5, here: false } : null;

  function markerSpans() {
    return steps.map(s => `<div class="tl-win" style="left:${s.win[0]*100}%;width:${(s.win[1]-s.win[0])*100}%"></div>`).join('') +
      `<div class="tl-bleed" style="left:${bleed[0]*100}%;width:${(bleed[1]-bleed[0])*100}%"></div>`;
  }

  function render() {
    app.innerHTML = `
      <div class="panel">
        <h2>🪄 Finishing — ${esc(job.name)}</h2>
        <p class="muted">${weather.temp}°F${order.nca ? `, ${order.nca}% NCA in the mix` : ''} — the slab sets ${dur < 40 ? '<b class="bad">FAST</b>' : dur > 60 ? 'slow (long day)' : 'at a normal clip'}. Hit each task inside its window. <b>Don’t finish during bleed water</b> (the 💧 sheen) — bull floating is the only safe move then.${crewHas('finisher') ? ' Old Pro on the crew: wider windows.' : ''}</p>
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
    site = Site3D.create(document.getElementById('site'), job, 380);
    if (!site) return;
    site.finishInit();
    window.__site = site;
    if (interior && hasTrowel) site.trowelMachine(false);
    // re-apply completed work after a re-mount (joints overlay rebuilds the DOM)
    if (results.edge !== undefined) site.finishMark('edge');
    if (results.broom !== undefined) site.finishMark('broom');
    if (results.pan !== undefined || results.burn !== undefined) { site.finishMark('swirl'); site.trowelMachine(true); }
    if (jointsResult) site.finishJoints(jointsResult.vCuts, jointsResult.hCuts);
    if (dog && dog.pawprints) site.pawprints();
    if (dog && dog.active && !dog.resolved) site.showDog();
    if (inspector && inspector.here) site.showInspector();
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
    // send the foreman onto the slab
    if (site) {
      const pose = s.pose || 'float';
      const tx = new THREE.Vector3(job.len * (Math.random() * 0.5 - 0.25), 0, job.wid * (Math.random() * 0.5 - 0.25));
      site.movePlayer(tx, () => site.playerPose(pose));
      if (s.id === 'pan' || s.id === 'burn') { site.trowelMachine(true); site.finishMark('swirl'); }
      if (s.id === 'edge') site.finishMark('edge');
      if (s.id === 'broom') site.finishMark('broom');
    }
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
    if (site) site.hideDog();
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
    if (site) site.finishSurface(p, p > bleed[0] && p < bleed[1]);
    if (inspector && !inspector.here && p >= inspector.at) {
      inspector.here = true;
      if (site) site.showInspector();
      log('📋 A city truck pulls up. The inspector steps out with a clipboard and no sense of humor.', 'warn');
    }
    if (dog && !dog.active && !dog.resolved && p >= dog.at) {
      dog.active = true; dog.x01 = 0;
      if (site) site.showDog();
      const row = document.getElementById('finish-actions');
      if (row) {
        const b = document.createElement('button');
        b.className = 'btn act dog'; b.id = 'act-dog'; b.textContent = '🐕 SHOO THE DOG!';
        b.onclick = shooDog;
        row.appendChild(b);
      }
      log('🐕 A dog is charging the wet slab!!', 'warn');
    }
    if (dog && dog.active && !dog.resolved) {
      dog.x01 += 0.028;                       // ~3.5 seconds to reach the mud
      if (site) site.dogX(dog.x01);
      if (dog.x01 >= 0.55) {
        dog.resolved = true; dog.pawprints = true;
        if (site) { site.hideDog(); site.pawprints(); }
        const b = document.getElementById('act-dog'); if (b) b.remove();
        log('🐾 The dog got in the slab! Pawprints across your finish. The customer thinks it’s adorable. It is NOT adorable.', 'bad');
      }
    }
    if (t >= dur) finish();
  }

  function finish() {
    clearInterval(timer);
    delete window.__finishAct; delete window.__finishState; delete window.__site;
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
           inspectorCame: !!(inspector && inspector.here),
           handFinishedInterior: interior && !hasTrowel });
  }

  render();
  timer = setInterval(tick, 100);
}
