const { Poly, R, T } = require('../src/01_math.js'); global.Poly=Poly; global.R=R; global.T=T;
global.window = undefined;
const L = require('../src/02b_lang.js');
let fails=0; const fail=(m)=>{fails++; console.log('FAIL',m);};
const p = { words: {} };
for (const deck of L.BUILTIN_DECKS) {
  const ids = new Set(); for (const w of deck.words) { if (ids.has(w.id)) fail('dup id '+w.id); ids.add(w.id); if (!w.w||!w.t) fail('empty word in '+deck.id); }
  const ws = deck.words.map(w=>L.normWord(w.w)); if (new Set(ws).size!==ws.length) fail('dup foreign in '+deck.id+': '+ws.filter((x,i)=>ws.indexOf(x)!==i));
  const ts = deck.words.map(w=>L.normWord(w.t)); if (new Set(ts).size!==ts.length) console.log('note: dup swedish in',deck.id, ts.filter((x,i)=>ts.indexOf(x)!==i));
  // lesson progression: run 6 lessons answering correctly
  const pp = { words: {} };
  for (let round=0; round<6; round++) {
    const lesson = L.buildLesson(pp, deck, 10);
    if (!lesson.length) fail('empty lesson '+deck.id);
    for (const ex of lesson) {
      if (ex.kind==='intro') continue;
      if (ex.kind==='match') { if (ex.pairs.length!==5) fail('match pairs'); continue; }
      if (ex.kind==='pick'||ex.kind==='listen') { if (ex.choices.length<2) fail('few choices '+deck.id); if (!ex.choices.some(c=>c.id===ex.correctId)) fail('no correct'); const labels=ex.choices.map(c=>L.normWord(c.label)); if (new Set(labels).size!==labels.length) fail('dup labels '+deck.id+' '+labels); }
      if (ex.kind==='spell') { const r=L.checkWordAnswer(ex, ex.target); if (r.status!=='correct') fail('spell self '+ex.target); const letters=ex.tiles.map(t=>t.c).join(''); for (const ch of ex.target.replace(/\s/g,'')) if (!letters.includes(ch)) fail('missing tile '+ch+' '+ex.target); }
      if (ex.kind==='type') { if (L.checkWordAnswer(ex, ex.word.w).status!=='correct') fail('type self'); if (L.checkWordAnswer(ex, 'zzzzzz').status!=='wrong') fail('type wrong'); }
      L.recordWord(pp, ex.word.id, true);
    }
  }
  const pr = L.deckProgress(pp, deck); 
  if (pr.learned===0 && deck.words.length<=12) fail('nothing learned '+deck.id+' '+JSON.stringify(pr));
}
// accent leniency
const ex = L.makeWordExercise(L.BUILTIN_DECKS[0], L.BUILTIN_DECKS[0].words.find(w=>w.w==='adiós'), 'type');
console.log(L.checkWordAnswer(ex,'adios'), L.checkWordAnswer(ex,'Adiós'), L.checkWordAnswer(ex,'hola').status);
const ex2 = L.makeWordExercise(L.BUILTIN_DECKS[3], L.BUILTIN_DECKS[3].words[0], 'type'); // el perro
console.log('perro:', L.checkWordAnswer(ex2,'perro').status, L.checkWordAnswer(ex2,'el perro').status, L.checkWordAnswer(ex2,'el pero').status);
console.log('decks', L.BUILTIN_DECKS.length, 'words', L.BUILTIN_DECKS.reduce((a,d)=>a+d.words.length,0), 'fails', fails);
process.exit(fails?1:0);
