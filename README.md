# Pluggapp

En lokal-först pluggapp för grundskolan: matte (åk 2, åk 4, åk 8/algebra), svenska, NO/SO, kemi, geografi, spanska och engelska.
Vanilla JavaScript, en enda HTML-fil, installeras som webbapp på telefon/surfplatta.

- Allt innehåll (uppgiftsgeneratorer, frågebanker, metodsidor) är generiskt och ligger i koden.
- Allt som rör en specifik familj – barnens namn, kurs, tema, prov, skolans glosor – ligger i familjens **privata konfiguration** i Firestore och läses in efter parkoppling. Inget sådant finns i detta repo.
- Framsteg synkas mellan en familjs enheter via Firestore. Åtkomst styrs av `firestore.rules`.
- Påminnelser skickas av `.github/workflows/reminders.yml` (web-push).

Publiceras via GitHub Pages. Byggs från källfiler med `build.sh` (källorna och testerna läggs till i repot i nästa fas).
