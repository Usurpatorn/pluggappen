// Skickar påminnelser till alla enheter som slagit på notiser. Körs av GitHub Actions.
import webpush from 'web-push';
const { FAMILY_CODE, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, FIREBASE_PROJECT, FIREBASE_KEY, FORCE_SLOT } = process.env;
if (!FAMILY_CODE || !VAPID_PRIVATE_KEY) { console.log('Saknar FAMILY_CODE eller VAPID_PRIVATE_KEY'); process.exit(0); }
webpush.setVapidDetails('mailto:noreply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const base = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/families/${encodeURIComponent(FAMILY_CODE)}/profiles`;
const KIDS = { adam: 'Adam', filip: 'Filip', clara: 'Clara' };
const now = new Date(); const stockholm = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
const hour = stockholm.getHours(); const dow = stockholm.getDay(); const today = stockholm.toISOString().slice(0, 10);
const slot = FORCE_SLOT || (hour < 19 || (hour === 19 && stockholm.getMinutes() < 30) ? 'afternoon' : 'evening');
console.log('Stockholm', stockholm.toString(), 'slot', slot);
const list = await fetch(`${base}?key=${FIREBASE_KEY}&pageSize=100`).then(r => r.json());
const docs = list.documents || [];
const profiles = {}; const subs = [];
for (const d of docs) {
  const id = d.name.split('/').pop(); const json = d.fields?.json?.stringValue; if (!json) continue;
  try { const obj = JSON.parse(json); if (id.startsWith('push_')) subs.push({ id, ...obj }); else profiles[id] = obj; } catch (e) { /* skip */ }
}
console.log('profiler', Object.keys(profiles).join(','), 'enheter med notiser', subs.length);
const practicedToday = (p) => !!(p && p.days && p.days[today] && p.days[today].c > 0);
const goalDone = (p) => !!(p && p.days && p.days[today] && p.days[today].c >= ((p.settings && p.settings.goal) || 10));
const daysSince = (p) => { if (!p || !p.lastDay) return 99; return Math.round((new Date(today) - new Date(p.lastDay)) / 86400000); };
let sent = 0;
for (const s of subs) {
  const msgs = [];
  if (s.kid === 'parent') {
    if (slot === 'evening') { const late = Object.entries(KIDS).filter(([k]) => daysSince(profiles[k]) >= 3).map(([, n]) => n); if (late.length) msgs.push({ title: 'Pluggapp', body: `${late.join(' och ')} har inte övat på 3 dagar.`, tag: 'parent-inactive' }); const done = Object.entries(KIDS).filter(([k]) => practicedToday(profiles[k])).map(([, n]) => n); if (done.length && dow === 0) msgs.push({ title: 'Veckan är slut', body: `${done.join(', ')} pluggade idag. Kolla veckorapporten i föräldraläget.`, tag: 'parent-week' }); }
  } else {
    const p = profiles[s.kid]; const name = KIDS[s.kid] || s.kid;
    if (slot === 'afternoon' && dow >= 1 && dow <= 5 && !goalDone(p)) msgs.push({ title: `Dags för din sprint, ${name}!`, body: p && p.streak ? `Du har ${p.streak} dagar i rad. Fem uppgifter räcker för idag.` : 'Fem snabba uppgifter så är dagens mål på väg.', tag: 'daily', url: `./#${s.kid}-kor` });
    if (slot === 'evening' && !practicedToday(p) && p && p.streak > 0) msgs.push({ title: `Streaken går ut ikväll`, body: `${p.streak} dagar i rad – en kort sprint räddar den.`, tag: 'streak', url: `./#${s.kid}-kor` });
  }
  for (const m of msgs) {
    try { await webpush.sendNotification(s.sub, JSON.stringify(m), { TTL: 3600 * 6 }); sent++; }
    catch (e) { console.log('fel', s.id, e.statusCode); if (e.statusCode === 404 || e.statusCode === 410) { await fetch(`${base}/${s.id}?key=${FIREBASE_KEY}`, { method: 'DELETE' }).catch(() => {}); console.log('tog bort död prenumeration', s.id); } }
  }
}
console.log('skickade', sent);
