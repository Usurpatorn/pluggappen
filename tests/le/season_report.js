// Skriver en sammanställning av säsongssimuleringen (syntetiska elever). node tests/le/season_report.js [mem] [seeds]
process.env.TZ = 'UTC';
const { PROFILES, runSeason, metrics } = require('./season.js');
const mem = Number(process.argv[2] || 2); const seeds = (process.argv[3] || '7,11,23').split(',').map(Number);
const pct = (x) => x == null ? '  –' : (x * 100).toFixed(0).padStart(3);
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`mem=${mem} seeds=${seeds}`);
console.log('prof namn                         pol      pass  träff backlog mitt→slut  kvot  svagVänt nyandel nyLucka maxÄmne provandel felbok(öppen max/synlig max) rescue/pass utm(ok) klar  d120 v2/v1  +14 v2/v1  +30 v2/v1  mästrat(giltigt)  iv');
for (const k of Object.keys(PROFILES)) {
  const rs = seeds.map(seed => runSeason(k, { seed, mem })); const ms = rs.map(metrics); const m = (f) => avg(ms.map(f)); const e = (f) => avg(rs.map(f));
  const exs = rs.flatMap(r => r.examResults); const examTxt = exs.length ? `${pct(avg(exs.map(x => x.v2)))}/${pct(avg(exs.map(x => x.v1)))}` : '';
  console.log(`${k}    ${rs[0].name.padEnd(28)} ${rs[0].pol.padEnd(7)} ${m(x => x.sessions).toFixed(0).padStart(4)} ${pct(m(x => x.accFirst))}%  ${m(x => x.backlogMid).toFixed(1).padStart(5)}→${m(x => x.backlogEnd).toFixed(1).padEnd(5)} ${m(x => x.ratioEnd).toFixed(2)}  ${m(x => x.weakWaitMax).toFixed(0).padStart(3)}d/${m(x => x.weakWaitSessionsMax).toFixed(0).padStart(2)}p   ${pct(m(x => x.newShare))}%  ${m(x => x.newGapMax).toFixed(1).padStart(4)}   ${pct(m(x => x.subjectMaxShare))}%   ${ms[0].examShare == null ? '   –' : pct(m(x => x.examShare || 0)) + '%'}     ${m(x => x.fbOpenMax).toFixed(1).padStart(4)} / ${m(x => x.fbVisibleMax).toFixed(1)}           ${m(x => x.rescuePerSession).toFixed(2)}       ${m(x => x.challenges).toFixed(0).padStart(3)}(${m(x => x.challengeOk).toFixed(0)})  ${m(x => x.klar).toFixed(0).padStart(3)}   ${pct(e(r => r.end.v2.now))}/${pct(e(r => r.end.v1.now))}   ${pct(e(r => r.end.v2.d14))}/${pct(e(r => r.end.v1.d14))}    ${pct(e(r => r.end.v2.d30))}/${pct(e(r => r.end.v1.d30))}    ${e(r => r.end.mastered).toFixed(1)}(${e(r => r.end.validMastery).toFixed(1)})/${rs[0].end.of}  ${e(r => r.end.iv).toFixed(2)}  ${examTxt ? 'prov ' + examTxt : ''}${rs[0].merges.length ? ` synk ${rs[0].merges.length}× lika efter: ${rs.every(r => r.merges.every(x => x.equalAfter))} dubbelbelöningar ${e(r => r.dupRewards).toFixed(1)}` : ''}${rs[0].end.misLeft != null && PROFILES[k].misconception ? ` missuppf kvar ${e(r => r.end.misLeft).toFixed(1)}` : ''}`);
}
