/* ========= Testa som barnet (bara på testadressen <sajten>/preview/) =========
   Föräldern provar appen exakt som ett barn – barnets upplevelse, innehåll, prov, motorläge och plan – utan att något blir riktig data.
   Två skydd som båda måste hålla:
   1. Testadressen (scripts/build.sh): egen lagring med prefix, och ett nätverksskydd som aldrig låter testadressen skriva barnens data
      (families/<familj>/profiles/…). Utanför testet är testadressens barnprofiler en spegel av familjens data: synken hämtar men laddar
      aldrig upp, och en lokalt ändrad kopia ersätts av den riktiga vid nästa hämtning.
   2. Testläget (här): börjar med att hämta barnets riktiga läge, sparar en ögonblicksbild av hela den lagrade datan och slår sedan om
      lagringen till en kopia i minnet (oåterkalleligt för sidan – ingen kod kan slå tillbaka). Under testet: ingen synk, inga
      nätverksskrivningar alls, egen enhetsmärkning av bevisen (~t). Avsluta, ladda om, stänga eller byta barn = sidan laddas om och
      kopian finns inte längre. Vid Avsluta jämförs den lagrade datan byte för byte med ögonblicksbilden före omladdningen.
   Går isoleringen inte att garantera startar testläget inte. Inget av detta finns i den vanliga appen (ingen knapp, start vägras). */
const TM = {
  on: null,   // { kidId, name, startedAt, exp } under testet
  before: null, lastNote: null,
  // Testadressen med lagring som kan slås om till minnet och ett nätverksskydd – annars finns testläget inte.
  available() { return typeof window !== 'undefined' && window.PLUGG_PREVIEW === true && window.__PV_LS === true && window.__PV_GUARD === true && typeof localStorage !== 'undefined' && typeof localStorage.__tmBegin === 'function' && typeof localStorage.__realDump === 'function'; },
  get preview() { return typeof window !== 'undefined' && window.PLUGG_PREVIEW === true && window.__PV_LS === true; },
  card(kid) {
    if (!TM.available()) return '';
    const cur = EXP.of ? EXP.of(kid) : null; const cn = cur && EXP.KINDS[cur] ? EXP.KINDS[cur].name : '';
    return `<div class="card stack tm-card" style="gap:10px;border:2px solid var(--warn)"><div class="eyebrow">Testläge</div>
      <div><b>Testa som ${esc(kid.name)}</b><div class="muted" style="font-size:.9rem">Börjar från ${esc(kid.name)}s riktiga läge just nu: upplevelse, plan, prov och innehåll. Inget du gör sparas eller synkas – allt försvinner när du avslutar.</div></div>
      <button class="btn big wide" data-tm="start" data-kid-id="${esc(kid.id)}">Testa som ${esc(kid.name)}${cn ? ` · ${esc(cn)}` : ''}</button>
      <details class="more-fold"><summary>Testa med en annan upplevelse</summary><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:8px">${['explore', 'grow', 'achieve', 'classic'].filter(x => EXP.KINDS[x] && x !== cur).map(x => `<button class="btn ghost" data-tm="start" data-kid-id="${esc(kid.id)}" data-exp="${x}">${esc(EXP.KINDS[x].name)}</button>`).join('')}</div><div class="muted" style="font-size:.85rem;margin-top:6px">Gäller bara testet. ${esc(kid.name)}s riktiga val ändras inte.</div></details>
      <div id="tmMsg" class="muted" style="font-size:.9rem" role="status"></div></div>`;
  },
  msg(t) { const el = document.getElementById('tmMsg'); if (el) el.textContent = t; else toast(t); },
  // Barnets riktiga läge just nu: hämtas från familjens data (spegel). Utan nät: bara en orörd spegel från tidigare får användas.
  async freshReal(kidId) {
    const p = prof(kidId); if (!p) return { ok: false, why: 'Barnet finns inte på den här enheten.' };
    if (!SYNC.active) return { ok: false, why: 'Testversionen är inte kopplad till familjen. Koppla den i föräldraläget först.' };
    const remote = await SYNC.pull(kidId);
    if (remote) { SYNC.mirror(kidId, remote); flushSave(); return { ok: true, at: Date.now() }; }
    if (SYNC.status === 'ok') return { ok: true, at: Date.now(), none: true };   // finns inget i familjens data ännu: det lokala (tomma) läget är det riktiga
    const clean = (p.updatedAt || 0) <= (p.syncedAt || 0) && (p.syncedAt || 0) > 0;
    return clean ? { ok: true, at: p.syncedAt, stale: true } : { ok: false, why: 'Kunde inte hämta det riktiga läget (nätet?). Försök igen.' };
  },
  async start(kidId, exp) {
    if (TM.on) return;
    const kid = kidById(kidId);
    if (!kid || !TM.available()) return TM.msg('Testläget finns bara på testadressen.');
    if (!parentUnlocked || state.screen !== 'parent') return TM.msg('Testläget startas från föräldraläget.');
    if (typeof V2 !== 'undefined' && V2.sandbox) V2.restoreSandbox();
    TM.msg('Hämtar ' + kid.name + 's riktiga läge…');
    try { await FAMILY.pullContent(); } catch (e) { /* skolinnehållet från förra hämtningen används */ }
    const fr = await TM.freshReal(kidId); if (!fr.ok) return TM.msg(fr.why);
    if (TM.on) return;
    clearTimeout(saveTimer); flushSave(); SYNC.pending.clear(); clearTimeout(SYNC.pushTimer);
    const before = localStorage.__realDump(); const realProfile = JSON.stringify(prof(kidId));
    // Från här: lagringen är en kopia i minnet (för resten av sidans liv) och nätverksskyddet nekar alla skrivningar.
    try { localStorage.__tmBegin(); Object.defineProperty(window, '__PV_TM', { value: true, writable: false, configurable: false }); } catch (e) { /* kontrolleras nedan */ }
    const probe = 'pluggappen.tm.probe'; let isolated = false;
    try { localStorage.setItem(probe, '1'); isolated = localStorage.__tmOn === true && window.__PV_TM === true && localStorage.getItem(probe) === '1' && !Object.prototype.hasOwnProperty.call(localStorage.__realDump(), 'pluggappen-preview:' + probe) && JSON.stringify(localStorage.__realDump()) === JSON.stringify(before); localStorage.removeItem(probe); } catch (e) { isolated = false; }
    if (!isolated) { TM.on = { kidId, name: kid.name, broken: true }; TM.render(); app.innerHTML = '<div class="card pad-lg stack"><h2>Testläget kunde inte starta</h2><p class="muted">Isoleringen gick inte att garantera i den här webbläsaren. Inget har sparats.</p><button class="btn" data-tm-exit>Tillbaka</button></div>'; return; }
    TM.before = before; TM.on = { kidId, name: kid.name, startedAt: Date.now(), exp: exp || null, stale: !!fr.stale, real: realProfile.length };
    if (exp && EXP.KINDS[exp]) { const p = prof(kidId); p.settings.exp = exp; p.settings.expAt = LE.now(); }   // bara i kopian
    LE.invalidate(kidId); if (typeof V2 !== 'undefined') delete V2.lastReasons[kidId];
    state.kid = kidId; state.subj = null; TM.render(); go('home');
  },
  // Förälderns markering, utanför barnets vy (ingen teknisk text i barnupplevelsen).
  render() {
    let bar = document.getElementById('tmBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'tmBar'; bar.className = 'tm-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Testläge'); document.body.insertBefore(bar, document.body.firstChild); bar.addEventListener('click', (e) => { if (e.target.closest('[data-tm-exit]')) TM.exit(); }); }
    bar.innerHTML = `<div class="tm-in"><div class="grow"><b>TESTLÄGE – inget sparas</b><span class="tm-who"> · som ${esc(TM.on.name)}${TM.on.stale ? ' (senast hämtade läget)' : ''}</span></div><button class="btn" data-tm-exit>Avsluta testläge</button></div>`;
  },
  // Avsluta: jämför den lagrade datan byte för byte med läget före testet, och ladda om sidan (kopian i minnet försvinner).
  exit() {
    if (!TM.on) return; let same = false;
    try { const now = localStorage.__realDump(); same = JSON.stringify(Object.keys(now).sort().map(k => [k, now[k]])) === JSON.stringify(Object.keys(TM.before || {}).sort().map(k => [k, TM.before[k]])); } catch (e) { same = false; }
    TM.leave(same ? 'tm1' : 'tm0');
  },
  leave(code) { try { location.replace(location.pathname + location.search + '#foralder-' + code); } catch (e) { /* ignore */ } TM.reload(); },
  reload() { try { location.reload(); } catch (e) { /* sidan kan inte laddas om: kopian ligger kvar i minnet och sparas ändå aldrig */ } },
  // Efter omladdningen: en rad till föräldern (ingen data bärs över – bara resultatet i adressens #).
  note(code) { TM.lastNote = code === 'tm1' ? 'Testläget är avslutat. Inget sparades, och barnets riktiga data är oförändrad (kontrollerad).' : code === 'tm0' ? 'Testläget är avslutat. Testet sparade inget, men den lagrade datan ändrades under testet – troligen av testversionen i en annan flik. Kontrollera barnets läge i den vanliga appen.' : null; },
};
// Sidan visas igen ur webbläsarens bakåt-cache (t.ex. Safari) mitt i ett test: avsluta i stället för att fortsätta med kopian.
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('pageshow', (e) => { if (e && e.persisted && TM.on) TM.exit(); });
if (typeof module !== 'undefined') module.exports = TM;
