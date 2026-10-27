// 3.2.2 Synkens integritet: appens villkorade skrivning (documents:commit med currentDocument.updateTime / exists=false i kroppen) mot
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
// samma skrivning som SYNC.push: documents:commit, förvillkoret i JSON-kroppen
const COMMIT = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-pluggappen/databases/(default)/documents:commit?key=x`;
const NAME = (kid) => `projects/demo-pluggappen/databases/(default)/documents/families/${FAM}/profiles/${kid}`;
const commit = async (kid, pre, n) => { const w = { update: { name: NAME(kid), fields: JSON.parse(body(n)).fields }, updateMask: { fieldPaths: ['json', 'updatedAt', 'kid'] }, currentDocument: pre === false ? { exists: false } : { updateTime: pre } };
  const r = await fetch(COMMIT, { method: 'POST', headers: H, body: JSON.stringify({ writes: [w] }) }); let j = null; try { j = await r.json(); } catch (e) { /* inget */ }
  return { r, j, st: (j && j.error && j.error.status) || '', ut: (j && j.writeResults && j.writeResults[0] && j.writeResults[0].updateTime) || (j && j.commitTime) || null, msg: (j && j.error && String(j.error.message || '').split(FAM).join('<familj>').slice(0, 160)) || '' }; };
const patch = async (cond, n) => { const pre = /exists=false/.test(cond) ? false : decodeURIComponent((cond.match(/updateTime=([^&]+)/) || [])[1] || ''); const x = await commit('k1', pre, n); x.j = x.j && x.ut ? { ...x.j, updateTime: x.ut } : x.j; return x; };
const get = async () => { const r = await fetch(URL0, { headers: H }); return r.status === 404 ? null : r.json(); };

let x = await patch('&currentDocument.exists=false', 1);
check('skapa: exists=false när dokumentet inte finns', x.r.ok && !!(x.j && x.j.updateTime), `HTTP ${x.r.status} ${x.st} ${JSON.stringify(x.j).slice(0, 200)}`); const t1 = x.j && x.j.updateTime;
check('svaret har den nya versionen (writeResults[0].updateTime)', !!t1);
x = await patch('&currentDocument.exists=false', 2);
check('exists=false när dokumentet finns: nekas som konflikt', !x.r.ok && isConflict(x.r.status, x.st), `HTTP ${x.r.status} ${x.st}`);
let d = await get(); check('…och ingenting skrevs', d && JSON.parse(d.fields.json.stringValue).xp === 1 && d.updateTime === t1);
x = await patch('&currentDocument.updateTime=' + encodeURIComponent(t1), 3);
check('villkorad skrivning med rätt version', x.r.ok && x.j && x.j.updateTime && x.j.updateTime !== t1, `HTTP ${x.r.status} ${x.st} ${x.msg}`); const t2 = x.j && x.j.updateTime;
x = await patch('&currentDocument.updateTime=' + encodeURIComponent(t1), 4);
check('inaktuell version: nekas som konflikt', !x.r.ok && isConflict(x.r.status, x.st), `HTTP ${x.r.status} ${x.st} ${x.msg}`);
d = await get(); check('…och den nyare versionen ligger kvar', d && JSON.parse(d.fields.json.stringValue).xp === 3 && d.updateTime === t2);
check('hämtningens updateTime = senaste skrivningens', d && d.updateTime === t2);
const x6 = await commit('k1', d && d.updateTime, 6); check('villkor = hämtningens updateTime (så som appen gör efter en hämtning): skrivs', x6.r.ok && !!x6.ut, `HTTP ${x6.r.status} ${x6.st} ${x6.msg}`);
const URL_MISSING = URL0.replace('/profiles/k1?', '/profiles/k2?');
void URL_MISSING; const x5 = await commit('k2', t2, 5);
check('villkor på en version när dokumentet inte finns: nekas som konflikt', !x5.r.ok && isConflict(x5.r.status, x5.st), `HTTP ${x5.r.status} ${x5.st} ${x5.msg}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice::Synkens villkor i emulatorn: ${seen.length - fails} av ${seen.length} – ${seen.join(' | ')}`.slice(0, 3000));
console.log(fails ? `SYNC PRECONDITION TEST FAILED (${fails})` : 'SYNC PRECONDITION TEST OK'); process.exit(fails ? 1 : 0);
