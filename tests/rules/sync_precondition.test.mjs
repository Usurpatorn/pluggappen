// 3.2.2 Synkens integritet: appens villkorade skrivning (PATCH …?currentDocument.updateTime=… / currentDocument.exists=false) mot
// Googles Firestore-emulator. Körs i CI inuti `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST). SYNTETISKA data.
// Visar att Firestore förstår villkoren i samma form som appen skickar dem (src/04_sync.js SYNC.push), att en inaktuell version
// nekas, och att appens klassning av svaret ("konflikt – hämta, slå ihop, försök igen" i stället för fel) stämmer med Firestores svar.
if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('kräver Firestore-emulatorn (firebase emulators:exec)'); process.exit(2); }
const FAM = 'syntetisk-familj-' + Math.random().toString(36).slice(2, 8);
const URL0 = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-pluggappen/databases/(default)/documents/families/${FAM}/profiles/k1?key=x`;
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
// appens egen klassning (SYNC_IS_CONFLICT i src/04_sync.js) – läses ur källkoden, så att testet och appen aldrig kan glida isär
import fs from 'node:fs'; import path from 'node:path';
const SRC = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../src/04_sync.js'), 'utf8');
const line = SRC.split('\n').find(l => l.startsWith('const SYNC_IS_CONFLICT = '));
if (!line) { console.error('SYNC_IS_CONFLICT saknas i src/04_sync.js'); process.exit(1); }
const isConflict = new Function(line.replace('const SYNC_IS_CONFLICT = ', 'return ').replace(/;\s*$/, ''))();
let fails = 0; const seen = []; const check = (name, cond, extra = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' – ' + extra : ''}`); seen.push(`${cond ? 'ok' : 'FEL'}: ${name}${extra ? ' (' + extra + ')' : ''}`); if (!cond) { fails++; if (process.env.GITHUB_ACTIONS) console.log(`::error::Synkens villkor: ${name}${extra ? ' – ' + extra : ''}`); } };
const body = (n) => JSON.stringify({ fields: { json: { stringValue: JSON.stringify({ xp: n }) }, updatedAt: { integerValue: String(1000 + n) }, kid: { stringValue: 'k1' } } });
const patch = async (cond, n) => { const r = await fetch(URL0 + '&mask.fieldPaths=updatedAt' + cond, { method: 'PATCH', headers: H, body: body(n) }); let j = null; try { j = await r.json(); } catch (e) { /* inget */ } return { r, j, st: (j && j.error && j.error.status) || '' }; };
const get = async () => { const r = await fetch(URL0, { headers: H }); return r.status === 404 ? null : r.json(); };

let x = await patch('&currentDocument.exists=false', 1);
check('skapa: exists=false när dokumentet inte finns', x.r.ok && !!(x.j && x.j.updateTime), `HTTP ${x.r.status} ${x.st} ${JSON.stringify(x.j).slice(0, 200)}`); const t1 = x.j && x.j.updateTime;
check('svaret (mask updatedAt) har updateTime', !!t1);
x = await patch('&currentDocument.exists=false', 2);
check('exists=false när dokumentet finns: nekas som konflikt', !x.r.ok && isConflict(x.r.status, x.st), `HTTP ${x.r.status} ${x.st}`);
let d = await get(); check('…och ingenting skrevs', d && JSON.parse(d.fields.json.stringValue).xp === 1 && d.updateTime === t1);
x = await patch('&currentDocument.updateTime=' + encodeURIComponent(t1), 3);
check('villkorad skrivning med rätt version', x.r.ok && x.j.updateTime && x.j.updateTime !== t1, `HTTP ${x.r.status}`); const t2 = x.j && x.j.updateTime;
x = await patch('&currentDocument.updateTime=' + encodeURIComponent(t1), 4);
check('inaktuell version: nekas som konflikt', !x.r.ok && isConflict(x.r.status, x.st), `HTTP ${x.r.status} ${x.st}`);
d = await get(); check('…och den nyare versionen ligger kvar', d && JSON.parse(d.fields.json.stringValue).xp === 3 && d.updateTime === t2);
check('hämtningens updateTime = senaste skrivningens', d && d.updateTime === t2);
const URL_MISSING = URL0.replace('/profiles/k1?', '/profiles/k2?');
const r5 = await fetch(URL_MISSING + '&mask.fieldPaths=updatedAt&currentDocument.updateTime=' + encodeURIComponent(t2), { method: 'PATCH', headers: H, body: body(5) }); let j5 = null; try { j5 = await r5.json(); } catch (e) { /* inget */ }
check('villkor på en version när dokumentet inte finns: nekas som konflikt', !r5.ok && isConflict(r5.status, (j5 && j5.error && j5.error.status) || ''), `HTTP ${r5.status}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice::Synkens villkor i emulatorn: ${seen.length - fails} av ${seen.length} – ${seen.join(' | ')}`.slice(0, 3000));
console.log(fails ? `SYNC PRECONDITION TEST FAILED (${fails})` : 'SYNC PRECONDITION TEST OK'); process.exit(fails ? 1 : 0);
