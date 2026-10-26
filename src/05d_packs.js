/* ========= Concept Packs (2.1 "Kunskap i många former") =========
   Ett Concept Pack beskriver KUNSKAP, inte enskilda frågor: kunskapspunkter (det motorn följer), fakta, förklaringar, vanliga
   missuppfattningar, samband och källor. Generatorn här gör om kunskapen till många olika frågeformer – deterministiskt rättade.
   "Upprepa kunskapen, inte frågan." Specifikation: docs/CONCEPT_PACKS.md (pluggPackVersion 1).
   - Inbyggda paket (allmän kursplanekunskap) ligger i content/packs/*.json och byggs in i appen som PACK_DATA.
   - Familjens egna paket (från lärarmaterial) och skoluppgifter ligger i familjens privata lagring (_content), aldrig i repot.
   - Ren logik: inga DOM-anrop. Slump bara via en inskickad rnd-funktion → CI kan räkna upp och kontrollera varje variant.
   Koncept-id för en kunskapspunkt: "k:<paket>/<punkt>". Frågans id (för variation och Felboken): LECAT.itemId(fråga). */
const PACKS = (() => {
  'use strict';
  const VERSION = 1;
  const FORMS = ['recognition', 'recall', 'reverse', 'relationship', 'mistake', 'cause', 'application', 'explanation', 'multistep'];
  const FCODE = { recognition: 'r', recall: 'c', reverse: 'v', relationship: 'l', mistake: 'm', cause: 'x', application: 'a', explanation: 'e', multistep: 's' };
  const DEPTH = new Set(['relationship', 'mistake', 'cause', 'application', 'explanation', 'multistep']);
  const BASE_LVL = { recognition: 1, recall: 2, reverse: 2, relationship: 2, mistake: 2, cause: 2, application: 3, explanation: 3, multistep: 3 };
  // Åldersanpassning: vilka former en policy får möta om faktat inte säger något annat (fact.ages).
  const POLICY_FORMS = {
    younger: new Set(['recognition', 'recall', 'relationship', 'mistake']),
    middle: new Set(['recognition', 'recall', 'reverse', 'relationship', 'mistake', 'cause', 'application', 'multistep']),
    older: new Set(FORMS),
  };
  // Textgränser per policy (frågetext i ord, svarsalternativ i tecken, längsta ord). Kontrolleras i CI.
  const TEXT = { younger: { qWords: 22, choice: 48, word: 16 }, middle: { qWords: 34, choice: 80, word: 22 }, older: { qWords: 48, choice: 120, word: 26 } };
  const KINDS = ['term', 'qa', 'pairs', 'group', 'order', 'stmt', 'num', 'pick', 'fix', 'read'];
  /* Kunskapstyp (Learning Recipes, 2.1): HUR en kunskapspunkt bäst lärs in. Minsta användbara uppsättning – sätts i paketet (kp.type)
     eller härleds ur faktaslagen. Typen styr vilka aktiviteter som väger tyngst i receptet (RECIPE nedan). */
  const TYPES = ['fact', 'term', 'classification', 'sequence', 'cause', 'language', 'concept', 'procedure'];
  const KIND_TYPE = { term: 'term', group: 'classification', order: 'sequence', fix: 'language', pick: 'language', num: 'procedure', stmt: 'concept', read: 'concept', pairs: 'fact', qa: 'fact' };
  function typeOf(kp) {
    if (kp.type && TYPES.includes(kp.type)) return kp.type;
    const n = {}; for (const f of kp.facts || []) { const t = f.k === 'qa' && f.form === 'cause' ? 'cause' : f.k === 'qa' && (f.form === 'explanation') ? 'concept' : KIND_TYPE[f.k] || 'fact'; n[t] = (n[t] || 0) + 1; }
    return Object.entries(n).sort((a, b) => b[1] - a[1] || TYPES.indexOf(a[0]) - TYPES.indexOf(b[0]))[0]?.[0] || 'fact';
  }
  // Signaturaktiviteter per kunskapstyp: faktaslag och former som passar typen extra bra
  const SIGNATURE = { term: { k: ['term'] }, classification: { k: ['group'] }, sequence: { k: ['order'], dir: ['gap'] }, cause: { forms: ['cause'] }, language: { k: ['fix', 'pick'] }, concept: { k: ['stmt'], forms: ['explanation', 'mistake'] }, procedure: { k: ['num'] }, fact: { k: ['qa', 'pairs'] } };
  /* Learning Recipe: kunskapstyp × inlärningsstadium × policy → vikt per form. Stadierna motsvarar motorns stadier:
     NY (aldrig sett: förstå – UPPTÄCK-kort, sedan igenkänning/sortering) · LÄR SIG (stadium 0–1: stöttad övning) ·
     ÖVAR (stadium 2: eget svar och görande) · SÄKER (stadium ≥ 3: koppla, tillämpa, hitta felet, utmaning).
     Senare repetition med eget svar styrs av motorns format (recall), djupgrinden av format depth. */
  const RECIPE = {
    new: { recognition: 4, relationship: 1.2, recall: 0.4, reverse: 0.6, mistake: 0.2, cause: 0.4, application: 0.2, explanation: 0.1, multistep: 0.1 },
    learning: { recognition: 2, recall: 2, relationship: 2, reverse: 1.2, mistake: 0.6, cause: 0.8, application: 0.4, explanation: 0.2, multistep: 0.3 },
    practising: { recognition: 0.8, recall: 3, reverse: 2, relationship: 2, mistake: 1.5, cause: 1.5, application: 1.2, explanation: 0.8, multistep: 1 },
    secure: { recognition: 0.3, recall: 1.5, reverse: 1, relationship: 3, mistake: 3, cause: 3, application: 3, explanation: 3, multistep: 3 },
  };
  const bandOf = (stage) => stage == null ? null : stage.n === 0 ? 'new' : stage.st <= 1 ? 'learning' : stage.st === 2 ? 'practising' : 'secure';
  const HINT = {
    recognition: 'Uteslut först de alternativ du vet är fel.', recall: 'Försök minnas ordet innan du gissar.', reverse: 'Tänk baklänges: vad hör ihop med det här?',
    relationship: 'Hur hänger sakerna ihop?', mistake: 'Läs varje alternativ noga – leta efter det som inte stämmer.', cause: 'Fråga dig: varför händer det?',
    application: 'Använd det du vet i den nya situationen.', explanation: 'Vilken förklaring stämmer med det du har lärt dig?', multistep: 'Ta ett steg i taget.',
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const strip = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const norm = (s) => strip(s).normalize('NFC').toLowerCase().replace(/[.,!?;:"'”“()[\]…]/g, ' ').replace(/−|–/g, '-').replace(/\s+/g, ' ').trim();
  const normT = (s) => norm(s).replace(/^(en|ett|att) /, '');   // eget svar: "en syra" = "syra"
  const words = (s) => strip(s).split(/\s+/).filter(Boolean);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function lev(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[b.length];
  }
  const tolOf = (w) => (w.length >= 9 ? 2 : w.length >= 6 ? 1 : 0);
  const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const toks = (sentence) => { const out = []; for (const w of strip(sentence).split(/\s+/)) { const t = w.replace(/^[„"'(«]+|[.,!?;:"'»)]+$/g, ''); if (t && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t); } return out; };
  // Identitet för alternativ: skiftläge och blanksteg spelar ingen roll, men skiljetecken gör det (kommatering kan vara själva frågan)
  const keyCi = (s) => strip(s).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  const keyCs = (s) => strip(s).normalize('NFC').replace(/\s+/g, ' ').trim();
  const key = keyCi;
  const cidOf = (packId, kpId) => `k:${packId}/${kpId}`;
  const ALLOWED_TAGS = /^(b|i|br|sub|sup|p|em|strong|span|ul|ol|li|div)$/i;

  /* ---------- Validering (schema + referenser). Returnerar en lista med fel (tom = giltig). ---------- */
  function validate(pack, opts = {}) {
    const E = []; const err = (m) => E.push(`${pack && pack.id || '?'}: ${m}`);
    if (!pack || typeof pack !== 'object') return ['paketet är inte ett objekt'];
    if (pack.pluggPackVersion !== VERSION) err(`pluggPackVersion måste vara ${VERSION}`);
    const idOk = (x) => typeof x === 'string' && /^[a-z0-9][a-z0-9-]{1,47}$/.test(x);
    if (!idOk(pack.id)) err('id saknas eller har fel form (a–z, 0–9, bindestreck)');
    if (typeof pack.title !== 'string' || !pack.title) err('title saknas');
    if (!['math', 'sv', 'en', 'no', 'so'].includes(pack.subject)) err('subject måste vara math, sv, en, no eller so');
    if (!Array.isArray(pack.policies) || !pack.policies.length || !pack.policies.every(p => POLICY_FORMS[p])) err('policies måste lista younger/middle/older');
    if (!opts.private && (!Array.isArray(pack.templates) || !pack.templates.length)) err('templates saknas (inbyggda paket)');
    if (opts.private && !(Array.isArray(pack.kids) && pack.kids.length) && !(Array.isArray(pack.templates) && pack.templates.length)) err('privat paket måste ange kids eller templates');
    if (!Array.isArray(pack.grades) || pack.grades.length !== 2 || !(pack.grades[0] <= pack.grades[1])) err('grades måste vara [från, till]');
    if (!Number.isInteger(pack.rev) || pack.rev < 1) err('rev måste vara ett heltal ≥ 1');
    const srcIds = new Set((pack.sources || []).map(s => s.id));
    for (const s of pack.sources || []) { if (!idOk(s.id)) err(`källa med ogiltigt id ${s.id}`); if (!s.label) err(`källa ${s.id} saknar label`); if (s.kind && !['lgr22', 'book', 'pdf', 'pptx', 'docx', 'paper', 'questions', 'web', 'own', 'image'].includes(s.kind)) err(`källa ${s.id}: okänd kind ${s.kind}`); }
    const srcOk = (list, where) => { for (const r of list || []) { if (!r || !srcIds.has(r.ref)) err(`${where}: källreferens ${r && r.ref} finns inte i sources`); for (const k of Object.keys(r || {})) if (!['ref', 'page', 'pages', 'slide', 'slides', 'q', 'section', 'note'].includes(k)) err(`${where}: okänt fält i källreferens: ${k}`); } };
    const skills = Array.isArray(pack.skills) ? pack.skills : []; if (!skills.length) err('skills saknas');
    const skillIds = new Set();
    for (const s of skills) { if (!/^[a-z0-9_]{2,40}$/.test(s.id || '')) err(`skill-id ${s.id} har fel form`); if (skillIds.has(s.id)) err(`skill ${s.id} dubblerad`); skillIds.add(s.id); if (!s.existing && (!s.name || !s.short || !s.icon)) err(`ny skill ${s.id} behöver name, short och icon`); }
    const kps = Array.isArray(pack.kps) ? pack.kps : []; if (!kps.length) err('kps saknas');
    const kpIds = new Set();
    for (const kp of kps) {
      const w = `kp ${kp.id}`;
      if (!idOk(kp.id)) err(`${w}: ogiltigt id`); if (kpIds.has(kp.id)) err(`${w}: dubblerat id`); kpIds.add(kp.id);
      if (!skillIds.has(kp.skill)) err(`${w}: skill ${kp.skill} finns inte i paketet`);
      if (!kp.name || typeof kp.name !== 'string') err(`${w}: name saknas`);
      if (!kp.explain || typeof kp.explain !== 'string') err(`${w}: explain saknas`);
      if (kp.type != null && !TYPES.includes(kp.type)) err(`${w}: okänd kunskapstyp ${kp.type} (${TYPES.join(', ')})`);
      if (!Array.isArray(kp.facts) || !kp.facts.length) err(`${w}: facts saknas`);
      srcOk(kp.src, w);
      (kp.facts || []).forEach((f, i) => {
        const fw = `${w} fakta ${i + 1}`;
        if (!KINDS.includes(f.k)) { err(`${fw}: okänd k ${f.k}`); return; }
        if (f.lvl != null && ![1, 2, 3].includes(f.lvl)) err(`${fw}: lvl måste vara 1–3`);
        if (f.form && !FORMS.includes(f.form)) err(`${fw}: okänd form ${f.form}`);
        if (f.ages && !(Array.isArray(f.ages) && f.ages.every(a => POLICY_FORMS[a]))) err(`${fw}: ages måste lista policyer`);
        srcOk(f.src, fw);
        const need = { term: ['term', 'q'], qa: ['q', 'a'], pairs: ['items', 'q'], group: ['groups'], order: ['q', 'items'], stmt: ['s', 'f'], num: ['q', 'a'], pick: ['text', 'ask', 'a'], fix: ['bad', 'good', 'err', 'fix'], read: ['text', 'qs'] }[f.k];
        for (const n of need) if (f[n] == null || f[n] === '') err(`${fw}: ${n} saknas`);
        if (f.k === 'num' && !Number.isFinite(f.a)) err(`${fw}: a måste vara ett tal`);
        if (f.k === 'pick' && !toks(f.text).includes(f.a)) err(`${fw}: svaret "${f.a}" finns inte som ord i meningen`);
        if (f.k === 'fix' && !toks(f.bad).includes(f.err)) err(`${fw}: felordet "${f.err}" finns inte i meningen`);
        if (f.k === 'pairs' && !(Array.isArray(f.items) && f.items.length >= 3 && f.items.every(p => Array.isArray(p) && p.length === 2 && p[0] && p[1]))) err(`${fw}: items måste vara minst 3 par`);
        if (f.k === 'group' && !(Array.isArray(f.groups) && f.groups.length >= 2 && f.groups.every(g => g.q && Array.isArray(g.items) && g.items.length >= 2))) err(`${fw}: groups måste vara minst 2 grupper med q och items`);
        // Experience v3 (SORTERA): grupperna får en kort etikett. Alla eller ingen, unika, korta – och inget led i två grupper.
        if (f.k === 'group' && Array.isArray(f.groups) && f.groups.some(g => g.label != null)) {
          if (!f.groups.every(g => typeof g.label === 'string' && g.label.trim() && g.label.length <= 28)) err(`${fw}: label måste finnas på alla grupper (högst 28 tecken)`);
          if (new Set(f.groups.map(g => norm(g.label))).size !== f.groups.length) err(`${fw}: två grupper har samma label`);
          const all = f.groups.flatMap(g => g.items || []).map(norm); if (new Set(all).size !== all.length) err(`${fw}: samma led finns i två grupper (sortering blir tvetydig)`);
        }
        if (f.k === 'pairs' && f.match != null && typeof f.match !== 'boolean') err(`${fw}: match måste vara true/false`);
        if (f.k === 'order' && !(Array.isArray(f.items) && f.items.length >= 3)) err(`${fw}: order behöver minst 3 led`);
        if (f.k === 'stmt' && !(Array.isArray(f.f) && f.f.length >= 1)) err(`${fw}: f måste vara en lista med falska versioner`);
        if (f.k === 'read' && !(Array.isArray(f.qs) && f.qs.length && f.qs.every(x => x.q && x.a && Array.isArray(x.not) && x.not.length >= 2))) err(`${fw}: read.qs behöver q, a och minst två not`);
        if (['qa'].includes(f.k) && !(Array.isArray(f.not) && f.not.length >= 2)) err(`${fw}: qa behöver minst två felalternativ i not`);
      });
      for (const r of kp.requires || []) if (!kps.some(x => x.id === r)) err(`${w}: requires ${r} finns inte`);
      for (const r of kp.related || []) if (!kps.some(x => x.id === r.kp)) err(`${w}: related ${r.kp} finns inte`);
      for (const m of kp.mistakes || []) if (!m.wrong || !m.right) err(`${w}: mistakes behöver wrong och right`);
    }
    for (const s of skills) if (!kps.some(k => k.skill === s.id)) err(`skill ${s.id} har inga kunskapspunkter`);
    for (const l of pack.legacy || []) { if (!Array.isArray(l) || l.length !== 4) { err('legacy-rad måste vara [kp, typ, text, svar]'); continue; } if (!kpIds.has(l[0])) err(`legacy pekar på okänd kp ${l[0]}`); }
    for (const t of pack.teacherQs || []) { if (!t.n || !t.q) err('teacherQs behöver n och q'); for (const k of t.kps || []) if (!kpIds.has(k)) err(`teacherQs ${t.n}: okänd kp ${k}`); srcOk(t.src, `teacherQs ${t.n}`); }
    return E;
  }

  /* ---------- Register ---------- */
  const REG = { packs: {}, bySkill: {}, kp: {}, priv: new Set(), errors: [] };
  function register(pack, opts = {}) {
    const errs = validate(pack, opts); if (errs.length) { REG.errors.push(...errs.slice(0, 5)); return false; }
    if (opts.private && REG.packs[pack.id] && !REG.priv.has(pack.id)) { REG.errors.push(`${pack.id}: privat paket får inte ha ett inbyggt pakets id`); return false; }
    REG.packs[pack.id] = pack; if (opts.private) REG.priv.add(pack.id); else REG.priv.delete(pack.id);
    rebuildIndex(); return true;
  }
  function clearPrivate() { for (const id of [...REG.priv]) delete REG.packs[id]; REG.priv.clear(); rebuildIndex(); }
  function rebuildIndex() {
    REG.bySkill = {}; REG.kp = {}; VCACHE.clear(); RCACHE.clear();
    for (const pack of Object.values(REG.packs)) for (const kp of pack.kps) {
      const cid = cidOf(pack.id, kp.id); REG.kp[cid] = { pack, kp, cid };
      (REG.bySkill[kp.skill] = REG.bySkill[kp.skill] || []).push(cid);
    }
  }
  const forTarget = (pack, kid) => (pack.templates || []).includes(kid.template) || (pack.kids || []).includes(kid.id);
  // Nya moment (finns inte i kursmallen) som paketen ger ett barn – bara i v2 (v1 är frusen reserv).
  function newSkillsFor(kid) {
    const out = [];
    for (const pack of Object.values(REG.packs)) if (forTarget(pack, kid)) for (const s of pack.skills) if (!s.existing && !out.some(x => x.id === s.id)) out.push(makeSkill(pack, s));
    return out;
  }
  function makeSkill(pack, s) {
    const sk = { id: s.id, name: s.name, short: s.short, icon: s.icon, group: s.group || pack.subject, subject: pack.topic || '', pack: pack.id, v2only: true, maxLvl: 3, readAloud: s.readAloud !== false,
      method: `${pack.topic ? `<div class="eyebrow" style="margin-bottom:6px">${esc(pack.topic)}</div>` : ''}${s.read || ''}` };
    sk.gen = (lvl, o = {}) => v1Question(sk, lvl, o);
    return sk;
  }
  // Kunskapspunkter för ett moment hos ett visst barn (mall/barn + policy)
  function kpsFor(skillId, kid) { return (REG.bySkill[skillId] || []).filter(cid => forTarget(REG.kp[cid].pack, kid)); }
  function skillFor(kid, skillId) { return [...(kid.skills || []), ...(kid.v2skills || [])].find(s => s.id === skillId) || null; }

  /* ---------- Varianter: varje fakta → en eller flera frågeformer ---------- */
  const VCACHE = new Map(); const RCACHE = new Map();
  const formOk = (f, form, pol) => (f.ages ? f.ages.includes(pol) : POLICY_FORMS[pol].has(form)) && !(f.not_forms || []).includes(form);
  const vLvl = (f, form) => Math.min(3, Math.max(f.lvl || 1, BASE_LVL[form] || 1));
  const shortTerm = (t, pol) => { const n = norm(t); return n.length >= 2 && n.length <= (pol === 'younger' ? 12 : 28) && n.split(' ').length <= 3 && !/\d/.test(n); };
  function variants(cid, pol) {
    const key = cid + '|' + pol; if (VCACHE.has(key)) return VCACHE.get(key);
    const ent = REG.kp[cid]; if (!ent) return [];
    const { pack, kp } = ent; const out = [];
    const sameSkill = pack.kps.filter(k => k.skill === kp.skill);
    const add = (f, form, dir, build, extra = {}) => { if (!formOk(f, form, pol)) return; out.push({ key: `${kp.id}|${f.id || fnv(JSON.stringify([f.k, f.q || f.term || f.s || f.text || f.bad || f.items]))}|${form}|${dir}`, form, lvl: vLvl(f, form), ch: !!f.ch || (vLvl(f, form) === 3 && DEPTH.has(form)), f, build, ...extra }); };
    // Distraktorpooler inom paketet
    const termPool = (f) => pack.kps.flatMap(k => k.facts.filter(x => x.k === 'term' && x !== f && (x.cls || '') === (f.cls || '')).map(x => x.term));
    const defPool = (f) => pack.kps.flatMap(k => k.facts.filter(x => x.k === 'term' && x !== f && x.def && (x.cls || '') === (f.cls || '')).map(x => x.def));
    // Påståendepooler i nivåer: samma kunskapspunkt → samma moment → hela paketet (närmast först, så felalternativen hör till ämnet)
    // Yngre: bara samma moment (ingen ämnesblandning) – och alla felalternativ ryms inom policyns textgräns
    const fitLen = (arr) => arr.filter(x => strip(x).length <= TEXT[pol].choice);
    const tiers = (pick) => [kp.facts, sameSkill.filter(k => k !== kp).flatMap(k => k.facts), pol === 'younger' ? [] : pack.kps.filter(k => k.skill !== kp.skill).flatMap(k => k.facts)].map(fs => fitLen(pick(fs)));
    const falsePool = (f) => tiers(fs => fs.filter(x => x.k === 'stmt' && x !== f).flatMap(x => x.f));
    const truePool = (f) => tiers(fs => fs.filter(x => x.k === 'stmt' && x !== f).map(x => x.s));
    const badPool = (f) => tiers(fs => fs.filter(x => x.k === 'fix' && x !== f).map(x => x.bad));
    for (const f of kp.facts) {
      const why = f.why || kp.explain;
      if (f.k === 'term') {
        const alias = [f.term, ...(f.alias || [])];
        add(f, 'recognition', 'q', (r) => mc(f.q, f.term, f.not, termPool(f), why, r, { alias }));
        if (f.recall !== false && shortTerm(f.term, pol)) add(f, 'recall', 'q', () => typed(f.q, alias, why, { exact: !!f.exact, pool: termPool(f), hint: `Ordet börjar på "${strip(f.term).trim()[0].toUpperCase()}".` }));
        if (f.def) add(f, 'reverse', 'd', (r) => mc(f.rq || `Vad betyder <b>${esc(f.term)}</b>?`, f.def, f.notDef, defPool(f), why, r));
      } else if (f.k === 'qa') {
        const form = f.form || 'recognition';
        add(f, form, 'q', (r) => mc(f.q, f.a, f.not, [], why, r, { alias: f.alias, cs: f.cs }));
        if (f.recall && shortTerm(f.a, pol)) add(f, 'recall', 'c', () => typed(f.q, [f.a, ...(f.alias || [])], why, { exact: !!f.exact, pool: f.not }));
      } else if (f.k === 'pairs') {
        const As = f.items.map(p => p[0]), Bs = f.items.map(p => p[1]);
        const aOf = (b) => f.items.filter(p => norm(p[1]) === norm(b)).map(p => p[0]); const bOf = (a) => f.items.filter(p => norm(p[0]) === norm(a)).map(p => p[1]);
        const fill = (t, a, b) => t.replace(/\{a\}/g, a).replace(/\{b\}/g, b).replace(/\{a_lower\}/g, a[0].toLowerCase() + a.slice(1)).replace(/\{b_lower\}/g, b[0].toLowerCase() + b.slice(1));
        f.items.forEach(([a, b], i) => {
          const sub = { ...f, id: (f.id || fnv(f.q)) + '.' + i };
          add(sub, f.form || 'recognition', 'ab', (r) => mc(fill(f.q, a, b), b, [], Bs.filter(x => !bOf(a).some(y => norm(y) === norm(x))), why, r));
          if (f.rq) add(sub, 'reverse', 'ba', (r) => mc(fill(f.rq, a, b), a, [], As.filter(x => !aOf(b).some(y => norm(y) === norm(x))), why, r));
          if (f.recallB && shortTerm(b, pol)) add(sub, 'recall', 'aB', () => typed(fill(f.q, a, b), [b, ...((f.aliasB || {})[b] || [])], why, { pool: Bs.filter(x => x !== b), exact: !!f.exact }));   // omvandla: skriv själv (t.ex. plural, dåtid)
          if (f.rq && f.recall && shortTerm(a, pol)) add(sub, 'recall', 'bA', () => typed(fill(f.rq, a, b), [a, ...((f.alias || {})[a] || [])], why, { pool: As.filter(x => x !== a), exact: !!f.exact }));
        });
        // Experience v3 – PARA IHOP: tryck på ett kort till vänster och sedan på det som hör ihop till höger. Rätt = alla par utan fel.
        // Bara par där varje vänster- och högerled är unikt (annars finns två rätta par) och där korten ryms.
        const uniq = (arr) => new Set(arr.map(norm)).size === arr.length;
        if (f.match !== false && f.items.length >= 3 && uniq(As) && uniq(Bs) && [...As, ...Bs].every(x => strip(x).length <= TEXT[pol].choice && !/[{}]/.test(x))) {
          const nP = Math.min(f.items.length, pol === 'younger' ? 3 : 4); const rounds = Math.ceil(f.items.length / nP);
          for (let r0 = 0; r0 < rounds; r0++) add({ ...f, id: (f.id || fnv(f.q)) + '.match' + r0 }, 'relationship', 'match', () => {
            const pairs = Array.from({ length: nP }, (_, j) => f.items[(r0 * nP + j) % f.items.length]).map(([a, b]) => [a, b]); const answer = {}; for (const [a, b] of pairs) answer[a] = b;
            return { type: 'match', text: f.mq || 'Para ihop det som hör ihop.', pairs, answer, k: nP, steps: [pairs.map(([a, b]) => `${esc(a)} – <b>${esc(b)}</b>`).join('<br>'), why].filter(Boolean), hint: 'Börja med det du är säkrast på.', v2check: 'pack' };
          }, { ui: 'match', lvl: Math.min(3, f.lvl || 1) });
        }
        const pairLen = Math.max(...As.map(x => strip(x).length)) + Math.max(...Bs.map(x => strip(x).length)) + 3;
        if (f.items.length >= 4 && pairLen <= TEXT[pol].choice) add({ ...f, id: (f.id || fnv(f.q)) + '.par', lvl: Math.max(2, f.lvl || 1) }, 'relationship', 'pair', (r) => {
          const pick = Math.floor(r() * f.items.length); const [a, b] = f.items[pick]; const wrong = [];
          const usedB = new Set([norm(b)]);   // felparen använder andra högerled än det rätta paret – och olika sinsemellan
          for (const [a2] of shuffle(f.items.filter((_, j) => j !== pick), r)) { const b2 = shuffle(Bs.filter(x => !usedB.has(norm(x)) && !bOf(a2).some(y => norm(y) === norm(x))), r)[0]; if (b2) { usedB.add(norm(b2)); wrong.push(`${a2} – ${b2}`); } if (wrong.length >= 3) break; }
          return mc(f.pq || 'Vilket par hör ihop?', `${a} – ${b}`, wrong, [], why, r);
        }, { many: f.items.length });
      } else if (f.k === 'group') {
        f.groups.forEach((g, gi) => {
          const others = f.groups.filter((_, j) => j !== gi).flatMap(x => x.items);
          g.items.forEach((it, ii) => add({ ...f, id: (f.id || fnv(g.q)) + '.' + gi + '.' + ii }, f.form || 'recognition', 'in', (r) => mc(g.q, it, [], others, g.why || why, r)));
          if (g.odd && g.items.length >= 3) others.forEach((o, oi) => add({ ...f, id: (f.id || fnv(g.q)) + '.odd' + gi + '.' + oi, lvl: Math.max(2, f.lvl || 1) }, 'relationship', 'odd', (r) => mc(g.odd, o, [], g.items, g.why || why, r, { exactD: 3 })));
        });
        // Experience v3 – SORTERA: lägg varje led i rätt grupp (tryck på ett kort, tryck på en grupp). Samma kunskap som gruppfrågorna, men som
        // en aktivitet. Bara när alla grupper har en etikett och alla led ryms. Rättas deterministiskt: allt på rätt plats = rätt.
        if (f.groups.every(g => g.label) && f.sort !== false && f.groups.flatMap(g => g.items).every(x => strip(x).length <= TEXT[pol].choice)) {
          // Fasta omgångar (inte slumpvalda led): varje omgång är en egen uppgift med stabilt id (Felboken, Innehållshälsa, ruttning)
          const want = pol === 'younger' ? 4 : 6; const per = Math.max(1, Math.floor(want / f.groups.length)); const rounds = Math.max(...f.groups.map(g => Math.ceil(g.items.length / per)));
          for (let r0 = 0; r0 < rounds; r0++) add({ ...f, id: (f.id || fnv(f.groups[0].q)) + '.sort' + r0 }, 'relationship', 'sort', (r) => {
            const items = []; for (const g of f.groups) for (let j = 0; j < Math.min(per, g.items.length); j++) items.push({ t: g.items[(r0 * per + j) % g.items.length], b: g.label });
            const answer = {}; for (const x of items) answer[x.t] = x.b;
            return { type: 'sort', text: f.sq || 'Sortera i rätt grupp.', bins: f.groups.map(g => g.label), items: shuffle(items.map(x => x.t), r), answer, k: f.groups.length,
              steps: [f.groups.map(g => `<b>${esc(g.label)}:</b> ${items.filter(x => x.b === g.label).map(x => esc(x.t)).join(', ')}`).join('<br>'), why].filter(Boolean), hint: f.hint || 'Ta ett kort i taget. Var hör det hemma?', v2check: 'pack' };
          }, { ui: 'sort', lvl: Math.min(3, f.lvl || 1) });
        }
      } else if (f.k === 'order') {
        add(f, 'relationship', 'ord', () => ({ type: 'order', text: f.q, items: f.items.slice(), answer: f.items.slice(), steps: [`<b>Rätt ordning:</b> ${f.items.map(esc).join(' → ')}`, why].filter(Boolean), hint: f.hint || HINT.relationship }), { ui: 'order' });
        // Saknad länk (2.1, samband): A → ? → C ur samma kedja. Felalternativen är andra led i kedjan – fel på den platsen.
        // Minst fem led, så att det finns felalternativ som inte redan står i frågan (grannarna visas aldrig som alternativ)
        if (f.items.length >= 5 && f.gap !== false) for (let i = 1; i < f.items.length - 1; i++) add({ ...f, id: (f.id || fnv(f.q)) + '.gap' + i, lvl: Math.max(2, f.lvl || 1) }, 'relationship', 'gap',
          (r) => mc(`${f.gapq || 'Vad saknas i kedjan?'}<br>${esc(f.items[i - 1])} → <b>?</b> → ${esc(f.items[i + 1])}`, f.items[i], f.items.filter((_, j) => j !== i && j !== i - 1 && j !== i + 1), [], `<b>Hela kedjan:</b> ${f.items.map(esc).join(' → ')}`, r));
      } else if (f.k === 'stmt') {
        add(f, f.form || 'recognition', 'true', (r) => mc(f.q || 'Vilket påstående stämmer?', f.s, f.f, falsePool(f), why, r));
        f.f.forEach((ff, i) => add({ ...f, id: (f.id || fnv(f.s)) + '.f' + i }, 'mistake', 'false', (r) => mc(f.mq || 'Vilket påstående är <b>fel</b>?', ff, [], truePool(f), `Det stämmer inte. Rätt är: ${f.s}${f.why ? ' ' + f.why : ''}`, r)));
      } else if (f.k === 'num') {
        add(f, f.form || 'multistep', 'n', () => ({ type: 'num', text: f.q, answer: f.a, steps: [why].filter(Boolean), hint: f.hint || HINT[f.form || 'multistep'], unit: f.unit }));
      } else if (f.k === 'pick') {
        add(f, f.form || 'recognition', 'pk', () => { const ch = toks(f.text); return { type: 'choicetext', text: `${f.ask}<br><i>${esc(f.text)}</i>`, choices: ch, answer: ch.indexOf(f.a), steps: [why].filter(Boolean), hint: f.hint || HINT.recognition, ordered: true, ui: 'tap', sentence: strip(f.text).trim(), ask: f.ask }; }, { ui: 'tap' });
      } else if (f.k === 'fix') {
        add(f, 'mistake', 'err', () => { const ch = toks(f.bad); return { type: 'choicetext', text: `${f.mq || 'Ett ord är fel i meningen. Vilket?'}<br><i>${esc(f.bad)}</i>`, choices: ch, answer: ch.indexOf(f.err), steps: [`Rätt: <b>${esc(f.good)}</b>`, why].filter(Boolean), hint: f.hint || HINT.mistake, ordered: true, ui: 'tap', sentence: strip(f.bad).trim(), ask: f.mq || 'Ett ord är fel i meningen. Vilket?' }; }, { ui: 'tap' });
        if (f.recall !== false) add(f, 'recall', 'fx', () => typed(`${f.rq || 'Skriv ordet rätt'}: <i>${esc(f.bad)}</i><br><b>${esc(f.err)}</b> → ?`, [f.fix, ...(f.alias || [])], `Rätt: <b>${esc(f.good)}</b>${why ? '<br>' + why : ''}`, { exact: f.exact !== false, pool: [f.err] }));
        add(f, f.form || 'recognition', 'good', (r) => mc(f.gq || 'Vilken mening är rätt skriven?', f.good, [f.bad], badPool(f), why, r, { cs: f.cs }));
      } else if (f.k === 'read') {
        f.qs.forEach((x, i) => add({ ...f, id: (f.id || fnv(f.text)) + '.' + i, lvl: x.lvl || f.lvl, ages: x.ages || f.ages }, x.form || 'recognition', 'rd', (r) => ({ ...mc(x.q, x.a, x.not, [], x.why || (['cause', 'application', 'explanation'].includes(x.form) ? 'Det står inte rakt ut i texten – men ledtrådarna i texten visar det.' : 'Svaret står i texten.'), r), fig: `<div class="readbox">${f.title ? `<div style="font-weight:800;margin-bottom:4px">${esc(f.title)}</div>` : ''}${f.text}</div>`, speak: false })));
      }
    }
    // Experience v3 – STÄMMER ELLER INTE? Sortera påståenden ur kunskapspunktens egna stmt-fakta (två sanna, två falska per omgång).
    // Samma granskade påståenden som flervalsfrågorna "Vilket stämmer?"/"Vilket är fel?" – nu som en aktivitet. Form: hitta felet.
    { const st = kp.facts.filter(f => f.k === 'stmt' && formOk(f, 'mistake', pol) && strip(f.s).length <= TEXT[pol].choice && f.f.some(x => strip(x).length <= TEXT[pol].choice));
      if (st.length >= 2 && kp.tf !== false) {
        const f0 = { k: 'stmt', id: kp.id + '.tf', lvl: Math.min(3, Math.max(...st.map(f => f.lvl || 1))), why: kp.explain };
        const rounds = Math.min(4, Math.ceil(st.length / 2));
        for (let r0 = 0; r0 < rounds; r0++) add({ ...f0, id: f0.id + r0 }, 'mistake', 'tf', (r) => {
          const tr = [st[(r0 * 2) % st.length], st[(r0 * 2 + 1) % st.length]]; const fa = [st[(r0 * 2 + 1) % st.length], st[(r0 * 2) % st.length]].map(f => f.f.find(x => strip(x).length <= TEXT[pol].choice));
          const items = [...tr.map(f => ({ t: f.s, b: 'Stämmer' })), ...fa.map(t => ({ t, b: 'Stämmer inte' }))].filter((x, i, a) => x.t && a.findIndex(y => norm(y.t) === norm(x.t)) === i);
          if (items.filter(x => x.b === 'Stämmer inte').length < 1) return null;
          const answer = {}; for (const x of items) answer[x.t] = x.b;
          return { type: 'sort', text: 'Stämmer det? Sortera.', bins: ['Stämmer', 'Stämmer inte'], items: shuffle(items.map(x => x.t), r), answer, k: 4, steps: [`<b>Stämmer:</b> ${tr.map(f => esc(f.s)).join(' · ')}`, kp.explain].filter(Boolean), hint: 'Läs ett påstående i taget. Stämmer det med det du har lärt dig?', v2check: 'pack' };
        }, { ui: 'sort', lvl: f0.lvl });
      } }
    for (const v of out) { v.speak = v.f.k !== 'read' && v.f.speak !== false; if (!v.ui) v.ui = v.form === 'recall' ? 'type' : v.f.k === 'num' ? 'num' : 'choice'; }
    VCACHE.set(key, out); return out;
  }
  // Flerval: rätt svar + 3 unika felalternativ – författade (not) först, sedan paketets pool. Alias räknas aldrig som felalternativ.
  function mc(text, correct, authored, pool, why, rnd, o = {}) {
    const key = o.cs ? keyCs : keyCi;   // cs: skiftläget är själva frågan (stor bokstav) – då är "Vi" och "vi" olika alternativ
    const bad = new Set([key(correct), ...(o.alias || []).map(key)]); const d = []; const want = o.exactD || 3;
    const tierList = Array.isArray(pool) && pool.length && Array.isArray(pool[0]) ? pool : [pool || []];   // pool kan vara nivåer (närmast först)
    for (const x of [...shuffle(authored || [], rnd), ...tierList.flatMap(t => shuffle(t, rnd))]) { const n = key(x); if (!n || bad.has(n)) continue; bad.add(n); d.push(x); if (d.length >= want) break; }
    // Granskning 2.1: rätt svar fick inte avslöjas av skiftläget ("vätejoner" bland "Saltsyra", "Kolsyra") → första bokstaven versal på
    // alla alternativ (utom när skiftläget är själva frågan, cs, eller ordet redan har versaler som "pH").
    const cap = (x) => (o.cs || !/^[a-zåäöéü]/.test(x) || /^\S*[A-ZÅÄÖ0-9⁺⁻₀-₉]/.test(x) ? x : x[0].toUpperCase() + x.slice(1));
    const all = [correct, ...d].map(cap); const choices = shuffle(all, rnd);
    return { type: 'choicetext', text, choices, answer: choices.indexOf(all[0]), steps: [why].filter(Boolean), hint: HINT.recognition, cs: o.cs ? true : undefined };
  }
  function typed(text, accept, why, o = {}) {
    return { type: 'text', ui: 'type', text, answer: accept.slice(), display: strip(accept[0]).trim(), steps: [why].filter(Boolean), hint: o.hint || HINT.recall, v2check: 'pack', accept: { exact: !!o.exact, pool: (o.pool || []).map(normT) } };
  }

  /* ---------- Rättning av eget svar (deterministisk) ---------- */
  function check(q, raw) {
    // Experience v3: sortering och para ihop. raw = JSON från gränssnittet. Rätt bara när allt är på rätt plats (sortera) eller när alla
    // par blev rätt utan ett enda fel (para ihop). Ingen delpoäng – samma stränghet som ordningsfrågorna.
    if (q.type === 'sort') { let m; try { m = JSON.parse(raw || '{}'); } catch (e) { return { status: 'empty' }; } const keys = Object.keys(q.answer); if (!m || typeof m !== 'object' || keys.some(k => !(k in m))) return { status: 'empty' }; const wrong = keys.filter(k => m[k] !== q.answer[k]); return { status: wrong.length ? 'wrong' : 'correct', wrongItems: wrong }; }
    if (q.type === 'match') { let m; try { m = JSON.parse(raw || '{}'); } catch (e) { return { status: 'empty' }; } if (!m || !(m.done >= q.pairs.length)) return { status: 'empty' }; return { status: m.mistakes === 0 ? 'correct' : 'wrong', mistakes: m.mistakes }; }
    const s = String(raw || '').trim(); if (!s) return { status: 'empty' };
    const a = normT(s); const acc = q.answer.map(normT);
    if (acc.includes(a)) return { status: 'correct' };
    if (q.accept && q.accept.exact) return { status: 'wrong' };
    // Små stavfel godkänns bara när svaret ligger klart närmare ett godkänt svar än alla felalternativ i poolen
    const best = Math.min(...acc.map(x => lev(a, x))); const tol = Math.max(...acc.map(tolOf));
    if (best > 0 && best <= tol && (q.accept && q.accept.pool || []).every(p => lev(a, p) > best + 1)) return { status: 'correct', note: `Rätt stavat: <b>${esc(q.display)}</b>` };
    return { status: 'wrong' };
  }

  /* ---------- Fråga till ett pass ----------
     opts: { lvl, format: 'any'|'recall'|'depth', pol, avoid: Set(itemId), rnd, challenge, itemId(q) } */
  function question(cid, opts = {}) {
    const ent = REG.kp[cid]; if (!ent) return null;
    const pol = opts.pol || 'middle'; const rnd = opts.rnd || Math.random; const all = variants(cid, pol); if (!all.length) return null;
    let pool = all;
    // Experience v3: para ihop ger återkoppling par för par → aldrig i Testa mig (opts.exam). v1-reserven får bara de gamla formerna.
    if (opts.exam) pool = pool.filter(v => v.ui !== 'match');
    if (opts.noInteractive) pool = pool.filter(v => v.ui !== 'sort' && v.ui !== 'match');
    if (!pool.length) return null;
    const all0 = pool;
    if (opts.challenge) { const ch = pool.filter(v => v.ch); if (!ch.length) return null; pool = ch; }
    else {
      if (opts.format === 'recall') { const r = all0.filter(v => v.form === 'recall'); if (r.length) pool = r; }
      else if (opts.format === 'depth') { const r = all0.filter(v => DEPTH.has(v.form)); if (r.length) pool = r; }
      const L = Math.max(1, Math.min(3, opts.lvl || 1)); const lv = pool.filter(v => v.lvl <= L); pool = lv.length ? lv : pool.filter(v => v.lvl === Math.min(...pool.map(x => x.lvl)));
      // Experience v3 (Explore): aldrig fler än två textval i rad när kunskapen också finns som en aktivitet (sortera, para ihop, ordna,
      // tryck i meningen, bygg ordet). Bara presentationen: formatet (eget svar/djup) och nivån som motorn bad om gäller fortfarande.
      if (opts.vary && opts.vary.choiceRun >= 2) { const act = pool.filter(v => v.ui !== 'choice'); if (act.length) pool = act; }
      // Explore-Bossen (en utmaning i sig): en aktivitet på högst en nivå över, om en sådan finns – annars som vanligt
      // Grow/Achieve-Bossen (sträckuppgiften): helst en djupare form – tillämpa, orsak, förklara, hitta felet – på högst en nivå över,
      // om motorn inte bad om fritt minne. Bara valet av variant; motorns bevisregler är desamma (UX-granskning: Bossen var ofta en kopia).
      if (opts.vary && opts.vary.depthBoss && opts.format !== 'recall') { const dp = all0.filter(v => DEPTH.has(v.form) && v.lvl <= L + 1); if (dp.length) pool = dp; }
      if (opts.vary && opts.vary.stretch) { const act = all0.filter(v => v.ui !== 'choice' && v.ui !== 'type' && v.lvl <= L + 1 && (opts.format !== 'recall' || v.form === 'recall') && (opts.format !== 'depth' || DEPTH.has(v.form))); if (act.length) pool = act; }
    }
    const iid = opts.itemId || ((q) => q.text);
    const built = (v) => finish(ent, v, v.build(rnd), pol);
    // Learning Recipe: viktat urval efter kunskapstyp × stadium (inte slumpvis rotation). Utan stadium (prov, CI): jämn vikt per nivå.
    const band = opts.challenge ? null : bandOf(opts.stage); const type = typeOf(ent.kp); const sig = SIGNATURE[type] || {}; const L0 = Math.max(1, Math.min(3, opts.lvl || 1));
    const wOf = (v) => { let w = band ? (RECIPE[band][v.form] || 0.5) : 1; if ((sig.k || []).includes(v.f.k) || (sig.forms || []).includes(v.form) || (sig.dir || []).includes(v.key.split('|').pop())) w *= 1.5; if (!opts.challenge && v.lvl === L0) w *= 1.6;
      if (opts.vary) { if (v.ui !== 'choice') w *= opts.vary.boost || 2; if (opts.vary.last && v.ui === opts.vary.last) w *= 0.5; }   // v3: variation i aktiviteten, inte i kunskapen
      return w; };
    const order = weightedOrder(pool, wOf, rnd);
    for (const v of order) { const q = built(v); if (q && !(opts.avoid && opts.avoid.has(iid(q)))) return q; }
    // Allt i det önskade formatet är nyligen använt (t.ex. Felbokens frågor): en ANNAN fråga om samma kunskap går före samma fråga igen
    if (!opts.challenge && pool !== all0) for (const v of weightedOrder(all0.filter(v => !pool.includes(v)), wOf, rnd)) { const q = built(v); if (q && !(opts.avoid && opts.avoid.has(iid(q)))) return q; }
    const q = built(order[0]); return q ? { ...q, onlyVariant: true } : null;
  }
  // Viktad ordning utan återläggning (deterministisk givet rnd): första elementet är det receptet helst vill ha
  function weightedOrder(list, wOf, rnd) { const rest = list.map(v => ({ v, w: Math.max(0.001, wOf(v)) })); const out = []; while (rest.length) { let t = rnd() * rest.reduce((a, x) => a + x.w, 0); let i = 0; while (i < rest.length - 1 && (t -= rest[i].w) > 0) i++; out.push(rest.splice(i, 1)[0].v); } return out; }
  function finish(ent, v, q, pol) {
    if (!q) return null;
    if (q.type === 'choicetext' && (!Array.isArray(q.choices) || q.choices.length < 3 || q.answer < 0)) return null;   // för få felalternativ → varianten används inte (CI rapporterar)
    const skill = ent.kp.skill;
    return { ...q, ui: q.ui || v.ui, level: v.lvl, form: v.form, fcode: FCODE[v.form], kp: ent.cid, packId: ent.pack.id, packRev: ent.pack.rev, kpSkill: skill, speak: v.speak && q.speak !== false && (ent.pack.skills.find(s => s.id === skill) || {}).readAloud !== false, challenge: v.ch || undefined, hint: q.hint || HINT[v.form], fk: v.key.split('|').slice(0, 2).join('|') };   // fk: faktumet (v3 undviker samma faktum två gånger samma dag)
  }
  // För CI: bygg en bestämd variant färdig (samma väg som i ett pass)
  function buildVariant(cid, v, rnd, pol) { const ent = REG.kp[cid]; return ent ? finish(ent, v, v.build(rnd), pol) : null; }
  // v1-reserven och "Öva" på ett nytt moment: blandade former från momentets kunskapspunkter (bara flerval/ordning, ingen fritext)
  function v1Question(skill, lvl, o = {}) {
    const cids = REG.bySkill[skill.id] || []; const rnd = o.rnd || Math.random; if (!cids.length) return null;
    for (let i = 0; i < 6; i++) { const cid = cids[Math.floor(rnd() * cids.length)]; const q = question(cid, { lvl, pol: polOfPack(REG.kp[cid].pack), rnd, noInteractive: true }); if (q) return q; }
    return null;
  }
  const polOfPack = (pack) => pack.policies[pack.policies.length - 1];
  /* 2.1 (granskning): manuell övning ("Öva" på ett moment) med motor v2 använder paketets granskade frågor i stället för den gamla
     frågebanken. v1-reserven (motor v1) är oförändrad. Bara flerval och ordning – samma säkra rättning som i passen. */
  function practiceQuestion(kid, skill, lvl, polName, rnd = Math.random) {
    const cids = kpsFor(skill.id, kid); if (!cids.length) return null;
    for (let i = 0; i < 8; i++) { const cid = cids[Math.floor(rnd() * cids.length)]; const pol = POLICY_FORMS[polName] && REG.kp[cid].pack.policies.includes(polName) ? polName : polOfPack(REG.kp[cid].pack); const q = question(cid, { lvl: Math.min(3, lvl || 1), pol, rnd }); if (q && q.type !== 'text') return q; }
    return null;
  }

  /* ---------- Katalog för motorn ---------- */
  function catalogEntries(kid, skill, polName, itemId) {
    const cids = kpsFor(skill.id, kid); if (!cids.length) return null;
    const pol = polName || 'middle'; const out = {}; const route = {};
    for (const cid of cids) {
      const { pack, kp } = REG.kp[cid]; const vs = variants(cid, pol); if (!vs.length) continue;
      out[cid] = { id: cid, kind: 'kp', ref: skill.id, pack: pack.id, kp: kp.id, name: kp.name, full: kp.name, subject: skill.group || pack.subject, maxLvl: Math.max(1, ...vs.map(v => v.lvl)),
        recall: vs.some(v => v.form === 'recall'), depth: vs.some(v => DEPTH.has(v.form)), challenge: vs.some(v => v.ch), focus: !!skill.focus || (kid.focusSkills || []).includes(skill.id) || (kid.focusCids || []).includes(cid), prereq: (kp.requires || []).map(r => cidOf(pack.id, r)), forms: [...new Set(vs.map(v => v.form))], ktype: typeOf(kp), intro: kp.intro !== false };
      // Nya frågors id → kunskapspunkt (v1-"Öva" på samma moment loggas på momentet och leds hit). Cachas per paketversion och policy
      // (granskning 2.1, L8: att bygga alla varianter vid varje katalogbygge var för långsamt på telefoner).
      const rk = cid + '|' + pol + '|' + pack.rev; let ids = RCACHE.get(rk); if (!ids) { ids = vs.map(v => itemId(v.build(seeded(7)))); RCACHE.set(rk, ids); }
      for (const id of ids) route[id] = cid;
    }
    // Gamla frågebankens id → kunskapspunkt (migrering av befintliga bevis, se docs/CONCEPT_PACKS.md §Migrering). En gammal fråga kan
    // leda till en punkt i ett annat moment i samma paket (t.ex. SIV-frågan under Syror → Säkerhet i labbet).
    const packsHere = new Set(cids.map(cid => REG.kp[cid].pack));
    for (const pack of packsHere) for (const [kpId, type, text, ans] of pack.legacy || []) { const to = cidOf(pack.id, kpId); if (REG.kp[to] && variants(to, pol).length) route[legacyId(type, text, ans)] = to; }
    return Object.keys(out).length ? { kps: out, route } : null;
  }
  const legacyId = (type, text, ans) => 'i' + fnv(String(type) + '|' + String(text).replace(/\s+/g, ' ').trim() + '|' + String(ans == null ? '' : ans).slice(0, 60));
  function seeded(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // Ett kort som förklarar kunskapspunkten (LÄR och Rescue): förklaring + ett exempel med svar
  function teach(cid, pol) {
    const ent = REG.kp[cid]; if (!ent) return null; const vs = variants(cid, pol || 'middle').filter(v => v.lvl === 1 && v.form !== 'recall' && v.ui !== 'sort' && v.ui !== 'match');
    const v = vs[0] || variants(cid, pol || 'middle')[0]; const q = v ? finish(ent, v, v.build(seeded(3)), pol) : null;
    return { explain: ent.kp.explain, name: ent.kp.name, q, mistakes: (ent.kp.mistakes || []).slice(0, 2) };
  }
  const info = (cid) => REG.kp[cid] || null;
  /* 2.1 Innehållshälsa (bara förälder/felsökning): uppgifts-id → vilken fråga det är (text, form, källa) så att en flaggad fråga kan
     granskas av Claude. Söker paketens varianter (samma id som i passet) och gamla frågebankens rader. Cache per policy och paketversion. */
  const ITEMS = {};
  function findItem(item, pol, itemId, kid) {
    const k = (pol || 'middle') + '#' + (kid ? kid.template + '/' + kid.id : '*') + '#' + regKey(); let ix = ITEMS[k];
    if (!ix) {
      ix = ITEMS[k] = new Map();
      for (const [cid, ent] of Object.entries(REG.kp)) { if (kid && !forTarget(ent.pack, kid)) continue;
        for (const v of variants(cid, pol || 'middle')) { try { const q = v.build(seeded(7)); ix.set(itemId(q), { cid, pack: ent.pack.id, kp: ent.kp.id, text: String(q.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160), form: v.form, src: ent.kp.src || null }); } catch (e) { /* hoppa över */ } }
      }
      for (const pack of Object.values(REG.packs)) if (!kid || forTarget(pack, kid)) for (const [kpId, type, text, ans] of pack.legacy || []) { const cid = cidOf(pack.id, kpId); if (!ix.has(legacyId(type, text, ans))) ix.set(legacyId(type, text, ans), { cid, pack: pack.id, kp: kpId, text: String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160), form: 'legacy', src: null }); }
      for (const old of Object.keys(ITEMS)) if (!old.endsWith('#' + regKey())) delete ITEMS[old];   // gamla paketversioner bort, övriga barn kvar
    }
    return ix.get(item) || null;
  }
  // Familjens privata paket: tvätta all HTML (bara enkla taggar, inga attribut) och begränsa storleken innan validering
  // Granskning 2.1 (H1): även en tagg utan avslutande ">" (t.ex. "<img src=x onerror=…") neutraliseras – varje "<" som inte inleder en
  // tillåten, attributlös tagg blir &lt;.
  const cleanHtml = (v) => String(v).replace(/<\/?([a-z0-9]+)[^>]*>/gi, (m, t) => (ALLOWED_TAGS.test(t) ? (m[1] === '/' ? `</${t.toLowerCase()}>` : `<${t.toLowerCase()}>`) : ''))
    .replace(/<(?!\/?(?:b|i|br|sub|sup|p|em|strong|span|ul|ol|li|div)>)/g, '&lt;').slice(0, 4000);
  // Fält som alltid är ren text (namn, ikoner, id:n): inga taggar alls
  const PLAIN = new Set(['id', 'title', 'topic', 'name', 'short', 'icon', 'skill', 'subject', 'group', 'label', 'kind', 'ref', 'cls']);
  const plain = (v) => String(v).replace(/[<>]/g, '').slice(0, 200);
  function cleanPack(pk) {
    if (!pk || typeof pk !== 'object') return null; let n = 0;
    const walk = (x, depth, key) => { if (++n > 20000 || depth > 8) throw new Error('för stort'); if (typeof x === 'string') return PLAIN.has(key) ? plain(x) : cleanHtml(x); if (Array.isArray(x)) return x.slice(0, 400).map(y => walk(y, depth + 1, key)); if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) if (/^[A-Za-z_][A-Za-z0-9_]{0,30}$/.test(k)) o[k] = walk(v, depth + 1, k); return o; } return typeof x === 'number' || typeof x === 'boolean' ? x : null; };
    try { return walk(pk, 0); } catch (e) { return null; }
  }
  // Hashar för cachning: ändras när paketen ändras (ny rev eller nya privata paket)
  const regKey = () => Object.values(REG.packs).map(p => p.id + '@' + p.rev).sort().join(',');
  return { TYPES, typeOf, RECIPE, bandOf, key, buildVariant, cleanPack, cleanHtml, VERSION, FORMS, FCODE, DEPTH, BASE_LVL, POLICY_FORMS, TEXT, KINDS, validate, register, clearPrivate, REG, newSkillsFor, kpsFor, skillFor, variants, question, check, teach, info, findItem, mc, typed, practiceQuestion, catalogEntries, legacyId, cidOf, regKey, v1Question, seeded, norm, normT, strip, words, toks, shuffle, lev, ALLOWED_TAGS };
})();
// Inbyggda paket (PACK_DATA byggs in av scripts/build.sh från content/packs/*.json)
if (typeof PACK_DATA !== 'undefined') for (const p of PACK_DATA) PACKS.register(p);
if (typeof module !== 'undefined') module.exports = PACKS;
