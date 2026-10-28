/* ========= Push reminders (self-hosted build only; needs service worker + VAPID public key + sync) ========= */
const PUSH = {
  key: typeof window !== 'undefined' ? window.PLUGG_PUSH_KEY || null : null,
  supported() { return !!(PUSH.key && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window); },
  needsInstall() { return typeof navigator !== 'undefined' && /iPhone|iPad/.test(navigator.userAgent) && !(window.navigator.standalone || matchMedia('(display-mode: standalone)').matches); },
  current() { return DB.settings.push || null; },
  lastStatus: null, statusTried: false,
  async loadStatus() { if (!SYNC.active) return; try { const r = await SYNC.fetch(SYNC.url('push_log'), { cache: 'no-store' }); if (!r.ok) return; const doc = await r.json(); PUSH.lastStatus = JSON.parse(doc.fields?.json?.stringValue || 'null'); } catch (e) { /* ignore */ } },
  urlB64(b64) { const pad = '='.repeat((4 - b64.length % 4) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); },
  async enable(kidId) {
    if (!PUSH.supported() || !SYNC.active) return { ok: false, msg: 'Påminnelser kräver att synk är på och att appen ligger på hemskärmen.' };
    try {
      const perm = await Notification.requestPermission(); if (perm !== 'granted') return { ok: false, msg: 'Du sa nej till notiser. Ändra under Inställningar → Notiser om du ångrar dig.' };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: PUSH.urlB64(PUSH.key) });
      const id = 'push_' + btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(-24);
      const body = { fields: { json: { stringValue: JSON.stringify({ sub: sub.toJSON(), kid: kidId, device: navigator.userAgent.slice(0, 80), createdAt: Date.now() }) }, updatedAt: { integerValue: String(Date.now()) }, kid: { stringValue: kidId } } };
      const r = await SYNC.fetch(SYNC.url(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      DB.settings.push = { id, kid: kidId }; try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ }
      return { ok: true };
    } catch (e) { return { ok: false, msg: 'Det gick inte att slå på: ' + e.message }; }
  },
  async disable() {
    const cur = PUSH.current(); if (!cur) return;
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) { /* ignore */ }
    try { await SYNC.fetch(SYNC.url(cur.id), { method: 'DELETE' }); } catch (e) { /* ignore */ }
    DB.settings.push = null; try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ }
  },
  card(kidId, who) {
    if (!PUSH.key || !SYNC.cfg) return '';
    const cur = PUSH.current(); const on = cur && cur.kid === kidId;
    const text = who === 'parent' ? 'Få ett meddelande om något barn inte övat på tre dagar.' : 'En tyst påminnelse kl 18.30 på vardagar, och kl 20 om streaken är i fara. Bara på den här enheten.';
    if (!PUSH.supported()) return `<div class="card stack" style="gap:6px"><div class="eyebrow">Påminnelser</div><p class="muted" style="font-size:.95rem">${PUSH.needsInstall() ? 'Lägg till appen på hemskärmen (dela-knappen i Safari → Lägg till på hemskärmen) så kan den skicka påminnelser.' : 'Den här webbläsaren stöder inte påminnelser.'}</p></div>`;
    const st = PUSH.lastStatus; const stTxt = st ? `Senaste körning ${new Date(st.at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}: ${st.ok ? `${st.sent} skickade till ${st.subs} enheter` : 'misslyckades'}${st.log && st.log.length ? ` · ${esc(st.log[st.log.length - 1]).slice(0, 140)}` : ''}` : 'Ingen körning registrerad ännu.';
    return `<div class="card stack" style="gap:8px"><div class="toggle"><div><div class="tl">Påminnelser</div><div class="td">${text}</div></div><button class="switch ${on ? 'on' : ''}" data-push="${kidId}" aria-label="Påminnelser"></button></div>${who === 'parent' && stTxt ? `<p class="muted" style="font-size:.85rem">${stTxt}</p>` : ''}${cur && cur.kid !== kidId ? `<p class="muted" style="font-size:.85rem">Den här enheten påminner just nu ${cur.kid === 'parent' ? 'föräldern' : (kidById(cur.kid)?.name || cur.kid)}. Slå på här för att byta.</p>` : ''}</div>`;
  },
};
