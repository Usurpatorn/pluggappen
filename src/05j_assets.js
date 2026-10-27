/* ========= 3.5 Privata bilder (familjens egna, t.ex. karttecken från lärarens material) =========
   Bilderna ligger ALDRIG i appen, repot, bygget eller CI – bara i familjens privata lagring:
     families/{familj}/assets/{rev}   rev = sha256 av bildens byte (64 hex). Dokumentet: { b64, mime, bytes, w, h }.
   Läsning kräver att enheten är medlem i familjen (Firestore-reglerna, samma som profilerna). Ingen offentlig länk finns.
   Skrivs bara av servicekontot via scripts/content.mjs assets (oföränderliga revisioner: samma rev = samma byte).
   _content.assets är manifestet: [{ id: "paket/namn", rev, mime, w, h, bytes }]. Innehållet hänvisar bara till id:n – aldrig HTML.
   Varje bild kontrolleras i appen innan den visas: typ (magiska byte), storlek, upplösning ur bildens huvud, sha256 = rev.
   En uppgift som behöver en bild visas bara när ALLA dess bilder är kontrollerade – annars inte alls (blir aldrig en ren textuppgift).
   Cache: i minnet och i localStorage, knuten till familjen (töms vid familjebyte, borttagen familj och när enheten kopplas bort).
   En kopia som redan finns på en enhet kan inte raderas på distans – därför bara små bilder som familjen själv har valt. */
const ASSETS = {
  KEY: 'pluggappen.assets.v1',
  MIME: { 'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/jpeg': [0xff, 0xd8, 0xff] },
  MAX_BYTES: 200000, MAX_DIM: 1024, MAX_COUNT: 200, CACHE_MAX: 1500000,
  ID_RE: /^[a-z0-9-]{2,48}\/[a-z0-9-]{1,48}$/, REV_RE: /^[0-9a-f]{64}$/,
  man: {},          // id → { id, rev, mime, w, h, bytes } (från _content.assets, tvättat)
  ok: {},           // rev → data-URL (kontrollerad)
  bad: {},          // rev → orsak (saknas, fel typ, fel storlek, fel kontrollsumma …)
  ver: 0,           // ändras när en bild blir klar → uppgiftscachen byggs om
  busy: null,
  // Manifestet ur _content (FAMILY.cleanContent anropar). Felaktiga poster tas bort en och en – resten fungerar.
  clean(list) {
    const out = []; const seen = new Set();
    for (const a of (Array.isArray(list) ? list : []).slice(0, ASSETS.MAX_COUNT)) {
      if (!a || typeof a !== 'object') continue; const id = String(a.id || ''), rev = String(a.rev || '');
      const w = Number(a.w), h = Number(a.h), bytes = Number(a.bytes);
      if (!ASSETS.ID_RE.test(id) || !ASSETS.REV_RE.test(rev) || !ASSETS.MIME[a.mime] || seen.has(id)) continue;
      if (!(Number.isInteger(w) && w >= 1 && w <= ASSETS.MAX_DIM && Number.isInteger(h) && h >= 1 && h <= ASSETS.MAX_DIM && Number.isInteger(bytes) && bytes >= 16 && bytes <= ASSETS.MAX_BYTES)) continue;
      seen.add(id); out.push({ id, rev, mime: a.mime, w, h, bytes });
    }
    return out;
  },
  setManifest(list) { ASSETS.man = {}; for (const a of list || []) ASSETS.man[a.id] = a; ASSETS.ver++; },
  ready(id) { const a = ASSETS.man[id]; return !!(a && ASSETS.ok[a.rev]); },
  allReady(ids) { return Array.isArray(ids) && ids.length > 0 && ids.every(ASSETS.ready); },
  url(id) { const a = ASSETS.man[id]; return a ? ASSETS.ok[a.rev] || null : null; },
  famId() { return typeof FAMILY !== 'undefined' ? FAMILY.famId() : ''; },
  /* ---------- kontroll av bildens byte ---------- */
  b64bytes(b64) { const s = atob(String(b64)); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
  dims(u, mime) {
    if (mime === 'image/png') { if (u.length < 24 || String.fromCharCode(u[12], u[13], u[14], u[15]) !== 'IHDR') return null; const r = (o) => ((u[o] << 24) >>> 0) + (u[o + 1] << 16) + (u[o + 2] << 8) + u[o + 3]; return { w: r(16), h: r(20) }; }
    if (mime === 'image/jpeg') { let i = 2; while (i + 9 < u.length) { if (u[i] !== 0xff) return null; const m = u[i + 1]; const len = (u[i + 2] << 8) + u[i + 3]; if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { h: (u[i + 5] << 8) + u[i + 6], w: (u[i + 7] << 8) + u[i + 8] }; if (len < 2) return null; i += 2 + len; } return null; }
    return null;
  },
  sha256(u) {   // liten, beroendefri SHA-256 (samma resultat i alla webbläsare och i testerna)
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const l = u.length; const n = ((l + 9 + 63) >> 6) << 6; const m = new Uint8Array(n); m.set(u); m[l] = 0x80; const bits = l * 8; for (let i = 0; i < 8; i++) m[n - 1 - i] = Math.floor(bits / 2 ** (8 * i)) & 0xff;
    const W = new Uint32Array(64); const rr = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) { const s0 = rr(W[i - 15], 7) ^ rr(W[i - 15], 18) ^ (W[i - 15] >>> 3); const s1 = rr(W[i - 2], 17) ^ rr(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) { const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0; const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  },
  // Kontrollerar en hämtad bild mot manifestet. Returnerar null (godkänd) eller orsaken.
  verify(a, b64) {
    if (typeof b64 !== 'string' || !b64 || b64.length > Math.ceil(ASSETS.MAX_BYTES / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return 'ogiltig kodning';
    let u; try { u = ASSETS.b64bytes(b64); } catch (e) { return 'ogiltig kodning'; }
    if (u.length !== a.bytes || u.length > ASSETS.MAX_BYTES) return 'fel storlek';
    const magic = ASSETS.MIME[a.mime]; if (!magic || !magic.every((x, i) => u[i] === x)) return 'fel bildtyp';
    const d = ASSETS.dims(u, a.mime); if (!d || d.w !== a.w || d.h !== a.h || d.w > ASSETS.MAX_DIM || d.h > ASSETS.MAX_DIM || d.w < 1 || d.h < 1) return 'fel upplösning';
    if (ASSETS.sha256(u) !== a.rev) return 'fel kontrollsumma';
    return null;
  },
  accept(a, b64) { const why = ASSETS.verify(a, b64); if (why) { ASSETS.bad[a.rev] = why; delete ASSETS.ok[a.rev]; return false; } ASSETS.ok[a.rev] = `data:${a.mime};base64,${b64}`; delete ASSETS.bad[a.rev]; return true; },
  /* ---------- cache (per familj) ---------- */
  loadLocal() {
    try { const raw = localStorage.getItem(ASSETS.KEY); if (!raw) return; const c = JSON.parse(raw); if (!c || c.fam !== ASSETS.famId() || !c.fam) { ASSETS.clearLocal(); return; }
      let n = 0; for (const a of Object.values(ASSETS.man)) { const b64 = c.items && c.items[a.rev]; if (b64 && !ASSETS.ok[a.rev] && ASSETS.accept(a, b64)) n++; } if (n) ASSETS.ver++;
    } catch (e) { /* ignore */ }
  },
  saveLocal() {
    try { const items = {}; let size = 0; for (const a of Object.values(ASSETS.man)) { const u = ASSETS.ok[a.rev]; if (!u) continue; const b64 = u.slice(u.indexOf(',') + 1); if (size + b64.length > ASSETS.CACHE_MAX) break; items[a.rev] = b64; size += b64.length; }
      if (!Object.keys(items).length) { localStorage.removeItem(ASSETS.KEY); return; } localStorage.setItem(ASSETS.KEY, JSON.stringify({ fam: ASSETS.famId(), items })); } catch (e) { /* ignore */ }
  },
  clearLocal() { ASSETS.ok = {}; ASSETS.bad = {}; ASSETS.ver++; try { localStorage.removeItem(ASSETS.KEY); } catch (e) { /* ignore */ } },
  /* ---------- hämtning (bara inloggad medlem; reglerna nekar alla andra) ---------- */
  docUrl(rev) { return `https://firestore.googleapis.com/v1/projects/${SYNC.cfg.projectId}/databases/(default)/documents/families/${encodeURIComponent(SYNC.family)}/assets/${rev}?key=${SYNC.cfg.apiKey}`; },
  async pull() {
    if (ASSETS.busy) return ASSETS.busy;
    ASSETS.busy = (async () => {
      let added = 0;
      try {
        if (typeof SYNC === 'undefined' || !SYNC.active || !SYNC.cfg) return 0;
        for (const a of Object.values(ASSETS.man)) {
          if (ASSETS.ok[a.rev]) continue;
          try { const r = await SYNC.fetch(ASSETS.docUrl(a.rev), { cache: 'no-store' }); if (r.status === 404) { ASSETS.bad[a.rev] = 'saknas'; continue; } if (!r.ok) continue;
            const d = await r.json(); const b64 = d && d.fields && d.fields.b64 && d.fields.b64.stringValue; if (ASSETS.accept(a, b64)) added++; } catch (e) { /* offline – försök igen senare */ }
        }
        if (added) { ASSETS.ver++; ASSETS.saveLocal(); }
      } finally { ASSETS.busy = null; }
      return added;
    })();
    return ASSETS.busy;
  },
  /* ---------- visning: bara via DOM, aldrig HTML från innehållet ---------- */
  // Platshållare som koden (inte innehållet) skriver: <span class="vimg" data-asset="paket/namn" data-alt="…">. id:t är kontrollerat.
  slot(id, alt) { return ASSETS.ID_RE.test(id) ? `<span class="vimg" data-asset="${id}" data-alt="${String(alt || 'Bild').replace(/[<>"&]/g, '')}"></span>` : ''; },
  hydrate(root) {
    try { for (const el of (root || document).querySelectorAll('span.vimg[data-asset]')) { if (el.firstChild) continue; const id = el.getAttribute('data-asset'); const u = ASSETS.ID_RE.test(id) ? ASSETS.url(id) : null;
      if (!u) { el.classList.add('vimg-missing'); el.textContent = 'Bilden kunde inte visas'; continue; }
      const img = document.createElement('img'); img.src = u; img.alt = el.getAttribute('data-alt') || 'Bild'; img.decoding = 'async'; img.draggable = false; const a = ASSETS.man[id]; if (a) { img.width = a.w; img.height = a.h; } el.appendChild(img); } } catch (e) { /* ignore */ }
  },
};
