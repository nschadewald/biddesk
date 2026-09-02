# Videoskript (Ziel 2:35, hart unter 3:00, englisches Voice-over) — Fassung Mi 02.09., 17:30

**Eine Botschaft je Szene, ≈ 335 gesprochene Wörter, 130–140 Wörter pro Minute.** Gekürzt nach
zwei externen Reviews: Rückfrage- und GAEB-Beat gestrichen, Nachweis als ein Satz in der
Prüfszene, Beweiskarte statt Toolliste. Aufnahme im ChatGPT-Desktop-Browser auf dem
Freeze-Stand `6b07b91` (live `bf452d58`), Oberfläche **Englisch**, frischer Workspace,
Fenster ≥ 1240 px, Cursor sichtbar.

---

## 0:00–0:15 · Hook
**Bild:** Prompt 1 ist abgeschickt. Die Tabelle füllt sich gestaffelt, Chips erscheinen, die
Summenleiste klettert. 03.04 und 04.02 bleiben leer.
**VO:** "A German construction tender: fourteen line items a painting firm has to price. The
contractor's own AI agent fills the table from the firm's price book — and leaves two cells
empty."

## 0:15–0:30 · Das Problem
**Bild:** Die gefüllte Tabelle bleibt stehen; kein Schnitt. (Es gibt kein PDF im Projekt — die
Tabelle ist das Gegenteil des PDFs, das reicht als Bild.)
**VO:** "Normally this is an evening at the kitchen table: a forty-six-page PDF, and the prices
buried in last year's quotes. Many small firms skip tenders for this reason."

## 0:30–0:50 · Herkunft
**Bild:** Chip „from your quote · Luegallee 40 · March 2026" öffnen: die Originalzeile. Dann
03.04: „no comparable entry".
**VO:** "Every price the agent wrote points back to a line in this firm's own history — project,
date, the original item. Where the firm has never priced radiators, the agent doesn't guess.
It says so, and leaves the cell empty."

## 0:50–1:15 · Der Weg
**Bild:** Prompt: *"Set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my
rate."* Log: `set_unit_price` · AWAITING CONFIRMATION. An der Zeile: „61,00 € × 4 pcs =
244,00 € · not from your price book — you are setting this price yourself" + Herleitung.
Klick **Confirm**. Zeile: „set by you · …", kein Chip. Summe 13.457,50 €.
**VO:** "The contractor states a price, and why. The agent has no source for that number, so it
neither refuses nor pretends. It puts the price on
the row and waits. The click is his. Recorded as his — no chip. No
authority of its own means confirmation, not a dead end."

## 1:15–1:40 · Prüfen
**Bild:** Prompt 3. Befunde: Ausreißer, **Nachweis abgelaufen in Rot**, je mit Handlungssatz.
Prompt: *"My new tax clearance certificate is valid until 15 August 2027."* Bestätigung im
Check-Panel, Klick, der rote Befund verschwindet.
**VO:** "Then the check. An outlier, and a tax clearance certificate that expired three weeks
ago — the only red in the app, each finding with its way
out. The certificate is renewed the same way: stated in the chat, confirmed with a click.
Nothing is uploaded; the page says so."

## 1:40–2:00 · Die Grenze
**Bild:** Prompt 5. Zusammenfassung, Abgabedialog mit Endsumme — das einzige Modal. Klick.
Banner, Tabelle gesperrt. Selbstdiagnose **11 → 10**.
**VO:** "Submitting is binding, so the agent stops. It summarises; a person
clicks. Afterwards the tool is gone from the agent's repertoire — eleven tools before, ten
after. The page didn't ask the agent to behave. It took the capability away."

## 2:00–2:20 · Die andere Seite
**Bild:** Rolle Auftraggeber. Eingang **2 → 3**, versiegelt. Prompt: *"Open tender
T-2026-014"* → Positionen ohne Preise. Dann der Preisspiegel der geschlossenen
Fassaden-Ausschreibung mit markiertem Ausreißer.
**VO:** "The property manager's side: a bid arrives — two, now three — but no prices. Sealed
until the deadline, for their agent too; the server refuses, not just the screen. On a closed
tender: the full comparison, one bidder's scaffolding at twice the median."

## 2:20–2:35 · Beweis und Schluss
**Bild:** Eine Karte: ChatGPTs Werkzeugansicht „11 tools · 5 with write access" · „202 tests ·
8 eval cases" · Browser-Agent → Tools → Worker + D1. Darunter der Satz.
**VO:** "Thirteen tools, two hundred tests, eight eval cases — five of them testing what the
agent must not do alone. No model in the backend: the intelligence is the user's own agent. And no price enters a bid without a traceable source — or a
person's hand on that exact value."

---

## Für den Aufnehmenden — bitte zuerst lesen

**Was aufgenommen wird:** https://biddesk.n-schadewald.workers.dev im **ChatGPT-Desktop-Browser**.
Modell **5.6 Sol** oder Terra — bei Luna ist WebMCP deaktiviert, und dann fehlt auch die Frage
nach dem Arbeitsmodus.

**Der Handoff.** ChatGPT fragt einmal nach dem Arbeitsmodus. **Annehmen.** Wird er abgelehnt,
verweigert ChatGPT für den Rest der Unterhaltung. Abhilfe: neue Unterhaltung. Kommt die Frage
gar nicht: Modell prüfen.

**Vor der Aufnahme:**
1. „Reset demo" — Tabelle leer, Summe 0,00 €, Log leer. Sprache **English**. Bieter Farbwerk Meier.
2. Fensterbreite ≥ 1240 px: Tabelle und Agent-Panel nebeneinander.
3. Selbstdiagnose „WebMCP detected · **11** tools registered". ChatGPTs Werkzeugansicht
   (Pfeil in der Adresszeile) **11 · 5 mit Schreibzugriff**. Zeigt eine der beiden etwas
   anderes: Stand alt oder Browser falsch — nicht aufnehmen.
4. Nach einem Deploy 15 Sekunden warten.

**Reihenfolge ist Pflicht.** Die Abgabe ist blockiert, solange 03.04 offen oder der Nachweis
abgelaufen ist — das ist gewollt. Also: Prompt 1 → Chip → 61 € bestätigen → Prüfen → Nachweis
bestätigen → Abgabe → Rollenwechsel. Wer die Abgabe vor dem Nachweis versucht, sieht
„blocked" mit der Liste; das ist kein Fehler, aber nicht die Szene.

**Die vier Sätze, wörtlich** (der Agent wählt die Kette selbst — nicht nachhelfen):
- *"Open tender T-2026-014 and price every position from my price book. Leave anything
  without a match empty and tell me which ones."*
- *"Set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my rate."*
- *"My new tax clearance certificate is valid until 15 August 2027."*
- *"Submit the bid."*
Danach als Auftraggeber: *"Open tender T-2026-014"* (zeigt: keine Preise) und *"Compare all
bids for the facade tender and tell me who is cheapest but complete."*

**Was zwingend im Bild sein muss:** Selbstdiagnose mit Zahl · Live-Log während der Aufrufe,
einschließlich AWAITING CONFIRMATION · Chip „from your quote" · die zwei leeren Zeilen · die
Bestätigung an der Zeile und danach „set by you" ohne Chip · die Bestätigung im Check-Panel
und der verschwindende rote Befund · Abgabedialog · 11 → 10 · Eingang 2 → 3 versiegelt ·
ChatGPTs Werkzeugansicht.

**Nicht wegschneiden:** das gestaffelte Einlaufen bei Prompt 1 und die Sekunde zwischen
AWAITING CONFIRMATION und dem Klick.

**Freeze-Regel:** Aufnahme auf `6b07b91` / `bf452d58`. Ändert sich der Code danach, wird nur
das nachgedreht, was sich sichtbar geändert hat.

## Produktionshinweise
- Sicherungsaufnahme zuerst: einmal ungeschnitten komplett, mitschneiden.
- 1080p, OBS oder Windows-Spielleiste. Schnitt Clipchamp/DaVinci. Voice-over ruhig, keine
  Musik über den Sprechstellen.
- YouTube **öffentlich**, unter 3:00, Titel "BidDesk — an agent-ready tender room (WebMCP
  Challenge)".
