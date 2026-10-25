// Skickar påminnelser till alla enheter som slagit på notiser. Körs av GitHub Actions.
import webpush from 'web-push';
const clean = (v) => (v || '').trim().replace(/^["']|["']$/g, '').trim();
// Privat nyckel: tål att hela vapid.json, standard-base64 eller nyckel med mellanslag/radbrytningar klistrats in.
const cleanKey = (v) => { let k = clean(v); const m = k.match(/"privateKey"\s*:\s*"([^"]+)"/); if (m) k = m[1]; k = k.replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); const pk = k.match(/[A-Za-z0-9_-]{43}/); return pk ? pk[0] : k; };
const FAMILY_CODE = clean(process.env.FAMILY_CODE), VAPID_PRIVATE_KEY = cleanKey(process.env.VAPID_PRIVATE_KEY), VAPID_PUBLIC_KEY = clean(process.env.VAPID_PUBLIC_KEY), FIREBASE_PROJECT = clean(process.env.FIREBASE_PROJECT), FIREBASE_KEY = clean(process.env.FIREBASE_KEY), FORCE_SLOT = clean(process.env.FORCE_SLOT);
const log = []; const say = (...a) => { const line = a.join(' '); console.log(line); log.push(line); };
// ---- Autentisering mot Firestore ----
// Reglerna kräver medlemskap; jobbet använder därför ett servicekonto (secret FIREBASE_SERVICE_ACCOUNT = hela JSON-nyckelfilen).
// Access-token hämtas med en egen-signerad RS256-JWT (inga extra beroenden). Saknas secreten används API-nyckeln (fungerar bara under övergångsperioden).
import { createSign } from 'node:crypto';
let ACCESS_TOKEN = null;
async function getAccessToken() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim(); if (!raw) return null;
  let sa; try { sa = JSON.parse(raw); } catch (e) { say('FIREBASE_SERVICE_ACCOUNT är inte giltig JSON'); return null; }
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 });
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${sig}` });
  if (!r.ok) { say('Kunde inte hämta access-token för servicekontot: HTTP ' + r.status); return null; }
  return (await r.json()).access_token;
}
const fsFetch = (url, opts = {}) => fetch(url, ACCESS_TOKEN ? { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + ACCESS_TOKEN } } : opts);
const writeStatus = async (extra) => { try { const base0 = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/families/${encodeURIComponent(FAMILY_CODE)}/profiles/push_log`; await fsFetch(`${base0}?key=${FIREBASE_KEY}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify({ at: Date.now(), log: log.slice(-20), ...extra }) }, updatedAt: { integerValue: String(Date.now()) }, kid: { stringValue: 'log' } } }) }); } catch (e) { console.log('kunde inte skriva status', e.message); } };
if (!FAMILY_CODE || !VAPID_PRIVATE_KEY) { say('Saknar FAMILY_CODE eller VAPID_PRIVATE_KEY (kontrollera repo secrets)'); await writeStatus({ ok: false }); process.exit(0); }
try { webpush.setVapidDetails('mailto:noreply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY); } catch (e) { say('VAPID-nycklarna stämmer inte: ' + e.message + ' (privat nyckel ska vara 43 tecken, utan citattecken)'); await writeStatus({ ok: false }); process.exit(0); }
const base = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/families/${encodeURIComponent(FAMILY_CODE)}/profiles`;
ACCESS_TOKEN = await getAccessToken(); say(ACCESS_TOKEN ? 'autentiserad med servicekonto' : 'INGEN servicekonto-nyckel – kör med API-nyckel (slutar fungera när övergångsperioden är över)');
let KIDS = {}; // id -> namn, läses från familjens privata konfiguration (_config) – inga namn i koden
const now = new Date(); const stockholm = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
const hour = stockholm.getHours(); const dow = stockholm.getDay(); const today = stockholm.toISOString().slice(0, 10);
const slot = FORCE_SLOT || (hour < 19 || (hour === 19 && stockholm.getMinutes() < 30) ? 'afternoon' : 'evening');
say('Stockholm', stockholm.toString(), 'slot', slot);
// Tysta timmar: GitHubs schemaläggning kan vara timmar försenad – skicka aldrig sent på kvällen eller på natten (testläge undantaget).
if (slot !== 'test' && (hour >= 21 || hour < 7)) { say('tyst timme (' + hour + ':xx) – skickar inget'); await writeStatus({ ok: true, sent: 0, slot, subs: 0, quiet: true }); process.exit(0); }
let list; try { list = await fsFetch(`${base}?key=${FIREBASE_KEY}&pageSize=100`).then(r => r.json()); if (list.error) throw new Error(JSON.stringify(list.error)); } catch (e) { say('Kunde inte läsa Firestore: ' + e.message); await writeStatus({ ok: false }); process.exit(0); }
const docs = list.documents || [];
const profiles = {}; const subs = [];
for (const d of docs) {
  const id = d.name.split('/').pop(); const json = d.fields?.json?.stringValue; if (!json) continue;
  try { const obj = JSON.parse(json); if (id === '_config') { for (const k of obj.kids || []) KIDS[k.id] = k.name; continue; } if (id === 'push_log' || id.startsWith('_')) continue; if (id.startsWith('push_')) subs.push({ id, ...obj }); else profiles[id] = obj; } catch (e) { /* skip */ }
}
say('profiler', Object.keys(profiles).length, 'barn i konfig', Object.keys(KIDS).length, 'enheter med notiser', subs.length);
const practicedToday = (p) => !!(p && p.days && p.days[today] && p.days[today].c > 0);
const goalDone = (p) => !!(p && p.days && p.days[today] && p.days[today].c >= ((p.settings && p.settings.goal) || 10));
const daysSince = (p) => { if (!p || !p.lastDay) return -1; return Math.round((new Date(today) - new Date(p.lastDay)) / 86400000); }; // -1 = har aldrig övat (räknas inte som inaktiv)
let sent = 0;
for (const s of subs) {
  const msgs = [];
  if (slot === 'test') { msgs.push({ title: 'Pluggapp – test', body: `Notiserna fungerar på den här enheten (${s.kid === 'parent' ? 'förälder' : (KIDS[s.kid] || s.kid)}).`, tag: 'test' }); }
  else if (s.kid === 'parent') {
    if (slot === 'evening') { const late = Object.entries(KIDS).filter(([k]) => daysSince(profiles[k]) >= 3).map(([, n]) => n); if (late.length) msgs.push({ title: 'Pluggapp', body: `${late.join(' och ')} har inte övat på 3 dagar.`, tag: 'parent-inactive' }); const done = Object.entries(KIDS).filter(([k]) => practicedToday(profiles[k])).map(([, n]) => n); if (done.length && dow === 0) msgs.push({ title: 'Veckan är slut', body: `${done.join(', ')} pluggade idag. Kolla veckorapporten i föräldraläget.`, tag: 'parent-week' }); }
  } else {
    const p = profiles[s.kid]; const name = KIDS[s.kid] || s.kid;
    if (slot === 'afternoon' && dow >= 1 && dow <= 5 && !goalDone(p)) msgs.push({ title: `Dags för din sprint, ${name}!`, body: p && p.streak ? `Du har ${p.streak} dagar i rad. Fem uppgifter räcker för idag.` : 'Fem snabba uppgifter så är dagens mål på väg.', tag: 'daily', url: `./#${s.kid}-kor` });
    if (slot === 'evening' && !practicedToday(p) && p && p.streak > 0) msgs.push({ title: `Streaken går ut ikväll`, body: `${p.streak} dagar i rad – en kort sprint räddar den.`, tag: 'streak', url: `./#${s.kid}-kor` });
  }
  for (const m of msgs) {
    try { await webpush.sendNotification(s.sub, JSON.stringify(m), { TTL: 3600 * 6 }); sent++; say('skickade till', s.kid, m.tag); }
    catch (e) { say('fel', s.id, e.statusCode, (e.body || e.message || '').toString().slice(0, 120)); if (e.statusCode === 404 || e.statusCode === 410) { await fsFetch(`${base}/${s.id}?key=${FIREBASE_KEY}`, { method: 'DELETE' }).catch(() => {}); say('tog bort död prenumeration', s.id); } }
  }
}
say('skickade totalt', sent); await writeStatus({ ok: true, sent, slot, subs: subs.length });
