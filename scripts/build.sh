#!/usr/bin/env bash
# Reproducerbart bygge: src/* → dist/index.html (publicerad app), dist/pluggappen.html (fristående variant utan moln),
# dist/bundle.js (bara JS, för syntaxkontroll). Samma källor + samma VERSION + samma BUILD_SHA ger byte-identisk utdata.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"; DIST="$ROOT/dist"; mkdir -p "$DIST"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
# Bygg-id = innehållshash av källorna (inte commit-sha), så att samma källor alltid ger samma bundle oavsett commit.
# Inbyggda Concept Packs (content/packs/*.json, sorterade) ingår i bygget och i hashen.
PACKS_DIR="$ROOT/content/packs"; PACK_FILES="$(cd "$PACKS_DIR" 2>/dev/null && LC_ALL=C ls -1 *.json 2>/dev/null || true)"
SHA="${BUILD_SHA:-$( { cat "$SRC"/*.js "$SRC"/*.html "$ROOT/VERSION" "$ROOT/sw.js"; for f in $PACK_FILES; do cat "$PACKS_DIR/$f"; done; } | sha256sum | cut -c1-7)}"
BUILD_ID="v${VERSION} (${SHA})"
# Ordningen spelar roll: hjälpfunktioner → innehåll → synk/familj/auth/push → appkärnan sist.
JS="01_math.js 02_content.js 02b_lang.js 02c_so.js 02d_kemi.js 02e_open.js 02g_visual.js 02f_math_more.js 02h_svenska.js 02i_naso.js 02j_math_ak2.js 02k_math_ak2_v2.js 04_sync.js 04a_family.js 04b_auth.js 05_push.js 05a_concepts.js 05d_packs.js 05b_engine2.js 05e_runner.js 05c_shadow.js 05f_content2.js 05h_experience.js 05g_v2app.js 05i_testmode.js 05j_assets.js 03_app.js"
cd "$SRC"
for f in $JS 00_head.html 00b_style.html 99_body.html; do [ -f "$f" ] || { echo "saknar $f" >&2; exit 1; }; done
pack_data() { local pf; echo "const PACK_DATA = ["; for pf in $PACK_FILES; do cat "$PACKS_DIR/$pf"; echo ","; done; echo "];"; }
js_bundle() { for f in $JS; do [ "$f" = "05d_packs.js" ] && pack_data; grep -v "module.exports" "$f"; echo; done; }

# Fristående variant (ingen molnkoppling) – används av testerna
{ cat 00_head.html 00b_style.html 99_body.html; echo "<script>window.PLUGG_BUILD = '$BUILD_ID';</script>"; echo '<script>'; js_bundle; echo '</script>'; } > "$DIST/pluggappen.html"

# Publicerad app: komplett dokument + molnkonfiguration (publika nycklar) + service worker
{
  echo '<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="theme-color" content="#fbfaf6"><meta name="apple-mobile-web-app-title" content="Pluggapp"><link rel="apple-touch-icon" href="icon-v2.png"><link rel="icon" href="icon-v2.png"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
  echo "<script>window.PLUGG_BUILD = '$BUILD_ID';</script>"
  # Den riktiga appen startar aldrig på testadressen (t.ex. ur en offline-kopia): där skulle föräldern tro att det var ett test
  echo '<script>if (/\/preview\//.test(location.pathname)) { window.PLUGG_STOP = true; document.addEventListener("DOMContentLoaded", function () { document.body.innerHTML = "<p style=\"font:16px system-ui;padding:24px\">Testversionen behöver nät. Försök igen när enheten är online.</p>"; }); }</script>'
  # Testa som barnet i föräldraläget (src/05i_testmode.js): lagringen kan slås om till en kopia i minnet (__tmBegin, för resten av sidans
  # liv – avsluta = ladda om) och nätverksskyddet nekar alla skrivningar när testet pågår (window.__PV_TM, går inte att slå av).
  # Utan test: exakt som förut (samma nycklar, samma nätverk). Fryst objekt; fetch går alltid genom skyddet.
  echo '<script>const localStorage = (function () { var s = null; try { s = window.localStorage; } catch (e) { s = null; } var ov = null; return Object.freeze({ getItem: function (k) { if (ov) { if (ov.has(k)) return ov.get(k); } try { return s ? s.getItem(k) : null; } catch (e) { return null; } }, setItem: function (k, v) { if (ov) { ov.set(k, String(v)); return; } if (s) s.setItem(k, v); }, removeItem: function (k) { if (ov) { ov.set(k, null); return; } try { if (s) s.removeItem(k); } catch (e) { /* ignore */ } }, __tmBegin: function () { if (!ov) ov = new Map(); return true; }, get __tmOn() { return !!ov; }, __realDump: function () { var o = {}; if (!s) return o; for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf("pluggappen-preview:") !== 0) o[k] = s.getItem(k); } return o; } }); })();</script>'
  echo '<script>(function () { var f = window.fetch; window.__PV_BLOCKED = 0; var g = function (u, o) { var m = String((o && o.method) || (u && typeof u === "object" && u.method) || "GET").toUpperCase(); if (m !== "GET" && m !== "HEAD" && window.__PV_TM === true) { window.__PV_BLOCKED++; return Promise.reject(new TypeError("testläget skickar inget")); } if (typeof f !== "function") return Promise.reject(new TypeError("fetch saknas")); return f.apply(this, arguments); }; try { Object.defineProperty(window, "fetch", { configurable: false, get: function () { return g; }, set: function (v) { if (typeof v === "function" && v !== g) f = v; } }); window.__TM_GUARD = window.fetch === g; } catch (e) { window.__TM_GUARD = false; } })();</script>'
  echo '<script>window.PLUGG_SYNC = window.PLUGG_SYNC || { projectId: "pluggappen", apiKey: "AIzaSyBexTJ4xs1dL0EytcH2N74pY84PuJQZVYQ" }; if (window.PLUGG_SYNC.projectId.startsWith("__")) window.PLUGG_SYNC = null; window.PLUGG_PUSH_KEY = "BPB-A8j28EB8I1cdEMseKa05bLaVDXnDpe9PBbTjekO6ReD_I2hKjJfQnuS1HkoBr8RafRaqWf2sWuQdghiXQX0"; if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); }); }</script>'
  cat 00_head.html 00b_style.html 99_body.html; echo '<script>'; js_bundle; echo '</script></body></html>'
} > "$DIST/index.html"

js_bundle > "$DIST/bundle.js"
# Testadress för en förhandsversion (PREVIEW=1, bara i deploy-jobbet): dist/preview/index.html. Samma kod och samma inbyggda innehåll –
# inget familjeinnehåll byggs in (det kommer bara via den vanliga inloggade synken). Skillnader mot den publicerade appen:
# egen lagring (prefix, så att produktionens data på samma enhet aldrig rörs), ingen service worker, inga push-påminnelser,
# och bygg-id:t säger att det är en testversion. Produktionens service worker kan råka spara testsidan som sin offline-kopia:
# testsidan lägger då tillbaka produktionens sida i cachen (direkt, efter 3 och 15 s och när sidan visas igen), och visas den ändå på fel
# adress startar den inte. Går lagringen inte att hålla skild (skuggningen misslyckas i webbläsaren) startar testsidan inte alls.
if [ "${PREVIEW:-}" = "1" ]; then
  mkdir -p "$DIST/preview"
  {
    echo '<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><meta name="theme-color" content="#fbfaf6"><link rel="icon" href="../icon-v2.png"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style><title>Pluggapp (testversion)</title></head><body>'
    echo "<script>window.PLUGG_BUILD = '$BUILD_ID · testversion'; window.PLUGG_PREVIEW = true;</script>"
    # Lagringen: prefix. "Testa som barnet" (src/05i_testmode.js) slår om den till en kopia i minnet med __tmBegin – för resten av
    # sidans liv (det finns ingen väg tillbaka; avsluta = ladda om). Objektet är fryst: appen kan inte byta ut metoderna.
    echo '<script>const localStorage = (function () { var s = null; try { s = window.localStorage; } catch (e) { s = null; } var P = "pluggappen-preview:"; var ov = null; window.__PV_LS = true; return Object.freeze({ getItem: function (k) { if (ov) { if (ov.has(k)) return ov.get(k); } try { return s ? s.getItem(P + k) : null; } catch (e) { return null; } }, setItem: function (k, v) { if (ov) { ov.set(k, String(v)); return; } if (s) s.setItem(P + k, v); }, removeItem: function (k) { if (ov) { ov.set(k, null); return; } try { if (s) s.removeItem(P + k); } catch (e) { /* ignore */ } }, __tmBegin: function () { if (!ov) ov = new Map(); return true; }, get __tmOn() { return !!ov; }, __realDump: function () { var o = {}; if (!s) return o; for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf(P) === 0) o[k] = s.getItem(k); } return o; } }); })();</script>'
    # Nätverksskyddet: testadressen skriver aldrig barnens data (families/…/profiles/…), raderar aldrig något och byter aldrig
    # parkopplingskod eller roller (bara enhetens egen parkoppling går igenom; familjens meta/info svarar som "finns redan" – 403 – så att
    # parkopplingen fortsätter utan att någonsin skriva om koden). Under "Testa som barnet" (window.__PV_TM, går inte att
    # slå av) skickas inga skrivningar alls. Gäller allt som går via fetch – appen använder inget annat.
    echo '<script>(function () { var f = window.fetch; window.__PV_BLOCKED = 0; if (typeof f !== "function") { window.__PV_GUARD = true; return; } var RX = /\/documents\/families\/[^\/?]+\/profiles(\/|\?|$)/; var g = function (u, o) { var m = String((o && o.method) || (u && typeof u === "object" && u.method) || "GET").toUpperCase(); var url = String((u && typeof u === "object" && u.url) || u); if (m !== "GET" && m !== "HEAD" && window.__PV_TM !== true && /\/meta\/info/.test(url)) { window.__PV_BLOCKED++; return Promise.resolve({ ok: false, status: 403, json: function () { return Promise.resolve({}); } }); } if (m !== "GET" && m !== "HEAD" && (window.__PV_TM === true || RX.test(url) || /\/documents:(commit|batchWrite|beginTransaction)\b/.test(url) || m === "DELETE" || /updateMask\.fieldPaths=(joinCode|role)/.test(url))) { window.__PV_BLOCKED++; return Promise.reject(new TypeError("testversionen skriver inte barnens data")); } return f.apply(this, arguments); }; try { Object.defineProperty(window, "fetch", { value: g, writable: false, configurable: false }); window.__PV_GUARD = window.fetch === g; } catch (e) { window.__PV_GUARD = false; } })();</script>'
    echo '<script>window.PLUGG_SYNC = { projectId: "pluggappen", apiKey: "AIzaSyBexTJ4xs1dL0EytcH2N74pY84PuJQZVYQ" }; window.PLUGG_PUSH_KEY = null;'
    echo 'var PV_STOP = function (msg) { window.PLUGG_STOP = true; document.addEventListener("DOMContentLoaded", function () { document.body.innerHTML = "<p style=\"font:16px system-ui;padding:24px\">" + msg + "</p>"; }); };'
    echo 'if (!window.__PV_LS || !window.__PV_GUARD || typeof localStorage === "undefined" || localStorage === window.localStorage) PV_STOP("Testversionen kan inte hålla sin data skild från appen i den här webbläsaren, så den startar inte. Använd den vanliga appen.");'
    echo 'else if (!/\/preview\/(index\.html)?$/.test(location.pathname)) PV_STOP("Öppna Pluggappen igen när enheten är online.");'
    echo 'if (!window.PLUGG_STOP && window.caches) { var PV_FIX = function () { if (navigator.onLine === false) return; var prod = new URL("../index.html", location.href).href; caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.open(k).then(function (c) { return c.match(prod).then(function (r) { if (!r) return; return r.clone().text().then(function (t) { if (t.indexOf("PLUGG_PREVIEW") < 0) return; return fetch(prod, { cache: "no-store" }).then(function (f) { if (f.ok) return c.put(prod, f); }); }); }); }); })); }).catch(function () {}); }; window.addEventListener("load", function () { PV_FIX(); setTimeout(PV_FIX, 3000); setTimeout(PV_FIX, 15000); }); document.addEventListener("visibilitychange", function () { if (!document.hidden) PV_FIX(); }); }</script>'
    cat 00_head.html 00b_style.html 99_body.html; echo '<script>'; js_bundle; echo '</script></body></html>'
  } > "$DIST/preview/index.html"
  echo "PREVIEW OK  $BUILD_ID · testversion  $(wc -c < "$DIST/preview/index.html") bytes"
fi
node --check "$DIST/bundle.js"
# Statiska filer som följer med till publiceringen
cp "$ROOT/sw.js" "$ROOT/icon.png" "$ROOT/icon-v2.png" "$DIST/"; touch "$DIST/.nojekyll"
echo "BUILD OK  $BUILD_ID  $(wc -c < "$DIST/index.html") bytes  sha256 $(sha256sum "$DIST/index.html" | cut -c1-16)"
