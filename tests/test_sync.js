const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../dist/index.html', 'utf8').replace(/<script src=[^>]+><\/script>/, '').replace('"__FIREBASE_PROJECT_ID__"', '"demo"').replace('"__FIREBASE_API_KEY__"', '"key"');
const cloud = {}; // path -> doc
let writeClock = 0;
const mkFetch = (log) => async (url, opts = {}) => {
  const path = url.split('/documents/')[1].split('?')[0];
  log.push((opts.method || 'GET') + ' ' + path);
  if (!opts.method) { if (!cloud[path]) return { status: 404, ok: false }; return { status: 200, ok: true, json: async () => cloud[path] }; }
  // som Firestore: villkorade skrivningar (currentDocument.*) och updateTime på varje skrivning (3.2.1: appen skriver alltid villkorat)
  const qs = new URL(url).searchParams; const ut = qs.get('currentDocument.updateTime'), ex = qs.get('currentDocument.exists');
  if ((ut !== null && (!cloud[path] || cloud[path].updateTime !== ut)) || (ex === 'false' && cloud[path]) || (ex === 'true' && !cloud[path])) { log.push('NEKAD ' + path); return { status: 400, ok: false, json: async () => ({ error: { status: 'FAILED_PRECONDITION' } }) }; }
  cloud[path] = JSON.parse(opts.body); cloud[path].updateTime = new Date(Date.UTC(2026, 0, 1) + (++writeClock) * 1000).toISOString(); return { status: 200, ok: true, json: async () => cloud[path] };
};
function device(name, storage) {
  const dom = new JSDOM('<!doctype html>' + html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://plugg.example/' });
  const w = dom.window; w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false }); w.HTMLCanvasElement.prototype.getContext = () => null;
  const log = []; w.fetch = mkFetch(log); w.__log = log;
  if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  // run scripts manually (outside-only) in order
  for (const sc of [...dom.window.document.querySelectorAll('script')]) if (sc.textContent.trim()) w.eval(sc.textContent);
  w.__name = name; return w;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error('no ' + sel + ' on ' + w.__name); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
(async () => {
  const A = device('phone');
  await sleep(50);
  // set family code via parent settings
  A.PA.DB.settings.family = 'test-fam-123'; A.localStorage.setItem('pluggappen.v1', JSON.stringify(A.PA.DB));
  const FIX = require('./test_fixture_family.json'); A.PA.FAMILY.apply(FIX); A.PA.load(); const pushedCfg = await A.PA.FAMILY.push(); A.PA.rerender(); console.log('A pushed config:', pushedCfg, 'kids', A.PA.KIDS.length);
  await A.PA.SYNC.refreshAll();
  console.log('A active:', A.PA.SYNC.active, 'status', A.PA.SYNC.status);
  // play on A: k2 answers a sprint
  click(A, '[data-kid="k2"]'); click(A, '[data-pet="uggla"]'); A.PA.DB.profiles.k2.xp = 300; A.PA.DB.profiles.k2.gems = 7; A.PA.DB.profiles.k2.skills.plus20 = { att: 10, cor: 9, streak: 2, m: 70, lvl: 2, last: Date.now(), wrongRun: 0 };
  A.PA.save(); await sleep(2000);
  console.log('cloud docs after A push:', Object.keys(cloud));
  // Device B fresh, with family link
  const B = device('ipad'); B.location.hash = '#fam-test-fam-123';
  B.PA.DB.settings.family = 'test-fam-123'; const gotCfg = await B.PA.FAMILY.pull(); B.PA.load(); console.log('B pulled config from cloud:', gotCfg, 'kids', B.PA.KIDS.length); await B.PA.SYNC.refreshAll();
  console.log('B k2 xp after pull:', B.PA.DB.profiles.k2.xp, 'gems', B.PA.DB.profiles.k2.gems, 'pet', B.PA.DB.profiles.k2.pet);
  // B plays: new skill + xp
  B.PA.DB.profiles.k2.xp += 50; B.PA.DB.profiles.k2.skills.minus20 = { att: 5, cor: 5, streak: 5, m: 60, lvl: 2, last: Date.now(), wrongRun: 0 };
  B.PA.setKid('k2'); B.PA.save(); await sleep(2000);
  // Meanwhile A played offline too (local changed) then refreshes -> merge
  A.PA.DB.profiles.k2.xp += 20; A.PA.DB.profiles.k2.skills.plus20.att = 14; A.PA.DB.profiles.k2.skills.plus20.cor = 13; A.PA.setKid('k2'); A.PA.save(); A.PA.SYNC.pending.clear(); clearTimeout(A.PA.SYNC.pushTimer);
  const changed = await A.PA.SYNC.refresh('k2'); await sleep(2000);
  const pa = A.PA.DB.profiles.k2;
  console.log('A merged:', changed, 'xp', pa.xp, 'plus20 att', pa.skills.plus20.att, 'has minus20', !!pa.skills.minus20);
  await B.PA.SYNC.refresh('k2');
  const pb = B.PA.DB.profiles.k2;
  console.log('B after re-pull:', 'xp', pb.xp, 'plus20 att', pb.skills.plus20.att, 'has minus20', !!pb.skills.minus20);
  const ok = gotCfg && B.PA.KIDS.length === 3 && pa.xp === 370 && pa.skills.plus20.att === 14 && pa.skills.minus20 && pb.xp === 370 && pb.skills.plus20.att === 14;
  console.log(ok ? 'SYNC TEST OK' : 'SYNC TEST FAILED');
  process.exit(ok ? 0 : 1);
})();
