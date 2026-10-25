// Skapar den gyllene v1-referensen: kör hela barnflödet + föräldrasidorna i en given bygg-HTML och sparar hashar av varje skärm och av v1-datan.
// Användning: node tests/golden/make_v1_golden.js <sökväg till pluggappen.html> <etikett>  (referensen gjordes från release-1.2.0-8d06e53)
process.env.TZ = 'Europe/Stockholm';
const crypto = require('crypto'); const fs = require('fs'); const path = require('path');
const { mkWin, tools, strip, childFlow, parentFlow } = require('../le/childflow.js');
const h = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
function capture(file) {
  return new Promise((resolve, reject) => {
    const w = mkWin({ seed: 4242, fixedClock: true, file });
    setTimeout(() => { try { const T = tools(w); childFlow(w, T); parentFlow(w, T); const PA = w.PA;
      const data = {}; for (const id of ['k2', 'k4', 'k8']) { const p = strip(PA.DB.profiles[id]); delete p.mistakesCleared; data[id] = h(JSON.stringify(p)); }
      resolve({ screens: T.snaps.map(([label, html]) => [label, h(html)]), data, raw: T.snaps }); } catch (e) { reject(e); } }, 300);
  });
}
module.exports = { capture, h };
if (require.main === module) capture(process.argv[2]).then(r => { const out = { label: process.argv[3] || '', made: 'release-1.2.0-8d06e53', screens: r.screens, data: r.data }; fs.writeFileSync(path.join(__dirname, 'v1_reference.json'), JSON.stringify(out, null, 1)); console.log('skärmar', r.screens.length, 'data', Object.keys(r.data).length); });
