/* ========= Konceptkatalog (Fas 3B) =========
   Stabila koncept-id:n för allt befintligt innehåll. 3B-granularitet: ett koncept per moment (skill) och ett per glosdeck.
   - Moment:  "s:<skillId>"  – skill-id:n är redan stabila i kursmallarna (02_content.js m.fl.).
   - Glosor:  "d:<deckId>"   – vokabulär följer Leitner oförändrat; konceptet används bara för planering/jämförelse.
   - Uppgift: "i<hash>"      – stabil fingeravtryck av frågans typ + text (ingen svarstext, inga personuppgifter).
   Finare fasetter (t.ex. tiotalsövergång inom plus20) och begreppstaggar i faktabankerna kommer i 3E. */
const LECAT = (() => {
  const SUBJECT = { math: 'Matte', sv: 'Svenska', en: 'Engelska', no: 'NO', so: 'SO', lang: 'Språk' };
  const skillCid = (skillId) => 's:' + skillId;
  const deckCid = (deckId) => 'd:' + deckId;
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
  // 3E: rätt svar ingår (ingen svarstext från barnet) – annars får t.ex. alla rättstavningsuppgifter ("Vilket ord är rätt stavat?") samma id.
  const ansKey = (q) => { const a = q.type === 'choicetext' && Array.isArray(q.choices) ? q.choices[q.answer] : Array.isArray(q.answer) ? q.answer[0] : q.answer && typeof q.answer === 'object' ? 'h' + fnv(Object.keys(q.answer).sort().map(k => k + '\u0001' + q.answer[k]).join('\u0002')) : q.answer; return a == null ? '' : String(a).slice(0, 60); };   // v3: objektsvar (sortera/para ihop) hashas i sin helhet – finns bara i v3, så inga gamla id ändras
  const itemId = (q) => 'i' + fnv(String(q.type || (q.choices ? 'mc' : 'q')) + '|' + String(q.text || q.prompt || '').replace(/\s+/g, ' ').trim() + '|' + ansKey(q));
  // Vilka moment har garanterat egen-svar-format (inte bara flerval)? Matte: ja. Övriga: om öppna frågor finns; annars avgör observerade svar.
  const recallOf = (s, openBank) => (s.group || 'math') === 'math' ? true : (openBank && openBank[s.id] && openBank[s.id].length ? true : null);
  /* Bygg katalogen för ett barn: moment från kursmallen (+ tilläggsmoment) och de glosdeck barnet har. Ren funktion. */
  /* 2.1: ett moment med Concept Pack får kunskapspunkter ("k:<paket>/<punkt>") som motorn följer. Själva momentkonceptet ligger kvar
     men vilar (active: false): gamla bevis på det leds vidare till rätt kunskapspunkt via route (frågans id → punkt), resten ligger kvar
     läsbart. Nya moment som bara finns i paket (kid.v2skills) får samma behandling. polName styr vilka frågeformer som finns. */
  function build(kid, decks, openBank, polName) {
    const cat = {}; const map = {}; const kpsOf = {};
    const P = typeof PACKS !== 'undefined' ? PACKS : null;
    for (const s of [...(kid.skills || []), ...(kid.v2skills || [])]) {
      const id = skillCid(s.id); if (cat[id]) continue;
      cat[id] = { id, kind: 'skill', ref: s.id, name: s.short || s.name, full: s.name, subject: s.group || 'math', maxLvl: s.maxLvl || 3, recall: recallOf(s, openBank), focus: !!s.focus || (kid.focusSkills || []).includes(s.id), prereq: [] };
      map[s.id] = id;
      const pk = P ? P.catalogEntries(kid, s, polName, itemId) : null;
      if (pk) { Object.assign(cat, pk.kps); cat[id].active = false; cat[id].route = pk.route; cat[id].packed = 1; kpsOf[s.id] = Object.keys(pk.kps); }
      else if (s.v2only) cat[id].active = false;
    }
    for (const d of decks || []) { const id = deckCid(d.id); if (cat[id]) continue; cat[id] = { id, kind: 'deck', ref: d.id, name: d.name, subject: 'lang', maxLvl: 1, recall: null, focus: false, prereq: [] }; }
    return { cat, map, kpsOf };
  }
  // Vilket koncept prövar en v1-uppgift i ett pass?
  function cidOfItem(item) {
    if (!item) return null;
    if (item.cat === 'math' && item.skill) return skillCid(item.skill.id);
    if (item.cat === 'word' && item.deck) return deckCid(item.deck.id);
    return null;
  }
  return { SUBJECT, skillCid, deckCid, itemId, build, cidOfItem, fnv };
})();
if (typeof module !== 'undefined') module.exports = LECAT;
