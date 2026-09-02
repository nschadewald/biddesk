# Videoskript (Ziel 2:40, hart unter 3:00, englisches Voice-over) — Fassung Mi 02.09., 18:30

**Eine Botschaft je Szene, ≈ 335 gesprochene Wörter, 130–140 Wörter pro Minute.** Änderungen
gegenüber 17:30 nach Nils' Videodurchlauf: kalter Einstieg beim Auftraggeber (zwei Angebote,
versiegelt — sonst trägt „zwei, jetzt drei" am Ende nicht), **beide** leeren Zeilen bekommen den
Preis des Menschen (der Abgabedialog liest sich sonst wie ein Fehler), kein Ausreißer in der
Prüfszene (den gäbe es nur nach einem absichtlichen Zahlendreher — gestrichen), Beweiskarte
gestrichen (zu technisch, gehört in den Devpost-Text), Abbinder ohne Diagramm. Aufnahme im
ChatGPT-Desktop-Browser auf dem Stand, den Claude Code als **„Videostand"** meldet (nach CC-11 und
CC-10 Teil 2), Oberfläche **Englisch**, frischer Workspace, Fenster ≥ 1240 px, Cursor sichtbar.

---

## 0:00–0:08 · Kalter Einstieg
**Bild:** Rolle „Client · Rheinpark Property Management", T-2026-014 geöffnet. Kasten „Bids
received": **2 bids received · Sealed until 12 Sept 2026** — keine Preise, keine Namen.
**VO:** "A property manager has put a staircase out to tender. Two bids are in — sealed. A third
firm has until the twelfth."

## 0:08–0:22 · Hook
**Bild:** Rolle „Bidder · Farbwerk Meier". Prompt 1 ist abgeschickt. Die Tabelle füllt sich
gestaffelt, Chips erscheinen, die Summenleiste klettert. 03.04 und 04.02 bleiben leer.
**VO:** "Fourteen line items a painting firm has to price. The contractor's own AI agent fills the
table from the firm's price book — and leaves two cells empty."

## 0:22–0:35 · Das Problem
**Bild:** Die gefüllte Tabelle bleibt stehen; kein Schnitt.
**VO:** "Normally this is an evening at the kitchen table: a forty-six-page PDF, and the prices
buried in last year's quotes. Many small firms skip tenders for this reason."

## 0:35–0:55 · Herkunft
**Bild:** Chip „from your quote · Luegallee 40 · March 2026" öffnen: die Originalzeile. Dann
03.04: „no comparable entry".
**VO:** "Every price the agent wrote points back to a line in this firm's own history — project,
date, the original item. Where the firm has never priced radiators, the agent doesn't guess. It
says so, and leaves the cell empty."

## 0:55–1:20 · Der Weg
**Bild:** Prompt: *"Set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my rate —
and 04.02 to 48 euros, my hourly rate."* Log: `set_unit_price` · AWAITING CONFIRMATION. An beiden
Zeilen die Bestätigung: „61,00 € × 4 pcs = 244,00 € · not from your price book — you are setting
this price yourself" + Herleitung; „48,00 € × 10 h = 480,00 €". Klick **Confirm**, zweimal. Zeilen:
„set by you · …", kein Chip. Summe 13.457,50 €, Bedarfspositionen 850,00 €.
**VO:** "The contractor states his prices, and why. The agent has no source for those numbers, so
it neither refuses nor pretends. It puts them on the rows and waits. The clicks are his — recorded
as his, no chip. No authority of its own means confirmation, not a dead end."

## 1:20–1:45 · Prüfen
**Bild:** Prompt 3. Ein Befund: **Nachweis abgelaufen, in Rot**, mit Handlungssatz. Prompt:
*"My new tax clearance certificate is valid until 15 August 2027."* Bestätigung im Check-Panel
(„Nothing is uploaded or checked here"), Klick, der rote Befund verschwindet.
**VO:** "Then the check. One finding: a tax clearance certificate that expired three weeks ago —
the only red in the app, with its way out beside it. Renewed the same way: stated in the chat,
confirmed with a click. Nothing is uploaded; the page says so."

## 1:45–2:05 · Die Grenze
**Bild:** Prompt 5. Zusammenfassung, Abgabedialog mit Endsumme — das einzige Modal. Klick.
Banner, Tabelle gesperrt. Selbstdiagnose **11 → 10**.
**VO:** "Submitting is binding, so the agent stops. It summarises; a person clicks. Afterwards the
tool is gone from the agent's repertoire — eleven tools before, ten after. The page didn't ask the
agent to behave. It took the capability away."

## 2:05–2:25 · Die andere Seite
**Bild:** Rolle Auftraggeber, T-2026-014: **3 bids received · sealed**. Prompt: *"Open tender
T-2026-014"* → Positionen ohne Preise. Dann der Preisspiegel der geschlossenen
Fassaden-Ausschreibung mit markiertem Ausreißer.
**VO:** "Back on the property manager's side: three bids now — and still no prices. Sealed until
the deadline, for their agent too: the server refuses, not just the screen. On a closed tender,
the full comparison — one bidder's scaffolding at twice the median."

## 2:25–2:40 · Schluss
**Bild:** Der Preisspiegel bleibt kurz stehen, dann eine schlichte Texttafel (weiß, zwei Zeilen,
darunter die URL) — kein Diagramm, keine Zahlen:
> No price enters a bid without a traceable source —
> or a person's hand on that exact value.
> biddesk.n-schadewald.workers.dev
**VO:** "No model in the backend — the intelligence is the user's own agent; the site only offers
it tools. And no price enters a bid without a traceable source, or a person's hand on that exact
value."

---

## Für den Aufnehmenden — bitte zuerst lesen

**Was aufgenommen wird:** https://biddesk.n-schadewald.workers.dev im **ChatGPT-Desktop-Browser**.
Modell **5.6 Sol** oder Terra — bei Luna ist WebMCP deaktiviert, und dann fehlt auch die Frage
nach dem Arbeitsmodus.

**Der Handoff.** ChatGPT fragt einmal nach dem Arbeitsmodus (beim ersten Werkzeugaufruf, also bei
Prompt 1). **Annehmen.** Wird er abgelehnt, verweigert ChatGPT für den Rest der Unterhaltung.
Abhilfe: neue Unterhaltung. Kommt die Frage gar nicht: Modell prüfen.

**Vor der Aufnahme:**
1. „Reset demo" — Tabelle leer, Summe 0,00 €, Log leer. Sprache **English**. Bieter Farbwerk Meier.
2. Fensterbreite ≥ 1240 px: Tabelle und Agent-Panel nebeneinander.
3. Selbstdiagnose „WebMCP detected · **11** tools registered". ChatGPTs Werkzeugansicht
   (Pfeil in der Adresszeile) **11 · 5 mit Schreibzugriff**. Zeigt eine der beiden etwas
   anderes: Stand alt oder Browser falsch — nicht aufnehmen.
4. Nach einem Deploy 15 Sekunden warten.
5. Für den kalten Einstieg zuerst auf „Client · Rheinpark Property Management" wechseln und
   T-2026-014 öffnen (2 bids received), dann zurück zu „Bidder · Farbwerk Meier". Der Wechsel
   selbst wird weggeschnitten.

**Reihenfolge ist Pflicht.** Die Abgabe ist blockiert, solange 03.04 offen oder der Nachweis
abgelaufen ist — das ist gewollt. 04.02 ist eine Bedarfsposition und würde nicht blockieren; sie
wird trotzdem bepreist, damit der Abgabedialog vollständig liest. Also: Auftraggeber (2) → Bieter,
Prompt 1 → Chip → beide Preise bestätigen → Prüfen → Nachweis bestätigen → Abgabe → Auftraggeber
(3). Wer die Abgabe vor dem Nachweis versucht, sieht „blocked" mit der Liste; das ist kein Fehler,
aber nicht die Szene.

**Die fünf Sätze, wörtlich** (der Agent wählt die Kette selbst — nicht nachhelfen; teilt er den
zweiten Satz in zwei Aufrufe, ist das in Ordnung):
- *"Open tender T-2026-014 and price every position from my price book. Leave anything
  without a match empty and tell me which ones."*
- *"Set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my rate — and 04.02 to
  48 euros, my hourly rate."*
- *"Run a check on my bid — anything that looks off?"*
- *"My new tax clearance certificate is valid until 15 August 2027."*
- *"Submit the bid."*
Danach als Auftraggeber: *"Open tender T-2026-014"* (zeigt: keine Preise) und *"Compare all
bids for the facade tender and tell me who is cheapest but complete."*

**Prüfzahlen im Bild:** nach Prompt 1 netto **13.213,50 €**, Bedarfspositionen 370,00 €; nach den
zwei Bestätigungen netto **13.457,50 €**, Bedarfspositionen **850,00 €**; Abgabedialog „12 of 12"
plus die Bedarfspositionen „2 of 2". Stimmt eine nicht: anhalten, melden.

**Was zwingend im Bild sein muss:** „2 bids received · sealed" vor Prompt 1 · Selbstdiagnose mit
Zahl · Live-Log während der Aufrufe, einschließlich AWAITING CONFIRMATION · Chip „from your
quote" · die zwei leeren Zeilen · die Bestätigungen an den Zeilen und danach „set by you" ohne
Chip · die Bestätigung im Check-Panel und der verschwindende rote Befund · Abgabedialog · 11 → 10 ·
„3 bids received · sealed" · Positionen ohne Preise beim Auftraggeber · Preisspiegel mit Ausreißer.

**Nicht wegschneiden:** das gestaffelte Einlaufen bei Prompt 1 und die Sekunde zwischen
AWAITING CONFIRMATION und dem Klick.

**Freeze-Regel:** Aufnahme auf dem gemeldeten „Videostand" (Hash und Deploy-Id in CCs Meldung).
Ändert sich der Code danach, wird nur das nachgedreht, was sich sichtbar geändert hat.

## Produktionshinweise
- Sicherungsaufnahme zuerst: einmal ungeschnitten komplett, mitschneiden.
- 1080p, OBS oder Windows-Spielleiste. Schnitt Clipchamp/DaVinci. Voice-over ruhig, keine
  Musik über den Sprechstellen.
- Die Texttafel am Schluss ist eine Textebene im Schnittprogramm (weißer Grund, dunkle Schrift,
  zwei Zeilen plus URL), 8–10 Sekunden, kein Diagramm.
- YouTube **öffentlich**, unter 3:00, Titel "BidDesk — an agent-ready tender room (WebMCP
  Challenge)".
