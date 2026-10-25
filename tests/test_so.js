const { Poly, R, T } = require('../src/01_math.js'); global.Poly=Poly; global.R=R; global.T=T;
global.Q = (q, choices, why) => ({ q, choices, why });
const so = require('../src/02c_so.js'); global.makeSoGen = (t)=>{ /* replicate */ return so.SO_SKILLS.ak4[0].gen; };
let fails=0;
const all = [...so.GEO4, ...require('../src/02d_kemi.js').KEMI4];
for (const t of all) { const seen=new Set(); for (const q of t.qs) { if (q.num) { if (typeof q.answer!=='number') fails++; continue; } if (!q.choices || q.choices.length!==4) { fails++; console.log('choices', t.id, q.q); } if (new Set(q.choices).size!==4) { fails++; console.log('dup choice', t.id, q.q); } if (seen.has(q.q)) { fails++; console.log('dup q', q.q); } seen.add(q.q); if (!q.why) fails++; } }
const skills = [...so.SO_SKILLS.ak4, ...require('../src/02d_kemi.js').KEMI_SKILLS];
for (const sk of skills) { for (let i=0;i<60;i++){ const q = sk.gen(1); if (q.type==='choicetext') { if (q.choices[q.answer]===undefined) { fails++; console.log('bad idx'); } } else if (q.type!=='num') { fails++; console.log('type', q.type); } if (!q.steps[0]) fails++; } }
console.log('topics', all.length, 'questions', all.reduce((a,t)=>a+t.qs.length,0), 'fails', fails);
