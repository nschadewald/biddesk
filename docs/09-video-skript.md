# Videoskript v3 (Ziel 2:45, hart unter 3:00, englisches Voice-over) — Fassung Do 03.09., 10:00

**≈ 300 gesprochene Wörter, 120–135 Wörter pro Minute, Anfang und Ende bewusst langsam.**
Umbau nach dem Blick auf das Feld: Alleinstellung in den ersten 15 Sekunden,
echte Werkzeugaufrufe im Bild, GAEB als eigener Beat, die Abgabe scheitert sichtbar am Nachweis
und gelingt nach der Korrektur, Rollenwechsel als Höhepunkt, ruhiger Schluss mit Zahlen. Was
bleibt: Herkunfts-Chip, die zwei leeren Zellen, Bestätigung statt Sackgasse, 11 → 10.
Aufnahme im ChatGPT-Desktop-Browser auf **`e73eada` / `ef9fd1a2`** (Freeze-Stand), Oberfläche
**Englisch**, frischer Workspace, Fenster 1920 × 1080, Cursor sichtbar.

---

## 0:00–0:15 · Was es ist
**Bild:** Bieter-Bildschirm, Tabelle füllt sich bereits (aus Take 1, ab der dritten Zeile),
dann Standbild mit gefüllter Tabelle, Chips, zwei leeren Zellen.
**VO:** "A German construction tender: fourteen line items. BidDesk is a workspace where the
contractor's own AI agent prices, checks and prepares the bid — and cannot bypass roles,
validation, or a person's final say."

## 0:15–0:35 · Echte Ausschreibung, echte Werkzeuge
**Bild:** Take 3: die Datei `T-2026-021.x83` fällt auf die Dropzone, die Tabelle des importierten
Leistungsverzeichnisses erscheint, unbepreist. Dann 3 Sekunden ChatGPTs Werkzeugansicht
„11 tools · 5 with write access", dann das Panel „WebMCP detected · 11 tools registered".
**VO:** "Tenders arrive as GAEB files — the format German procurement actually uses. Dropped on
the page, one becomes a priceable bill of quantities. The page publishes eleven typed tools, and
the agent discovers them. No API key, no plugin: bring your own agent."

## 0:35–1:05 · Preise mit Herkunft
**Bild:** Satz 1 abgeschickt, Log `get_tender` → `suggest_prices` → `set_unit_price · 12 applied`,
Zeilen laufen gestaffelt ein. Chip „from your quote · Luegallee 40 · March 2026" öffnen: die
Originalzeile. 03.04 und 04.02: „no comparable entry".
**VO:** "One sentence: price every position from my price book. Twelve rows fill in, each with
its source — project, date, the original line. Two rows stay empty. The price book has nothing
comparable, so the agent says so instead of guessing."

## 1:05–1:30 · Der Preis des Menschen — und die Abgabe scheitert
**Bild:** Satz 2 (beide Preise). Log `set_unit_price · AWAITING CONFIRMATION` als oberste Zeile.
Zwei Karten an den Zeilen, zwei Klicks, „set by you" ohne Chip, Summe 13.457,50 €. Dann Satz 3
„Submit the bid." → Kasten **„Cannot be handed in yet: 1 thing in the way — Tax clearance
certificate — expired 13 Aug 2026"**, Knopf „Submit bid" grau.
**VO:** "The contractor states his own prices, and why. The agent has no source for them, so it
puts them on the rows and waits — the clicks are his. Then: submit. The page refuses. A tax
clearance certificate expired three weeks ago, and nobody hands in around that — not the agent,
not the button."

## 1:30–1:50 · Die Korrektur
**Bild:** Satz 4 „My new tax clearance certificate is valid until 15 August 2027." Karte im
Prüfpanel: „Confirm this document? … Nothing is uploaded or checked here." · „13 Aug 2026 →
15 Aug 2027". Klick. Der Kasten verschwindet, „Submit bid" wird dunkel.
**VO:** "The fix is stated, not uploaded: the new validity date, confirmed with a click, recorded
as a date a person gave. The blocker is gone."

## 1:50–2:10 · Die Abgabe
**Bild:** Satz 5 „Submit the bid." Zusammenfassung im Chat, Dialog mit Endsumme — das einzige
Modal — Klick. Banner „Submitted", Tabelle gesperrt, Statuszeile **11 → 10**.
**VO:** "Now submitting is allowed — and still binding, so the agent stops. It summarises; a
person clicks. Afterwards the tool is gone from the agent's repertoire: eleven tools before, ten
after."

## 2:10–2:35 · Die andere Rolle
**Bild:** „Acting as" → Client. Panel „5 tools registered". T-2026-014: **3 bids received ·
sealed**. Satz „Open tender T-2026-014" → Positionen ohne Preise; im Log die Antwort ohne
Preisfelder. Kurz: der Preisspiegel der geschlossenen Fassaden-Ausschreibung, Ausreißer
unterstrichen.
**VO:** "The property manager's side: five tools, not eleven. Three bids in, sealed until the
deadline — for their agent as well. Prices reach this side only after closing, and it is the
server that refuses, not the screen. On a closed tender: the full comparison."

## 2:35–2:50 · Schluss
**Bild:** Texttafel (Space Grotesk auf Weiß, Text dunkel, URL orange):
> No price enters a bid without a traceable source —
> or a person's hand on that exact value.
> 228 tests · live · MIT · biddesk.n-schadewald.workers.dev
**VO:** "Two hundred and twenty-eight tests. Live, open source, MIT. And no price enters a bid
without a traceable source — or a person's hand on that exact value."

---

## Für den Aufnehmenden — bitte zuerst lesen

**Was aufgenommen wird:** https://biddesk.n-schadewald.workers.dev im **ChatGPT-Desktop-Browser**,
Modell **5.6 Sol** oder Terra (bei Luna ist WebMCP aus). **Der Handoff:** ChatGPT fragt beim ersten
Werkzeugaufruf nach dem Arbeitsmodus — **annehmen**; abgelehnt heißt: neue Unterhaltung.

**Drei Takes, in dieser Reihenfolge:**

**Take 1 — der Hauptlauf** (frischer Workspace: „Reset demo", English, 1920 × 1080, Log leer,
Statuszeile 11; vorher ChatGPTs Werkzeugansicht öffnen und 3 Sekunden stehen lassen):
1. *"Open tender T-2026-014 and price every position from my price book. Leave anything without a
   match empty and tell me which ones."* → Chip öffnen, 03.04 zeigen.
2. *"Set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my rate — and 04.02 to
   48 euros, my hourly rate."* → zwei Karten, **die Sekunde vor dem Klick stehen lassen**, zwei Klicks.
3. *"Submit the bid."* → **blockiert**, Kasten mit dem Nachweis. Das ist gewollt, das ist die Szene.
4. *"My new tax clearance certificate is valid until 15 August 2027."* → Karte im Prüfpanel, Klick.
5. *"Submit the bid."* → Dialog, Klick, Banner, Statuszeile 10.
Teilt der Agent Satz 2 in zwei Aufrufe oder ruft er vor Satz 3 selbst `check_bid`: in Ordnung,
nicht nachhelfen. Prüfzahlen: 13.213,50 € → 13.457,50 €, Bedarf 370 → 850 €, Dialog „12 of 12 ·
2 of 2".

**Take 2 — Auftraggeber:** „Acting as" → Client. T-2026-014 öffnen: „3 bids received · sealed".
*"Open tender T-2026-014"* → keine Preise. *"Compare all bids for the facade tender and tell me
who is cheapest but complete."* → Preisspiegel.

**Take 3 — GAEB, zuletzt:** Zurück zu Contractor, `seed/gaeb/T-2026-021.x83` aus dem Explorer auf
die Dropzone ziehen. Die importierte Ausschreibung öffnet sich, unbepreist. 5 Sekunden. Danach
„Reset demo". (Zuletzt, weil der Import den Workspace wechselt.)

**Was zwingend im Bild sein muss:** Werkzeugansicht 11 · 5 · Statuszeile mit Zahl · Live-Log mit
AWAITING CONFIRMATION als oberster Zeile · Chip „from your quote" · die zwei leeren Zellen · zwei
Bestätigungen, danach „set by you" ohne Chip · der Blockiert-Kasten · die Karte im Prüfpanel ·
Dialog · 11 → 10 · Panel „5 tools" · „3 bids received · sealed" · Positionen ohne Preise · GAEB-Drop.

**Nicht wegschneiden:** das gestaffelte Einlaufen bei Satz 1, die Sekunde zwischen AWAITING
CONFIRMATION und dem Klick, den Moment, in dem der Blockiert-Kasten erscheint.

**Freeze-Regel:** Aufnahme auf `e73eada` / `ef9fd1a2`. Ändert sich der Code danach (nur noch
Befunde, Freeze 12:00), wird nur das nachgedreht, was sich sichtbar geändert hat.

## Produktionshinweise
- Sicherungsaufnahme: Take 1 einmal ungeschnitten komplett, mitschneiden.
- 1080p, OBS oder Windows-Spielleiste. Schnitt Clipchamp/DaVinci. Voice-over ruhig, Anfang und
  Ende langsamer als die Mitte; keine Musik über den Sprechstellen.
- Texttafel am Schluss: Textebene im Schnittprogramm, weißer Grund, Space Grotesk, 10 Sekunden.
- YouTube **öffentlich**, unter 3:00, Titel "BidDesk — an agent-ready tender room (WebMCP
  Challenge)".
