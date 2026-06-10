// End-to-end smoke test: plays Chapter 1 (Mrs. Henderson's sidewalk)
// from title screen through the results screen, in jsdom.
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const dom = await JSDOM.fromFile(join(root, 'index.html'), {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;
window.addEventListener('error', e => errors.push(e.message));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = sel => document.querySelector(sel);
const text = () => document.getElementById('app')?.textContent || '';

async function waitFor(fn, label, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const v = fn(); if (v) return v; } catch (e) {}
    await sleep(50);
  }
  throw new Error(`timeout waiting for: ${label}\n--- app text: ${text().slice(0, 400)}`);
}
const step = (msg) => console.log('  ✓', msg);
const clickModalOk = async () => { (await waitFor(() => $('#modal-ok'), 'modal')).click(); await sleep(60); };

// ---- title → new game ----
await waitFor(() => $('#t-new'), 'title screen');
step('title screen rendered');
$('#t-new').click();
await waitFor(() => $('#co-go'), 'company naming');
$('#co-name').value = 'Smoke Test Concrete';
$('#co-go').click();

// chapter 1 intro
await waitFor(() => $('#story-go'), 'chapter 1 intro');
step('chapter intro shown');
$('#story-go').click();

// story tab → bid
(await waitFor(() => $('#sj-go'), 'story job button')).click();
await clickModalOk(); // Dale bid tip
await waitFor(() => $('#bid-amt'), 'bid screen');
step('bid screen rendered');
$('#bid-amt').value = '2400';
$('#bid-go').click();
await clickModalOk(); // bid won modal
step('bid won');

// demo phase (sidewalk has demo)
await clickModalOk().catch(() => {}); // Dale demo tip
await waitFor(() => $('#demo-grid'), 'demo grid');
step('demo minigame rendered');
await waitFor(() => {
  const tiles = [...document.querySelectorAll('.demo-tile:not(.done)')];
  tiles.slice(0, 30).forEach(t => t.click());
  return !document.querySelector('#demo-grid .demo-tile:not(.done)');
}, 'demo complete', 30000);
await clickModalOk(); // demo complete modal
step('demo complete');

// forms phase
await clickModalOk(); // Dale forms tip
const formsDone = await waitFor(() => $('#forms-done'), 'forms screen');
step('forms minigame rendered');
// nudge a stake both ways to exercise the handlers
window.__stake(1, 1); window.__stake(1, -1);
(await waitFor(() => $('#forms-done'), 'forms done btn')).click();
await clickModalOk(); // forms set modal

// order phase
await clickModalOk(); // Dale order tip
await waitFor(() => $('#o-yards'), 'order screen');
step('batch plant order screen rendered');
$('#o-yards').value = '2.5';
$('#o-yards').dispatchEvent(new window.Event('input', { bubbles: true }));
await waitFor(() => /Quote/.test($('#o-quote').textContent), 'live quote');
document.getElementById('o-bags').value = '7';
document.getElementById('o-air').value = '6';
document.getElementById('o-fiber').value = '1';
document.getElementById('o-chert').value = '1';
$('#o-go').click();
await clickModalOk(); // order placed
step('order placed: 7 bag, low chert, air, microfiber');

// pour phase
await clickModalOk(); // Dale pour tip
await waitFor(() => $('#pour-grid'), 'pour grid');
step('pour minigame rendered');
await waitFor(() => {
  [...document.querySelectorAll('#pour-grid .demo-tile:not(.done)')].slice(0, 20).forEach(t => t.click());
  return !document.querySelector('#pour-grid .demo-tile:not(.done)');
}, 'pour complete', 30000);
await clickModalOk(); // truck washed out
step('pour complete');

// finishing phase — hit windows by watching the cursor
await clickModalOk(); // Dale finish tip
await waitFor(() => $('#tl-cursor'), 'finishing timeline');
step('finishing timeline running');
const cursorPct = () => parseFloat($('#tl-cursor')?.style.left || '0');
$('#act-bull').click();

// joints window opens mid-set (no saw owned in fresh game)
await waitFor(() => cursorPct() > 50, 'mid-set window', 120000);
$('#act-edge').click();
$('#act-joints').click();
const jointsBtn = await waitFor(() => $('#joints-done'), 'joints overlay');
step('joints minigame opened from finishing timeline');
window.__jv(10); window.__jv(20); window.__jv(30); // tool some joints
(await waitFor(() => $('#joints-done'), 'joints done')).click();
await waitFor(() => $('#act-broom'), 'back to timeline');
await waitFor(() => cursorPct() > 65, 'broom window', 120000);
$('#act-broom').click();
step('finishing actions done — waiting for set');

// results
const res = await waitFor(() => $('#res-go'), 'results screen', 180000);
step('results screen rendered');
const appText = text();
for (const needle of ['Slab Quality', 'Mix spec', 'Control joints', 'Net', 'Dale’s post-pour debrief']) {
  if (!appText.includes(needle)) throw new Error(`results screen missing "${needle}"`);
}
console.log('\n  --- results excerpt ---');
console.log('  ' + (appText.match(/Slab Quality: \d+\/100/) || ['?'])[0]);
res.click();
await waitFor(() => text().includes('complete') || $('.tabs'), 'back at hub');
step('returned to hub — chapter 1 complete');

if (errors.length) {
  console.error('\nPAGE ERRORS:', errors);
  process.exit(1);
}
console.log('\nSMOKE TEST PASSED ✅');
process.exit(0);
