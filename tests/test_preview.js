/* Testadressen för en förhandsversion (PREVIEW=1 i deploy-jobbet → dist/preview/index.html).
   - inget familjeinnehåll byggs in (bara de inbyggda paketen; familjens data kommer via den vanliga inloggade synken)
   - egen lagring: allt appen sparar får prefixet "pluggappen-preview:" – produktionens data på samma enhet rörs aldrig
   - ingen service worker och inga push-påminnelser; bygg-id:t säger "testversion"
   - serverad på fel adress (t.ex. ur produktionens offline-cache) startar den inte
   - de vanliga byggena (index.html, pluggappen.html) är byte för byte desamma som utan PREVIEW */
'use strict';
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { JSDOM } = require('jsdom');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const ROOT = path.join(__dirname, '..'); const DIST = path.join(ROOT, 'dist'); const h = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const before = { idx: h(path.join(DIST, 'index.html')), alone: h(path.join(DIST, 'pluggappen.html')) };
execFileSync('bash', [path.join(ROOT, 'scripts/build.sh')], { env: { ...process.env, PREVIEW: '1' }, stdio: 'pipe' });
const PV = path.join(DIST, 'preview/index.html');
try {
  ok(fs.existsSync(PV), 'dist/preview/index.html byggs');
  ok(h(path.join(DIST, 'index.html')) === before.idx && h(path.join(DIST, 'pluggappen.html')) === before.alone, 'de vanliga byggena är oförändrade');
  const html = fs.readFileSync(PV, 'utf8');
  ok(!/serviceWorker\.register/.test(html), 'ingen service worker registreras');
  ok(/window\.PLUGG_PUSH_KEY = null/.test(html) && !/PLUGG_PUSH_KEY = "B/.test(html), 'inga push-påminnelser (ingen push-nyckel)');
  ok(/testversion/.test(html) && /noindex/.test(html), 'bygg-id:t säger testversion, sidan indexeras inte');
  const bundle = fs.readFileSync(path.join(DIST, 'bundle.js'), 'utf8'); const shell = ['00_head.html', '00b_style.html', '99_body.html'].map(f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join(''); const rest = html.replace(bundle.trimEnd(), '').replace(shell, '');
  ok(html.includes(bundle.trimEnd()) && html.includes(shell) && rest.length < 4000, `samma kod och samma inbyggda innehåll som den publicerade appen – inget annat byggs in (${rest.length} tecken runt koden)`);
  const boot = (url) => { const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(w) { w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null; w.localStorage.setItem('pluggappen.v1', '{"marker":"prod"}'); } }); return dom.window; };
  const w = boot('https://example.org/pluggappen/preview/');
  ok(!!w.PA && w.PLUGG_PREVIEW === true, 'testversionen startar på sin adress');
  w.PA.flushSave(); const keys = Object.keys(w.localStorage);
  ok(keys.includes('pluggappen-preview:pluggappen.v1') && keys.filter(k => !k.startsWith('pluggappen-preview:')).every(k => k === 'pluggappen.v1'), `allt som sparas har prefixet (${keys.join(', ')})`);
  ok(w.localStorage.getItem('pluggappen.v1') === '{"marker":"prod"}', 'produktionens data på samma enhet är orörd');
  const w2 = boot('https://example.org/pluggappen/');
  ok(w2.PLUGG_STOP === true && !(w2.document.querySelector('#app') && w2.document.querySelector('#app').children.length), 'på fel adress startar testversionen inte');
} catch (e) { fails++; console.log('EXC', e.stack); }
finally { try { fs.rmSync(path.join(DIST, 'preview'), { recursive: true, force: true }); } catch (e) { /* ignore */ } }
console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'PREVIEW TEST FAILED' : 'PREVIEW TEST OK'); process.exit(fails ? 1 : 0);
