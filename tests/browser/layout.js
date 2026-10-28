/* Layout och tillgänglighet i riktig Chromium (Playwright) – det jsdom inte kan mäta. Syntetisk familj, fast klocka, fast slump.
   Körs i CI-jobbet "Layout och tillgänglighet i Chromium" och lokalt med: node tests/browser/layout.js
   Kräver playwright och axe-core (CI installerar dem utan att ändra package-lock).
   Varje storlek (375×667, 390×844, 820×1180, 1180×820), alla tre upplevelser, några dygn:
     1. ingen sidledsscroll
     2. Svara syns utan att rulla, även med telefonens tangentbord uppe (telefon)
     3. Nästa (fast knapprad) täcker aldrig återkopplingen efter rullningen som följer på svaret
     4. KLAR: stjärnstigen ligger inom kortet
     5. förälderns flikar syns helt på telefon (v2-barn)
     6. axe-core WCAG 2.1 A/AA: 0 fynd på nyckelskärmar
     7. Testa mig: ett tryck på ett alternativ lämnar inte in – Svara gör det, utan återkoppling */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'); const path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('playwright saknas – installera i CI-jobbet'); if (process.env.GITHUB_ACTIONS) console.log('::error::layout: playwright saknas'); process.exit(1); }
const ROOT = path.join(__dirname, '..', '..'); const APP = path.join(ROOT, 'dist', 'pluggappen.html');
const FIX = require(path.join(ROOT, 'tests', 'test_fixture_family.json'));
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const driverSrc = fs.readFileSync(path.join(ROOT, 'tests', 'le', 'v2driver.js'), 'utf8').replace(/module\.exports[\s\S]*$/, '').replace("'use strict';", '');
const T_FIXED = Date.UTC(2026, 9, 25, 15, 0, 0); const KB = 290;
const SIZES = (process.env.SIZES || '375x667,390x844,820x1180,1180x820').split(',').map(s => s.split('x').map(Number));
const DAYS = +(process.env.DAYS || 3);
let rs = 20261027; const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };   // fast slump även i testet (samma körning varje gång)
// I CI syns bara anteckningar (inte loggen) – varje fel skrivs därför också som ::error (högst 20, en rad var)
const GHA = !!process.env.GITHUB_ACTIONS; let notes = 0; const note = (m) => { if (GHA && notes++ < 20) console.log('::error::' + String(m).replace(/\r?\n/g, ' ⏎ ').slice(0, 900)); };
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); note('layout: ' + m); } };

async function run(VW, VH) {
  const phone = VW < 600; const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: true });
  await ctx.addInitScript(({ T }) => { const RD = Date; let now = T; class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } } window.Date = FD; window.__advance = (ms) => { now += ms; };
    let s = 4242; Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }, { T: T_FIXED });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + APP); await pg.waitForTimeout(200);
  await pg.addScriptTag({ content: AXE });
  await pg.addScriptTag({ content: driverSrc + '\nwindow.__clk = (el) => { if (!el) throw new Error("click null"); el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }; window.__hold = false; window.__T = { $: (s) => document.querySelector(s), click: (el) => { if (window.__hold && el && el.id === "next") { window.__hold = false; return; } if (window.__holdSub && el && el.id === "submit") return; window.__clk(el); }, PA: () => window.PA }; window.__D = v2tools(window, window.__T); window.__toStart = () => toStart(window.__T);' });
  const fix = JSON.parse(JSON.stringify(FIX)); const k8 = fix.kids.find(k => k.id === 'k8'); if (k8 && k8.exams && k8.exams[0]) k8.exams[0].date = new Date(T_FIXED + 9 * 86400000).toISOString().slice(0, 10);   // ett prov inom Testa mig-fönstret
  await pg.evaluate((fix) => { PA.FAMILY.apply(fix); PA.load(); PA.rerender(); }, fix);
  const tag = `${VW}×${VH}`; const axeSeen = new Set(); const C = { items: 0, sub: 0, fb: 0, klar: 0, axe: 0 };
  const axe = async (name) => { if (axeSeen.has(name)) return; axeSeen.add(name); C.axe++; const v = await pg.evaluate(async () => { document.querySelectorAll('details').forEach(d => { d.open = true; }); const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }); return r.violations.map(x => `${x.id} (${x.nodes.length}): ${x.nodes[0] && x.nodes[0].target.join(' ')}`); });
    ok(v.length === 0, `${tag} ${name}: axe ${v.join(' · ')}`); };
  const noHScroll = async (where) => { const d = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(d <= 0, `${tag} ${where}: sidledsscroll ${d}px`); };
  const open = (id) => pg.evaluate((id) => { __toStart(); __T.click(__T.$(`[data-kid="${id}"]`)); if (__T.$('[data-pet]')) __T.click(__T.$('[data-pet]')); }, id);
  await axe('start'); await noHScroll('start');
  for (let d = 0; d < DAYS; d++) for (const [id, n] of [['k2', 'explore'], ['k4', 'grow'], ['k8', 'achieve']]) {
    await open(id); await noHScroll(n + ' hem'); if (d === 0) await axe(n + ' hem');
    for (const btn of ['.go-btn[data-v2="kor"]', '[data-v2="flow"]', '[data-v2="revansch"]']) {
      if (!await pg.evaluate((s) => !!__T.$(s), btn)) { await open(id); if (!await pg.evaluate((s) => !!__T.$(s), btn)) continue; }
      await pg.evaluate((s) => __T.click(__T.$(s)), btn);
      for (let i = 0; i < 40; i++) {
        const m = await pg.evaluate(() => { const S = PA.S; if (!S || !S.v2 || !document.querySelector('#qcard')) return null; window.scrollTo(0, 0); const it = S.queue[S.i];
          const r = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return x.height ? { t: x.top, b: x.bottom } : null; };
          return { mode: PA.EXP.modeOf(it).mode, sub: r('#submit'), inp: r('#ans'), learn: it.cat === 'learn' }; });
        if (!m) break; C.items++;
        await noHScroll(`${n} ${m.mode}`); if (d === 0) await axe(`${n} fråga ${m.mode}`);
        const composed = ['sort', 'order', 'build'].includes(m.mode);   // svaret byggs av flera tryck: Svara mäts när det är färdigbyggt (den rullas då fram)
        if (phone && m.sub && !composed) { C.sub++; ok(m.sub.b <= VH + 1, `${tag} ${n} ${m.mode}: Svara under kanten (${Math.round(m.sub.b)} > ${VH})`); if (m.inp) ok(m.sub.b - m.inp.t <= VH - KB - 60, `${tag} ${n} ${m.mode}: Svara syns inte med tangentbordet uppe`); }
        if (phone && composed) { const w = rnd() < 0.35; await pg.evaluate((w) => { window.__holdSub = true; window.__hold = true; try { __D.answer(() => w); } catch (e) { if (!/ingen Nästa-knapp/.test(e.message)) throw e; } }, w);   /* Svara hålls tillbaka för mätningen */ await pg.waitForTimeout(600);
          const sb = await pg.evaluate(() => { const e = document.querySelector('#submit'); if (!e || e.disabled) return null; const r = e.getBoundingClientRect(); return { b: r.bottom, t: r.top }; });
          if (sb) { C.sub++; ok(sb.b <= VH + 1 && sb.t >= -1, `${tag} ${n} ${m.mode}: Svara syns inte när svaret är färdigbyggt (${Math.round(sb.t)}–${Math.round(sb.b)})`); }
          await pg.evaluate(() => { window.__holdSub = false; const e = document.querySelector('#submit'); if (e && !document.querySelector('#next')) window.__clk(e); }); }
        else await pg.evaluate((w) => { window.__hold = true; __D.answer(() => w); }, rnd() < 0.35);
        const f = await pg.evaluate(() => { const fb = document.querySelector('#fb .feedback'), act = document.querySelector('#actions'), nx = document.querySelector('#next'); if (!fb || !act || !nx) return null; const a = fb.getBoundingClientRect(), c = act.getBoundingClientRect(); return { fbT: a.top, fbB: a.bottom, actT: c.top, actB: c.bottom, vh: window.innerHeight }; });
        if (f) { C.fb++; const visible = f.fbB > 0 && f.fbT < f.vh; ok(!visible || f.fbB <= f.actT + 1 || f.fbT >= f.actB - 1, `${tag} ${n} ${m.mode}: Nästa täcker återkopplingen (${Math.round(f.fbT)}–${Math.round(f.fbB)} mot ${Math.round(f.actT)})`);
          if (d === 0 && C.fb < 4) await axe(`${n} återkoppling`); }
        await pg.evaluate(() => { window.__hold = false; const nx = document.querySelector('#next'); if (nx) window.__clk(nx); window.__advance(4000); });
      }
      const k = await pg.evaluate(() => { const card = document.querySelector('.klar'); if (!card) return null; const c = card.getBoundingClientRect(); const out = [...card.querySelectorAll('.klar-path .dot')].filter(e => { const r = e.getBoundingClientRect(); return r.left < c.left - 1 || r.right > c.right + 1; }).length; return { out, kind: [...card.classList].join(' ') }; });
      if (k) { C.klar++; ok(k.out === 0, `${tag} ${n}: ${k.out} stjärnor utanför KLAR-kortet`); await noHScroll(n + ' KLAR'); if (d === 0) await axe(`${n} KLAR ${btn.includes('flow') ? 'flow' : 'kor'}`); }
    }
    if (id === 'k8') await pg.evaluate(() => window.__advance(86400000));
  }
  // 7. Testa mig: ett tryck väljer, Svara lämnar in, ingen återkoppling under testet
  let tapped = 0; await open('k8'); if (await pg.evaluate(() => !!__T.$('[data-v2="testa"]'))) { await pg.evaluate(() => __T.click(__T.$('[data-v2="testa"]'))); await axe('Testa mig fråga');
    // ett flerval säkert med i testet: provets frågor kan vara skrivna – byt den första mot ett påståendeflerval (samma flöde)
    await pg.evaluate(() => { const S = PA.S; const k = PA.KIDS.find(x => x.id === 'k8'); const sk = k.skills.find(x => x.id === 'kemi_syror') || k.skills[0]; let q = null; for (let i = 0; i < 9 && !q; i++) { const c = PA.CHG.make(sk, 2, i, {}); if (c && Array.isArray(c.choices)) q = c; }
      if (q && S && S.v2) { const it = S.queue[S.i]; S.queue[S.i] = { ...q, skill: sk, cat: 'math', level: 2, spec: { ...(it.spec || {}), help: 'none' }, _slotEnd: true }; PA.rerender(); } });
    for (let q = 0; q < 30; q++) { const st = await pg.evaluate(() => { const S = PA.S; if (!S || !S.v2 || !document.querySelector('#qcard')) return null; const before = S.i; const ch = document.querySelector('#qcard [data-choice], #qcard [data-wchoice]'); if (!ch) return { skip: true };
        window.__clk(ch); const same = PA.S.i === before && !document.querySelector('#fb .feedback') && !document.querySelector('#qcard .ok, #qcard .no'); const sb = document.querySelector('#submit'); return { same, sb: !!sb && !sb.disabled }; });
      if (!st) break; if (!st.skip) { tapped++; ok(st.same && st.sb, `${tag} Testa mig: ett tryck lämnade in eller visade rätt/fel (${JSON.stringify(st)})`); await pg.evaluate(() => window.__clk(document.querySelector('#submit'))); } else await pg.evaluate(() => __D.answer(() => Math.random() < 0.3)); }
    await noHScroll('Testa mig resultat'); await axe('Testa mig resultat'); }
  ok(tapped > 0, `${tag} Testa mig: flerval prövat`);
  // 5. Föräldraläget: flikarna syns helt
  await pg.evaluate(() => { __toStart(); __T.click(__T.$('[data-go="parent"]')); const pins = [...document.querySelectorAll('[data-pin]')]; ['1', '2', '3', '4'].forEach((d, i) => { pins[i].value = d; pins[i].dispatchEvent(new Event('input', { bubbles: true })); }); });
  for (const id of ['k8', 'k4', 'k2']) { await pg.evaluate((id) => __T.click(__T.$(`[data-tab="${id}"]`)), id); await noHScroll('förälder ' + id); await axe('förälder ' + id);
    const hid = await pg.evaluate(() => [...document.querySelectorAll('[data-sub], [data-tab]')].filter(b => { const r = b.getBoundingClientRect(); return r.left < -1 || r.right > window.innerWidth + 1 || r.width < 24; }).map(b => b.textContent.trim()));
    ok(hid.length === 0, `${tag} förälder ${id}: flikar utanför skärmen: ${hid.join(', ')}`); }
  ok(errs.length === 0, `${tag}: fel i sidan: ${errs.slice(0, 2).join(' | ')}`);
  console.log(`  ${tag}: ${C.items} uppgifter, Svara mätt ${C.sub}, återkoppling ${C.fb}, KLAR ${C.klar}, axe-skärmar ${C.axe}`);
  ok(C.items > 20 && C.fb > 10 && C.klar >= 3 && C.axe > 10 && (!phone || C.sub > 5), `${tag}: tillräckligt mycket prövat`);
  await b.close();
}
(async () => { try { for (const [w, h] of SIZES) await run(w, h); } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); note('layout undantag: ' + (e && e.stack || e)); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'BROWSER LAYOUT TEST FAILED' : 'BROWSER LAYOUT TEST OK'); process.exit(fails ? 1 : 0); })();
