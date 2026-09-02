<!-- SNAPSHOT 01.09.2026 15:20 aus docs/03-spec-biddesk.md. Beide Dateien sind bis auf diese Zeile deckungsgleich; wer eine ändert, ändert die andere mit. -->

# BidDesk – Build-Spec (v0.1, 28.08.2026)

Einreichung für die WebMCP Challenge (Devpost/OpenAI). Deadline Do 03.09.2026, 22:00 Uhr Berlin. Zeitbudget halbtags → Scope ist bewusst eng. Alles, was hier nicht steht, ist Stretch.

## 0. Ein-Satz-Pitch (englisch, für Devpost)

**BidDesk is an agent-ready tender room for building trades: property managers publish a bill of quantities, contractors price it together with their AI agent from their own price book, and everyone – humans and agents – works on the same page.**

## 1. Rollen, Story, Demo-Daten

Rollen ohne Login, Wechsel per Dropdown oben rechts. Jeder Besucher bekommt einen eigenen **Workspace** (isolierte Kopie der Seed-Daten), damit Juroren sich nicht gegenseitig den Zustand verändern.

- **Client** (Auftraggeber): „Rheinpark Property Management" (fiktiv, Düsseldorf).
- **Bidders** (Bieter, drei fiktive Malerbetriebe):
  - A „Farbwerk Meier GmbH" – vollständiges Preisbuch, mittleres Preisniveau (Standard-Demo-Bieter).
  - B „Malerei Brandt & Sohn" – Premium-Preise, vollständig.
  - C „Colorpoint Anstrich UG" – günstig, Preisbuch lückenhaft (Agent muss Lücken erkennen und rückfragen).

Ausschreibungen (Seed):
1. **T-2026-014 „Staircase painting works – Rheinallee 12"** – offen, Frist 10.09.2026, 14 Positionen (Haupt-Demo).
2. **T-2026-015 „Basement corridor painting – Kaiserswerther Str. 88"** – offen, 6 Positionen (damit `list_tenders` etwas zu filtern hat).
3. **T-2026-009 „Facade repaint – Luegallee 40"** – geschlossen, 3 abgegebene Angebote (damit der Preisspiegel sofort etwas zeigt).

### Leistungsverzeichnis T-2026-014 (Malerarbeiten Treppenhaus, MFH 4 Etagen)

Alle Texte zweisprachig speichern (`text_en`, `text_de`). Mengen und Einheiten fix. Preise sind Demo-Werte (fiktiv, plausibel), keine Marktdaten.

| OZ | Kurztext (EN) | Kurztext (DE) | Menge | Einheit | Kategorie | Bedarf |
|---|---|---|---|---|---|---|
| 01.01 | Site setup, protective covering of stairs, handrails and floors | Baustelleneinrichtung, Abdecken von Treppen, Handläufen, Böden | 1 | LS (psch) | prep | nein |
| 01.02 | Clean and sand existing wall coating | Altanstrich Wandflächen reinigen und anschleifen | 320 | m² | prep | nein |
| 01.03 | Fill cracks and holes, finish quality Q3 | Risse/Löcher spachteln, Q3 | 320 | m² | prep | nein |
| 02.01 | Primer on wall surfaces | Grundierung Wandflächen | 320 | m² | wall | nein |
| 02.02 | Two coats washable emulsion paint, white, wall surfaces | Wandflächen 2× Dispersionsanstrich, waschbeständig, weiß | 320 | m² | wall | nein |
| 02.03 | Two coats emulsion paint, ceilings | Deckenflächen 2× Dispersionsanstrich | 60 | m² | ceiling | nein |
| 02.04 | Protective latex coating on dado up to 1.50 m, colour per client | Sockelanstrich Latex bis 1,50 m, Farbton nach Wahl AG | 90 | m² | wall | nein |
| 03.01 | Steel balustrade: de-rust, prime, two coats alkyd enamel | Treppengeländer Stahl: entrosten, grundieren, 2× Lackanstrich | 45 | m | metal | nein |
| 03.02 | Wooden handrail: sand and apply two coats clear varnish | Handlauf Holz: schleifen, 2× Klarlack | 45 | m | wood | nein |
| 03.03 | Apartment entrance doors incl. frames: sand and two coats enamel | Wohnungseingangstüren inkl. Zargen: schleifen, 2× Lackanstrich | 10 | pcs (St) | wood | nein |
| 03.04 | Radiators incl. pipes: two coats radiator enamel | Heizkörper inkl. Rohre: 2× Heizkörperlack | 4 | pcs (St) | metal | nein |
| 03.05 | Window frames inside: sand and two coats enamel | Fensterrahmen innen: schleifen, 2× Lackanstrich | 5 | pcs (St) | wood | nein |
| 04.01 | Contingency: mould treatment on wall surfaces | Bedarfsposition: Schimmelbehandlung Wandflächen | 20 | m² | prep | **ja** |
| 04.02 | Hourly rate skilled painter (contingency) | Stundenlohnarbeiten Geselle (Bedarf) | 10 | h | labour | **ja** |

Regeln: Bedarfspositionen zählen nicht in die Angebotssumme (nur ausgewiesen). Vollständigkeit = alle Nicht-Bedarfspositionen bepreist. Nachweise (Seed pro Bieter, boolean): Handwerkskarte/Trade registration, Haftpflichtversicherung/Liability insurance, Referenz/Reference project, Unbedenklichkeitsbescheinigung/Tax clearance.

### Preisbuch (pro Bieter)

**Quelle im MVP: vorbereitete Beispieldatenbank, kein Upload.** PDF-/Altangebots-Parsen ist die wahrscheinlichste Stelle, an der eine Live-Demo scheitert, und frisst das Zeitbudget. Ein einfacher Tabellen-Import („alte Angebotszeilen einfügen") ist Stretch nach DoD.

Jeder Eintrag ist eine **echte historische Zeile** und trägt seine Herkunft mit, damit jeder Vorschlag belegbar ist:
`{ id, bidder_id, source_project, source_date, source_position_text, category, keywords[], unit, unit_price }`. Bieter A hat zu jeder Kategorie/Einheit Einträge; Bieter C ohne `metal` und ohne `h`. `suggest_prices` matcht deterministisch und erklärbar (kein LLM im Backend). Drei Regeln, alle drei nötig:

1. **Kategorie UND Einheit müssen übereinstimmen.** Sonst kein Vorschlag.
2. **Keyword-Treffer als Teilstring**, nicht als Wortgleichheit – deutsche Komposita: „Schimmelbehandlung" enthält „schimmel" und „behandlung", ist ihnen aber nicht gleich. Vorher normalisieren (Kleinschreibung, ä→ae, ö→oe, ü→ue, ß→ss).
3. **Mindestens ein Keyword-Treffer.** Konfidenz `high` ab zwei Treffern, `medium` bei einem, sonst `none` und kein Preis.

> **Zwei Korrekturen vom 31.08., beide von der Seed-Prüfung gefunden:**
> (a) Ein früherer Entwurf erlaubte als Rückfallebene „nur Einheit passt" – daraus wäre für „Heizkörper lackieren" (metal/St) der Türenpreis von 148 € geworden. Gestrichen.
> (b) Wortgleiches Matching ließ „Schimmelbehandlung" auf keinen Eintrag treffen; die Auswahl fiel dann auf den ersten Eintrag derselben Kategorie und hätte 3,20 € (Reinigen) für eine Schimmelsanierung vorgeschlagen – mit Herkunfts-Chip auf die falsche Zeile, also schlimmer als eine Lücke. Deshalb Teilstring plus Mindesttreffer.

**Geprüftes Sollergebnis** für Farbwerk Meier auf T-2026-014: 12 Vorschläge (10 `high`, 1 `medium`), genau zwei `none` (03.04, 04.02), Nettosumme **13.213,50 €**, Bedarfspositionen separat **370,00 €**. `seed/verify_seed.py` prüft das als ausführbare Referenz.

## 2. Screens

1. **Tenders** (Bidder): Liste mit Filter Gewerk/Ort/Frist; Karte → Tender öffnen.
2. **Tender / Bid** (Bidder, Hauptscreen): links LV-Tabelle (OZ, Text, Menge, Einheit, **Einheitspreis editierbar**, Gesamt), oben Summenleiste (Netto, Bedarfspositionen separat, Status, Frist-Countdown), rechts **Agent Panel**. Zeilen mit Vorschlag zeigen einen **Herkunfts-Chip**: „11.50 € · Luegallee 40, March 2026 (high)" mit Übernehmen-Button; Klick auf den Chip öffnet die Originalzeile aus dem Preisbuch (Projekt, Datum, Positionstext, Einheit, Preis). Ohne Treffer steht statt eines Preises „no comparable entry" – nie ein geratener Wert; agent-gesetzte Preise blinken kurz (Live-Feedback). Undo-Button (letzte 20 Änderungen). Buttons: „Check bid", „Ask client", „Submit bid" (Bestätigungsdialog). Nach Abgabe: Tabelle read-only, Banner „Submitted on …".
3. **Client dashboard** (Client, **nur lesen + Rückfragen beantworten** – kein Anlegen/Ändern von Ausschreibungen im MVP): Ausschreibungen mit Status/Anzahl Angebote; **Preisspiegel** (Positionen × Bieter, Min/Max/Ø, Ausreißer > ±30 % vom Median markiert, Rang); Bieterfragen mit Antwortfeld.
4. **Agent Panel** (beide Rollen, rechts, einklappbar): Tool-Liste (Name, readOnly-Badge), **Live-Log** der Tool-Aufrufe (Zeit, Tool, Input, Output-Kurzform, Dauer), 4 kopierbare Beispiel-Prompts, „Reset workspace"-Button, Link „How to enable WebMCP" (Chrome-Flag, ChatGPT-Desktop).
5. **About/How to test** (Route `/how-to-test`): 60-Sekunden-Anleitung für Juroren, Tool-Übersicht, Sicherheitsmodell.

Sprache: **DE/EN-Umschalter im Kopfbereich, Vorgabe Englisch** (gebaut am 01.09., nicht mehr Stretch). Die Sprache reist im Header `X-Language` und wird im Worker in `toTender`/`toPosition` aufgelöst; ohne Header gilt Englisch. Werkzeuge bleiben in beiden Sprachen englisch – Namen, Beschreibungen, Schemas, `reason`, `warnings`, Fehlerobjekte, Log-Zeilen. Der Sprache folgen nur Positionstexte und Nachweis-Bezeichnungen. Ein Sprachwechsel löst **kein** `toolchange` aus. Beträge und Mengen bleiben in beiden Sprachen `de-DE`, Datumsangaben folgen der Sprache. `/how-to-test` bleibt englisch.

## 2b. Designhaltung und Interaktionsregeln

**Haltung: Arbeitsgerät, nicht Cockpit.** Hell, dicht, echte Zahlen, keine Kacheln, keine Hero-Grafiken, kein dunkles „Agenten-Dashboard" – das liest die Jury als KI-Demo und ist das häufigste Einreichungsmuster. Zurückhaltung wie Linear oder das Stripe-Dashboard: enge Typografie, wenig Farbe, Farbe nur dort, wo sie etwas bedeutet.

**Mentales Modell: der Vorschlagsmodus in Google Docs.** Jemand anderes schlägt vor, der Vorschlag steht sichtbar im Dokument, er ist einer Quelle zugeordnet, der Mensch nimmt einzeln an oder verwirft – das Dokument bleibt seins. Wer das kennt, versteht BidDesk ohne Erklärung. Danach richten sich Chips, Übernehmen-Buttons und Undo.

**Die Inszenierung passiert IN der Tabelle, nicht daneben.** Keine Agent-Avatare, keine pulsierenden Effekte, keine Animation in der Seitenleiste. Was Mensch und Agent gemeinsam tun, muss am Artefakt selbst sichtbar sein.

- **Gestaffeltes Einlaufen (verbindlich):** Ein `set_unit_price` mit mehreren Zeilen bleibt technisch EIN Aufruf, wird aber im UI gestaffelt ausgerollt – ca. 60–80 ms je Zeile –, sodass das Auge folgen kann und die Summenleiste sichtbar mitläuft. Kein Sprung von leer auf fertig. Reduzierte Bewegung respektieren (`prefers-reduced-motion` → sofort setzen).
- Die zwei bewusst leeren Positionen wirken nur durch diesen Kontrast: Alles füllt sich, zwei Zeilen bleiben stehen.

**Vertrauen und Unsicherheit:**

- **Quellen-Chip statt Konfidenzbalken.** Der Chip sagt einen Satz, keinen Wert: „aus Luegallee 40, März 2026". **Keine Prozentangaben, keine Balken, keine Ampel** – eine Zahl, die die Maschine über sich selbst erfindet, installiert genau die Lesart „hier schätzt etwas", die wir loswerden wollen. Die interne Konfidenz (`high|medium|low`) steuert nur Reihenfolge und Wortwahl der Begründung, sie wird nicht als Skala angezeigt.
- **Unsicherheit erscheint als Abwesenheit, nicht als Warnung.** Feld bleibt leer, daneben in normaler Schrift „no comparable entry". Kein gelbes Dreieck, kein Ampelgelb – eine Lücke, die auf eine Handlung wartet.
- **Rot/Warnsymbole gibt es genau an einer Stelle:** im Prüfergebnis (`check_bid`) – Ausreißer, abgelaufener Nachweis, ablaufende Frist. Das sind Tatsachen über das Angebot, keine Selbsteinschätzung des Systems. Weil Rot sonst nirgends vorkommt, wirkt es dort.

**Reichweite der Farbdisziplin (Klarstellung 31.08.):** Sie gilt für das **Artefakt** – Tabelle, Summenleiste, Agent-Panel, Dialoge. Dort ist Rot ausschließlich im Prüfergebnis erlaubt und Gelb gar nicht. **Hilfe- und Dokumentationsseiten wie `/how-to-test` sind davon ausgenommen**: Dort darf genau ein hervorgehobener Kasten (bernsteinfarben) auf den Handoff hinweisen, weil er keinen Zustand des Angebots markiert, sondern eine Bedienhürde. Dieser Kasten darf im Hauptbildschirm nicht auftauchen.

**Zu vermeiden:** Konfidenz-Prozente, Ampelfarben an Preisen, Agent-Avatar/Chat-Blase im Hauptbereich, Dark-Mode-Cockpit, Fortschrittsbalken für Tool-Aufrufe (das Live-Log im Agent Panel genügt).

## 3. WebMCP-Tools

Registrierung über einen Wrapper `registerTool(def)`, der (a) `document.modelContext` nutzt, (b) auf `navigator.modelContext` zurückfällt, (c) jeden Aufruf ins Live-Log schreibt, (d) Fehler als strukturiertes `{ ok:false, error, hint }` zurückgibt (nie werfen), (e) Ergebnisse als JSON-Objekte liefert (kein HTML, keine Markdown-Tabellen – Text ist untrusted, siehe Sicherheit).

Kontextabhängige Registrierung: Bidder-Tools nur in Bidder-Rolle, Client-Tools nur in Client-Rolle; `submit_bid` wird nach Abgabe per AbortSignal abgemeldet. Jeder Wechsel löst `toolchange` aus.

Alle `inputSchema` als JSON Schema draft-07 mit `additionalProperties:false` und Beschreibungen je Feld.

### Bidder-Tools

1. `list_tenders` – readOnlyHint
   - input: `{ status?: "open"|"closed"|"all", trade?: string, city?: string, due_before?: string(date) }`
   - output: `{ tenders: [{ id, title, client, city, trade, due_date, positions_count, status, my_bid_status }] }`
2. `get_tender` – readOnlyHint
   - input: `{ tender_id: string }`
   - output: `{ id, title, client, due_date, positions: [{ oz, text, long_text, quantity, unit, category, contingency, my_unit_price|null, line_total|null }], required_documents: [...] }`
   - Nebenwirkung: öffnet den Tender im UI (Navigation) – im Description erwähnen.
3. `get_price_book` – readOnlyHint
   - input: `{ category?: string, query?: string }`
   - output: `{ entries: [{ id, category, keywords, unit, unit_price, source_project, source_date, source_position_text }] }`
   - **Kein `last_used`** – das Feld gab es im Datenmodell nie (Korrektur 31.08.). Die drei Herkunftsfelder sind das, was den Chip belegbar macht.
4. `suggest_prices` – readOnlyHint
   - input: `{ tender_id: string, oz?: string[] }`
   - output: `{ suggestions: [{ oz, unit_price|null, confidence: "high"|"medium"|"low"|"none", based_on: { price_book_id, source_project, source_date, source_position_text }|null, reason }] }`
   - Bei `confidence:"none"` **kein Preis**, sondern `reason: "no comparable entry in your price book"`. Nie schätzen.
   - UI: Vorschläge erscheinen als Chips in der Tabelle (Mensch kann einzeln übernehmen).
5. `set_unit_price` – schreibend (kein readOnlyHint)
   - input: `{ tender_id: string, prices: [{ oz: string, unit_price: number(≥0), note?: string }] }` (Batch, 1–50)
   - output: `{ applied: [{ oz, unit_price, line_total }], rejected: [{ oz, reason }], totals: { net, contingency, positions_priced, positions_open } }`
   - UI: Zeilen aktualisieren live + Highlight; Undo-Stack.
6. `check_bid` – readOnlyHint
   - input: `{ tender_id: string }`
   - output: `{ complete: boolean, open_positions: [oz], outliers: [{ oz, unit_price, price_book_price, deviation_pct }], missing_documents: [...], due_in_days, warnings: [string] }`
7. ~~`get_bid_state`~~ – **gestrichen am 31.08.**, vollständig in `check_bid` aufgegangen. `check_bid` liefert zusätzlich `status`, `totals`, `positions_priced`, `positions_open`, `undo_available`.
8. `ask_clarification` – schreibend, **zusätzlich deklarativ** als `<form toolname="ask_clarification" tooldescription="...">` mit `toolparamdescription` je Feld
   - input: `{ tender_id: string, oz?: string, question: string(≤500) }`
   - output: `{ question_id, status: "open" }`
9. `submit_bid` – schreibend, destruktiv
   - input: `{ tender_id: string, confirm: boolean }`
   - Verhalten: `confirm:false` → `{ ok:false, needs_confirmation:true, summary }`; `confirm:true` → UI-Bestätigungsdialog (Mensch klickt), erst dann Abgabe → `{ ok:true, submitted_at, total_net }`; danach Tool abmelden.
10. `undo_last_change` – schreibend; input `{ steps?: number(1–20) }`; output `{ undone: n, totals }`

### Grenzen des Agenten (bewusst fehlende Werkzeuge)

Es gibt **kein** Tool, um Positionen, Mengen oder Texte der Ausschreibung zu ändern – das Leistungsverzeichnis ist das Dokument des Auftraggebers, und im Vergabeverfahren darf ein Bieter daran nichts ändern. Ebenso wenig gibt es Tools zum Löschen, zum Anlegen von Ausschreibungen oder zum Abgeben ohne menschlichen Klick. Rollen sind getrennt: In der Bieterrolle sind Auftraggeber-Tools gar nicht registriert. Diese Lücken sind Absicht und gehören ins Write-up – sie zeigen die Grenzziehung, nicht fehlende Zeit.

**Prinzip: Lesen ist frei, Schreiben ist schmal und umkehrbar, Verbindliches braucht eine Hand.**

### Client-Tools

11. `get_price_comparison` – readOnlyHint
    - input: `{ tender_id: string }`
    - output: `{ bidders: [{ bidder_id, name, total_net, complete, rank }], positions: [{ oz, text, prices: [{ bidder_id, unit_price, line_total }], min, max, median, outliers: [bidder_id] }] }`
12. `list_clarifications` – readOnlyHint, **untrustedContentHint** (Fragetexte stammen von Bietern)
    - input `{ tender_id?: string, status?: "open"|"answered" }`; output `{ questions: [{ id, tender_id, oz, bidder, question, answer|null }] }`
13. `answer_clarification` – schreibend; input `{ question_id, answer: string(≤500) }`; output `{ ok, published_to: "all bidders" }`

Bidder-Tool `list_clarifications` ebenfalls verfügbar (readOnly, untrustedContent), damit der Bieter-Agent Antworten sieht.

### Beispiel-Prompts (Agent Panel + Video)
1. "Open tender T-2026-014 and price every position from my price book. Flag anything you're not confident about."
2. "Why is there no price for the radiators?"
3. "Run a check on my bid – anything that looks off compared to my price book?"
4. "Ask the client whether the scaffolding from the previous trade will still be in place."
5. "Submit the bid." (→ Bestätigungsdialog)
Client: "Compare all bids for the facade tender and tell me who is cheapest but complete."

## 4. Architektur

- **Frontend**: React + Vite + TypeScript, Tailwind. Basis: Cloudflare `agents/examples/webmcp-react` (Hook zum Registrieren von Tools) – prüfen, ob der Hook `document.modelContext` schon unterstützt; sonst eigener Wrapper.
- **Backend**: Hono auf Cloudflare Workers, D1 (SQLite). Ein Worker liefert API (`/api/*`) und statische Assets.
- **Workspace-Isolation**: beim ersten Besuch `POST /api/workspace` → id (UUID), in `localStorage` + URL `?ws=` (damit Juroren einen Link teilen können). Alle Tabellen haben `workspace_id`. `POST /api/workspace/:id/reset` seedet neu. Aufräumen: Workspaces älter als 7 Tage per Cron-Trigger löschen.
- **Tabellen**: `workspaces`, `tenders`, `positions`, `bidders`, `price_book`, `bids` (bidder × tender, status), `bid_prices` (bid × oz), `clarifications`, `change_log` (für Undo und Änderungsprotokoll).
- **Tools** rufen `fetch('/api/...')` auf und schreiben das Ergebnis in den React-Store (Zustand/Context) → UI aktualisiert sich; gleiche Store-Aktionen wie bei manueller Bedienung (eine Wahrheit).
- **Deploy**: `wrangler deploy`; URL `biddesk.<account>.workers.dev` (oder Custom-Domain unter merkur-impulse.com, wenn schnell). Origin-Trial-Token für die finale Origin im `<meta http-equiv="origin-trial">` (Mo).
- **Kein LLM im Backend.** Die Intelligenz sitzt im Agenten des Nutzers; BidDesk liefert Werkzeuge + deterministische Heuristik. Das ist die WebMCP-These und im Write-up so zu benennen.

## 5. Sicherheit (ins Write-up übernehmen)

- Permissions-Policy `tools=self`; keine Cross-Origin-iframes.
- Lese-Tools mit `readOnlyHint`, Schreib-Tools ohne; destruktive Aktion (`submit_bid`) nur mit menschlicher Bestätigung im UI – niemals allein per Tool-Argument.
- `untrustedContentHint` auf allen Tools, die nutzergenerierten Text zurückgeben (Bieterfragen/Antworten) → Prompt-Injection-Grenze; im UI zusätzlich Hinweis „content from other parties".
- Tool-Ausgaben sind reine JSON-Daten, keine Anweisungen; Längenlimits auf Freitext.
- Workspace-Isolation statt Login; keine personenbezogenen Daten (alle Firmen fiktiv).
- Ratenlimit pro Workspace im Worker (einfach: 60 Requests/Minute).

## 6. Evals & Tests

- **WebMCP Evals** (Chrome-Framework) mit 6 Fällen: (1) Tender öffnen + alle Positionen bepreisen, (2) offene Positionen nennen, (3) Ausreißer finden, (4) Bieterfrage stellen, (5) Abgabe verlangt Bestätigung, (6) Client-Preisspiegel. Ergebnisse als Tabelle ins README.
- Unit-Tests (vitest) für Heuristik `suggest_prices`, Summenlogik (Bedarfspositionen), Preisspiegel-Statistik, Undo.
- Manuelle Testmatrix: ChatGPT-Desktop-Browser (Pfeil in Adressleiste sichtbar? Bestätigung bei submit?) × Chrome mit Flag + Model Context Tool Inspector. Jeden Tool-Aufruf einmal durchspielen.

## 7. Akzeptanzkriterien (Definition of Done für die Einreichung)

1. Live-URL ohne Login; frischer Besucher landet in eigenem Workspace mit Seed-Daten; Reset funktioniert.
2. Alle 13 Tools registriert, im Tool Inspector sichtbar, mit korrekten Annotations; `toolchange` bei Rollenwechsel und nach Abgabe.
3. Jeder agent-gesetzte Preis zeigt seinen Herkunfts-Chip; im Haupt-Tender liefern **mindestens zwei Positionen bewusst keinen Vorschlag** (Lücke im Preisbuch) und der Mensch trägt sie ein – das ist die Kernszene des Videos.
4. Prompt 1–5 laufen im ChatGPT-Desktop-Browser und in Chrome fehlerfrei durch; UI aktualisiert sich live; `submit_bid` erzwingt den Dialog.
5. Agent Panel zeigt Live-Log und Prompts; `/how-to-test` vorhanden.
6. Repo öffentlich, MIT-Lizenz erkannt, README mit 60-Sekunden-Test, Architektur, Tool-Tabelle, Eval-Ergebnisse, Security-Abschnitt.
7. Video < 3 Min auf YouTube (öffentlich), englisch, mit Audio.
8. Devpost-Text entlang der vier Pflichtpunkte (siehe docs/04-submission.md).

## 8. Stretch (nur nach DoD)

> **Zwei davon sind erledigt und damit kein Stretch mehr** – der GAEB-X83-Import am
> 01.09. (`docs/07` Schritt 11) und der DE/EN-Umschalter am 01.09. (`docs/07` Schritt 12).
> Sie stehen hier durchgestrichen, statt gelöscht zu werden, damit lesbar bleibt, wovon
> diese Liste ausging und was sich daran geändert hat.

- ~~DE/EN-Umschalter im UI.~~ **Gebaut am 01.09.** Die Zielkorrektur, die ihn nach vorn
  zog: Die Demo soll Kunden gewinnen, Publikum sind deutsche Handwerksbetriebe und
  Hausverwaltungen, die Jury ist ein Sonderfall davon. Ein Malermeister sieht sich keine
  englische Oberfläche an. Einzelheiten in §2.
- ~~GAEB DA XML (X83) Import für eigene LVs~~ **gebaut am 01.09.**, auf einer Datei, die
  der Parser nie gesehen hatte. **X84-Export des Angebots bleibt offen.**
- Auftraggeber legt eigene Ausschreibung an (Agent-Authoring, `create_tender`, `add_position`).
- `list_tenders` optional mit echten Bekanntmachungen aus dem Datenservice Öffentlicher Einkauf (API-Zugang zuerst prüfen).

## 9. Plan (Stand Montag, 31.08.2026, 11:30 Uhr – Budget 30–40 h)

Heute ist Montag, 31.08. Gebaut ist noch nichts. Nils' Budget: **30–40 Stunden bis Mittwochabend**, also im Kern Vollzeit an drei Tagen. Damit ist der volle Scope aus §1–§3 (13 Tools, beide Rollen) machbar; der Überschuss geht **nicht in mehr Funktionen, sondern in Tiefe, Beweise und ein besseres Video**.

- **Mo 31.08. (ab 11:30, ca. 11 h):**
  1. *Erste Stunde:* Deploy-Pfad beweisen – leere App auf der finalen Worker-URL, bevor Fachlogik entsteht.
  2. Datenmodell + Seed einspielen; Workspace-Isolation.
  3. Tool-Wrapper (document/navigator, Log, Fehlerform), `list_tenders`, `get_tender`, `get_price_book`.
  4. **Tagesziel bis spätestens 18:00: ChatGPT-Desktop ruft ein Tool von dieser URL auf.** Ab da ist das Hauptrisiko weg.
  5. Abends: Bid-Screen mit LV-Tabelle, `suggest_prices` mit Herkunfts-Chip, `set_unit_price` mit gestaffeltem Einlaufen.
- **Di 01.09. (ca. 12 h):** `check_bid`, `ask_clarification` (imperativ + deklaratives Formular), `submit_bid` mit Dialog und Abmeldung, Undo als Block, Agent Panel mit Live-Log und Prompts, Client-Screen mit `get_price_comparison` und Rückfragen. Seed vollständig (3 Ausschreibungen, 3 Bieter). **Abends: kompletter Prompt-Durchlauf in ChatGPT-Desktop UND Chrome.** Origin-Trial-Token für die finale Origin eintragen, damit Chrome ohne Flag funktioniert.
- **Mi 02.09. vormittags (ca. 5 h):** GAEB-DA-XML-Import (X83) – **harter Abbruch um 13:00**, wenn er nicht läuft, fliegt er raus. Danach WebMCP-Evals, Lighthouse-Agentic-Audit, Security-Härtung, Ratenlimit, `/how-to-test`, DE/EN-Umschalter.
- **Mi 02.09. ab 15:00: FEATURE FREEZE.** Ab hier nur noch Video, README, Devpost-Text, Screenshots. **Einreichen bis 21:00.**
- **Do 03.09.:** Nur Notfall bis 22:00. Nicht verplanen.

## 10. Wofür der Überschuss ausgegeben wird (Stand 31.08.)

Voller Scope aus §1–§3 gilt: 13 Tools, beide Rollen. Zusätzlich, in dieser Rangfolge:

1. **GAEB DA XML (X83) importieren** – der Dateiformat-Standard, in dem deutsche Leistungsverzeichnisse tatsächlich ausgetauscht werden. Eine echte Datei hineinziehen und daraus bepreisbare Positionen bekommen, ist der stärkste Realitätsbeweis, den dieses Projekt haben kann. Zeitbox Mittwochvormittag, harter Abbruch 13:00.
2. **Origin-Trial-Token** statt Chrome-Flag – senkt die Hürde für Juroren auf null. Wer erst ein Flag setzen muss, testet im Zweifel nicht.
3. **WebMCP-Evals + Lighthouse-Agentic-Audit** mit veröffentlichten Ergebnissen im README – macht kaum jemand, zahlt direkt auf „WebMCP Leverage" ein.
4. **Videobudget verdoppeln** (5–6 h statt 2–3 h). Ein besseres Video schlägt ein 14. Werkzeug, weil die Jury zuerst das Video sieht.
5. **DE/EN-Umschalter** – ~~für die Jury egal~~, für Kundengespräche entscheidend. **Am 01.09. gebaut und dabei auf Platz eins gezogen**: Wenn die Demo Kunden gewinnen soll, ist die deutsche Fassung nicht das Nachspiel, sondern die Hauptsache. Englisch bleibt die Vorgabe, damit ein Juror ohne Vorgeschichte in seiner Testsprache ankommt.
6. **Deutsche Zweitfassung des Videos** nach der Einreichung, für Website und Vertrieb.

**Bewusst NICHT, auch mit 30–40 h:**

- **Kein Live-Feed öffentlicher Ausschreibungen.** Fachlicher Grund, nicht Zeitgrund: Öffentliche Bekanntmachungen enthalten Metadaten, nicht das Leistungsverzeichnis – das hängt als GAEB oder PDF daran. Ein Feed brächte eine Liste, die den Kern-Ablauf nicht berührt. Der GAEB-Import trifft dasselbe Ziel am richtigen Artefakt.
- **Kein Anlegen von Ausschreibungen durch den Auftraggeber.** Verdoppelt die Oberfläche, ohne die These zu stärken.
- **Keine weiteren Tools über die 13 hinaus.** Mehr Werkzeuge machen den Agenten schlechter, nicht besser.
- **Keine Anmeldung.** Rollen sind über Tool-Registrierung getrennt, nicht über Rechte – das ist die stärkere WebMCP-Demonstration. Im README als Demo-Vertrauensmodell benennen.
- **Keine zweite Einreichung.** Eine starke Arbeit schlägt zwei halbe, und der Marketingwert liegt ohnehin in dieser einen.

## 11. Betriebsfragen – verbindlich beantwortet (31.08.2026)

### 11.1 Erster Eindruck und Rückkehr in den Ausgangszustand

**Der Einstieg ist der Bid-Screen, keine Startseite.** Ein Juror mit vierzig offenen Tabs darf nicht navigieren müssen: Die URL öffnet direkt T-2026-014 in der Bieterrolle als Farbwerk Meier. Sichtbar sind die 14 Positionen mit Mengen und Einheiten, die Preisspalte leer, Summe 0,00 €. Die leere Spalte ist die Aufforderung.

Kopfzeile: Rollenwahl (Bieter Farbwerk Meier / Auftraggeber Rheinpark) und ein Link „How to test in 60 seconds". Rechts das Agent Panel, **standardmäßig offen**, mit vier Elementen:

1. **Selbstdiagnose als erste Zeile** – live geprüft: „WebMCP detected · 11 tools registered" (grün; 10 bis zum 02.09.) oder „WebMCP not available in this browser" mit beiden Wegen (ChatGPT-Desktop-Browser, Chrome mit Origin Trial bzw. Flag). Das ist die wichtigste Zeile der ganzen Anwendung: Der wahrscheinlichste Ausfall ist ein Juror, der die Seite in einem normalen Browser öffnet und daraus „funktioniert nicht" schließt. Die Seite muss sich selbst diagnostizieren.
2. Die vier bis fünf **Beispiel-Prompts** zum Kopieren.
3. Das **Live-Log**, leer, mit Platzhalter „tool calls appear here".
4. **Reset demo**.

Kein Modal, kein Cookie-Banner, kein Onboarding-Overlay.

**Rückkehr in den Ausgangszustand – drei Mechanismen:**

- *Standardfall:* Ein Besucher ohne bekannten Workspace bekommt einen **neuen**, frisch geseedeten. Ein Juror startet also immer sauber, ohne etwas zu tun.
- *Knopf:* „Reset demo" → `POST /api/workspace/:id/reset` löscht die Zeilen dieses Workspace und spielt den Seed in **einem D1-Batch** neu ein, unter einer Sekunde, idempotent.
- *Netz:* Zeigt `?ws=` oder localStorage auf einen Workspace, den es nicht mehr gibt (Aufräumlauf), wird still ein neuer erzeugt – **kein Fehlerbildschirm**.

**Der Reset muss auch den Werkzeugzustand zurücksetzen.** Nach `submit_bid` ist das Werkzeug abgemeldet; nach dem Reset muss es wieder registriert sein und `toolchange` feuern. Das ist die wahrscheinlichste Fehlerquelle beim zweiten Demo-Durchlauf.

*Abnahme:* Ein Klick auf Reset führt zu 14 Positionen, keinen Preisen, Summe 0,00 €, leerem Log und wieder registriertem `submit_bid`.

### 11.2 Teilweise schreibbarer Preisblock

**Regel: pro Zeile prüfen, gültige Zeilen in EINEM atomaren Batch schreiben, Ergebnis pro Zeile zurückgeben. Kein Rollback wegen einzelner schlechter Zeilen.**

Begründung: Ein Angebotsentwurf ist keine Finanztransaktion. Alles zurückzurollen, weil Zeile 7 von 12 unbrauchbar ist, zwingt zur Wiederholung und sieht auf dem Bildschirm kaputt aus – Zeilen erscheinen und verschwinden wieder. Das fachliche Vorbild ist der Kollege, der elf Felder füllt und zum zwölften sagt: das konnte ich nicht.

Ablauf:

1. **Validierung vor dem Schreiben**, je Zeile. Abweisungsgründe: unbekannte OZ; Preis nicht numerisch, negativ oder über 1.000.000; Angebot bereits abgegeben (gesperrt); doppelte OZ im selben Aufruf.
2. Die gültigen Zeilen gehen als **ein D1-Batch** raus – dadurch kann kein halb geschriebener Zustand durch einen Infrastrukturfehler entstehen.
3. Rückgabe: `applied[]`, `rejected[{oz, reason}]`, neu berechnete Summen. Die Gründe sind maschinenlesbar, damit der Agent gezielt nachbessern kann.
4. Der Schreibvorgang landet als **ein Block** im `change_log` (mit Block-ID). Undo nimmt den ganzen Block zurück, nicht einzelne Zeilen – das ist der übernommene Gedanke aus dem Pull-Request-Modell.

UI: Abgewiesene Zeilen bekommen eine Markierung **in der Zeile** mit dem Grund, keine Meldung, die wieder verschwindet. Das gestaffelte Einlaufen gilt nur für die `applied`-Zeilen.

### 11.3 Isolation und Lebensdauer des Zustands

- **Kennung:** UUID je Workspace, erzeugt beim ersten Besuch, gespeichert in **localStorage**. Kein Cookie (kein Consent-Thema, keine SameSite-Probleme im eingebetteten ChatGPT-Browser).
- **Lebensdauer:** Der Zustand überlebt Neuladen und Browser-Neustart. Serverseitig **7 Tage**, danach löscht ein täglicher Cron-Lauf. Grund: Ein Juror kann unterbrochen werden und am nächsten Tag weitermachen; die Jurierung läuft bis 21.09.
- **Kein `?ws=`-Parameter, kein „Stand teilen"-Knopf.** Beides gestrichen am 31.08. Der Zustand lebt ausschließlich in localStorage. Damit ist die eingereichte URL **konstruktionsbedingt** sauber – der schlimmste Fall (jemand kopiert eine URL mit fremdem, benutztem Zustand ins Devpost-Formular) kann nicht mehr eintreten, statt nur durch Disziplin vermieden zu werden. Ein Codepfad weniger.
- **Kein localStorage verfügbar** (privater Modus, eigenes Profil im ChatGPT-Browser): neuer Workspace bei jedem Laden. Das ist ein sauberer Zustand, also ein akzeptabler Rückfall – nie ein Fehler.
- Größenordnung: rund 80 Zeilen je Workspace; tausend Juroren sind 80.000 Zeilen. Für D1 belanglos.

### 11.4 Gate heute, Montag 31.08., 18:00 – nur bestanden / nicht bestanden

Alle drei Bedingungen müssen zutreffen. Teilerfüllung gilt als nicht bestanden.

1. Die produktive URL liefert die Anwendung – nicht „Hello World", nicht 404, nicht die lokale Entwicklungsumgebung.
2. Ein frisch geöffneter Browser ohne `?ws=` zeigt die 14 Positionen aus dem Seed mit Mengen und Einheiten.
3. Im ChatGPT-Desktop-Browser ruft ChatGPT `get_tender` auf dieser URL erfolgreich auf, und der Aufruf erscheint im Live-Log der Seite.

**Folge bei „nicht bestanden":** GAEB-Import entfällt sofort und endgültig. Der Auftraggeber-Teil rutscht auf „nur wenn Dienstag hält". Der Dienstag beginnt mit der offenen Bedingung, nicht mit neuen Funktionen.

**Zweiter Prüfpunkt heute 23:00** (gleiche Logik, zwei Bedingungen): `suggest_prices` liefert für Farbwerk Meier auf T-2026-014 zwölf Vorschläge mit Herkunft und genau zweimal `none` (03.04, 04.02); `set_unit_price` schreibt einen Block und die Summenleiste zeigt danach den korrekten Nettobetrag.

### 11.5 Feature Freeze, Mittwoch 02.09., 15:00

**Fertig sein muss um 15:00:**

- Der gesamte auszuliefernde Code, im Repository, auf der produktiven URL deployt und rauchgetestet.
- Der vollständige Prompt-Durchlauf **in beiden Browsern** bestanden, aus einem frischen Workspace: ChatGPT-Desktop und Chrome.
- Reset geprüft, inklusive Wiederanmeldung von `submit_bid`.
- `verify_seed.py` grün gegen die deployte Datenbank.
- Alle Screenshots gemacht (sie zeigen die endgültige Oberfläche).
- Die Entscheidung über GAEB gefallen – drin oder raus, nichts Halbes.

**Nach 15:00 ausschließlich erlaubt:** Video (Aufnahme, Schnitt, Upload, auf öffentlich stellen), README, Lizenzdatei, Devpost-Text, Bildunterschriften, das Ausfüllen und Absenden des Formulars. Dazu reine Textkorrekturen in der Oberfläche, wenn danach der Fünf-Prompt-Rauchtest erneut läuft.

**Nach 15:00 verboten:** neue Funktionen, neue Werkzeuge, Schemaänderungen, Refactorings, das „schnell noch" behobene unkritische Problem.

**Einzige Ausnahme – demo-blockierender Fehler**, definiert als: Die Anwendung lädt nicht, der Reset funktioniert nicht, oder einer der fünf Demo-Prompts schlägt fehl. Dann: beheben, neu deployen, **die volle Matrix in beiden Browsern erneut durchlaufen**. Alles, was nicht demo-blockierend ist, wandert stattdessen als „known limitation" ins README. Offen benannte Grenzen sind bei dieser Jury ein Plus, kein Makel.

**Planungskorrektur, die daraus folgt:** Zwischen Freeze (15:00) und Einreichung (21:00) liegen sechs Stunden. Video (≈6 h) und Texte (≈3 h) passen dort nicht hinein. Deshalb: **Videoskript und Devpost-Entwurf entstehen am Dienstagabend**, sobald der Ablauf einmal durchläuft – beide brauchen den fertigen Ablauf, nicht den fertigen Code. Der Mittwochnachmittag ist dann nur noch Aufnahme, Schnitt, Upload, ein Textdurchgang und das Absenden (≈5,5 h).

**Sicherungsaufnahme:** Sobald der Ablauf am Dienstagabend das erste Mal komplett durchläuft, einmal ungeschnitten mitschneiden. Wenn der Mittwoch schiefgeht, existiert ein brauchbares Video. Kostet zwanzig Minuten.

## 12. Demo-Prompts, Grenzen, GAEB-Gate (31.08.2026)

### 12.1 Die fünf Prompts und ihr überprüfbares Ergebnis

Wortlaut englisch, weil die Jury englisch testet. Diese fünf sind zugleich Rauchtest, Eval-Fälle und Videodrehbuch. Ausgangspunkt ist immer ein **frischer Workspace**.

**P1 – „Open tender T-2026-014 and price every position from my price book. Flag anything you're not confident about."**
Sichtbar: Der Tender öffnet sich. Zwölf Zeilen füllen sich gestaffelt, jede mit Herkunfts-Chip. **03.04 und 04.02 bleiben leer** mit „no comparable entry". Summenleiste: **13.213,50 € netto**, Bedarfspositionen separat **370,00 €**, elf von zwölf Nicht-Bedarfs-Positionen bepreist. Log: `get_tender` → `suggest_prices` → `set_unit_price` (ein Block, 12 applied, 0 rejected).

**P2 – „Why is there no price for the radiators?"** (geändert 01.09.: der alte Wortlaut „Which positions are still open and what's my total right now?" war nach P1 redundant – der Agent hatte die Antwort gerade selbst genannt.)
Sichtbar: **Keine Schreibvorgänge.** Der Agent schlägt 03.04 nach und antwortet, dass das Preisbuch für Kategorie `metal` und Einheit `pcs` keinen Eintrag hat – eine echte Lücke, kein verschwiegener Schätzwert. **Er darf keine Zahl anbieten.** Log: nur Lese-Aufrufe. Das ist der Prompt, der die Kernaussage abfragt, statt sie zu wiederholen.

**P3 – „Run a check on my bid – anything that looks off?"**
Sichtbar: Prüfergebnis mit drei Befunden – zwei offene Positionen, **abgelaufene Unbedenklichkeitsbescheinigung**, verbleibende Tage bis zur Frist. Nur hier erscheint Rot. Im Video zusätzlich ein Ausreißer, weil vorher von Hand ein Zahlendreher gesetzt wurde; für den Rauchtest ist der Ausreißer optional, die drei Befunde sind Pflicht.

**P4 – „Ask the client whether the scaffolding from the roofing works will still be in place."**
Sichtbar: Neue Rückfrage erscheint mit Status „open" in der Liste. Log: `ask_clarification` als Schreibvorgang. Kein Preis ändert sich.

**P5 – „Submit the bid."**
Sichtbar: Der Agent gibt **nicht** ab, sondern liefert `needs_confirmation` mit Zusammenfassung; der Bestätigungsdialog erscheint mit der Endsumme; **erst der menschliche Klick** gibt ab. Danach: Tabelle gesperrt, Banner „Submitted on …", `submit_bid` abgemeldet, **die Selbstdiagnose zählt eins weniger**.

*Zusatzprompt für den zweiten Akt (nicht Teil der fünf):* „Compare all bids for the facade tender and tell me who is cheapest but complete." → Preisspiegel für T-2026-009 mit markiertem Ausreißer bei Colorpoint.

### 12.2 Werkzeugzahl – aufgelöst

Der Widerspruch war echt: Die frühere „13" zählte `list_clarifications` doppelt (beide Rollen) und enthielt `get_bid_state`, das nun in `check_bid` aufgegangen ist.

**Dreizehn verschiedene Werkzeuge** (zwölf bis zum 02.09.; das dreizehnte, `set_document_validity`, kam mit CC-05 und ist das einzige, das nach dieser Zählung noch dazukam). Registriert sind nie alle gleichzeitig:

- **Bieterrolle, Ausgangszustand: 11** – `list_tenders`, `get_tender`, `get_price_book`, `suggest_prices`, `set_unit_price`, `check_bid`, `ask_clarification`, `list_clarifications`, `undo_last_change`, `set_document_validity`, `submit_bid`.
- **Bieterrolle nach Abgabe des geöffneten Tenders: 10** – `submit_bid` ist abgemeldet; `set_document_validity` bleibt, weil Nachweise Stammdaten des Bieters sind – das Angebot ist gesperrt, nicht der Betrieb. Öffnet der Nutzer einen anderen Tender mit Entwurfsangebot, wird es wieder registriert. Das ist die sichtbarste `toolchange`-Demonstration.
- **Auftraggeberrolle: 5** – `list_tenders`, `get_tender`, `get_price_comparison`, `list_clarifications`, `answer_clarification`.
- Gemeinsam in beiden Rollen: `list_tenders`, `get_tender`, `list_clarifications`.

**Die Selbstdiagnose zählt zur Laufzeit über `getTools()`**, sie enthält keine fest verdrahtete Zahl. Damit kann sie nie wieder der Wirklichkeit widersprechen.

**Wie die 11 zustande kommt (01.09., aus dem ChatGPT-Befund; seit 02.09. mit `set_document_validity`):** zehn imperativ registrierte Werkzeuge plus `ask_clarification` – als Formular dort, wo der Browser das Formular-Werkzeug in `getTools()` **listet**, sonst als imperativer Zwilling. Die Feature-Erkennung an `SubmitEvent` entscheidet das nicht mehr: Sie beweist die DOM-API, nicht, dass ein Agent das Werkzeug sieht. ChatGPTs Browser trägt die Erweiterung, listet aber keine Formulare – die Seite zählte zehn, der Agent sah neun, und Prompt 4 endete als getippter, nie gesendeter Text im Formularfeld. Gezählt wird deshalb nur, was der Browser bestätigt; ein deklariertes, aber nicht gelistetes Formular erscheint als „declared by form · not confirmed by this browser" und nicht in der Zahl. Solange der Browser noch entscheidet, wird unter dem Namen nichts angemeldet – Chrome 152 weist einen Doppelnamen mit `InvalidStateError` ab.

**Die Rollengrenze liegt im Worker (02.09., CC-09).** Registrierung ist Sichtbarkeit, nicht Grenze. Zwei externe Reviews fanden am 02.09. denselben Fehler: `get_tender` und `list_tenders` waren als gemeinsame Werkzeuge auch beim Auftraggeber registriert, `api.ts` schickte `X-Bidder-Id` weiter, und der Worker kannte keine Rolle – `get_tender(T-2026-014)` lieferte dem Auftraggeber den vollständigen Entwurf des zuletzt gewählten Bieters (Preise, Zeilensummen, `set_by`, `note`, Herkunft, Nachweise), während die Oberfläche „versiegelt" versprach. Seitdem reist `X-Role: bidder | client` wie `X-Language` (ohne Header gilt `bidder`, Evals und `/how-to-test` unverändert), wird im Worker an **einer** Stelle gelesen (`readRole`), und daraus folgt alles Weitere: `GET /api/tenders` und `GET /api/tenders/:id` projizieren je Rolle – der Auftraggeber erhält Positionen nur mit `oz`, `text`, `long_text`, `quantity`, `unit`, `category`, `contingency`, kein `bidder_id`, kein `my_bid_status`, keine `required_documents`, keinen Preis-Schlüssel, und ein Feld `role:"client"`; Bieter-Endpunkte (price-book, suggestions, prices, check, submit, undo, documents, Rückfrage stellen) antworten dem Auftraggeber mit `403 { ok:false, error:"role_not_allowed", hint }`, Client-Endpunkte (comparison, answer) dem Bieter ebenso. **Preise erreichen den Auftraggeber ausschließlich über `get_price_comparison`** – vor Fristende versiegelt, danach der Preisspiegel; `get_tender` liefert ihm auch nach Fristende keine. Die drei gemeinsamen Werkzeuge behalten Name und Schema und tragen je Rolle eine eigene Beschreibung (die des Auftraggebers ohne „this contractor's own price"); `get_tender` trägt `untrustedContentHint`, weil Positionstexte Fremdtext sind. Werkzeugzahl unverändert 13 / 11 / 10 / 5. Ein Test hält die Projektion rekursiv geschlossen (kein Schlüssel `my_unit_price`, `line_total`, `set_by`, `note`, `source`, `price_book_id`, `required_documents`, `bidder_id`, `my_bid_status`, `valid_until` in der Antwort, für B-A, B-B, B-C); Sabotage-Probe: `readRole` fest auf `bidder` macht genau die drei Rollentests rot.

**Abgabe: Blocker sind keine Bestätigung (02.09., CC-09).** Eine Funktion entscheidet über Abgabefähigkeit, `submissionBlockers()` in `src/submission.ts`: offene Nicht-Bedarfspositionen, abgelaufene und fehlende Pflichtnachweise; Bedarfspositionen blockieren nie. `check_bid` liefert sie als `blockers`, `submit_bid` antwortet bei Blockern `{ ok:true, status:"blocked", blockers:[{kind:"open_position", oz, text}, {kind:"document_expired", doc_type, label, valid_until}, {kind:"document_missing", …}], summary }` – mit `confirm:false` **und** `confirm:true`, ohne Dialog; ohne Blocker `{ ok:true, status:"needs_confirmation", summary }` und der Dialog wie bisher. Nie mehr `ok:false` zusammen mit `needs_confirmation:true`. Der Worker weist `POST /submit` bei Blockern mit `409 bid_blocked` ab. Im UI ist der Abgabeknopf bei Blockern deaktiviert und zeigt die Liste mit den Handlungssätzen aus CC-04/05; im Live-Log heißt der Ausgang `BLOCKED`, weder Fehlschlag noch Schreibvorgang. E5 erwartet seitdem `blocked` mit 03.04 und `tax_clearance`.

### 12.3 Known Limitations – bewusst dokumentiert statt gebaut

1. **Kein vergaberechtlich belastbares Verfahren.** Echte Ausschreibungen verlangen versiegelte Angebote bis zum Submissionstermin und ein manipulationssicheres Protokoll. BidDesk zeigt Status und Sperre, keine Kryptografie. Grenze der Demo, nicht der Idee.
2. **Preisbuch stammt aus vorbereiteten Daten.** Import echter Altangebote (PDF, GAEB X84) fehlt. Der Beleg-Mechanismus ist echt, die Befüllung ist es nicht.
3. **Keine Anmeldung, keine Autorisierung.** Der Rollenwechsel ist ein Demo-Mechanismus; jeder Besucher sieht beide Seiten. Rollen sind über Werkzeug-Registrierung getrennt, nicht über Rechte.
4. **Das Matching ist bewusst konservativ.** Es opfert Trefferquote für Präzision: abweichende Formulierungen und Synonyme führen zu „no comparable entry" statt zu einem unsicheren Preis. Ein falscher Preis mit Herkunfts-Chip wäre schädlicher als eine Lücke.
5. **Der Agent kann keinen frei genannten Preis eintragen – aber vorschlagen und herleiten.** (Umgeschrieben am 02.09., CC-04.) Ein Preis ohne Preisbuchzeile wird nicht geschrieben und nicht mehr abgewiesen: Er erscheint als kleine Bestätigung an der Zeile, mit Rechnung, mit der Herleitung des Agenten („4 Heizkörper à 25 Min bei Ihrem Stundensatz von 58 €") und mit dem Satz, woher der Wert *nicht* kommt. Erst der Klick des Menschen schreibt ihn – als `set_by='human'` ohne Herkunft, wahrheitsgemäß, weil eine Hand genau diesen Wert freigegeben hat, mit `change_log`-Block für `undo_last_change`. Keine eigene Autorität heißt Bestätigung, nicht Sackgasse – dasselbe Muster wie `submit_bid`.
6. **Ein Bieter je Workspace, Desktop-first.** Gleichzeitiges Arbeiten mehrerer Bieter im selben Zustand ist nicht getestet; die Oberfläche ist für Desktop ausgelegt, weil der ChatGPT-Browser dort läuft.
7. **Nachweise sind Metadaten** (02.09., CC-05). Ein Nachweis ist hier Bezeichnung plus Gültigkeitsdatum. Nichts wird hochgeladen, gespeichert oder geprüft: `set_document_validity` reicht ein Datum weiter, das ein Mensch nennt, der Mensch bestätigt es auf der Seite, und die Bestätigung sagt ausdrücklich, dass hier nichts hochgeladen oder geprüft wurde.

### 12.4 GAEB – binärer Go/No-Go

**Test (bestanden / nicht bestanden):** Eine GAEB-X83-Datei, **die der Parser nicht kennt** (zweites, anders aufgebautes Beispiel: andere Kategoriebezeichnungen, andere Einheiten-Schreibweisen, andere Positionsanzahl), wird auf die Seite gezogen und erzeugt eine Ausschreibung mit allen Positionen, Mengen und Einheiten, die anschließend mit `suggest_prices` bepreisbar ist – **ohne Codeänderung**. Alles andere ist nicht bestanden. Abbruch spätestens Mittwoch 13:00.

**Was der Import beweist, was Seed-Daten nicht können:** Er zeigt den **Eingang**. Seed-Daten beweisen die Interaktion, aber nicht, woher ein Leistungsverzeichnis kommt – und in der Wirklichkeit kommt es nie aus unserer Datenbank, sondern als Datei aus der AVA-Software des Auftraggebers. Mit dem Import wird aus der Behauptung „das ginge mit jeder Ausschreibung" eine vorführbare Tatsache, und aus einer Demo mit erfundenen Daten eine Anwendung mit einem Anschluss an die reale Werkzeugkette. Das zahlt auf „Potential Impact" ein.

**Was er nicht beweist:** Produktionsreife. Unsere Beispieldateien sind handgebaut und keine zertifizierten Exporte; die Kennzeichnung der Bedarfsposition ist nicht verifiziert. Genau so gehört es ins README – als Stärke formuliert, nicht als Ausrede.

## 13. Beweisführung und Missverständnisse (31.08.2026)

### 13.1 Der eine Satz nach 90 Sekunden

> **„Ein Agent wird im Betrieb erst dann brauchbar, wenn er nichts erfindet, was im Angebot landet, und nichts allein verbindlich macht – dann aber sofort."**

Englisch fürs Write-up (Fassung vom 31.08., enger als der erste Entwurf): *„An agent becomes useful inside a real business the moment it invents no business facts and holds no authority of its own."*

**Präzisiert am 02.09. (CC-04), als Satz über den Preis:** *„No price enters a bid without either a traceable source in this firm's own history or a person's hand on that exact value."* – das ist die Fassung für README und Devpost. Sie nennt beide Wege, die es gibt, und schließt den dritten aus.

Die frühere Formulierung „adds no information of its own" war zu absolut und wäre in der ersten Minute widerlegt worden: Der Agent formuliert sehr wohl – Prüfhinweise, Zusammenfassungen, Begründungen. **Die Trennlinie verläuft nicht zwischen Text und Schweigen, sondern zwischen Formulierung und Geschäftsfakt.**

*Geschäftsfakt* ist alles, was im Angebot oder in einer Entscheidung landen kann: Preis, Menge, Frist, Nachweisstatus, Summe. Davon darf der Agent **keinen einzigen selbst hervorbringen** – er darf sie nur aus dem Preisbuch holen, aus der Ausschreibung lesen oder ausrechnen. *Formulierung* ist alles andere: Reihenfolge, Erklärung, Zusammenfassung, Wortwahl. Die darf er frei. Diese Linie ist im Code prüfbar – jeder Wert, der in `bid_prices` landet, hat entweder eine `price_book_id` oder `set_by='human'`, niemals etwas Drittes.

Der zweite Halbsatz trägt den Wert. Ohne ihn wäre es eine Selbstbeschränkung, mit ihm eine Behauptung über den Nutzen.

Alles im Video ordnet sich diesem Satz unter. Was ihn nicht stützt, fliegt raus.

### 13.2 Beweis, dass nichts auf die 14 Seed-Zeilen hartcodiert ist

Vier Beweise, drei davon kostenlos, weil sie schon in den Daten stecken. **GAEB und diese Beweise beantworten verschiedene Zweifel:** GAEB beweist den *Eingang* (woher kommt ein Leistungsverzeichnis), die folgenden beweisen, dass die *Logik verallgemeinert*. Fällt GAEB, bleibt Punkt 1–4 unberührt.

1. **Bieterwechsel bei identischem Leistungsverzeichnis.** Dieselben 14 Zeilen ergeben drei verschiedene Ergebnisse: Farbwerk Meier zwei Lücken, Brandt & Sohn keine, Colorpoint sechs. Wäre etwas hartcodiert, könnte das nicht variieren. Das ist der stärkste und billigste Beweis – deshalb **muss der Bieter im Kopfbereich wählbar sein**, nicht nur die Rolle.
2. **Zweite und dritte Ausschreibung.** T-2026-015 (Kellergang, 6 Positionen, andere Kategorien) und T-2026-009 (Fassade, 5 Positionen) funktionieren mit demselben Ablauf. In die Prompt-Liste gehört deshalb ein sechster Vorschlag: *„Now do the same for the basement corridor tender."*
3. **Das Preisbuch ist selbst ein Werkzeug.** Ein Juror kann `get_price_book` aufrufen, die Einträge sehen und danach prüfen, dass die Vorschläge exakt auf diese Zeilen zeigen. Die Kette ist von Ende zu Ende einsehbar.
4. **Veröffentlichte Eval-Läufe** über mehrere Ausschreibungen und Bieter, nicht nur über den Demo-Fall.

**Ersatz, falls GAEB stirbt (Zeitbox 45 Minuten):** eine „Positionen einfügen"-Fläche, die eine getippte oder eingefügte Tabelle (OZ, Text, Menge, Einheit) als neue Ausschreibung anlegt. Der arme Bruder des Imports, aber er beweist denselben Punkt – das Leistungsverzeichnis kommt von außen. Im README als „paste-in import" benennen, nicht als GAEB-Ersatz verkaufen.

### 13.3 „Confidence" – Prompt ändern, nicht Beschreibung biegen

Der Widerspruch ist real: P1 sagte „Flag anything you're not confident about", während das Produkt bewusst keine maschinelle Selbsteinschätzung kennt.

**Entscheidung: Der Prompt wird geändert, die Werkzeugbeschreibung bleibt wörtlich wahr.** „Confidence" in der Beschreibung zu einer Umschreibung für „kein deterministischer Treffer" umzudeuten, wäre genau die semantische Verbiegung, die Agenten fehlleitet – und die Juroren lesen Werkzeugbeschreibungen.

Neuer Wortlaut P1: **„Open tender T-2026-014 and price every position from my price book. Leave anything without a match empty and tell me which ones."**

Zusätzlich wird das Ausgabefeld umbenannt: statt `confidence` nun **`matched_terms: n`** und `matched_on: ["category","unit"]` – reine Daten statt eines Selbsteinschätzungswortes.

**Darstellung: alle belegten Quellen-Chips sehen gleich aus.** Der frühere Vorschlag (gefüllt ab zwei Treffern, umrandet bei einem) war eine Konfidenzskala durch die Hintertür und ist gestrichen. `matched_terms` und `matched_on` bleiben überprüfbare Werkzeugdaten und erscheinen **erst beim Öffnen des Chips**, zusammen mit der Originalzeile. Zwei Gründe: Eine visuelle Abstufung wäre genau die Selbsteinschätzung, die wir abgeschafft haben – und sie würde den Menschen dazu verleiten, über die „starken" Chips hinwegzulesen. Einheitliche Chips erzwingen dieselbe Behandlung jedes vorgeschlagenen Werts.

**Unterschieden werden nur Zustände, keine Grade.** Drei sind sichtbar und müssen unverwechselbar bleiben: Wert mit Quellen-Chip (aus dem Preisbuch übernommen), Wert ohne Chip (vom Menschen eingetragen), kein Wert mit dem Hinweis „no comparable entry". Das ist eine Zustandsunterscheidung, keine Skala.

### 13.3b Zwei Präzisierungen aus dem Bau (31.08.)

- **Gleichstand:** Haben zwei Preisbuch-Einträge dieselbe Trefferzahl, gewinnt der frühere (`ORDER BY id`, also Seed-Reihenfolge). Deterministisch und getestet.
- **`matched_on` unterscheidet zwei Arten von Lücke:** `[]` heißt „kein Eintrag dieser Bauart im Preisbuch", `["category","unit"]` heißt „richtige Bauart vorhanden, aber die Wortwahl passte nicht". Der Preis bleibt in beiden Fällen `null`. Für Farbwerk Meier sind beide Lücken der erste Fall.
- **Vorschlagen ist nicht Eintragen.** `suggest_prices` ist `readOnlyHint` und ändert deshalb NICHTS am Dokument: Der Preis steht auf dem Chip, die Zelle bleibt leer, die Summenleiste bei 0,00 €. Eingetragen wird ausschließlich über `set_unit_price` – per Übernehmen-Knopf durch den Menschen oder durch den Agenten. Ein Lese-Werkzeug, das die Tabelle füllt, wäre eine Lüge über `readOnlyHint`.

### 13.3c Der Agent kann keinen Preis erfinden – durch Bauart, nicht durch Beschriftung (31.08.)

Beim Bau von `set_unit_price` fiel auf, dass die Invariante „`price_book_id` ODER `set_by='human'`" auf zwei Arten erfüllbar ist: ehrlich – oder durch Umetikettieren. Ein Agent, der einen Preis erfindet und die Zeile als `human` verbucht, erfüllt die Bedingung und bricht trotzdem den Leitsatz.

**Deshalb verschärft:** Was über ein Werkzeug kommt, wird `set_by='agent'` verbucht, **verlangt zwingend eine `price_book_id`**, und der Preis muss dem der genannten Preisbuchzeile entsprechen. `set_by='human'` kann nur über die Oberfläche entstehen. Damit gilt die Invariante durch Bauart.

**Das ist der stärkste einzelne Satz über dieses Produkt** und gehört so ins Write-up: *The agent cannot write a price that is not traceable to a previous quote by this firm – not by policy, by construction.*

**Der Preis dafür, bewusst bezahlt:** „Trag bei 03.04 61 € ein" über den Agenten wird abgewiesen; der Mensch tippt es in die Tabelle. Das ist genau die Szene aus §12.1 – aber ein Juror wird diesen Satz mit hoher Wahrscheinlichkeit ausprobieren. Deshalb ist die **Abweisung ein gestalteter Moment, kein Fehler**: Der Grund muss menschenlesbar und handlungsweisend sein, sinngemäß *„I can't write a price that isn't in your price book. Enter it in the table yourself, or add it to your price book first."* Gut formuliert ist das eine Demonstration; schlecht formuliert sieht es kaputt aus.

Umkehrbar in einer Zeile (`src/pricing.ts`, `setBy === "agent"`-Block) – dann fällt allerdings der Beweis. Nicht ohne Not umkehren.

**Nachtrag 02.09. (CC-04): Aus der Abweisung wurde eine Bestätigung.** Die Invariante ist unverändert und der `setBy === "agent"`-Block steht noch – ein Werkzeugaufruf ohne `price_book_id` erreicht den Worker aber nicht mehr. Er wird auf der Seite zur Bestätigung an der Zeile; der Klick schreibt über denselben Weg wie eine Eingabe in die Tabelle, als `human`, mit der Herleitung als `note` und mit `change_log`-Block. „Trag bei 03.04 61 € ein" endet also nicht mehr mit „geht nicht", sondern mit einer Bestätigung, in der steht, woher der Wert *nicht* kommt. Sabotage-Probe: Prüfung im Block entfernt → drei Tests rot (`pricing.test.ts` zweimal, `server.test.ts` einmal), zurückgesetzt, `git diff` leer. Der präzisierte Satz steht in §13.1.

### 13.3d Die Grenze der Garantie – Fund aus dem ChatGPT-Durchlauf (31.08. abends)

Im vollständigen Durchlauf hat ein juroren-typischer Satz („set position 03.04 to 61 euros") **funktioniert**, obwohl `set_unit_price` einen Preis ohne `price_book_id` abweist. Erklärung: Der Agent hatte im Arbeitsmodus zusätzlich Browsersteuerung und hat den Wert wie ein Mensch **in das Tabellenfeld getippt**. Der Wert ist damit als `set_by='human'` ohne Herkunft verbucht – die Invariante hält, aber die Zurechnung stimmt nicht mehr mit der Wirklichkeit überein.

**Konsequenz für die zentrale Aussage.** Die Fassung „the agent cannot write a price that is not traceable – by construction" ist zu weit und von einem Juror in einer Minute widerlegbar. Präzise und deutlich interessanter:

> Through the tools this page exposes, an agent cannot write a price that isn't traceable to a previous quote by this firm. An agent that also controls the browser can type into the form like a person would — and then the value is recorded exactly like a person's, without provenance. That is the honest boundary of what a page can guarantee, and it is an argument for tools over DOM control, not against them.

Das ist kein Rückzug, sondern das bessere Argument: Werkzeuge geben eine beschränkte, prüfbare Oberfläche; Browsersteuerung gibt gar keine. Genau darum geht es bei WebMCP. Gehört in README, Write-up und als sechste Known Limitation.

**Zu prüfen (Di früh):** Steht in der Datenbank für 03.04 tatsächlich `set_by='human'` ohne `price_book_id`, und fehlt im Live-Log an dieser Stelle ein `set_unit_price`? Dann ist die Erklärung bestätigt.

### 13.4 Live-Log – Inhalt und bewusste Auslassungen

Je Eintrag: **Uhrzeit, Werkzeugname, Lese-/Schreib-Kennzeichen, Dauer in Millisekunden, verkürzte Eingabe, verkürztes Ergebnis** – aufklappbar das vollständige JSON.

Sichtbar bleiben muss auch das Unangenehme: **fehlgeschlagene Aufrufe, abgewiesene Zeilen und Fehlerobjekte.** Ein Log, das nur Erfolge zeigt, ist Werbung und kein Beweis. Bei einem Teilschreibvorgang steht dort „12 applied, 1 rejected (03.04: no price)".

Bewusst nicht oder nur gekürzt:

- **Fremdtexte** (Rückfragen und Antworten) werden auf 120 Zeichen gekürzt, als „untrusted content" gekennzeichnet und **niemals als HTML gerendert** – das ist die Prompt-Injection-Grenze, an der sonst fremder Text in den Agentenkontext und in unsere Oberfläche gelangt.
- **Massendaten** werden zusammengefasst statt ausgeschüttet: `get_price_book` erscheint als „34 entries", nicht als 34 Zeilen. Sonst ist das Log unlesbar und der Beweis verschwindet im Rauschen.
- **Keine Fehler-Stacktraces**, nur die Fehlerform `{ok:false, error, hint}` – Stacktraces verraten interne Pfade.
- **Ringpuffer von 100 Einträgen**, damit eine lange Sitzung nicht den Speicher füllt – seit dem 02.09. in `localStorage` je Workspace, damit er das Neuladen überlebt (ein Tester las ein leeres Log nach F5 als „meine Historie ist weg"). Der Reset leert ihn, im Speicher wie im Bild.

Und eine Zeile Text unter dem Log, die mehr wert ist als sie kostet: **„This log stays in your browser. Nothing is sent anywhere."** Das stimmt – es gibt keine Analytik – und beantwortet die Frage, die ein Juror bei einem Aufzeichnungsfenster automatisch stellt.

### 13.5 Preisspiegel – wie er entsteht und was vorher zu sehen ist

**Der Auftraggeber darf offene Angebote nicht sehen.** Das ist keine Design-Frage, sondern das Submissionsprinzip: Angebote sind bis zum Fristende versiegelt. Genau so wird es gebaut, und es ist der bessere Demo-Moment.

- **T-2026-014 (offen):** `get_price_comparison` liefert vor Fristende **nur Anzahl und Eingangszeitpunkte, keine Preise** – Status „sealed until <Datum>". Im Seed liegen bereits zwei versiegelte Konkurrenzangebote (Brandt & Sohn, Colorpoint). Nach der Demo-Abgabe **springt der Zähler von 2 auf 3**: Der Juror sieht sein eigenes Angebot ankommen, ohne dass jemand hineinsehen kann. Das ist die Aussage „der Auftraggeber kann Ihre Preise nicht sehen – und sein Agent auch nicht", in einer Zahl.
- **T-2026-009 (geschlossen):** vollständiger Preisspiegel über drei Angebote, Position für Position, mit markiertem Ausreißer bei Colorpoint (Gerüst 27,80 € gegen 11,50 € und 13,20 €). Hier findet der zweite Akt statt.
- **Hat der aktuelle Bieter noch nicht abgegeben**, zeigt die Auftraggeberansicht „2 bids received · your draft is not visible to the client" – kein leerer Bildschirm, kein Platzhalter-Eintrag, sondern eine fachliche Aussage. Seit CC-09 stammt dieses eine Bit aus dem Browser-Gedächtnis beim Rollenwechsel (`ownDraftPending` im Store), nie vom Worker: der Auftraggeber-Read kennt keinen Angebotsstatus.
- **Ein Weg, eine Wahrheit (02.09., CC-09):** Der Preisspiegel ist der **einzige** Weg, auf dem ein Preis den Auftraggeber erreicht. `get_tender` und `list_tenders` liefern ihm in keiner Phase Preise, Zeilensummen, Herkunft oder Nachweise – auch nach Fristende nicht –, und jeder Bieter-Endpunkt weist die Auftraggeberrolle serverseitig mit 403 ab. Die Grenze liegt im Worker (`X-Role`), nicht in der Registrierung; Einzelheiten in §12.2.

Vergleichszahlen im Seed (netto, ohne Bedarfspositionen): Brandt & Sohn **16.749,50 €**, Farbwerk Meier **13.213,50 €** (nach Prompt 1, Position 03.04 noch offen), Colorpoint **10.993,50 €**. Colorpoint ist der billigste – hatte aber für sechs Positionen keinen Preisbucheintrag und musste sie von Hand setzen. Das ist die Geschichte, die der Preisspiegel erzählt.
