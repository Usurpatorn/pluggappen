// Skriver ut de gamla frågebankernas frågor för ett moment som legacy-rader [kp, typ, text, svar] (kp = "?").
// Används när ett befintligt moment får ett Concept Pack: varje gammal fråga ska ledas till en kunskapspunkt (bevis följer med).
// node scripts/legacy-dump.js kemi_syror kemi_baser …
'use strict';
const { loadLegacyBanks } = require('../tests/lib/legacy.js');
const B = loadLegacyBanks();
for (const sk of process.argv.slice(2)) { const rows = B.rowsFor(sk); console.log(`// ${sk}: ${rows.length} frågor`); for (const r of rows) console.log(JSON.stringify(['?', ...r]) + ','); }
