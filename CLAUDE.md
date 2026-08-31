# BidDesk – WebMCP Challenge (Devpost/OpenAI)

Agent-ready tender room for building trades. Einreichung für die WebMCP Challenge.
**Deadline: Donnerstag, 03.09.2026, 22:00 Uhr Berlin (13:00 PT). Ziel: Mittwochabend einreichen.**
**Stand Mo 31.08., noch nichts gebaut. Budget 30–40 h bis Mi abends → voller Scope (13 Tools, beide Rollen).** Tagesplan und Prioritäten: docs/03-spec-biddesk.md §9/§10. Erste Handlung heute: Deploy-Pfad auf die finale URL beweisen. Tagesziel Montag: ChatGPT-Desktop ruft ein Tool von dieser URL auf. **Feature Freeze Mi 02.09. 15:00**, danach nur noch Video/README/Devpost.

## Wo steht was
- `docs/01-challenge-analyse.md` – Regeln, Jury, Bewertungskriterien, Technikstand WebMCP, Was-gewinnt-These
- `docs/02-idee-ausschreibungen.md` – Varianten und warum V2 light
- `docs/03-spec-biddesk.md` – **die Build-Spec** (Rollen, Seed-LV, Screens, 13 Tools mit Schemas, Architektur, Sicherheit, Evals, DoD, Tagesplan)
- `docs/04-submission.md` – Devpost-Checkliste, Video-Skript, Write-up-Gerüst
- `seed/` – **fertige Seed-Daten, nicht neu erfinden**: `seed.json` (Quelle der Wahrheit), `schema.sql`, `seed.sql` (`{{WS}}` ersetzen), `gaeb/T-2026-014.x83` (Beispieldatei für den Import), `verify_seed.py` (muss „ALLES GRUEN" sagen). Details und Fallstricke: `seed/README.md`.
- Arbeitsteilung: Technik hier in Claude Code; Konzept, Texte, Video über Cowork. Entscheidungen und Learnings in `docs/` festhalten, nicht nur im Chat.

## Stack (fest)
- Frontend React + Vite + TypeScript + Tailwind; Backend Hono auf Cloudflare Workers; D1; ein Worker für API + Assets; `wrangler deploy`.
- Basis-Template: `cloudflare/agents` → `examples/webmcp-react`. Cloudflare-Konto „MERKUR Impulse"; benutzerweiter `CLOUDFLARE_API_TOKEN` auf NB-NSC hat Workers-Edit-Rechte.
- **Produktive URL: https://biddesk.n-schadewald.workers.dev** · D1 `biddesk` (WEUR), Binding `DB` · Konfiguration ist **`wrangler.jsonc`** (nicht .toml).
- Kein LLM im Backend. Heuristiken deterministisch und erklärbar.
- Lizenz MIT. Repo öffentlich auf GitHub (Devpost verlangt sichtbare Lizenzdatei).

## WebMCP-Regeln (nicht verhandelbar)
- Tools über zentralen Wrapper registrieren: `document.modelContext` zuerst, Fallback `navigator.modelContext` (Spec-Draft 21.07.2026 hat die API verschoben; Chrome 149–156 bedient beides).
- Jedes Tool: `name`, `title`, `description` (sagt, wann es zu benutzen ist und welche UI-Wirkung es hat), `inputSchema` (JSON Schema, `additionalProperties:false`, Feldbeschreibungen), `execute`, `annotations`.
- `readOnlyHint:true` auf allen Lese-Tools. `untrustedContentHint:true` auf allem, was Fremdtext zurückgibt (Bieterfragen/Antworten).
- Tools werfen nie; Fehler als `{ ok:false, error, hint }`. Ausgaben sind JSON-Daten, kein HTML/Markdown, keine Anweisungen.
- Destruktives (`submit_bid`) nur mit UI-Bestätigung durch den Menschen; danach Tool per AbortSignal abmelden.
- Kontextabhängig registrieren (Rolle Bidder/Client) → `toolchange` feuert.
- Jeder Tool-Aufruf landet im Agent-Panel-Log (Zeit, Tool, Input, Output-Kurzform, Dauer).
- Tools und manuelle Bedienung nutzen dieselben Store-Aktionen (eine Wahrheit, UI aktualisiert live).
- **Permissions-Policy: KEIN eigener Header.** Laut Chrome-Doku ist `tools` bereits per Default auf `self` – ein selbst gesetzter Header kann die Werkzeugerkennung nur kaputtmachen. Wir setzen keine Cross-Origin-iframes ein und verlassen uns auf den Default; das gehört so ins Write-up (im Tool Inspector gegenprüfen).

## Produktregeln
- **Leitsatz, dem sich alles unterordnet:** „Ein Agent wird im Betrieb erst dann brauchbar, wenn er nichts erfindet, was im Angebot landet, und nichts allein verbindlich macht – dann aber sofort." Was ihn nicht stützt, fliegt raus.
- **Trennlinie Formulierung vs. Geschäftsfakt:** Preis, Menge, Frist, Nachweisstatus, Summe darf der Agent nie selbst hervorbringen – nur holen, lesen, rechnen. Text (Erklärung, Zusammenfassung, Reihenfolge) darf er frei. Prüfbar: jeder Wert in `bid_prices` hat `price_book_id` ODER `set_by='human'`, nie etwas Drittes.
- **Alle Quellen-Chips sehen gleich aus.** Keine gefüllt/umrandet-Abstufung, keine Skala. `matched_terms`/`matched_on` erscheinen erst beim Öffnen des Chips. Sichtbar unterschieden werden nur drei Zustände: Chip (aus Preisbuch) / kein Chip (vom Menschen) / leer mit „no comparable entry".
- **Bieter ist wählbar**, nicht nur die Rolle – der Wechsel zwischen Meier/Brandt/Colorpoint auf demselben LV ist der Beweis, dass nichts hartcodiert ist.
- **Offene Ausschreibungen sind versiegelt:** `get_price_comparison` liefert vor Fristende nur Anzahl und Eingangszeit, keine Preise. Voller Preisspiegel nur für T-2026-009.
- Ausgabefeld heißt `matched_terms` (Zahl) + `matched_on`, **nicht** `confidence`. Nie als Skala anzeigen.
- **Kein geratener Preis.** Jeder Vorschlag trägt seine Herkunft (Projekt, Datum, Originalzeile) und ist im UI anklickbar. Ohne Treffer: „no comparable entry", kein Wert.
- **Das Leistungsverzeichnis ist unantastbar.** Kein Tool ändert Positionen, Mengen oder Texte der Ausschreibung. Kein Löschen, kein Anlegen von Ausschreibungen im MVP.
- Auftraggeber-Rolle darf im MVP nur lesen und Rückfragen beantworten.
- **`suggest_prices`:** Kategorie UND Einheit müssen passen; Keyword-Treffer als **Teilstring** auf normalisiertem Text (deutsche Komposita: „Schimmelbehandlung" enthält „schimmel"+„behandlung"); **mindestens ein Treffer**, sonst kein Vorschlag. `high` ab 2 Treffern, `medium` bei 1. Sollergebnis B-A auf T-2026-014: 12 Vorschläge, genau 2× none (03.04, 04.02), netto 13.213,50 €. Prüfbar mit `seed/verify_seed.py`.
- **Kein `?ws=`-Parameter und kein „Stand teilen"-Knopf.** Zustand lebt nur in localStorage.
- **Selbstdiagnose im Agent-Panel zählt über `getTools()`**, nie eine fest verdrahtete Zahl. Bieterrolle 10 Werkzeuge, nach Abgabe 9; Auftraggeber 5; insgesamt 12 verschiedene.
- **Fristen und Nachweis-Gültigkeiten bleiben relativ** (`date('now','+N day')`). Feste Daten würden während der Jurierung bis 21.09. ablaufen.
- **Design: Arbeitsgerät, nicht Cockpit.** Hell, dicht, zurückhaltend (Referenz: Google-Docs-Vorschlagsmodus als Interaktion, Linear/Stripe als Optik). Batch-Preise laufen im UI gestaffelt ein (60–80 ms/Zeile, `prefers-reduced-motion` beachten), nie als Sprung. **Keine Konfidenzbalken, keine Prozente, keine Ampel an Preisen** – der Quellen-Chip ist die Vertrauensanzeige, Unsicherheit erscheint als leeres Feld mit „no comparable entry". Rot nur im Prüfergebnis. Details: docs/03-spec-biddesk.md §2b.
- Kein Login. Jeder Besucher bekommt einen Workspace (isolierte Seed-Kopie), `?ws=` in der URL, Reset-Button.
- UI-Sprache Englisch (Jury). Seed-Texte zweisprachig (`text_en`, `text_de`); DE-Umschalter ist Stretch.
- Alle Firmen und Preise sind fiktiv. Keine echten Personen, keine Marktdaten-Behauptungen.
- Bedarfspositionen (contingency) zählen nicht in die Angebotssumme.

## Testen
- Chrome: `chrome://flags/#enable-webmcp-testing` + Extension „Model Context Tool Inspector" + DevTools-WebMCP-Panel.
- ChatGPT-Desktop-Browser (WebMCP seit ~26.08.2026): Pfeil in der Adressleiste zeigt Tools; Bestätigung bei sensiblen Aktionen prüfen.
- Vor jedem Commit: `npm test` (vitest) + `npm run typecheck`. Vor Deploy: Seed/Reset lokal durchspielen.
- Testmatrix und Eval-Fälle: `docs/03-spec-biddesk.md` §6.

## Nicht tun
- Keine externen Datenquellen für die Einreichung (DÖE-API nur als Stretch nach DoD).
- Keine Features außerhalb von Spec §1–§7, bevor die DoD (§7) erfüllt ist.
- Keine Secrets ins Repo (`wrangler.jsonc` ohne Tokens; `.dev.vars` in `.gitignore`).
- Keine unbelegten Zahlen in README/Devpost-Text.
