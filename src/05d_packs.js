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
  const toks = (sentence) => { const out = []; for (const w of strip(sentence).split(/\s+/)) { const t = w.replace(/^[„"'(«]+|[.,!?;:"'»)]+$/g, ''); if (t && !out.includes(t)) out.push(t); } return out; };
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
    REG.packs[pack.id] = pack; if (opts.private) REG.priv.add(pack.id); else REG.priv.delete(pack.id);
    rebuildIndex(); return true;
  }
  function clearPrivate() { for (const id of [...REG.priv]) delete REG.packs[id]; REG.priv.clear(); rebuildIndex(); }
  function rebuildIndex() {
    REG.bySkill = {}; REG.kp = {}; VCACHE.clear();
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
    const sk = { id: s.id, name: s.name, short: s.short, icon: s.icon, group: pack.subject, subject: pack.topic || '', pack: pack.id, v2only: true, maxLvl: 3, readAloud: s.readAloud !== false,
      method: `${pack.topic ? `<div class="eyebrow" style="margin-bottom:6px">${esc(pack.topic)}</div>` : ''}${s.read || ''}` };
    sk.gen = (lvl, o = {}) => v1Question(sk, lvl, o);
    return sk;
  }
  // Kunskapspunkter för ett moment hos ett visst barn (mall/barn + policy)
  function kpsFor(skillId, kid) { return (REG.bySkill[skillId] || []).filter(cid => forTarget(REG.kp[cid].pack, kid)); }
  function skillFor(kid, skillId) { return [...(kid.skills || []), ...(kid.v2skills || [])].find(s => s.id === skillId) || null; }

  /* ---------- Varianter: varje fakta → en eller flera frågeformer ---------- */
  const VCACHE = new Map();
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
    const tiers = (pick) => [kp.facts, sameSkill.filter(k => k !== kp).flatMap(k => k.facts), pack.kps.filter(k => k.skill !== kp.skill).flatMap(k => k.facts)].map(pick);
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
        add(f, form, 'q', (r) => mc(f.q, f.a, f.not, [], why, r, { alias: f.alias }));
        if (f.recall && shortTerm(f.a, pol)) add(f, 'recall', 'c', () => typed(f.q, [f.a, ...(f.alias || [])], why, { exact: !!f.exact, pool: f.not }));
      } else if (f.k === 'pairs') {
        const As = f.items.map(p => p[0]), Bs = f.items.map(p => p[1]);
        const aOf = (b) => f.items.filter(p => norm(p[1]) === norm(b)).map(p => p[0]); const bOf = (a) => f.items.filter(p => norm(p[0]) === norm(a)).map(p => p[1]);
        const fill = (t, a, b) => t.replace(/\{a\}/g, a).replace(/\{b\}/g, b).replace(/\{a_lower\}/g, a[0].toLowerCase() + a.slice(1)).replace(/\{b_lower\}/g, b[0].toLowerCase() + b.slice(1));
        f.items.forEach(([a, b], i) => {
          const sub = { ...f, id: (f.id || fnv(f.q)) + '.' + i };
          add(sub, f.form || 'recognition', 'ab', (r) => mc(fill(f.q, a, b), b, [], Bs.filter(x => !bOf(a).some(y => norm(y) === norm(x))), why, r));
          if (f.rq) add(sub, 'reverse', 'ba', (r) => mc(fill(f.rq, a, b), a, [], As.filter(x => !aOf(b).some(y => norm(y) === norm(x))), why, r));
          if (f.rq && f.recall && shortTerm(a, pol)) add(sub, 'recall', 'bA', () => typed(fill(f.rq, a, b), [a, ...((f.alias || {})[a] || [])], why, { pool: As.filter(x => x !== a) }));
        });
        if (f.items.length >= 4) add({ ...f, id: (f.id || fnv(f.q)) + '.par', lvl: Math.max(2, f.lvl || 1) }, 'relationship', 'pair', (r) => {
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
      } else if (f.k === 'order') {
        add(f, 'relationship', 'ord', () => ({ type: 'order', text: f.q, items: f.items.slice(), answer: f.items.slice(), steps: [`<b>Rätt ordning:</b> ${f.items.map(esc).join(' → ')}`, why].filter(Boolean), hint: f.hint || HINT.relationship }));
      } else if (f.k === 'stmt') {
        add(f, f.form || 'recognition', 'true', (r) => mc(f.q || 'Vilket påstående stämmer?', f.s, f.f, falsePool(f), why, r));
        f.f.forEach((ff, i) => add({ ...f, id: (f.id || fnv(f.s)) + '.f' + i }, 'mistake', 'false', (r) => mc(f.mq || 'Vilket påstående är <b>fel</b>?', ff, [], truePool(f), `Det stämmer inte. Rätt är: ${f.s}${f.why ? ' ' + f.why : ''}`, r)));
      } else if (f.k === 'num') {
        add(f, f.form || 'multistep', 'n', () => ({ type: 'num', text: f.q, answer: f.a, steps: [why].filter(Boolean), hint: f.hint || HINT[f.form || 'multistep'], unit: f.unit }));
      } else if (f.k === 'pick') {
        add(f, f.form || 'recognition', 'pk', () => { const ch = toks(f.text); return { type: 'choicetext', text: `${f.ask}<br><i>${esc(f.text)}</i>`, choices: ch, answer: ch.indexOf(f.a), steps: [why].filter(Boolean), hint: f.hint || HINT.recognition, ordered: true }; });
      } else if (f.k === 'fix') {
        add(f, 'mistake', 'err', () => { const ch = toks(f.bad); return { type: 'choicetext', text: `${f.mq || 'Ett ord är fel i meningen. Vilket?'}<br><i>${esc(f.bad)}</i>`, choices: ch, answer: ch.indexOf(f.err), steps: [`Rätt: <b>${esc(f.good)}</b>`, why].filter(Boolean), hint: f.hint || HINT.mistake, ordered: true }; });
        if (f.recall !== false) add(f, 'recall', 'fx', () => typed(`${f.rq || 'Skriv ordet rätt'}: <i>${esc(f.bad)}</i><br><b>${esc(f.err)}</b> → ?`, [f.fix, ...(f.alias || [])], `Rätt: <b>${esc(f.good)}</b>${why ? '<br>' + why : ''}`, { exact: f.exact !== false, pool: [f.err] }));
        add(f, f.form || 'recognition', 'good', (r) => mc(f.gq || 'Vilken mening är rätt skriven?', f.good, [f.bad], badPool(f), why, r));
      } else if (f.k === 'read') {
        f.qs.forEach((x, i) => add({ ...f, id: (f.id || fnv(f.text)) + '.' + i, lvl: x.lvl || f.lvl, ages: x.ages || f.ages }, x.form || 'recognition', 'rd', (r) => ({ ...mc(x.q, x.a, x.not, [], x.why || `Svaret står i texten.`, r), fig: `<div class="readbox">${f.title ? `<div style="font-weight:800;margin-bottom:4px">${esc(f.title)}</div>` : ''}${f.text}</div>`, speak: false })));
      }
    }
    for (const v of out) { v.speak = v.f.k !== 'read' && v.f.speak !== false; }
    VCACHE.set(key, out); return out;
  }
  // Flerval: rätt svar + 3 unika felalternativ – författade (not) först, sedan paketets pool. Alias räknas aldrig som felalternativ.
  function mc(text, correct, authored, pool, why, rnd, o = {}) {
    const bad = new Set([norm(correct), ...(o.alias || []).map(norm)]); const d = []; const want = o.exactD || 3;
    const tierList = Array.isArray(pool) && pool.length && Array.isArray(pool[0]) ? pool : [pool || []];   // pool kan vara nivåer (närmast först)
    for (const x of [...shuffle(authored || [], rnd), ...tierList.flatMap(t => shuffle(t, rnd))]) { const n = norm(x); if (!n || bad.has(n)) continue; bad.add(n); d.push(x); if (d.length >= want) break; }
    const choices = shuffle([correct, ...d], rnd);
    return { type: 'choicetext', text, choices, answer: choices.indexOf(correct), steps: [why].filter(Boolean), hint: HINT.recognition };
  }
  function typed(text, accept, why, o = {}) {
    return { type: 'text', text, answer: accept.slice(), display: strip(accept[0]).trim(), steps: [why].filter(Boolean), hint: o.hint || HINT.recall, v2check: 'pack', accept: { exact: !!o.exact, pool: (o.pool || []).map(normT) } };
  }

  /* ---------- Rättning av eget svar (deterministisk) ---------- */
  function check(q, raw) {
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
    if (opts.challenge) { const ch = all.filter(v => v.ch); if (!ch.length) return null; pool = ch; }
    else {
      if (opts.format === 'recall') { const r = all.filter(v => v.form === 'recall'); if (r.length) pool = r; }
      else if (opts.format === 'depth') { const r = all.filter(v => DEPTH.has(v.form)); if (r.length) pool = r; }
      const L = Math.max(1, Math.min(3, opts.lvl || 1)); const lv = pool.filter(v => v.lvl <= L); pool = lv.length ? lv : pool.filter(v => v.lvl === Math.min(...pool.map(x => x.lvl)));
      if (!opts.format || opts.format === 'any') { const L2 = pool.filter(v => v.lvl === L); if (L2.length && rnd() < 0.6) pool = L2; }
    }
    const iid = opts.itemId || ((q) => q.text);
    const built = (v) => finish(ent, v, v.build(rnd), pol);
    const order = shuffle(pool, rnd);
    for (const v of order) { const q = built(v); if (q && !(opts.avoid && opts.avoid.has(iid(q)))) return q; }
    const q = built(order[0]); return q ? { ...q, onlyVariant: true } : null;
  }
  function finish(ent, v, q, pol) {
    if (!q) return null;
    if (q.type === 'choicetext' && (!Array.isArray(q.choices) || q.choices.length < 3 || q.answer < 0)) return null;   // för få felalternativ → varianten används inte (CI rapporterar)
    const skill = ent.kp.skill;
    return { ...q, level: v.lvl, form: v.form, fcode: FCODE[v.form], kp: ent.cid, packId: ent.pack.id, packRev: ent.pack.rev, kpSkill: skill, speak: v.speak && q.speak !== false && (ent.pack.skills.find(s => s.id === skill) || {}).readAloud !== false, challenge: v.ch || undefined, hint: q.hint || HINT[v.form] };
  }
  // För CI: bygg en bestämd variant färdig (samma väg som i ett pass)
  function buildVariant(cid, v, rnd, pol) { const ent = REG.kp[cid]; return ent ? finish(ent, v, v.build(rnd), pol) : null; }
  // v1-reserven och "Öva" på ett nytt moment: blandade former från momentets kunskapspunkter (bara flerval/ordning, ingen fritext)
  function v1Question(skill, lvl, o = {}) {
    const cids = REG.bySkill[skill.id] || []; const rnd = o.rnd || Math.random; if (!cids.length) return null;
    for (let i = 0; i < 6; i++) { const cid = cids[Math.floor(rnd() * cids.length)]; const q = question(cid, { lvl, pol: polOfPack(REG.kp[cid].pack), rnd }); if (q) return q; }
    return null;
  }
  const polOfPack = (pack) => pack.policies[pack.policies.length - 1];

  /* ---------- Katalog för motorn ---------- */
  function catalogEntries(kid, skill, polName, itemId) {
    const cids = kpsFor(skill.id, kid); if (!cids.length) return null;
    const pol = polName || 'middle'; const out = {}; const route = {};
    for (const cid of cids) {
      const { pack, kp } = REG.kp[cid]; const vs = variants(cid, pol); if (!vs.length) continue;
      out[cid] = { id: cid, kind: 'kp', ref: skill.id, pack: pack.id, kp: kp.id, name: kp.name, full: kp.name, subject: pack.subject, maxLvl: Math.max(1, ...vs.map(v => v.lvl)),
        recall: vs.some(v => v.form === 'recall'), depth: vs.some(v => DEPTH.has(v.form)), challenge: vs.some(v => v.ch), focus: !!skill.focus || (kid.focusCids || []).includes(cid), prereq: (kp.requires || []).map(r => cidOf(pack.id, r)), forms: [...new Set(vs.map(v => v.form))] };
      // Nya frågors id → kunskapspunkt (v1-"Öva" på samma moment loggas på momentet och leds hit)
      for (const v of vs) { const q = v.build(seeded(7)); route[itemId(q)] = cid; }
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
    const ent = REG.kp[cid]; if (!ent) return null; const vs = variants(cid, pol || 'middle').filter(v => v.lvl === 1 && v.form !== 'recall');
    const v = vs[0] || variants(cid, pol || 'middle')[0]; const q = v ? finish(ent, v, v.build(seeded(3)), pol) : null;
    return { explain: ent.kp.explain, name: ent.kp.name, q, mistakes: (ent.kp.mistakes || []).slice(0, 2) };
  }
  const info = (cid) => REG.kp[cid] || null;
  // Familjens privata paket: tvätta all HTML (bara enkla taggar, inga attribut) och begränsa storleken innan validering
  const cleanHtml = (v) => String(v).replace(/<\/?([a-z0-9]+)[^>]*>/gi, (m, t) => (ALLOWED_TAGS.test(t) ? (m[1] === '/' ? `</${t.toLowerCase()}>` : `<${t.toLowerCase()}>`) : '')).slice(0, 4000);
  function cleanPack(pk) {
    if (!pk || typeof pk !== 'object') return null; let n = 0;
    const walk = (x, depth) => { if (++n > 20000 || depth > 8) throw new Error('för stort'); if (typeof x === 'string') return cleanHtml(x); if (Array.isArray(x)) return x.slice(0, 400).map(y => walk(y, depth + 1)); if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) if (/^[A-Za-z_][A-Za-z0-9_]{0,30}$/.test(k)) o[k] = walk(v, depth + 1); return o; } return typeof x === 'number' || typeof x === 'boolean' ? x : null; };
    try { return walk(pk, 0); } catch (e) { return null; }
  }
  // Hashar för cachning: ändras när paketen ändras (ny rev eller nya privata paket)
  const regKey = () => Object.values(REG.packs).map(p => p.id + '@' + p.rev).sort().join(',');
  return { buildVariant, cleanPack, cleanHtml, VERSION, FORMS, FCODE, DEPTH, BASE_LVL, POLICY_FORMS, TEXT, KINDS, validate, register, clearPrivate, REG, newSkillsFor, kpsFor, skillFor, variants, question, check, teach, info, catalogEntries, legacyId, cidOf, regKey, v1Question, seeded, norm, normT, strip, words, toks, shuffle, lev, ALLOWED_TAGS };
})();
// Inbyggda paket (PACK_DATA byggs in av scripts/build.sh från content/packs/*.json)
if (typeof PACK_DATA !== 'undefined') for (const p of PACK_DATA) PACKS.register(p);
if (typeof module !== 'undefined') module.exports = PACKS;
