# Endspurt — Checkliste bis zur Einreichung

Stand Di 01.09., 11:00. **Feature Freeze Mi 02.09. 15:00 · Einreichung bis 21:00 · Deadline Do 03.09. 22:00 Berlin.**
Gebaut ist alles. Was folgt, ist Aufnahme, Text und Sorgfalt.

## Heute (Dienstag)

- [ ] **Vollständiger Durchlauf im ChatGPT-Desktop-Browser**, frischer Workspace, die fünf Prompts der Reihe nach. Der einzige Test, den die Evals nicht abdecken: ob das Modell die richtige Kette wählt.
- [ ] **Derselbe Durchlauf in Chrome** (ohne Flag, Origin Trial). Kürzer, nur: Selbstdiagnose grün, Prompt 1, Prompt 5 mit Dialog.
- [ ] **Screenshots für Devpost** (3–5), aus dem fertigen Layout:
  1. Bid-Screen mit gefüllter Tabelle, Herkunfts-Chips und den zwei leeren Zeilen
  2. Ein geöffneter Chip mit Originalzeile aus dem alten Angebot
  3. Der Bestätigungsdialog mit Endsumme
  4. ChatGPTs eigene Werkzeugansicht („Website-Tools (2), 2 mit Lesezugriff") — Beleg von außen
  5. Preisspiegel der geschlossenen Ausschreibung mit markiertem Ausreißer
- [ ] **Sicherungsaufnahme**: einmal ungeschnitten komplett durchlaufen und mitschneiden. Zwanzig Minuten. Versicherung für den Fall, dass der Mittwoch klemmt.
- [ ] `docs/08-devpost-text.md` und `docs/09-video-skript.md` in einer ruhigen Minute gegenlesen.

## Mittwoch bis 15:00 (Freeze)

- [ ] Letzte Textkorrekturen in der Oberfläche, falls beim Durchlauf etwas auffiel
- [ ] **Aufräumen im öffentlichen Repo prüfen:** Liegen `docs/01`, `02`, `04`, `06`, `08`, `09` noch im sichtbaren Baum? Das sind Dokumente über die *Einreichung*, nicht über das Produkt — nach `notes/` verschieben und `notes/` in `.gitignore`. **Öffentlich bleiben:** `spec.md`, `docs/03` (Spec), `docs/05` (Fachbeschreibung), `docs/07` (Technikentscheidungen), `seed/`, `evals/`, README, `llms.txt`.
- [ ] Deploy, **15 Sekunden warten**, dann Rauchtest: `/`, `/how-to-test`, `/llms.txt` je 200, Selbstdiagnose grün
- [ ] `npm test`, `npm run typecheck`, `python3 seed/verify_seed.py`, Evals — alle grün
- [ ] Reset zweimal hintereinander, inklusive Wiederanmeldung von `submit_bid`
- [ ] **Ab 15:00: kein Code mehr.** Ausnahme nur bei demo-blockierendem Fehler (Seite lädt nicht, Reset defekt, einer der fünf Prompts schlägt fehl) — dann beheben, deployen, volle Matrix erneut.

## Mittwoch 15:00–21:00 (Video und Text)

- [ ] Video nach `docs/09`: aufnehmen, schneiden, Voice-over, Upload
- [ ] YouTube **öffentlich**, unter 3:00, Titel „BidDesk — an agent-ready tender room (WebMCP Challenge)"
- [ ] Devpost-Formular: Name, Tagline, Live-URL, Video-URL, Repo-URL, Beschreibung aus `docs/08`, Screenshots, „Built with", Sponsorkategorien (Cloudflare, Chrome)
- [ ] Vorschau prüfen, dann **Submit** — nicht nur Save
- [ ] Nach dem Absenden: Live-URL noch einmal in einem frischen Browser öffnen

## Donnerstag

Nur Notfall bis 22:00. Nicht verplanen.

## Wenn etwas schiefgeht

- **Demo läuft nicht mehr:** Sicherungsaufnahme vom Dienstag verwenden, Live-URL bleibt trotzdem eingereicht.
- **Nicht demo-blockierender Fehler nach dem Freeze:** nicht beheben. In die Known Limitations im README, das ist stärker als eine hastige Korrektur.
- **Propagation:** 404 oder Fehler 1042 direkt nach dem Deploy sind normal. Warten, nicht nachdeployen.

## Nach der Einreichung (Marketing, ohne Zeitdruck)

- Deutsche Zweitfassung des Videos für Website und Kundengespräche
- Case-Seite auf merkur-impulse.com mit `docs/05` als Grundlage
- LinkedIn: der Befund aus §13.3d ist der beste Aufhänger — eine gemessene Grenze der eigenen Garantie erzählt sich besser als jedes Feature
- Erfahrungsbericht an SpecShift, falls du dir das Werkzeug ansiehst
