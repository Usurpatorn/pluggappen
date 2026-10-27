/* 3.5 Privata bilder – kvalitetsgrinden, appen och äldre klienter (jsdom). Bara SYNTETISKA bilder (små PNG:er som testet ritar själv),
   ett syntetiskt paket och en syntetisk familj. Inga riktiga bilder, inget lärarmaterial, inga riktiga id:n.
   Visar:
   · bundle: bilderna kontrolleras (typ ur filens byte, storlek, upplösning, sha256, ursprung) och hamnar inte i _content – bara manifestet
   · appen: en bilduppgift visas bara när ALLA dess bilder är kontrollerade; skadad, saknad, fel typ, fel storlek, fel upplösning → ingen
     bilduppgift (och aldrig en textuppgift i stället); innehållet kan inte injicera HTML via bild-id eller text
   · alt-texten är neutral (avslöjar aldrig svaret) och bilden sätts in via DOM (data-URL ur den kontrollerade cachen)
   · cachen hör till familjen: familjebyte och bortkoppling tömmer den
   · Testa mig: utan bilder är bilduppgifterna inte med, och resultatet säger det ärligt
   · äldre klienter (inbyggda referensbyggen 2.0.0–2.1.1 och 3.3): paketet godtas, textuppgifterna är identiska, inga bilder visas */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'); const path = require('path'); const os = require('os'); const zlib = require('zlib'); const { spawnSync } = require('child_process'); const crypto = require('crypto');
const { mkWin, tools, FIX, T_FIXED } = require('./le/childflow.js');
const SOON = new Date(T_FIXED + 8 * 86400000).toISOString().slice(0, 10);   // syntetiskt provdatum om åtta dygn
const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ROOT = path.join(__dirname, '..');

/* ---------- syntetiska PNG:er ---------- */
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function png(w, h, rgb) { const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = (rgb[2] + x * 7 + y * 3) & 255; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
const IMGS = { ring: png(12, 12, [20, 60, 200]), 'streck-svart': png(16, 8, [10, 10, 10]), prick: png(8, 8, [200, 160, 0]), kors: png(10, 10, [120, 40, 20]), torn: png(9, 14, [0, 0, 0]) };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

/* ---------- syntetiskt paket med bilduppgifter ---------- */
// Ett giltigt paket (kvalitetsgrinden kräver eget svar och fördjupande former per punkt): det inbyggda kemipaketets punkter under ett
// privat id. Bilduppgifterna hänger på två av punkterna (kp-id:n nedan). Inget privat innehåll.
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/packs/kemi8-syror-baser.json'), 'utf8'));
const PACK = { ...BASE, id: 'syn-tecken', title: 'Syntetiska tecken', rev: 1, legacy: [] };
const KP_V = PACK.kps[0].id, KP_B = PACK.kps[1].id;
const VIS = { specVersion: 1, pack: 'syn-tecken', neverTogether: [['prick', 'kors']], items: [
  { id: 'sm-ring', form: 'symbol-meaning', kp: KP_V, prompt: 'Vilket tecken är det här?', image: 'ring', options: [{ text: 'Brunn' }, { text: 'Stig' }, { text: 'Torn' }, { text: 'Åker' }], answer: 0, why: 'En blå ring = brunn.' },
  { id: 'ms-torn', form: 'meaning-symbol', kp: KP_B, prompt: 'Vilken bild är tecknet för torn?', options: [{ image: 'torn' }, { image: 'ring' }, { image: 'streck-svart' }], answer: 0, why: 'Ett svart T = torn.' },
  { id: 'rc-streck', form: 'recall', kp: KP_B, prompt: 'Skriv vad tecknet heter.', image: 'streck-svart', accept: ['stig'], why: 'Streckad svart linje = stig.' },
  { id: 'match-1', form: 'match', kps: [KP_V, KP_B], prompt: 'Para ihop bild och tecken.', pairs: [{ image: 'ring', text: 'Brunn' }, { image: 'torn', text: 'Torn' }, { image: 'streck-svart', text: 'Stig' }], why: 'Ring, T och streck.' },
  { id: 'sort-1', form: 'sort', kp: KP_B, prompt: 'Vilken färg har tecknet?', bins: ['Blå – vatten', 'Svart – byggt'], cards: [{ image: 'ring' }, { image: 'torn' }, { image: 'streck-svart' }], answer: { ring: 'Blå – vatten', torn: 'Svart – byggt', 'streck-svart': 'Svart – byggt' } },
  { id: 'sm-prick', form: 'symbol-meaning', kp: KP_V, prompt: 'Vad betyder tecknet? <img src=x onerror=alert(1)>', image: 'prick', options: [{ text: 'Åker' }, { text: 'Sjö' }, { text: 'Torn' }], answer: 0 } ] };
const MAN = { pack: 'syn-tecken', source: { label: 'syntetiskt' }, license: 'syntetiskt testmaterial', assets: Object.entries(IMGS).map(([id, b]) => ({ id, file: id + '.png', sha256: sha(b), source: 'syntetiskt' })) };
function writeDir(mut = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'privimg-')); fs.mkdirSync(path.join(dir, 'packs')); fs.mkdirSync(path.join(dir, 'visual')); fs.mkdirSync(path.join(dir, 'assets', 'syn-tecken'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'packs', 'syn-tecken.json'), JSON.stringify(mut.pack || PACK)); fs.writeFileSync(path.join(dir, 'work.json'), '[]');
  fs.writeFileSync(path.join(dir, 'visual', 'syn-tecken.visual.json'), JSON.stringify(mut.vis || VIS)); fs.writeFileSync(path.join(dir, 'assets', 'syn-tecken', 'manifest.json'), JSON.stringify(mut.man || MAN));
  for (const [id, b] of Object.entries(mut.imgs || IMGS)) fs.writeFileSync(path.join(dir, 'assets', 'syn-tecken', id + '.png'), b);
  return dir;
}
const bundle = (dir) => { const out = path.join(dir, 'ut.json'); const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/content.mjs'), 'bundle', dir, out], { encoding: 'utf8', env: { ...process.env, PRIVACY_TERMS: '[]' } }); return { code: r.status, txt: (r.stdout || '') + (r.stderr || ''), out: fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null, up: fs.existsSync(out.replace(/\.json$/, '.assets.json')) ? JSON.parse(fs.readFileSync(out.replace(/\.json$/, '.assets.json'), 'utf8')) : null }; };

(async () => {
  try {
    /* 1. Kvalitetsgrinden (bundle) */
    const good = bundle(writeDir()); ok(good.code === 0, 'bundle: giltigt syntetiskt underlag godtas ' + good.txt.slice(0, 200));
    const B = good.out, UP = good.up;
    ok(B && Array.isArray(B.assets) && B.assets.length === 5 && B.assets.every(a => /^syn-tecken\/[a-z-]+$/.test(a.id) && /^[0-9a-f]{64}$/.test(a.rev)), 'bundle: _content får bara manifestet (id → sha256-revision)');
    ok(!JSON.stringify(B).includes(IMGS.ring.toString('base64').slice(0, 24)), 'bundle: inga bildbyte i _content');
    ok(UP && UP.assets.length === 5 && UP.assets.every(a => sha(Buffer.from(a.b64, 'base64')) === a.rev), 'bundle: bildrevisionerna i en egen fil för uppladdning, kontrollsummorna stämmer');
    ok(B.packs[0].visual.length === 6 && B.packs[0].visual.every(it => !('src' in it)), 'bundle: bilduppgifterna följer med paketet (utan källfält)');
    const neg = [
      ['fel kontrollsumma i manifestet', { man: { ...MAN, assets: MAN.assets.map((a, i) => (i ? a : { ...a, sha256: 'f'.repeat(64) })) } }, /kontrollsumman stämmer inte/],
      ['en GIF med .png-namn', { imgs: { ...IMGS, ring: Buffer.from('GIF89a' + 'x'.repeat(40)) } }, /bara PNG och JPEG/],
      ['för stor upplösning', { imgs: { ...IMGS, ring: png(2000, 1, [1, 2, 3]) }, man: { ...MAN, assets: MAN.assets.map(a => (a.id === 'ring' ? { ...a, sha256: undefined } : a)) } }, /upplösning/],
      ['en bilduppgift med en bild som inte finns', { vis: { ...VIS, items: [...VIS.items, { id: 'sm-x', form: 'symbol-meaning', kp: KP_V, prompt: 'Vad?', image: 'saknas', options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }], answer: 0 }] } }, /finns inte i manifestet/],
      ['två tecken som inte får stå ihop (utan variant: true)', { vis: { ...VIS, items: [...VIS.items, { id: 'ms-y', form: 'meaning-symbol', kp: KP_V, prompt: 'Vilken?', options: [{ image: 'prick' }, { image: 'kors' }, { image: 'ring' }], answer: 0 }] } }, /får inte stå i samma uppgift/],
      ['manifest utan rätt att använda (license)', { man: { ...MAN, license: undefined } }, /license/],
      ['ett svar utanför alternativen', { vis: { ...VIS, items: [...VIS.items, { id: 'sm-z', form: 'symbol-meaning', kp: KP_V, prompt: 'Vad?', image: 'ring', options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }], answer: 5 }] } }, /giltigt svar/],
      ['sortering där ett kort saknar grupp', { vis: { ...VIS, items: [...VIS.items, { id: 'sort-2', form: 'sort', kp: KP_B, prompt: 'Sortera', bins: ['A', 'B'], cards: [{ image: 'ring' }, { image: 'torn' }, { image: 'streck-svart' }], answer: { ring: 'A' } }] } }, /rätt grupp/],
      ['en bildfil utanför paketets mapp', { man: { ...MAN, assets: [...MAN.assets, { id: 'ut', file: '../../packs/syn-tecken.json' }] } }, /filen saknas/],
    ];
    for (const [name, mut, re] of neg) { const r = bundle(writeDir(mut)); ok(r.code !== 0 && re.test(r.txt), `bundle stoppar: ${name} (${r.txt.slice(0, 140).replace(/\n/g, ' ')})`); }

    /* 2. Appen */
    const boot = async (o = {}) => { const w = mkWin({ seed: 11, fixedClock: true, file: o.file }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); return { w, T, PA }; };
    const store = {}; for (const a of UP.assets) store[a.rev] = a;
    const mockSync = (w, PA, docs) => { const S = w.eval('SYNC'); S.cfg = { projectId: 'demo', apiKey: 'k' }; w.eval('DB.settings.family = "syntetisk"');   // SYNC.active blir sant (cfg + familj)
      for (const k of ['k2', 'k4', 'k8']) S.lastPull[k] = Date.now();   // som efter första synken (annars väntar v2 på molnet)
      S.schedulePush = () => {}; S.push = async () => true;
      S.fetch = async (url) => { const rev = (url.match(/\/assets\/([0-9a-f]{64})/) || [])[1]; const d = rev && docs[rev]; if (!d) return { status: 404, ok: false, json: async () => ({}) }; return { status: 200, ok: true, json: async () => ({ fields: { b64: { stringValue: d.b64 }, mime: { stringValue: d.mime }, bytes: { integerValue: String(d.bytes) }, w: { integerValue: String(d.w) }, h: { integerValue: String(d.h) } } }) }; }; };
    const A = (w) => w.eval('ASSETS');
    { const { w, T, PA } = await boot(); mockSync(w, PA, store); PA().FAMILY.applyContent(B); const AS = A(w);
      ok(Object.keys(AS.man).length === 5 && Object.values(AS.man).every(a => !AS.ready(a.id)), 'appen: manifestet laddat, inga bilder kontrollerade ännu');
      const cidV = PA().PACKS.cidOf('syn-tecken', KP_V), cidB = PA().PACKS.cidOf('syn-tecken', KP_B);
      const vis = (cid) => PA().PACKS.variants(cid, 'older').filter(v => v.visual);
      ok(vis(cidV).length === 0 && vis(cidB).length === 0, 'utan kontrollerade bilder: inga bilduppgifter (och ingen textversion av dem)');
      const textBefore = PA().PACKS.variants(cidV, 'older').filter(v => !v.visual).map(v => v.key).join();
      const n = await AS.pull(); ok(n === 5 && Object.values(AS.man).every(a => AS.ready(a.id)), `alla fem bilderna hämtade och kontrollerade (${n})`);
      ok(vis(cidB).some(v => v.f.form === 'sort'), 'sorteringen byggs (gruppen följer kortet genom paketets tvätt, även med bindestreck i bildnamnet)');
      ok(vis(cidV).length >= 2 && vis(cidB).length >= 3, `med bilderna: bilduppgifter för båda punkterna (${vis(cidV).length}, ${vis(cidB).length})`);
      ok(PA().PACKS.variants(cidV, 'older').filter(v => !v.visual).map(v => v.key).join() === textBefore, 'textuppgifterna är oförändrade (bilderna är ett komplement)');
      const all = [...vis(cidV), ...vis(cidB)].map(v => v.build(() => 0.42));
      ok(all.every(q => q.vid && q.vassets && q.vassets.length), 'varje bilduppgift bär sitt uppgifts-id och sina bilder');
      { const uq = [...new Map(all.map(q => [q.vid, q])).values()]; ok(new Set(uq.map(q => PA().LECAT.itemId(q))).size === uq.length && uq.every(q => PA().LECAT.itemId(q) === PA().LECAT.itemId({ ...q, choices: [], text: 'x' })), 'stabila uppgifts-id:n: ett per bilduppgift, oberoende av blandning och text'); }
      for (const q of all) { const html = (q.fig || '') + JSON.stringify(q.choiceAssets || q.pairAssets || q.itemAssets || ''); const ans = q.type === 'choicetext' && !q.choiceAssets ? q.choices[q.answer] : q.type === 'text' ? q.answer[0] : null;
        if (ans) ok(!new RegExp(ans, 'i').test((q.fig || '').replace(/data-asset="[^"]*"/g, '')), `alt-texten avslöjar inte svaret (${q.vid})`); ok(!/onerror|<img|javascript:/i.test(html), `ingen HTML från innehållet i bildfälten (${q.vid})`); }
      const prick = all.find(q => q.vid === 'syn-tecken/sm-prick'); ok(prick && !/<img|onerror/i.test(PA().safeHtml ? PA().safeHtml(prick.text) : prick.text.replace(/&lt;/g, '')), 'HTML i en bilduppgifts text tvättas bort (paketets tvätt)');
      // visning i ett riktigt pass
      PA().DB.profiles.k8.exams = [{ id: 'ex-syn', title: 'Teckenförhör', date: SOON, kps: [cidV, cidB], skillIds: [], deckIds: [] }]; PA().LE.invalidate('k8'); PA().rerender(); const D = v2tools(w, T);
      toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]'));
      let seenImg = 0, seenAltLeak = 0, srcBad = 0, rounds = 0;
      for (let k = 0; k < 6 && seenImg < 3; k++) { PA().V2.start(PA().KIDS.find(x => x.id === 'k8'), 'mission', { examId: 'ex-syn' }); let g = 0;
        while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 40) { rounds++; const q = PA().S.queue[PA().S.i]; const imgs = [...w.document.querySelectorAll('#qcard img')];
          if (q.vid) { if (imgs.length) seenImg++; for (const im of imgs) { if (!/^data:image\/png;base64,/.test(im.getAttribute('src') || '')) srcBad++; const ans = q.type === 'choicetext' && !q.choiceAssets ? q.choices[q.answer] : q.type === 'text' ? q.answer[0] : ''; if (ans && im.alt.toLowerCase().includes(String(ans).toLowerCase())) seenAltLeak++; } }
          D.answer(() => false); w.__advance(4000); } w.__advance(86400000); }
      ok(seenImg >= 2, `bilduppgifter visas i passet med bild (${seenImg} av ${rounds} uppgifter)`); ok(srcBad === 0, 'bilden kommer bara från den kontrollerade cachen (data-URL)'); ok(seenAltLeak === 0, 'alt-texten avslöjar aldrig svaret');
      ok(!w.document.querySelector('[onerror]'), 'inga händelseattribut i sidan');
      // cachen hör till familjen
      ok(!!w.localStorage.getItem('pluggappen.assets.v1'), 'bilderna cachas lokalt för offline');
      w.eval('DB.settings.family = "en-annan-familj"'); PA().FAMILY.loadContentLocal(); ok(!w.localStorage.getItem('pluggappen.assets.v1') && Object.keys(A(w).ok).length === 0, 'familjebyte: bildcachen töms');
      w.eval('DB.settings.family = "syntetisk"'); PA().FAMILY.applyContent(B); await A(w).pull(); ok(Object.keys(A(w).ok).length === 5, 'tillbaka i familjen: bilderna hämtas igen');
      PA().FAMILY.clearContent(); ok(!w.localStorage.getItem('pluggappen.assets.v1') && Object.keys(A(w).ok).length === 0 && Object.keys(A(w).man).length === 0, 'bortkoppling (innehållet rensas): bildcachen töms');
    }
    /* 3. Skadade, saknade och felaktiga bilder */
    { const { w, PA } = await boot(); const bad = JSON.parse(JSON.stringify(store)); const rev = (id) => B.assets.find(a => a.id === 'syn-tecken/' + id).rev;
      const ringB = Buffer.from(bad[rev('ring')].b64, 'base64'); ringB[ringB.length - 20] ^= 0xff; bad[rev('ring')].b64 = ringB.toString('base64');   // skadad (sha stämmer inte)
      delete bad[rev('torn')];                                                                                                                   // saknas
      bad[rev('streck-svart')].b64 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100)]).toString('base64');                          // fel typ
      mockSync(w, PA, bad); PA().FAMILY.applyContent(B); const AS = A(w); await AS.pull();
      ok(!AS.ready('syn-tecken/ring') && !AS.ready('syn-tecken/torn') && !AS.ready('syn-tecken/streck-svart') && AS.ready('syn-tecken/prick'), 'skadad, saknad och fel typ godtas inte; den hela bilden godtas');
      ok(/kontrollsumma|storlek/.test(AS.bad[rev('ring')]) && AS.bad[rev('torn')] === 'saknas' && /typ|storlek/.test(AS.bad[rev('streck-svart')]), `orsaken noteras (${AS.bad[rev('ring')]}, ${AS.bad[rev('torn')]}, ${AS.bad[rev('streck-svart')]})`);
      const vq = [...PA().PACKS.variants(PA().PACKS.cidOf('syn-tecken', KP_V), 'older'), ...PA().PACKS.variants(PA().PACKS.cidOf('syn-tecken', KP_B), 'older')].filter(v => v.visual).map(v => v.f.id);
      ok(vq.join() === 'sm-prick', `bara uppgiften vars alla bilder är hela finns kvar (${vq.join()})`);
      // manifest med farliga eller felaktiga poster: tas bort en och en
      const evil = { ...B, assets: [...B.assets, { id: '"><img src=x onerror=alert(1)>', rev: 'a'.repeat(64), mime: 'image/png', w: 1, h: 1, bytes: 20 }, { id: 'syn-tecken/stor', rev: 'b'.repeat(64), mime: 'image/png', w: 1, h: 1, bytes: 5000000 }, { id: 'syn-tecken/svg', rev: 'c'.repeat(64), mime: 'image/svg+xml', w: 1, h: 1, bytes: 20 }, { id: 'syn-tecken/hog', rev: 'd'.repeat(64), mime: 'image/png', w: 1, h: 4000, bytes: 20 }] };
      PA().FAMILY.applyContent(evil); ok(Object.keys(A(w).man).length === 5, 'manifestet: farligt id, för stor fil, SVG och för hög upplösning tas bort');
      // fel upplösning i lagringen (manifestet säger något annat)
      const dimsBad = JSON.parse(JSON.stringify(store)); const pr = dimsBad[rev('prick')]; pr.b64 = png(9, 8, [200, 160, 0]).toString('base64');
      const { w: w2, PA: PA2 } = await boot(); mockSync(w2, PA2, dimsBad); PA2().FAMILY.applyContent(B); await A(w2).pull(); ok(!A(w2).ready('syn-tecken/prick'), `fel bild under rätt namn godtas inte (${A(w2).bad[rev('prick')]})`);
    }
    /* 4. Testa mig utan bilder: inga bilduppgifter, och resultatet säger det */
    { const { w, T, PA } = await boot(); mockSync(w, PA, {}); PA().FAMILY.applyContent(B); await A(w).pull(); const D = v2tools(w, T);
      const cids = [KP_V, KP_B].map(k => PA().PACKS.cidOf('syn-tecken', k)); PA().DB.profiles.k8.exams = [{ id: 'ex-syn', title: 'Teckenförhör', date: SOON, kps: cids, skillIds: [], deckIds: [] }]; PA().LE.invalidate('k8'); PA().rerender();
      toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); PA().V2.start(PA().KIDS.find(x => x.id === 'k8'), 'exam', { examId: 'ex-syn' }); let vis = 0, g = 0;
      while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 30) { if (PA().S.queue[PA().S.i].vid) vis++; D.answer(() => false); }
      const res = T.$('#app').textContent.replace(/\s+/g, ' ');
      ok(vis === 0, 'Testa mig utan bilder: inga bilduppgifter'); ok(/Bilduppgifterna kunde inte visas på den här enheten och var inte med i testet/.test(res), 'Testa mig säger ärligt att bilduppgifterna inte var med');
    }
    /* 5. Äldre klienter: paketet med bilduppgifter godtas, textuppgifterna identiska, inga bilder */
    const gz = (name) => { const f = path.join(os.tmpdir(), `${name}-${process.pid}.html`); fs.writeFileSync(f, zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'golden', name + '.html.gz')))); return f; };
    const olds = fs.readdirSync(path.join(__dirname, 'golden')).filter(f => /\.html\.gz$/.test(f)).map(f => f.replace('.html.gz', ''));
    if (process.env.OLD33) olds.push('OLD33');
    const noVis = { ...B, assets: undefined, packs: B.packs.map(p => { const c = { ...p }; delete c.visual; delete c.visualRules; return c; }) };
    for (const name of olds) {
      const file = name === 'OLD33' ? process.env.OLD33 : gz(name); const { w, PA } = await boot({ file }); if (!PA().FAMILY || !PA().FAMILY.applyContent) { ok(true, `${name}: saknar privat innehåll (äldre än 2.1) – inget att visa`); continue; }
      const keys = (content) => { PA().FAMILY.applyContent(content); const P = PA().PACKS; if (!P.REG.packs['syn-tecken']) return null; return [KP_V, KP_B].flatMap(k => P.variants(P.cidOf('syn-tecken', k), 'older').map(v => v.key)).join('|'); };
      const withVis = keys(B), without = keys(noVis);
      ok(withVis !== null && withVis === without, `${name}: paketet med bilduppgifter godtas och textuppgifterna är identiska`);
      ok(!/data-asset|<img/.test(w.document.querySelector('#app').innerHTML), `${name}: inga bilder visas`);
    }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'PRIVATE IMAGES TEST FAILED' : 'PRIVATE IMAGES TEST OK'); process.exit(fails ? 1 : 0);
})();
