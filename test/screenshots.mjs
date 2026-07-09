// Capture real rendered screenshots of game screens via WebKitWebDriver.
// Requires: webkit2gtk-driver + xvfb, a static server on :8080, and
//   xvfb-run -a WebKitWebDriver --port=4444 --host=127.0.0.1
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

await wd('POST', S('/window/rect'), { x: 0, y: 0, width: 1150, height: 900 });
await wd('POST', S('/url'), { url: GAME });
await new Promise(r => setTimeout(r, 1500));

const exec = script => wd('POST', S('/execute/sync'), { script, args: [] });
const pause = ms => new Promise(r => setTimeout(r, ms));
async function shot(name) {
  const b64 = await wd('GET', S('/screenshot'));
  writeFileSync(`shots/${name}.png`, Buffer.from(b64, 'base64'));
  console.log('📸', name);
}

// mid-game save: chapter 2, cash, gear, a crew
const setup = `
  localStorage.clear();
  G = newState('Legacy Concrete & Outdoor');
  G.cash = 23450; G.rep = 37; G.day = 18; G.chapter = 2;
  G.seenIntro = {1:true, 2:true}; G.storyDone = {1:true};
  G.equipment = { compactor:true, laser:true, eJack:true, powerScreed:true };
  G.jobsDone = 6;
  G.crew = [
    { id:'c1', name:'Duane',  face:'👷', skin:'#c8956c', trait:'screed',   wage:180, bio:'Can back a trailer into anything. Anything.' },
    { id:'c2', name:'Shawna', face:'👷‍♀️', skin:'#8a5a3c', trait:'finisher', wage:210, bio:'Got fired by Big Mike for "doing it too good."' },
  ];
  G.applicants = [
    { id:'a1', name:'Skeeter', face:'🧢', skin:'#e0b090', trait:'fast', wage:150, bio:'Talks to the concrete. The concrete listens.' },
  ];
  for (let i = 0; i < 3; i++) G.leads.push(genLead());
  renderHUD();
`;
const job = `makeStoryJob(CHAPTERS[1])`; // Gary's driveway 48x18x5, demo

// 1. title
await shot('01-title');

// 2. the town map hub
await exec(setup + `showHub('story');`);
await pause(900);
await shot('02-town');

// 3. crew tab
await exec(`showHub('crew');`);
await pause(500);
await shot('03-crew');

// 4. equipment shop
await exec(`showHub('shop');`);
await pause(400);
await shot('04-shop');

// 5. bid walk
await exec(`startBid(${job});`);
await exec(`const m=document.querySelector('#modal-ok'); if(m)m.click();`);
await exec(`const b=document.getElementById('bid-amt'); if(b)b.value='8200';`);
await shot('05-bid');

// 6. demo on the job site, mid-teardown, foreman walking in to work
await exec(`
  G.currentJob = Object.assign(${job}, {bid: 8200, costs:{labor:0,materials:0,fees:0}, scores:{}, flags:{}});
  startDemoGame(G.currentJob, ()=>{});
`);
await pause(400);
await exec(`for (let i = 0; i < 22; i++) window.__demoHit(i);
            for (let i = 0; i < 12; i++) window.__demoHit(i);`);
await exec(`const R = slabRect(G.currentJob); Stage.onClick(R.x + R.w*0.62, R.y + R.h*0.55);`);
await pause(2200);   // let him walk over and start swinging
await shot('06-demo');

// 7. forms & flow lines
await exec(`window.__demoHit && delete window.__demoHit; startFormsGame(G.currentJob, ()=>{});`);
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

// 9. pour day: mixer, chute, wet mud — and rig the RNG so rain rolls in
await exec(`
  window.__oR = Math.random; Math.random = () => 0.2;   // forces the squall
  G.currentJob.order = {yards:14, bags:7, air:6, slump:4, fiber:1, chert:1, nca:0,
    exactYards: 13.33, specString:'7 bag, low chert, air, microfiber, 4″ slump'};
  startPourGame(G.currentJob, G.currentJob.order, ()=>{});
  Math.random = window.__oR;
`);
await pause(600);
await exec(`for (let k = 0; k < 6; k++) window.__pourCell(0);`);
await exec(`const R = slabRect(G.currentJob); Stage.onClick(R.x + R.w*0.5, R.y + R.h*0.6);`);
await pause(1500);
await shot('09-pour');
// wait for the rain to arrive, keep pouring meanwhile
for (let i = 0; i < 100; i++) {
  await pause(1000);
  const raining = await exec(`return !!document.querySelector('#pour-wx b');`);
  if (raining) break;
}
await exec(`for (let k = 0; k < 3; k++) window.__pourCell(0);`);
await pause(1200);
await shot('09b-pour-rain');

// 10. finishing on-site — rig the RNG so the dog shows up
await exec(`
  window.__origRandom = Math.random;
  Math.random = () => 0.2;   // guarantees the dog, at ~37% set
  startFinishGame(G.currentJob, G.currentJob.order, {temp: 64, desc:'⛅ decent'}, ()=>{});
  Math.random = window.__origRandom;
`);
await pause(2500);
await exec(`document.getElementById('act-bull').click();`);
// wait for the dog to be on the slab
for (let i = 0; i < 120; i++) {
  await pause(500);
  const dogOut = await exec(`return !!document.getElementById('act-dog');`);
  if (dogOut) break;
}
await pause(900);   // let him get onto the canvas
await shot('10-finish-dog');

// wait for the inspector (story job, arrives at ~50% set)
for (let i = 0; i < 80; i++) {
  await pause(500);
  const insp = await exec(`const s = window.__finishState && window.__finishState(); return s && s.p > 0.56;`);
  if (insp) break;
}
await exec(`document.getElementById('act-edge')?.click();`);
await pause(700);
await shot('10b-inspector');

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
