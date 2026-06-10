// Capture real rendered screenshots of game screens via WebKitWebDriver.
import { writeFileSync, mkdirSync } from 'node:fs';

const WD = 'http://127.0.0.1:4444';
const GAME = 'http://127.0.0.1:8080/index.html';
mkdirSync('shots', { recursive: true });

async function wd(method, path, body) {
  const res = await fetch(WD + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json();
  if (j.value && j.value.error) throw new Error(`${path}: ${JSON.stringify(j.value).slice(0, 300)}`);
  return j.value;
}

const session = await wd('POST', '/session', {
  capabilities: { alwaysMatch: { browserName: 'MiniBrowser',
    'webkitgtk:browserOptions': { args: ['--automation'] } } },
});
const sid = session.sessionId;
const S = p => `/session/${sid}${p}`;

await wd('POST', S('/window/rect'), { x: 0, y: 0, width: 1150, height: 860 });
await wd('POST', S('/url'), { url: GAME });
await new Promise(r => setTimeout(r, 1500));

async function exec(script) {
  return wd('POST', S('/execute/sync'), { script, args: [] });
}
async function shot(name) {
  const b64 = await wd('GET', S('/screenshot'));
  writeFileSync(`shots/${name}.png`, Buffer.from(b64, 'base64'));
  console.log('📸', name);
}
const pause = ms => new Promise(r => setTimeout(r, ms));

// a mid-game save: chapter 2, some cash/rep/equipment
const setup = `
  localStorage.clear();
  G = newState('Legacy Concrete & Outdoor');
  G.cash = 23450; G.rep = 37; G.day = 18; G.chapter = 2;
  G.seenIntro = {1:true, 2:true}; G.storyDone = {1:true};
  G.equipment = { compactor:true, laser:true, eJack:true, powerScreed:true };
  G.jobsDone = 6;
  for (let i = 0; i < 3; i++) G.leads.push(genLead());
  renderHUD();
`;
const job = `makeStoryJob(CHAPTERS[1])`; // Gary's driveway 48x18x5, demo

// 1. title
await shot('01-title');

// 2. story intro (chapter 2 beats)
await exec(setup + `showStoryIntro(CHAPTERS[1]);`);
await shot('02-story');

// 3. hub: leads
await exec(`showHub('leads');`);
await shot('03-hub-leads');

// 4. hub: equipment shop
await exec(`showHub('shop');`);
await shot('04-shop');

// 5. bid walk
await exec(`G.chapter = 1; startBid(${job}); G.chapter = 2;`);
await exec(`const m=document.querySelector('#modal-ok'); if(m)m.click();`);
await exec(`const b=document.getElementById('bid-amt'); if(b)b.value='8200';`);
await shot('05-bid');

// 6. demo minigame, partially busted
await exec(`
  G.currentJob = Object.assign(${job}, {bid: 8200, costs:{labor:0,materials:0,fees:0}, scores:{}, flags:{}});
  startDemoGame(G.currentJob, ()=>{});
  [...document.querySelectorAll('.demo-tile')].forEach((t,i)=>{ if (i % 3 === 0 || i < 14) { t.click(); t.click(); } });
`);
await shot('06-demo');

// 7. forms & flow lines
await exec(`startFormsGame(G.currentJob, ()=>{});`);
await shot('07-forms');

// 8. batch plant order with live quote
await exec(`phaseOrder();`);
await pause(400);
await exec(`
  const y=document.getElementById('o-yards'); y.value='14';
  document.getElementById('o-bags').value='7';
  document.getElementById('o-air').value='6';
  document.getElementById('o-fiber').value='1';
  document.getElementById('o-chert').value='1';
  document.getElementById('o-nca').value='1';
  y.dispatchEvent(new Event('input',{bubbles:true}));
`);
await pause(300);
await shot('08-order');

// 9. pour, mid-pour
await exec(`
  G.currentJob.order = {yards:14, bags:7, air:6, slump:4, fiber:1, chert:1, nca:0,
    exactYards: 13.33, specString:'7 bag, low chert, air, microfiber, 4″ slump'};
  startPourGame(G.currentJob, G.currentJob.order, ()=>{});
`);
await pause(400);
await exec(`[...document.querySelectorAll('.pour-tile')].slice(0, 26).forEach(t=>t.click());`);
await shot('09-pour');

// 10. finishing timeline mid-set with bleed water
await exec(`startFinishGame(G.currentJob, G.currentJob.order, {temp: 64, desc:'⛅ decent'}, ()=>{});`);
await pause(3000);
await exec(`document.getElementById('act-bull').click();`);
await pause(12000); // let cursor reach the bleed-water zone
await shot('10-finish');

// 11. control joints with some cuts made
await exec(`startJointsGame(G.currentJob, true, ()=>{});`);
await exec(`window.__jv(8); window.__jv(16); window.__jv(24); window.__jv(32); window.__jv(40); window.__jh(9);`);
await shot('11-joints');

// 12. results screen
await exec(`
  G.currentJob.scores = { demo: 88, forms: 91, pour: 86, finish: 84, joints: 95 };
  G.currentJob.flags = { jointInfo: { bad: 0 } };
  G.currentJob.costs = { labor: 410, materials: 3120, fees: 240 };
  G.currentJob.weather = { temp: 64, desc: '⛅ decent' };
  finishResults();
`);
await shot('12-results');

await wd('DELETE', S(''));
console.log('done');
