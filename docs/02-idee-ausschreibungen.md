# Richtung „Ausschreibungen" – Varianten, Scope, Plan

Stand: 28.08.2026, Status: Brainstorming (Entscheidung offen). Rahmen: halbtags 3–4 Std/Tag bis Do 03.09. 22:00 → ca. 20–24 Std Gesamtbudget, Technik über Claude Code.

## Warum Ausschreibungen gut zur Jury passen

- Echtes, spezifisches Problem für eine echte Zielgruppe (Kriterium „Potential Impact"): Handwerksbetriebe scheuen Ausschreibungen wegen Aufwand für Nachweise und Bepreisung; belegt durch Praktiker-Aussagen (ZDH, Deutsche Handwerks Zeitung 2022: 40-seitige Vorbemerkungen für 20 m Geländer; Eignungsnachweise für simple Malerarbeiten). Quantitative Zahlen (Bieter je Vergabe, Teilnahmequote) sind noch NICHT validiert – vor Verwendung im Write-up Quelle suchen (z. B. ZDH-Umfrage).
- Strukturierte Daten (Leistungsverzeichnis mit Positionen, Mengen, Einheiten) sind der ideale Fall für WebMCP: Agent arbeitet auf dem Datenmodell statt DOM-Scraping; Mensch sieht jede Änderung live in der Tabelle.
- Niemand sonst im Feld baut LV-Bepreisung → Kreativität/Differenzierung.
- Zwei Kundensegmente von MERKUR auf einer Plattform: Hausverwaltung/Immobilien (Auftraggeber) und Handwerk (Bieter).

## Varianten

| Variante | Kern | Human+Agent | Leverage | Impact | Neu | Risiko (halbtags) |
|---|---|---|---|---|---|---|
| V1 Bid Desk (Bieter) | LV im Browser, Agent bepreist aus eigenem Preisbuch, Mensch korrigiert, Checks, Abgabe mit Bestätigung | sehr stark | hoch | hoch | hoch | niedrig-mittel |
| V2 Tender Room (zweiseitig) | V1 + Auftraggeber: LV anlegen, veröffentlichen, Preisspiegel, Bieterfragen | sehr stark | sehr hoch | hoch | sehr hoch | mittel-hoch (voll) / mittel (light) |
| V3 Ausschreibungs-Scout | Agent sucht/filtert öffentliche Ausschreibungen (CPV, Region, Frist), Eignungscheck, Fristenkalender | mittel | mittel (überwiegend Lese-Tools) | hoch | mittel | Datenquelle unklar (DÖE-Open-Data-API heute nicht erreichbar) |
| V4 LV-Studio (Planer) | Agent verfasst Leistungsverzeichnis aus Projektbeschreibung, Mensch editiert, Export | stark | hoch | mittel | hoch | mittel |

## Empfehlung: V2 light = „Tender Room"

Kern-Flow tief: Bieter-Seite (V1). Auftraggeber-Seite leicht: vorangelegte Ausschreibungen (Seed) + Preisspiegel + Bieterfragen beantworten. Erzählung: „Eine Hausverwaltung schreibt die Dachsanierung eines Mehrfamilienhauses aus. Drei Dachdeckerbetriebe bepreisen das Leistungsverzeichnis mit ihren Agenten – jeder mit seinem eigenen Preisbuch. Die Verwaltung vergleicht per Preisspiegel. Alle arbeiten auf derselben Seite, Mensch und Agent nebeneinander."

### Rollen & Demo-Daten (kein Login, Rollenwahl per Dropdown)
- Auftraggeber: „Rheinpark Hausverwaltung" (fiktiv), 2–3 Ausschreibungen (Dachsanierung MFH ~25 Positionen; Treppenhaus-Malerarbeiten ~12 Positionen; optional Elektro-Unterverteilung).
- Bieter A/B/C: drei fiktive Dachdecker-/Malerbetriebe mit unterschiedlichen Preisbüchern (Einheitspreise, Historie).
- Sprache: UI Englisch (Jury) mit DE-Umschaltung (Kundendemos). Fachbegriffe (LV, Position, OZ) im Glossar erklären.

### Tool-Liste (11 + 1 deklarativ, + Stretch)
Bieter:
1. `list_tenders` – readOnly; Filter Gewerk/Ort/Frist
2. `get_tender` – readOnly; LV mit Positionen (OZ, Kurz-/Langtext, Menge, Einheit, Bedarfsposition ja/nein)
3. `get_price_book` – readOnly; eigene Einheitspreise + Historie
4. `suggest_prices` – readOnly; Vorschläge aus Preisbuch (Ähnlichkeit) mit Konfidenz und Begründung; Mensch übernimmt per Klick oder Agent via set_unit_price
5. `set_unit_price` – write; Batch `positions[{oz, unitPrice, note}]`; Summen live; Undo
6. `check_bid` – readOnly; Vollständigkeit, Ausreißer vs. Preisbuch, fehlende Nachweise, Fristcheck
7. `get_bid_state` – readOnly; Summe, offene Positionen, Status
8. `ask_clarification` – write; Bieterfrage (auch deklarativ als Formular mit toolname/tooldescription)
9. `submit_bid` – write, destruktiv → Bestätigungsdialog im UI, danach read-only
Auftraggeber:
10. `get_price_comparison` – readOnly; Preisspiegel je Position, Ausreißer, Rang
11. `answer_clarification` – write
Deklarativ: Formular „Bieterfrage stellen" (zeigt beide API-Stile).
Stretch (nur bei Zeitreserve): `import_gaeb_x83` (GAEB DA XML einlesen – echter deutscher Standard, starkes Realitätssignal), `export_bid_x84`.

### WebMCP-Tiefe (Leverage-Signale)
- `document.modelContext` mit Fallback `navigator.modelContext`; Origin-Trial-Token zusätzlich zum Flag.
- Annotations korrekt: `readOnlyHint` auf allen Lese-Tools; `untrustedContentHint` auf Tools, die Bieterfragen/Notizen zurückgeben.
- Kontextabhängige Registrierung: Auftraggeber-Tools nur in der Auftraggeber-Rolle, `submit_bid` verschwindet nach Abgabe (AbortSignal, `toolchange`).
- Agent-Panel: Live-Log der Tool-Aufrufe mit Ein-/Ausgaben, Tool-Liste, 4 Beispiel-Prompts, Reset-Button.
- Sicherheit: Permissions-Policy `tools=self`, keine Tool-Ausgaben mit HTML, Bestätigung bei `submit_bid`, Write-up zu Prompt-Injection über Bieterfragen.
- WebMCP Evals: 5–8 Testfälle („bepreise alle Positionen", „was fehlt noch?", „gib ab") mit Ergebnis im README.

### Beispiel-Prompts (für Jury und Video)
1. "Price every position in this tender from my price book and flag anything you're unsure about."
2. "Which positions are still missing a price, and what's my current total?"
3. "Compare my prices to my price book – anything looks off?"
4. "Ask the client whether the scaffolding needs to stay for the painters."
5. "Submit the bid." → Bestätigungsdialog

## 6-Tage-Plan (halbtags)
- Fr 28.08. (3 h): Entscheidung, Datenmodell + Tool-Schemas in docs/, Scaffold (Cloudflare `agents/examples/webmcp-react` oder Vite+Hono auf Workers), Chrome-Flag + Model Context Tool Inspector, erster Tool-Test im ChatGPT-Desktop-Browser.
- Sa 29.08. (4 h): LV-Ansicht, Preisbuch, Tools 1–6, Summen live, Undo.
- So 30.08. (4 h): Tools 7–11, deklaratives Formular, Agent-Panel, Bestätigungsdialog, Seed-Daten (3 Bieter, 2 Ausschreibungen), Preisspiegel.
- Mo 31.08. (4 h): Tests ChatGPT-Desktop + Chrome, Evals, Security, DE/EN, Polish, Origin-Trial-Token.
- Di 01.09. (4 h): Video (Skript → Aufnahme → Schnitt, englisches Voice-over), Textbeschreibung entlang der vier Pflichtpunkte + vier Kriterien, README „How to test in 60 seconds", Lizenz (MIT).
- Mi 02.09. (2–3 h): Puffer, Fremdtest, Einreichung abends.
- Do 03.09.: nur Notfall.

## Offene Punkte
- Name (englisch, für Devpost): Vorschläge „Tender Room", „BidDesk", „Preisspiegel" – Entscheidung Nils.
- Quantitative Belege für das Problem (Bieter je Vergabe, Aufwand je Angebot) recherchieren und nur mit Quelle verwenden.
- DÖE-Open-Data (oeffentlichevergabe.de) als echte Datenquelle für `list_tenders` prüfen – heute nicht erreichbar; für die Einreichung Seed-Daten, Live-Anbindung nur als Stretch.
- GAEB-Import nur, wenn bis Mo Kern fertig ist.

## Entscheidungen (28.08.2026, Nils)
- Zuschnitt: V2 light („Tender Room") – bestätigt.
- Name: **BidDesk**.
- Demo-Fall: **Malerarbeiten Treppenhaus** (14 Positionen inkl. 2 Bedarfspositionen) statt Dachsanierung.
- Verbindliche Tool-Liste (13 Tools) und Plan: siehe `docs/03-spec-biddesk.md` – dieses Dokument ist damit Historie.
