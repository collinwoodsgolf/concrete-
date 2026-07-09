// ============================================================
// POUR DECISIONS — main game flow
// ============================================================

const app = document.getElementById('app');
const hud = document.getElementById('hud');

let G = null; // game state

// ---------- helpers ----------------------------------------------------------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round8 = v => Math.round(v * 8) / 8;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const owns = id => !!(G && G.equipment[id]);
const crewHas = trait => !!(G && (G.crew || []).some(c => c.trait === trait));
const crewWages = () => (G && G.crew || []).reduce((a, c) => a + c.wage, 0);

const OVERHEAD_PER_DAY = 45;   // truck payment, insurance, phone, coffee

function newState(company) {
  return {
    company, cash: 5000, rep: 0, day: 1, chapter: 1,
    equipment: {}, leads: [], crew: [], applicants: [],
    jobsDone: 0, storyDone: {}, seenIntro: {},
  };
}

function save() { try { localStorage.setItem('pourDecisionsSave', JSON.stringify(G)); } catch (e) {} }
function load() {
  try {
    const s = localStorage.getItem('pourDecisionsSave');
    if (!s) return null;
    const g = JSON.parse(s);
    g.crew = g.crew || []; g.applicants = g.applicants || [];   // migrate older saves
    return g;
  } catch (e) { return null; }
}

function chapterDef() { return CHAPTERS[Math.min(G.chapter, CHAPTERS.length) - 1]; }

function rollWeather(cold) {
  const ranges = { 1: [58, 82], 2: [52, 78], 3: [30, 52], 4: [48, 72], 5: [55, 80] };
  const [lo, hi] = ranges[Math.min(G.chapter, 5)];
  let temp = Math.round(lo + Math.random() * (hi - lo));
  if (cold) temp = Math.round(32 + Math.random() * 12);
  return { temp, desc: temp <= 40 ? '🥶 bitter' : temp <= 55 ? '🍂 chilly' : temp <= 75 ? '⛅ decent' : '🥵 hot' };
}

function advanceDays(n) {
  G.day += n;
  G.cash -= OVERHEAD_PER_DAY * n;
}

function renderHUD() {
  if (!G) { hud.innerHTML = ''; return; }
  hud.innerHTML = `
    <span class="hud-co">🏗️ ${esc(G.company)}</span>
    <span>💰 <b class="${G.cash < 0 ? 'bad' : ''}">${money(G.cash)}</b></span>
    <span>⭐ Rep <b>${G.rep}</b></span>
    <span>📅 Day ${G.day}</span>
    <span>👷 Crew <b>${(G.crew || []).length}</b></span>
    <span>📖 ${esc(chapterDef().title)}</span>`;
}

function modal(html, onClose) {
  const m = document.createElement('div');
  m.className = 'modal-back';
  m.innerHTML = `<div class="modal">${html}<button class="btn primary" id="modal-ok">Continue</button></div>`;
  document.body.appendChild(m);
  m.querySelector('#modal-ok').onclick = () => { m.remove(); if (onClose) onClose(); };
}

function daleTip(phase, cb) {
  if (!chapterDef().tutorial) return cb();
  modal(`<h3>🧓 Uncle Dale leans on his shovel</h3><p>${esc(DALE_TIPS[phase])}</p>`, cb);
}

// ---------- title / new game --------------------------------------------------

function showTitle() {
  G = null; renderHUD(); Stage.unmount();
  const hasSave = !!load();
  app.innerHTML = `
    <div class="panel title-panel">
      <div class="title-art">🚛🏗️🧱</div>
      <h1 class="game-title">POUR DECISIONS</h1>
      <p class="tagline">A Concrete Business Story — bids, mud, money, and one perfect broom finish at a time.</p>
      <div class="title-btns">
        <button class="btn primary big" id="t-new">🆕 New Company</button>
        ${hasSave ? '<button class="btn big" id="t-load">📂 Continue</button>' : ''}
      </div>
      <p class="muted small">Demo it. Form it. Spec it — <i>"7 bag, low chert, air, microfiber, 1% NCA."</i> Pour it. Joint it. Broom it. Get paid.</p>
    </div>`;
  document.getElementById('t-new').onclick = showNewGame;
  if (hasSave) document.getElementById('t-load').onclick = () => { G = load(); showHub(); };
}

function showNewGame() {
  app.innerHTML = `
    <div class="panel">
      <h2>🪧 Name Your Company</h2>
      <p class="muted">Something that looks good on a yard sign and a hoodie.</p>
      <input id="co-name" class="input" maxlength="34" value="Legacy Concrete & Outdoor" />
      <button class="btn primary" id="co-go">Start the Story</button>
    </div>`;
  document.getElementById('co-go').onclick = () => {
    const name = document.getElementById('co-name').value.trim() || 'Legacy Concrete';
    G = newState(name); save();
    showHub();
  };
}

// ---------- hub: the town ------------------------------------------------------

function showHub(tab) {
  renderHUD(); save();
  if (G.cash <= -5000) return showGameOver();
  const ch = chapterDef();
  if (!G.seenIntro[ch.id]) { G.seenIntro[ch.id] = true; save(); return showStoryIntro(ch); }

  tab = tab || 'story';
  app.innerHTML = `
    <div class="panel">
      <div class="town-bar">
        <span class="muted small">🗺️ Cedar Falls — ${season().name}, day ${G.day}. <b>$</b> markers are jobs to bid; <b>★</b> is the story job.</span>
        <button class="btn" id="lead-call">📞 Answer the Phone <span class="small muted">(1 day, -${money(OVERHEAD_PER_DAY)})</span></button>
      </div>
      <div id="town" class="site-wrap"></div>
      <div class="tabs">
        <button class="tab ${tab==='story'?'on':''}" data-t="story">📖 Story</button>
        <button class="tab ${tab==='crew'?'on':''}" data-t="crew">👷 Crew</button>
        <button class="tab ${tab==='shop'?'on':''}" data-t="shop">🛠️ Equipment</button>
        <button class="tab ${tab==='pedia'?'on':''}" data-t="pedia">📚 Crete-o-pedia</button>
      </div>
      <div id="tab-body"></div>
    </div>`;

  // the living town map
  const st = townState();
  Stage.mount(document.getElementById('town'), TOWN.W, TOWN.H);
  Stage.draw = (ctx, t) => drawTown(ctx, t, st);
  Stage.onClick = (x, y) => {
    for (const m of st.markers) {
      const p = lotMarkerPos(LOTS[m.lot]);
      if (Math.hypot(x - p.x, y - p.y) < 26) {
        if (m.story) return startStoryJob();
        if (m.job) return startBid(m.job);
      }
    }
  };

  document.getElementById('lead-call').onclick = () => {
    advanceDays(1);
    const n = 1 + Math.round(Math.random() * 2);
    for (let i = 0; i < n; i++) G.leads.push(genLead());
    G.leads = G.leads.slice(-5);
    if (G.applicants.length < 3 && Math.random() < 0.7) G.applicants.push(genApplicant());
    save(); showHub(tab);
  };

  app.querySelectorAll('.tab').forEach(b => b.onclick = () => showHub(b.dataset.t));
  const body = document.getElementById('tab-body');
  if (tab === 'story') renderStoryTab(body);
  if (tab === 'crew') renderCrewTab(body);
  if (tab === 'shop') renderShopTab(body);
  if (tab === 'pedia') renderPediaTab(body);
}

function startStoryJob() {
  const ch = chapterDef();
  if (G.storyDone[ch.id]) return;
  const missing = (ch.storyJob.needs || []).filter(id => !owns(id));
  if (missing.length) {
    return modal(`<h3>🔒 Not ready for this one</h3><p>${esc(ch.storyJob.name)} needs equipment you don’t own yet: <b>${missing.map(id => EQUIPMENT.find(e => e.id === id).name).join(', ')}</b>. Hit the Equipment tab.</p>`);
  }
  startBid(makeStoryJob(ch));
}

function showStoryIntro(ch) {
  Stage.unmount();
  app.innerHTML = `
    <div class="panel">
      <h2>${esc(ch.title)}</h2>
      ${ch.intro.map(([icon, text]) => `<div class="story-beat"><span class="beat-icon">${icon}</span><p>${esc(text)}</p></div>`).join('')}
      <button class="btn primary" id="story-go">Let’s get to work</button>
    </div>`;
  document.getElementById('story-go').onclick = () => showHub('story');
}

function renderStoryTab(el) {
  const ch = chapterDef();
  const sj = ch.storyJob;
  if (G.storyDone[CHAPTERS.length]) {
    el.innerHTML = `<h3>🏆 Story complete!</h3><p class="muted">The campaign is finished, but the phone keeps ringing — keep taking leads and growing the empire.</p>`;
    return;
  }
  if (G.storyDone[ch.id]) {
    const next = CHAPTERS[ch.id];
    el.innerHTML = `<h3>✅ ${esc(ch.title)} — complete</h3>
      <p class="muted">Next: <b>${esc(next.title)}</b> unlocks at <b>${next.repReq} reputation</b> (you have ${G.rep}).
      ${G.rep >= next.repReq ? 'You’re ready!' : 'Take side jobs off the map ($ markers) to build rep and cash.'}</p>
      ${G.rep >= next.repReq ? '<button class="btn primary" id="ch-next">📖 Start ' + esc(next.title) + '</button>' : ''}`;
    const b = document.getElementById('ch-next');
    if (b) b.onclick = () => { G.chapter++; save(); showHub(); };
    return;
  }
  const missing = (sj.needs || []).filter(id => !owns(id));
  el.innerHTML = `
    <h3>${JOB_TYPES[sj.type].icon} Story Job: ${esc(sj.name)}</h3>
    <p>${esc(sj.desc)}</p>
    <p class="muted">${sj.len}×${sj.wid} ft · ${sj.thick}″ thick · ${sj.demo ? 'tear-out required' : 'new pour, no demo'}${sj.cold ? ' · ❄️ COLD weather pour' : ''} · find the ★ on the map</p>
    ${missing.length ? `<p class="bad">⚠️ Requires equipment: ${missing.map(id => EQUIPMENT.find(e => e.id === id).name).join(', ')} — hit the Equipment tab.</p>` : ''}
    <button class="btn primary" id="sj-go" ${missing.length ? 'disabled' : ''}>📋 Walk the Job & Bid It</button>`;
  const b = document.getElementById('sj-go');
  if (b) b.onclick = startStoryJob;
}

function makeStoryJob(ch) {
  const sj = ch.storyJob;
  const t = JOB_TYPES[sj.type];
  const sqft = sj.len * sj.wid;
  const fair = Math.max(800, Math.round(sqft * t.rate + (sj.demo ? sqft * 3 : 0)));
  return { ...sj, id: 'story' + ch.id, story: true, chapter: ch.id, fair,
           lot: STORY_LOTS[ch.id] || 2,
           weather: rollWeather(sj.cold),
           note: ch.tutorial ? 'Dale will coach you through every step of this one.' : pick(CUSTOMER_NOTES) };
}

// ---------- leads & applicants --------------------------------------------------

function genLead() {
  const pool = ['sidewalk', 'patio', 'driveway', 'pad'];
  if (G.chapter >= 4 && owns('trowel')) pool.push('garage');
  const type = pick(pool);
  const dims = {
    sidewalk: [() => 20 + Math.round(Math.random() * 40), () => 4],
    patio:    [() => 10 + Math.round(Math.random() * 8), () => 10 + Math.round(Math.random() * 8)],
    driveway: [() => 30 + Math.round(Math.random() * 30), () => 14 + Math.round(Math.random() * 10)],
    pad:      [() => 10 + Math.round(Math.random() * 6), () => 10 + Math.round(Math.random() * 6)],
    garage:   [() => 22 + Math.round(Math.random() * 6), () => 20 + Math.round(Math.random() * 6)],
  }[type];
  const len = dims[0](), wid = dims[1]();
  const thick = type === 'driveway' ? 5 : 4;
  const demo = Math.random() < 0.5;
  const t = JOB_TYPES[type];
  const sqft = len * wid;
  const fair = Math.max(800, Math.round(sqft * t.rate + (demo ? sqft * 3 : 0)));
  const customer = pick(FIRST_NAMES);
  const lots = [1, 2, 3, 5, 6, 7, 8, 9];
  return { id: 'lead' + Math.random().toString(36).slice(2, 8), type, len, wid, thick, demo, fair,
           lot: lots[Math.floor(Math.random() * lots.length)],
           customer, name: `${customer}’s ${t.label}`, weather: rollWeather(false),
           desc: `${len}×${wid} ${t.label.toLowerCase()} on ${pick(STREETS)}. ${demo ? 'Old slab needs to come out first.' : 'Fresh grade, ready to form.'}`,
           note: pick(CUSTOMER_NOTES) };
}

function genApplicant() {
  const trait = pick(CREW_TRAITS);
  const wage = trait.id === 'cheap' ? 70 + Math.round(Math.random() * 40)
                                    : 130 + Math.round(Math.random() * 90);
  return {
    id: 'crew' + Math.random().toString(36).slice(2, 8),
    name: pick(CREW_NAMES.filter(n => !(G.crew || []).some(c => c.name === n))) || pick(CREW_NAMES),
    face: pick(['👷','👷‍♀️','🧔','👩‍🦰','🧑‍🦱','👨‍🦳','🧢']),
    skin: pick(WORKER_SKINS),
    trait: trait.id, wage,
    bio: pick(CREW_BIOS),
  };
}

function renderCrewTab(el) {
  const traitOf = id => CREW_TRAITS.find(t => t.id === id);
  el.innerHTML = `
    <h3>👷 The Crew</h3>
    <p class="muted">Crew works every job with you — their traits change how the phases play, and their wages come out of every job. Max 3. Applicants show up when you answer the phone.</p>
    <div class="cols">
      <div>
        <h4>On the payroll (${G.crew.length}/3)</h4>
        <div id="crew-list">${G.crew.length ? '' : '<p class="muted small">Nobody yet. It’s just you and the radio.</p>'}</div>
      </div>
      <div>
        <h4>Applicants</h4>
        <div id="app-list">${G.applicants.length ? '' : '<p class="muted small">No applications. Answer the phone — word gets around.</p>'}</div>
      </div>
    </div>`;
  const cl = el.querySelector('#crew-list');
  G.crew.forEach(c => {
    const t = traitOf(c.trait);
    const card = document.createElement('div');
    card.className = 'card crew-card';
    card.innerHTML = `<h4><span class="crew-face">${c.face}</span> ${esc(c.name)} <span class="price">${money(c.wage)}/job</span></h4>
      <p class="small">${t.icon} <b>${t.name}</b> — ${esc(t.desc)}</p>
      <p class="small muted">${esc(c.bio)}</p>
      <button class="btn">🪪 Let Go</button>`;
    card.querySelector('button').onclick = () => {
      G.crew = G.crew.filter(x => x.id !== c.id); save(); showHub('crew');
    };
    cl.appendChild(card);
  });
  const al = el.querySelector('#app-list');
  G.applicants.forEach(c => {
    const t = traitOf(c.trait);
    const card = document.createElement('div');
    card.className = 'card crew-card';
    card.innerHTML = `<h4><span class="crew-face">${c.face}</span> ${esc(c.name)} <span class="price">${money(c.wage)}/job</span></h4>
      <p class="small">${t.icon} <b>${t.name}</b> — ${esc(t.desc)}</p>
      <p class="small muted">${esc(c.bio)}</p>
      <button class="btn primary" ${G.crew.length >= 3 ? 'disabled' : ''}>🤝 Hire</button>`;
    card.querySelector('button').onclick = () => {
      if (G.crew.length >= 3) return;
      G.crew.push(c);
      G.applicants = G.applicants.filter(x => x.id !== c.id);
      save(); showHub('crew');
    };
    al.appendChild(card);
  });
}

// ---------- shop / pedia ---------------------------------------------------------

function renderShopTab(el) {
  el.innerHTML = `<h3>🛠️ Equipment Yard</h3>
    <p class="muted">Tools change how the job phases play. Buy smart — the iron pays for itself.</p>
    <div class="lead-list" id="shop-list"></div>`;
  const list = document.getElementById('shop-list');
  EQUIPMENT.forEach(eq => {
    const owned = owns(eq.id);
    const locked = eq.requires && !owns(eq.requires);
    const card = document.createElement('div');
    card.className = 'card' + (owned ? ' owned' : '');
    card.innerHTML = `
      <h4>${eq.icon} ${esc(eq.name)} ${owned ? '<span class="ok">✓ OWNED</span>' : `<span class="price">${money(eq.cost)}</span>`}</h4>
      <p class="small muted">${esc(eq.desc)}</p>
      ${owned ? '' : `<button class="btn" ${locked || G.cash < eq.cost ? 'disabled' : ''}>${locked ? '🔒 Requires ' + esc(EQUIPMENT.find(e => e.id === eq.requires).name) : G.cash < eq.cost ? 'Can’t afford' : '💳 Buy'}</button>`}`;
    const b = card.querySelector('button');
    if (b) b.onclick = () => { G.cash -= eq.cost; G.equipment[eq.id] = true; save(); showHub('shop'); };
    list.appendChild(card);
  });
}

function renderPediaTab(el) {
  el.innerHTML = `<h3>📚 Crete-o-pedia</h3><p class="muted">Everything Dale ever yelled at you, in alphabetical-ish order.</p>` +
    CRETEPEDIA.map(([t, d]) => `<details class="pedia"><summary>${esc(t)}</summary><p>${esc(d)}</p></details>`).join('');
}

// ---------- bidding -------------------------------------------------------------------

function startBid(job) {
  Stage.unmount();
  daleTip('bid', () => {
    const t = JOB_TYPES[job.type];
    const sqft = job.len * job.wid;
    app.innerHTML = `
      <div class="panel">
        <h2>📋 Walking the Job — ${esc(job.name)}</h2>
        <p>${esc(job.desc)}</p>
        <div class="statline">
          <span>📏 ${job.len}×${job.wid} ft = <b>${sqft} sq ft</b></span>
          <span>📐 ${job.thick}″ thick</span>
          <span>${job.demo ? '🔨 Demo required' : '🌱 No demo'}</span>
          <span>🌡️ Forecast: ${job.weather.temp}°F ${job.weather.desc}</span>
        </div>
        <p class="small">🗒️ ${esc(job.note)}</p>
        <div class="card">
          <h4>🧓 Dale’s cheat sheet</h4>
          <p class="small muted">${t.label}s run about <b>$${t.rate.toFixed(2)}/sq ft</b> around here${job.demo ? ', plus ~$3/sq ft for tear-out' : ''}. Concrete, forms, fuel, crew wages${crewWages() ? ` (yours run ${money(crewWages())}/job)` : ''} and labor come out of YOUR end — leave yourself margin, but don’t price yourself off the porch.</p>
        </div>
        <label class="lbl">Your bid:</label>
        <div class="bid-row"><span class="big-dollar">$</span><input id="bid-amt" class="input num" type="number" min="0" step="50" placeholder="0"></div>
        <button class="btn primary" id="bid-go">🤝 Shake Hands on It</button>
        <button class="btn" id="bid-back">↩️ Walk Away</button>
      </div>`;
    document.getElementById('bid-back').onclick = () => showHub(job.story ? 'story' : undefined);
    document.getElementById('bid-go').onclick = () => {
      const amt = Number(document.getElementById('bid-amt').value) || 0;
      if (amt < 200) return modal('<h3>🧓 Dale grabs your clipboard</h3><p>"You can’t pour a slab for that. Write a real number, kid."</p>');
      resolveBid(job, amt);
    };
  });
}

function resolveBid(job, bid) {
  const r = bid / job.fair;
  let won, msg;
  if (job.story) {
    if (r <= 1.15) { won = true; msg = 'They look at the number, look at your references, and nod. "When can you start?"'; }
    else {
      won = true; bid = Math.round(job.fair * 1.05);
      msg = `They wince at the number. After some kitchen-table negotiating you settle at <b>${money(bid)}</b>. A story job is a story job.`;
    }
  } else {
    const p = r <= 0.85 ? 0.97 : r <= 1.0 ? 0.9 : r <= 1.1 ? 0.62 + G.rep / 400 : r <= 1.25 ? 0.32 + G.rep / 300 : r <= 1.4 ? 0.1 + G.rep / 400 : 0.02;
    won = Math.random() < p;
    msg = won ? 'The phone rings that evening: "You’re hired. Don’t track mud in the flowerbeds."'
              : (r > 1.1 ? `"We went with another bid." You’d bet your last mag float it was Big Mike at ${money(job.fair * 0.7)}. Their funeral.`
                         : '"We decided to hold off this year." Some you win, some stay gravel.');
  }
  if (won) {
    G.leads = G.leads.filter(l => l.id !== job.id);
    G.currentJob = { ...job, bid, costs: { labor: 0, materials: 0, fees: 0 }, scores: {}, flags: {} };
  }
  modal(`<h3>${won ? '🤝 Bid WON' : '📵 Bid lost'}</h3><p>${msg}</p>${won ? `<p class="ok">Contract: <b>${money(bid)}</b> on completion.</p>` : ''}`,
    () => won ? showDriveOut() : showHub(job.story ? 'story' : undefined));
}

// truck rolls from the shop to the job's lot, then work starts
function showDriveOut() {
  const job = G.currentJob;
  renderHUD();
  app.innerHTML = `
    <div class="panel">
      <h2>🚛 Rolling Out — ${esc(job.name)}</h2>
      <p class="muted">Tools loaded, coffee poured, radio on. Day ${G.day}.</p>
      <div id="town" class="site-wrap"></div>
    </div>`;
  const st = townState();
  st.markers = st.markers.filter(m => m.lot !== job.lot);   // that marker is now YOUR job
  Stage.mount(document.getElementById('town'), TOWN.W, TOWN.H);
  Stage.draw = (ctx, t) => drawTown(ctx, t, st);
  driveTruckTo(st, job.lot ?? 6, () => startJobPipeline());
}

// ---------- the job pipeline -------------------------------------------------------

function startJobPipeline() {
  const job = G.currentJob;
  advanceDays(1); renderHUD(); save();
  if (job.demo) {
    daleTip('demo', () => startDemoGame(job, res => {
      job.scores.demo = res.score;
      job.costs.labor += res.laborCost;
      job.costs.fees += res.haul;
      modal(`<h3>🔨 Demo complete</h3><p>Old slab busted and hauled in ${res.elapsed}s. Crew cost ${money(res.laborCost)}, haul-off &amp; dump fees ${money(res.haul)}.</p>
        ${owns('compactor') ? '<p class="ok">🦶 You run the plate compactor over fresh class-5. Subgrade like a parking ramp.</p>' : '<p class="warn">No plate compactor — you rake the base flat and stomp it with your boots. Dale would sigh.</p>'}`,
        phaseForm);
    }));
  } else {
    modal(`<h3>🌱 Grade is ready</h3><p>No tear-out on this one — straight to setting forms.</p>
      ${owns('compactor') ? '<p class="ok">🦶 Plate compactor passes done. Base is tight.</p>' : '<p class="warn">No plate compactor — fingers crossed on that base.</p>'}`, phaseForm);
  }
}

function phaseForm() {
  const job = G.currentJob;
  Stage.unmount();
  daleTip('forms', () => startFormsGame(job, res => {
    job.scores.forms = res.score;
    job.flags.birdbath = res.birdbath;
    const lumber = Math.round((job.len + job.wid) * 2 * 0.8);
    job.costs.materials += lumber;
    modal(`<h3>📐 Forms set</h3><p>Lumber and stakes ran ${money(lumber)}. ${res.birdbath ? '<span class="bad">⚠️ Your string line shows a reverse-fall section — possible bird bath. You can live with it... maybe.</span>' : res.score >= 85 ? '<span class="ok">String line is laser straight, fall is perfect. This is the good part of the job.</span>' : 'Close enough to pour — not your finest staking.'}</p>`,
      phaseOrder);
  }));
}

// ---------- ordering concrete -------------------------------------------------------

function phaseOrder() {
  const job = G.currentJob;
  daleTip('order', () => {
    const sqft = job.len * job.wid;
    const exactYards = sqft * (job.thick / 12) / 27;
    const interior = !!JOB_TYPES[job.type].interior;
    app.innerHTML = `
      <div class="panel">
        <h2>☎️ Calling the Batch Plant — ${esc(job.name)}</h2>
        <p class="muted">Rhonda at dispatch: <i>"Go ahead with your order, hon."</i> Slab is <b>${job.len}×${job.wid} ft × ${job.thick}″</b>. Forecast <b>${job.weather.temp}°F ${job.weather.desc}</b>. ${interior ? 'Interior floor — you’re hard troweling this.' : 'Exterior flatwork — it lives outside in the freeze-thaw.'}</p>
        <div class="card"><p class="small muted">🧓 Dale’s formula: L × W × (thick ÷ 12) ÷ 27, plus 5–10% waste. Don’t make Rhonda do your math.</p></div>
        <div class="order-grid">
          <label class="lbl">Yards ordered <input id="o-yards" class="input num" type="number" min="1" step="0.5" value=""></label>
          <label class="lbl">Cement (bag mix)
            <select id="o-bags" class="input">${[5,6,7,8].map(b => `<option value="${b}" ${b===6?'selected':''}>${b} bag</option>`).join('')}</select></label>
          <label class="lbl">Air entrainment
            <select id="o-air" class="input"><option value="0">None (≤2%)</option><option value="3">~3% (low)</option><option value="6">5–7% (full air)</option></select></label>
          <label class="lbl">Slump
            <select id="o-slump" class="input">${[3,4,5,6,7].map(s => `<option value="${s}" ${s===4?'selected':''}>${s}″</option>`).join('')}</select></label>
          <label class="lbl">Microfiber
            <select id="o-fiber" class="input"><option value="0">No</option><option value="1">Yes</option></select></label>
          <label class="lbl">Low-chert aggregate
            <select id="o-chert" class="input"><option value="0">Standard rock</option><option value="1">Low chert (+$)</option></select></label>
          <label class="lbl">Non-chloride accelerator (NCA)
            <select id="o-nca" class="input"><option value="0">None</option><option value="1">1%</option><option value="2">2%</option></select></label>
        </div>
        <div class="card"><p id="o-quote" class="small">…</p></div>
        <button class="btn primary" id="o-go">📠 Place the Order</button>
      </div>`;

    const readOrder = () => ({
      yards: Number(document.getElementById('o-yards').value) || 0,
      bags: Number(document.getElementById('o-bags').value),
      air: Number(document.getElementById('o-air').value),
      slump: Number(document.getElementById('o-slump').value),
      fiber: Number(document.getElementById('o-fiber').value),
      chert: Number(document.getElementById('o-chert').value),
      nca: Number(document.getElementById('o-nca').value),
    });
    const priceOrder = o => {
      let per = MIX_PRICES.perYardBase + (o.bags - 5) * MIX_PRICES.perBagStep;
      if (o.air > 0) per += MIX_PRICES.air;
      if (o.fiber) per += MIX_PRICES.fiber;
      if (o.chert) per += MIX_PRICES.lowChert;
      per += o.nca * MIX_PRICES.ncaPerPct;
      let total = per * o.yards + MIX_PRICES.delivery;
      if (o.yards > 0 && o.yards < 4) total += MIX_PRICES.shortLoadFee;
      return Math.round(total);
    };
    const specString = o =>
      `${o.bags} bag${o.chert ? ', low chert' : ''}${o.air >= 6 ? ', air' : o.air === 3 ? ', low air' : ''}${o.fiber ? ', microfiber' : ''}${o.nca ? `, ${o.nca}% NCA` : ''}, ${o.slump}″ slump`;

    const refresh = () => {
      const o = readOrder();
      document.getElementById('o-quote').innerHTML = o.yards > 0
        ? `Rhonda reads it back: <b>"${o.yards} yards, ${specString(o)}."</b> Quote: <b>${money(priceOrder(o))}</b>${o.yards < 4 ? ' (incl. short-load fee)' : ''}.`
        : 'Enter your yardage, hon.';
    };
    app.querySelectorAll('input,select').forEach(el => el.oninput = refresh);
    refresh();

    document.getElementById('o-go').onclick = () => {
      const o = readOrder();
      if (o.yards <= 0) return;
      o.specString = specString(o);
      o.cost = priceOrder(o);
      o.exactYards = exactYards;
      if (o.yards < exactYards * 0.97) {
        o.shorted = true;
        o.cost += MIX_PRICES.secondTruckFee + Math.round((exactYards * 1.05 - o.yards) * (MIX_PRICES.perYardBase + 30));
      } else if (o.yards > exactYards * 1.3) {
        o.wasted = true;
      }
      G.currentJob.order = o;
      G.currentJob.costs.materials += o.cost;
      save();
      modal(`<h3>📠 Order placed</h3><p>"${o.yards} yards, <b>${o.specString}</b> — truck’s rolling at 7 AM. Don’t make my driver wait."</p>
        ${o.shorted ? '<p class="bad">⚠️ Mid-pour you run SHORT. A cleanup truck saves you — short-load and standby fees apply, and the cold joint between loads will show.</p>' : ''}
        ${o.wasted ? '<p class="warn">That’s a lot of extra mud — the leftover goes to the wash-out pit along with your money.</p>' : ''}`,
        phasePour);
    };
  });
}

// ---------- pour day -----------------------------------------------------------------

function phasePour() {
  const job = G.currentJob;
  daleTip('pour', () => startPourGame(job, job.order, res => {
    job.scores.pour = res.score;
    job.costs.fees += res.demurrage;
    job.flags.coldJoint = res.shorted || job.order.shorted;
    modal(`<h3>🚛 Truck’s washed out</h3><p>${res.shorted ? '<span class="bad">You didn’t get it all placed in time — part of the slab got dumped and raked in rough. It’ll show.</span>' : 'Mud’s down and screeded off.'} ${res.demurrage ? `Demurrage: <b>${money(res.demurrage)}</b> (${res.overtime}s over).` : 'Zero demurrage — Rhonda’s driver tips his cap.'}</p>`,
      phaseFinish);
  }));
}

function phaseFinish() {
  const job = G.currentJob;
  daleTip('finish', () => startFinishGame(job, job.order, job.weather, res => {
    Stage.unmount();
    job.scores.finish = res.score;
    job.flags.bleedFouls = res.bleedFouls;
    job.flags.missed = res.missed;
    job.flags.dogPrints = res.dogPrints;
    job.flags.handFinishedInterior = res.handFinishedInterior;
    if (res.jointsResult) { job.scores.joints = res.jointsResult.score; job.flags.jointInfo = res.jointsResult; finishResults(); }
    else if (owns('saw')) {
      modal(`<h3>🪚 Next morning</h3><p>Slab’s hard enough to walk. You fire up the early-entry saw — clean, calm, straight lines with a chalk box and a coffee.</p>`,
        () => startJointsGame(job, true, jr => { job.scores.joints = jr.score; job.flags.jointInfo = jr; finishResults(); }));
    } else {
      job.scores.joints = 10;
      job.flags.noJoints = true;
      finishResults();
    }
  }));
}

// ---------- results -------------------------------------------------------------------

function gradeMix(job) {
  const o = job.order, interior = !!JOB_TYPES[job.type].interior, temp = job.weather.temp;
  let score = 100; const notes = [];
  if (o.bags <= 5) { score -= 20; notes.push(['bad', '5-bag mix outside is Big Mike behavior — weak surface, early wear.']); }
  else if (o.bags === 8) { score -= 8; notes.push(['warn', '8 bag is overkill — pricey, and rich mixes shrink-crack more.']); }
  else if (o.bags === 7 && !interior) notes.push(['ok', '7 bag exterior mix — strong like Dale likes it.']);
  if (!interior) {
    if (o.air >= 6) notes.push(['ok', 'Full air entrainment — winter can do its worst.']);
    else { score -= 25; notes.push(['bad', `No${o.air ? 't enough' : ''} air in an exterior mix. First freeze-thaw cycle will scale this surface. Dale is disappointed.`]); }
  } else {
    if (o.air >= 6) { score -= 30; notes.push(['bad', '6% air under a power trowel = DELAMINATION. Blisters are already forming. Dale told you. He TOLD you.']); }
    else if (o.air === 3) notes.push(['ok', 'Low air interior mix — perfect under the trowel.']);
    else notes.push(['ok', 'Non-air interior mix — trowels fine.']);
  }
  if (temp <= 42) {
    if (o.nca >= 2) notes.push(['ok', '2% NCA on a bitter day — set right on schedule.']);
    else if (o.nca === 1) { score -= 6; notes.push(['warn', '1% NCA helped, but you were finishing by headlights.']); }
    else { score -= 18; notes.push(['bad', 'No accelerator below 42°F — the slab sat wet all day and the surface is weak.']); }
  } else if (temp <= 52) {
    if (o.nca === 1) notes.push(['ok', '1% NCA was the right call for a chilly pour.']);
    else if (o.nca === 0) { score -= 8; notes.push(['warn', 'Chilly pour with no NCA — long, risky set.']); }
    else { score -= 4; notes.push(['warn', '2% on a mild-cold day — it got away from you a little.']); }
  } else if (o.nca >= 1) { score -= 12; notes.push(['bad', `Accelerator on a ${temp}°F day — the mud flashed on you. Why, champ.`]); }
  if (!interior) {
    if (o.fiber) notes.push(['ok', 'Microfiber in the mix — plastic shrinkage cracks never stood a chance.']);
    else { score -= 5; notes.push(['warn', 'No fiber — a few hairline surface checks show up as it cures.']); }
    if (o.chert) notes.push(['ok', 'Low-chert rock — no popouts on this slab, ever.']);
    else { score -= 5; notes.push(['warn', 'Standard aggregate — expect a popout or two come spring.']); }
  }
  if (o.slump >= 6) { score -= 12; notes.push(['bad', `${o.slump}″ slump soup — easy to push, weak as gas-station coffee.`]); }
  else if (o.slump === 3) { score -= 4; notes.push(['warn', '3″ slump — strong, but the crew’s backs filed a grievance.']); }
  else notes.push(['ok', `${o.slump}″ slump placed like a dream.`]);
  if (o.shorted) { score -= 15; notes.push(['bad', 'Ran short on yardage — cold joint where the cleanup load tied in.']); }
  else if (o.wasted) { score -= 4; notes.push(['warn', 'Way over-ordered — the wash-out pit ate your margin.']); }
  else notes.push(['ok', `Yardage math was on the money (needed ${o.exactYards.toFixed(1)}, ordered ${o.yards}).`]);
  return { score: clamp(score, 0, 100), notes };
}

function finishResults() {
  const job = G.currentJob;
  const mix = gradeMix(job);
  job.scores.mix = mix.score;
  const subgrade = owns('compactor') ? 100 : 68;
  const s = job.scores;
  const weights = { mix: 0.25, finish: 0.20, joints: 0.15, forms: 0.15, pour: 0.15, sub: 0.10 };
  let quality = Math.round(
    mix.score * weights.mix + (s.finish ?? 60) * weights.finish + (s.joints ?? 50) * weights.joints +
    (s.forms ?? 60) * weights.forms + (s.pour ?? 60) * weights.pour + subgrade * weights.sub);
  if (job.flags.birdbath) quality -= 4;
  if (job.flags.coldJoint) quality -= 4;
  quality = clamp(quality, 5, 100);

  const fuel = 60 + (job.demo ? 40 : 0);
  job.costs.fees += fuel;
  const wages = crewWages();
  job.costs.labor += wages;
  const costs = job.costs.labor + job.costs.materials + job.costs.fees;
  let callback = 0;
  if (quality < 55) callback = Math.round(job.bid * 0.12);
  const net = job.bid - costs - callback;
  G.cash += net;
  const repDelta = clamp(Math.round((quality - 58) / 4) + (job.story ? 3 : 0), -8, 14);
  G.rep = clamp(G.rep + repDelta, 0, 100);
  G.jobsDone++; advanceDays(1);

  const tier = REVIEWS.find(r => quality >= r.min);
  const review = pick(tier.texts);

  const isStory = job.story;
  if (isStory) G.storyDone[job.chapter] = true;
  const isFinal = isStory && CHAPTERS[job.chapter - 1].final;
  G.currentJob = null;
  save(); renderHUD();

  app.innerHTML = `
    <div class="panel">
      <h2>🏁 Job Complete — ${esc(job.name)}</h2>
      <div class="quality-banner q${quality >= 85 ? 'A' : quality >= 70 ? 'B' : quality >= 55 ? 'C' : 'D'}">
        Slab Quality: <b>${quality}/100</b> &nbsp; ${tier.stars}
      </div>
      <p class="review">${esc(review)} — ${esc(job.customer)}</p>
      <div class="cols">
        <div class="card">
          <h4>📊 Scorecard</h4>
          <table class="score-table">
            <tr><td>Mix spec</td><td>${mix.score}</td></tr>
            <tr><td>Finishing</td><td>${s.finish ?? '—'}</td></tr>
            <tr><td>Control joints</td><td>${s.joints ?? '—'}</td></tr>
            <tr><td>Forms &amp; flow lines</td><td>${s.forms ?? '—'}</td></tr>
            <tr><td>Pour</td><td>${s.pour ?? '—'}</td></tr>
            <tr><td>Subgrade</td><td>${subgrade}</td></tr>
            ${s.demo !== undefined ? `<tr><td>Demo</td><td>${s.demo}</td></tr>` : ''}
          </table>
        </div>
        <div class="card">
          <h4>💵 The Money</h4>
          <table class="score-table">
            <tr><td>Contract</td><td>${money(job.bid)}</td></tr>
            <tr><td>Materials &amp; concrete</td><td>-${money(job.costs.materials)}</td></tr>
            <tr><td>Labor${wages ? ` (incl. ${money(wages)} crew wages)` : ''}</td><td>-${money(job.costs.labor)}</td></tr>
            <tr><td>Fees, fuel, dump</td><td>-${money(job.costs.fees)}</td></tr>
            ${callback ? `<tr class="bad"><td>Warranty callback</td><td>-${money(callback)}</td></tr>` : ''}
            <tr class="total"><td>Net</td><td class="${net >= 0 ? 'ok' : 'bad'}">${money(net)}</td></tr>
          </table>
          <p class="small">Reputation ${repDelta >= 0 ? '+' : ''}${repDelta} ⭐</p>
        </div>
      </div>
      <div class="card"><h4>🧓 Dale’s post-pour debrief</h4>
        ${mix.notes.map(([cls, n]) => `<p class="small ${cls}">• ${esc(n)}</p>`).join('')}
        ${job.flags.birdbath ? '<p class="small bad">• Bird bath in the flow line — first rain proved it. Customer noticed.</p>' : ''}
        ${job.flags.missed && job.flags.missed.length ? `<p class="small bad">• Skipped finishing steps: ${job.flags.missed.join(', ')}.</p>` : ''}
        ${job.flags.bleedFouls ? '<p class="small bad">• Finished through bleed water — surface will dust.</p>' : ''}
        ${job.flags.dogPrints ? '<p class="small bad">• Dog prints in the finish. The customer named him "Rebar." You are not laughing.</p>' : ''}
        ${job.flags.handFinishedInterior ? '<p class="small bad">• Hand-magging a whole garage floor… buy the power trowel, kid.</p>' : ''}
        ${job.flags.noJoints ? '<p class="small bad">• NO control joints?! That’s Big Mike behavior. A lightning-bolt crack is already forming.</p>'
          : job.flags.jointInfo && job.flags.jointInfo.bad ? '<p class="small bad">• Panels over max joint spacing — a random crack is already plotting its route.</p>'
          : '<p class="small ok">• Joints look right. The cracks will land where YOU said.</p>'}
      </div>
      <button class="btn primary" id="res-go">${isFinal ? '🏆 See How It Ends' : '🏠 Back to Town'}</button>
    </div>`;
  document.getElementById('res-go').onclick = () => isFinal ? showEpilogue(quality) : showHub(isStory ? 'story' : undefined);
}

// ---------- endings -----------------------------------------------------------------

function showEpilogue(finalQuality) {
  Stage.unmount();
  G.storyDone[CHAPTERS.length] = true; save();
  const good = finalQuality >= 70;
  app.innerHTML = `
    <div class="panel">
      <h1>${good ? '🏆 EPILOGUE — The Town You Built' : '📖 EPILOGUE — Hard Lessons'}</h1>
      ${good ? `
        <div class="story-beat"><span class="beat-icon">🏛️</span><p>The mayor cuts the ribbon on the new plaza. Kids chalk hopscotch grids on your broom finish. Somewhere under their feet: perfect joints, full air, low-chert rock, and ${finalQuality} points of pride.</p></div>
        <div class="story-beat"><span class="beat-icon">😤</span><p>Big Mike’s flatbed is spotted two counties over with a new banner: BIG MIKE’S DISCOUNT GUTTERS. Godspeed, Mike.</p></div>
        <div class="story-beat"><span class="beat-icon">🧓</span><p>Dale runs a thumb along a saw cut, straight as the day is long. "Your grandpa tooled joints like this," he says. He doesn’t say anything else. He doesn’t have to.</p></div>
        <div class="story-beat"><span class="beat-icon">🏗️</span><p>${esc(G.company)} — Final cash: ${money(G.cash)} · Reputation: ${G.rep} · Jobs poured: ${G.jobsDone}. The phone is still ringing.</p></div>`
      : `
        <div class="story-beat"><span class="beat-icon">🏛️</span><p>The plaza got done... eventually. The city inspector’s punch list was longer than the spec sheet. You got paid, mostly, and learned more on one job than in the whole season before it.</p></div>
        <div class="story-beat"><span class="beat-icon">🧓</span><p>Dale claps you on the shoulder. "Concrete forgives nothing and forgets nothing. But the next slab don’t know about the last one. Pour again."</p></div>
        <div class="story-beat"><span class="beat-icon">🏗️</span><p>${esc(G.company)} — Cash: ${money(G.cash)} · Reputation: ${G.rep}. The leads board is still open — go earn the ending you wanted.</p></div>`}
      <button class="btn primary" id="ep-go">🏠 Keep Pouring (free play)</button>
      <button class="btn" id="ep-title">🔁 Title Screen</button>
    </div>`;
  document.getElementById('ep-go').onclick = () => showHub();
  document.getElementById('ep-title').onclick = showTitle;
}

function showGameOver() {
  Stage.unmount();
  app.innerHTML = `
    <div class="panel">
      <h1>💸 GAME OVER — The Bank Calls It</h1>
      <p>Five grand in the hole, the truck payment is due, and the yard sign blew into the ditch. Even Dale can’t talk the banker down this time.</p>
      <p class="muted">Big Mike honks as he drives past. Twice.</p>
      <button class="btn primary" id="go-new">🆕 Start Over</button>
    </div>`;
  document.getElementById('go-new').onclick = () => { localStorage.removeItem('pourDecisionsSave'); showTitle(); };
}

// ---------- boot ----------------------------------------------------------------------

showTitle();
