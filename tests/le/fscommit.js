'use strict';
// Låtsas-Firestore i testerna: appen skriver barnprofiler villkorat via documents:commit (förvillkoret i JSON-kroppen, 3.2.2).
// withCommit(h) låter en befintlig låtsasserver (som förstår PATCH + currentDocument.* i adressen) svara på samma skrivning,
// med Firestores svarsform för commit ({ writeResults: [{ updateTime }], commitTime }). Inget annat ändras.
function commitAsPatch(url, opts) {
  const body = JSON.parse(opts.body); const w = (body.writes || [])[0] || {}; const name = String((w.update && w.update.name) || '');
  const path = name.split('/documents/')[1] || ''; const base = String(url).split('/documents:commit')[0];
  const qs = String(url).split('?')[1] || ''; let q = '?' + (qs || 'x=1'); const cd = w.currentDocument || {};
  if (cd.exists === false) q += '&currentDocument.exists=false'; else if (cd.exists === true) q += '&currentDocument.exists=true'; else if (cd.updateTime) q += '&currentDocument.updateTime=' + encodeURIComponent(cd.updateTime);
  return { url: base + '/documents/' + path + q, opts: { ...opts, method: 'PATCH', body: JSON.stringify({ fields: (w.update && w.update.fields) || {} }) } };
}
function withCommit(h) {
  return async (url, opts = {}) => {
    if (!String(url).includes('/documents:commit')) return h(url, opts);
    const t = commitAsPatch(url, opts); const r = await h(t.url, t.opts); if (!r || !r.ok) return r;
    let d = null; try { d = await r.json(); } catch (e) { /* inget */ }
    return { ok: true, status: 200, json: async () => ({ writeResults: [{ updateTime: d && d.updateTime }], commitTime: d && d.updateTime }) };
  };
}
module.exports = { withCommit, commitAsPatch };
