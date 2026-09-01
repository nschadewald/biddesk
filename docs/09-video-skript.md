# Videoskript (Ziel 2:30, englisches Voice-over) — Entwurf 02.09.

**Reihenfolge-Prinzip: erst sehen, dann vertrauen, dann rechnen.** Die Zusammenarbeit muss im Bild sein, bevor irgendetwas erklärt wird.
Aufnahme im ChatGPT-Desktop-Browser, Fenster so breit, dass Tabelle und Agent-Panel nebeneinander stehen. Frischer Workspace. Cursor sichtbar.

---

## 0:00–0:15 · Hook, ohne Vorrede
**Bild:** Prompt 1 ist abgeschickt. Die Tabelle füllt sich gestaffelt von oben nach unten, Chips erscheinen, die Summenleiste klettert. Eine Hand korrigiert *währenddessen* eine Zeile.
**VO:** "This is a German construction tender — fourteen line items that a painting firm has to price. Watch the table fill in, and watch what stays empty."

## 0:15–0:35 · Das Problem, kurz
**Bild:** Kurzer Schnitt auf das 46-Seiten-PDF neben der Tabelle, dann zurück.
**VO:** "Normally this is an evening's work. A forty-six-page PDF, three pages of which are the actual job, and the prices are scattered across old quotes. Many small firms skip tenders for exactly this reason — so the client gets fewer bids, at worse prices."

## 0:35–1:00 · Vertrauen — der Kern
**Bild:** Auf einen Chip zoomen, anklicken: Originalzeile aus dem alten Angebot. Dann auf 03.04 und 04.02 — leer, "no comparable entry".
**VO:** "Every price the agent wrote points back to a line in this firm's own price book — the project, the date, the original item. And where the firm has never priced radiators, the agent doesn't guess. It leaves the cell empty and says so. That is the whole idea: the agent moves the firm's knowledge into place. It never invents any."
**Bild:** Der Mensch tippt 61,00 € in 03.04. Kein Chip an dieser Zeile.
**VO:** "The master fills that one in himself. No chip — because it came from him, not from the record."

## 1:00–1:30 · Prüfen und rückfragen
**Bild:** Prompt 3. Prüfergebnis mit drei Befunden.
**VO:** "Then: check the bid. Two positions still open, an outlier against the firm's own prices, and a tax clearance certificate that expired three weeks ago. This is the only place in the whole app that uses red."
**Bild:** Prompt 4, Rückfrage erscheint in der Liste.
**VO:** "A question to the client goes out from the same page — and the answer is visible to every bidder, the way a tender requires."

## 1:30–1:50 · Die Grenze
**Bild:** Prompt 5. Der Agent liefert eine Zusammenfassung und hält an. Der Dialog erscheint. Der Mensch klickt. Banner, Tabelle gesperrt.
**Bild:** Kurz auf die Selbstdiagnose: 10 → 9 Werkzeuge.
**VO:** "Submitting is binding, so the agent stops. It prepares, it summarises — a person clicks. And afterwards the tool is gone from the agent's repertoire: ten tools before, nine after."

## 1:50–2:05 · Zweiter Akt
**Bild:** Rollenwechsel zum Auftraggeber. Offene Ausschreibung: Zähler 2 → 3, versiegelt. Dann der Preisspiegel der geschlossenen Fassaden-Ausschreibung.
**VO:** "The client sees the bid arrive — but not its prices. Sealed until the deadline, for their agent too. On a closed tender, the full comparison: position by position, with one bidder's scaffolding price flagged at twice the median."

## Optionaler Beat (nur wenn die Zeit es hergibt, sonst weglassen)
**Bild:** Eine GAEB-X83-Datei wird auf die Seite gezogen, eine neue Ausschreibung entsteht, danach ein Bepreisungslauf.
**VO:** "And this is where a tender actually comes from: a GAEB file out of the client's tendering software. Dragged in, priced with the same tools."
*Hinweis: Dieser Beat kostet ~12 Sekunden. Wenn das Video über 2:40 läuft, fällt er — der Import steht im README und in den Screenshots.*

## 2:05–2:20 · Beweis
**Bild:** ChatGPTs eigene Werkzeugansicht ("2 mit Lesezugriff"), dann Chrome ohne Flag mit der grünen Selbstdiagnose, dann kurz die Eval-Tabelle im README.
**VO:** "Twelve tools, ten in the contractor role, five for the client. Read-only where it reads, confirmation where it commits. Ten eval cases — two of which test that we refuse the right things."

## 2:20–2:30 · Abbinder
**Bild:** Architektur in einem Bild: Browser-Agent → Tools → Worker + D1. Darunter der Satz.
**VO:** "No model in the backend. The intelligence is the user's own agent; the site only offers tools — and none of them can be used to invent a number."

---

## Für den Aufnehmenden — bitte zuerst lesen

**Was aufgenommen wird:** https://biddesk.n-schadewald.workers.dev im **ChatGPT-Desktop-Browser** (nicht Chrome, nicht extern). Modell **5.6 Sol** oder Terra — bei Luna ist WebMCP deaktiviert.

**Der Handoff.** ChatGPT fragt einmal nach dem Arbeitsmodus. **Annehmen.** Wird er abgelehnt, verweigert ChatGPT für den Rest der Unterhaltung und die Seite sieht funktionslos aus, obwohl alles korrekt läuft. Abhilfe: neue Unterhaltung.

**Vor jeder Aufnahme:**
1. „Reset demo" im Agent-Panel drücken — Tabelle leer, Summe 0,00 €, Log leer.
2. Fensterbreite prüfen: Tabelle und Agent-Panel müssen **nebeneinander** stehen, ohne Überlappung (ab ca. 1240 px). Darunter klappt das Panel weg und die halbe Aussage fehlt.
3. Die grüne Zeile oben rechts muss „WebMCP detected · 10 tools registered" sagen. Sagt sie das nicht, ist der Browser falsch — nicht aufnehmen.
4. Nach einem Deploy 15 Sekunden warten, sonst laufen Aufrufe ins Leere.

**Was zwingend im Bild sein muss**, sonst fehlt der Beweis: die grüne Selbstdiagnose mit der Werkzeugzahl, das Live-Log rechts während der Aufrufe, die Herkunfts-Chips an den Preisen, die zwei leeren Zeilen mit „no comparable entry", der Bestätigungsdialog vor der Abgabe, und die Werkzeugzahl **nach** der Abgabe (10 → 9).

**Nicht schneiden weg:** das gestaffelte Einlaufen der Zeilen bei Prompt 1. Es ist die Kernaussage in Bewegung — dass man beim Entstehen zusieht.

**Freeze-Regel, wichtig:** Die Oberfläche darf sich zwischen Aufnahme und Einreichung nicht mehr ändern, sonst zeigt das Video ein anderes Produkt als die Live-URL. Vor der Aufnahme mit Nils abstimmen, dass der Stand steht.

## Produktionshinweise
- **Sicherungsaufnahme zuerst:** einmal ungeschnitten komplett durchlaufen und mitschneiden, bevor geschnitten wird.
- Aufnahme 1080p, OBS oder Windows-Spielleiste. Schnitt Clipchamp/DaVinci.
- Voice-over: englischer Text vorher einsprechen oder KI-Stimme; Tempo ruhig, keine Musik über den Sprechstellen.
- **Vor der Aufnahme:** Reset drücken, Log leeren, Fensterbreite prüfen (Tabelle und Panel nebeneinander, keine Überlappung).
- Nach dem Deploy 15 Sekunden warten, bevor aufgenommen wird (Propagation).
- YouTube: öffentlich, unter 3:00, Titel "BidDesk — an agent-ready tender room (WebMCP Challenge)".
