/* Läser de GAMLA (v1-)frågebankerna direkt ur källorna i en isolerad vm – utan DOM – så att migreringstestet kan räkna upp
   varje fråga v1 kan ställa för ett moment och kontrollera att den leds till en kunskapspunkt. */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
function loadLegacyBanks() {
  const src = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', f), 'utf8').split('\n').filter(l => !l.includes('module.exports')).join('\n');
  const ctx = { console, Math, JSON, Object, Array, String, Number, Set, Map };
  vm.createContext(ctx);
  const code = ['01_math.js', '02c_so.js', '02d_kemi.js', '02e_open.js', '02i_naso.js', '02h_svenska.js'].map(src).join('\n;\n') +
    '\n;this.__B = { GEO4: typeof GEO4 !== "undefined" ? GEO4 : [], KEMI4: typeof KEMI4 !== "undefined" ? KEMI4 : [], OPEN: typeof OPEN !== "undefined" ? OPEN : {}, ORDERS: typeof ORDERS !== "undefined" ? ORDERS : {}, NO2: typeof NO2 !== "undefined" ? NO2 : [], SO2: typeof SO2 !== "undefined" ? SO2 : [] };';
  vm.runInContext(code, ctx);
  const B = ctx.__B;
  const topics = [...B.GEO4, ...B.KEMI4, ...B.NO2, ...B.SO2];
  // [typ, text, svarsnyckel] exakt som LECAT.itemId räknar (typ | text | rätt svar)
  function rowsFor(skillId) {
    const t = topics.find(x => x.id === skillId); const rows = [];
    if (t) for (const it of t.qs || []) rows.push(it.order ? ['order', it.q, it.items[0]] : it.num ? ['num', it.q, String(it.answer)] : ['choicetext', it.q, it.choices[0]]);
    for (const o of B.OPEN[skillId] || []) rows.push(['open', o.q, o.model]);
    for (const o of B.ORDERS[skillId] || []) rows.push(['order', o.q, o.items[0]]);
    return rows;
  }
  return { B, topics, rowsFor };
}
module.exports = { loadLegacyBanks };
