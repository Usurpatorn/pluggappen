// Flerseeds-sammanställning av simuleringen (syntetiska elever). Används av test_le_sim.js och K-13-omkörningen.
process.env.TZ = 'UTC';
const S = require('./sim.js');
function summarize(opts = {}, seeds = [7, 11, 23, 42, 99], keys = Object.keys(S.PROFILES)) {
  const out = {};
  for (const k of keys) {
    const rs = seeds.map(seed => S.runProfile(k, { ...opts, seed })); const avg = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
    const rw = {}; for (const r of rs) for (const [x, v] of Object.entries(r.stats.rewards)) rw[x] = (rw[x] || 0) + v / rs.length;
    out[k] = { name: rs[0].name, pol: rs[0].pol, items: avg(r => r.stats.items), acc: avg(r => r.stats.ok / r.stats.items), rescue: avg(r => r.stats.rescue / r.stats.sessions), fbMax: avg(r => r.stats.fbOpenMax), dueMax: avg(r => r.stats.dueMax),
      v2: { d45: avg(r => r.v2.test), d14: avg(r => r.v2.test14), d30: avg(r => r.v2.test30), exam: rs[0].v2.exam != null ? avg(r => r.v2.exam) : null },
      v1: { d45: avg(r => r.v1.test), d14: avg(r => r.v1.test14), d30: avg(r => r.v1.test30), exam: rs[0].v1.exam != null ? avg(r => r.v1.exam) : null },
      light: avg(r => r.stats.light), iv: avg(r => r.L.ivMult || 1), rewards: rw };
  }
  return out;
}
const pct = (x) => x == null ? '  –' : (x * 100).toFixed(0).padStart(3);
function table(res) {
  const lines = ['prof pol      items acc  rescue fbMax dueMax  d45 v2/v1  +14d v2/v1  +30d v2/v1  prov v2/v1  iv'];
  for (const [k, r] of Object.entries(res)) lines.push(`${k}    ${r.pol.padEnd(8)} ${r.items.toFixed(0).padStart(4)} ${pct(r.acc)}%  ${r.rescue.toFixed(2)}  ${r.fbMax.toFixed(1).padStart(5)} ${r.dueMax.toFixed(1).padStart(5)}   ${pct(r.v2.d45)}/${pct(r.v1.d45)}    ${pct(r.v2.d14)}/${pct(r.v1.d14)}     ${pct(r.v2.d30)}/${pct(r.v1.d30)}     ${r.v2.exam != null ? pct(r.v2.exam) + '/' + pct(r.v1.exam) : '       '}  ${r.iv.toFixed(2)}`);
  return lines.join('\n');
}
module.exports = { summarize, table };
if (require.main === module) console.log(table(summarize()));
