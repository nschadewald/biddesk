# Technik-Entscheidungen und Befunde

Laufendes Protokoll. Eine Überschrift je Bauschritt aus `docs/03-spec-biddesk.md` §9.

## Schritt 1 – Deploy-Pfad (Mo 31.08.2026)

**Ergebnis:** Produktive URL **https://biddesk.n-schadewald.workers.dev** liefert die Anwendung,
`/api/health` erreicht D1. Worker `biddesk`, D1-Datenbank `biddesk`
(`d5a184fa-3c88-47e7-94a8-7836ada1fdd6`, Region WEUR), Konto MERKUR Impulse.

### Befund: Der Hook des Cloudflare-Beispiels reicht nicht

Geprüft: `cloudflare/agents` → `examples/webmcp-react/src/useWebMCPTools.ts` (Stand 31.08.2026).

Der Hook nutzt **ausschließlich `document.modelContext`**:

```ts
const modelContext = document.modelContext;
if (!modelContext) { setState({ supported: false, ... }); return; }
```

Kein Fallback auf `navigator.modelContext`. Vier weitere Lücken gegenüber unseren
nicht verhandelbaren Regeln (CLAUDE.md, AGENTS.md §7/§8):

| Unsere Regel | Beispiel-Hook |
|---|---|
| Fallback `navigator.modelContext` | fehlt |
| `title` je Werkzeug | fehlt (nur `name`, `description`, `inputSchema`, `annotations`) |
| Jeder Aufruf ins Live-Log (Zeit, Input, Output-Kurzform, Dauer) | fehlt |
| Nie werfen, Fehler als `{ok:false,error,hint}` | `execute` wirft (`parseArgs` per Zod) |
| Selbstdiagnose über `getTools()` | keine Zählung, nur `registered: boolean` |

**Folge:** Eigener Wrapper `registerTool(def)` in Schritt 2, wie in Spec §3 vorgesehen.
Brauchbar übernommen wird aus dem Beispiel:

- Das Muster **ein `AbortController` je Registrierungsblock** – genau der Mechanismus,
  den wir für das Abmelden von `submit_bid` und für `toolchange` beim Rollenwechsel brauchen.
- `src/webmcp.d.ts` als Ausgangspunkt für die Typdeklarationen (inkl. der React-Attribute
  `toolname`, `tooldescription`, `toolparamdescription` für das deklarative Formular bei
  `ask_clarification`) – noch nicht übernommen, kommt mit dem Wrapper.

### Befund: Vom Beispiel übernommen wurde die Bau-Konfiguration, nicht der Code

Nicht übernommen: `@cloudflare/kumo` (Cloudflares Design-System – kollidiert mit der
Designhaltung „Arbeitsgerät, nicht Cockpit", Spec §2b), das Paket `agents` samt
`agents/vite` und `agents/tsconfig` (Agents SDK, Durable Objects – wir haben kein LLM
im Backend), `@phosphor-icons/react`, `zod`.

Übernommen: Vite + `@cloudflare/vite-plugin` + Tailwind v4 + React 19,
`assets.not_found_handling: "single-page-application"`,
`assets.run_worker_first: ["/api/*"]` (aus `examples/webmcp-react/docs/d1.md`),
die tsconfig-Werte aus `agents.tsconfig.json`, die vitest-Konfiguration.
Ergänzt: **Hono** als Router im Worker (Spec §4).

### Konfiguration: `wrangler.jsonc`, nicht `wrangler.toml`

CLAUDE.md nennt `wrangler.toml`. Verwendet wird `wrangler.jsonc` – das ist das Format des
Beispiels und der aktuelle Cloudflare-Standard, erlaubt Kommentare und liefert über
`$schema` Autovervollständigung. Inhaltlich identisch, keine Tokens in der Datei.
Der Token kommt aus `CLOUDFLARE_API_TOKEN` in der Umgebung.

### Offen, bewusst noch nicht gebaut

- **Permissions-Policy `tools=self`** (Spec §5) – noch nicht gesetzt. Bewusst: Vor dem
  Montags-Gate („ChatGPT-Desktop ruft ein Werkzeug auf dieser URL auf") wird kein
  ungetesteter Header eingeführt, der die Werkzeugerkennung blockieren könnte.
  Setzen und gegenprüfen in Schritt 2, zusammen mit dem Wrapper.
- **Origin-Trial-Token** für `biddesk.n-schadewald.workers.dev` (Spec §10.2) – die finale
  Origin steht jetzt fest, das Token kann beantragt werden.
- Schema, Seed, Workspace-Isolation, Werkzeuge, Oberfläche: Schritt 2.

## Schritt 2 – Daten, Workspace, öffentliches Repo (Mo 31.08.2026)

**Ergebnis:** Schema steht in D1, jeder Besucher bekommt eine eigene geseedete Kopie,
die Startseite zeigt die 14 Positionen von T-2026-014.

### Der Workspace steht im Header, nicht in der URL

Spec §11.3 verbietet `?ws=` in der Seiten-URL. Die API braucht die Kennung trotzdem.
Gewählt: Anfragekopf **`X-Workspace-Id`** auf den Lese-Routen. Damit bleibt die URL
konstruktionsbedingt zustandsfrei – eine kopierte Adresse kann keinen fremden Zustand
mitschleppen. `POST /api/workspace` nimmt die gespeicherte Kennung im Rumpf entgegen
(`{ id }`) und liefert sie zurück, wenn es sie noch gibt, sonst eine frische. Für den
Besucher existiert kein Fehlerpfad: unbekannt heißt neu, nie Fehlerbildschirm.

### Der Seed geht als gebundener Parameter in die Datenbank, nicht als Textersetzung

`seed/seed.sql` wird über `?raw` in den Worker gebündelt (28 KB), zeilenweise zerlegt,
und `'{{WS}}'` wird durch `?1` ersetzt. Die Workspace-Kennung wird **gebunden**, statt in
den SQL-Text hineinkopiert zu werden. Grund: Bei `/reset` kommt die Kennung aus dem
Pfad. Zusätzlich wird sie gegen ein UUID-Muster geprüft. `src/workspace.test.ts` hält
das fest (127 Anweisungen, alle mit `?1`, kein `{{WS}}` mehr übrig).

**Reset ist ein einziger Batch aus Löschen und Neuseeden.** Nicht zwei Batches: sonst gäbe
es einen Moment, in dem der Workspace halb weg ist. Idempotent – ein Reset auf eine
Kennung, die es nicht mehr gibt, legt sie wieder an und setzt damit auch die 7-Tage-Uhr neu.

### Zwei Fallstricke, die Zeit gekostet haben

1. **D1 begrenzt die Anzahl der Terme in einem zusammengesetzten SELECT.**
   Neun `UNION ALL`-Zweige quittiert D1 mit `too many terms in compound SELECT`
   (`SQLITE_ERROR 7500`). Ausweg: skalare Unterabfragen in einer Zeile. Relevant für
   `get_price_comparison` in Schritt 3 – dort nicht über `UNION ALL` bauen.
2. **Cloudflare beantwortet `Python-urllib` mit Fehler 1010.** Jedes Prüfskript gegen die
   produktive URL braucht einen eigenen `User-Agent`. Browser sind nicht betroffen,
   die Eval-Skripte am Mittwoch schon.

### Schema wird von Hand eingespielt, nicht vom Worker

`wrangler d1 execute biddesk --remote --file=seed/schema.sql` (und einmal `--local` für
`npm run dev`). Bewusst keine Migration-Ordner und kein „Schema beim ersten Zugriff
anlegen" im Worker: Das Schema kommt aus `seed/`, das aus `seed.json` erzeugt wird
(`seed/README.md`), und ein zweiter Erzeugungsweg im Code wäre eine zweite Wahrheit.

### Offen

- Der **Origin-Trial-Meta-Tag** ist registriert (`origin-trial-token.txt`, gültig bis
  17.11.2026), aber **noch nicht in `index.html` eingebaut** – der Einbau gehört zu dem
  Schritt, in dem die Selbstdiagnose ihn gegenprüfen kann.
- Reset-Knopf in der Oberfläche: kommt mit dem Agent-Panel in Schritt 3. Der Endpunkt läuft.
- Preisspalte, Summenlogik und Bieterwahl: Schritt 3. Heute steht die Spalte leer, weil
  Farbwerk Meier im Seed noch kein Angebot auf T-2026-014 hat – so ist es gewollt.

## Schritt 3 – Werkzeug-Wrapper und die beiden Lese-Werkzeuge (Mo 31.08.2026)

**Ergebnis:** `list_tenders` und `get_tender` sind registriert, das Agent-Panel steht rechts,
die Selbstdiagnose zählt live. Gegen das ausgelieferte Bundle geprüft.

### Was der Wrapper leistet, damit die Werkzeuge es nicht einzeln tun müssen

`src/webmcp/registry.ts` ist die einzige Stelle, die Werkzeuge anmeldet. Vier Zusagen gelten
dadurch für jedes Werkzeug, ohne dass eines davon sie wiederholen muss:

1. **Es wirft nie.** `execute` läuft in einem `try`, jeder geworfene Wert wird zu
   `{ ok:false, error, hint }`. Stacktraces werden verworfen – sie verraten interne Pfade.
2. **Die Ausgabe ist reines JSON.** Kein HTML, kein Markdown, keine Anweisungen.
3. **Der Aufruf steht im Live-Log**, samt Dauer, Lese-/Schreib-Kennzeichen und Ausgang.
   Auch Fehlschläge – ein Log, das nur Erfolge zeigt, ist Werbung.
4. **Anmeldung über einen `AbortController` je Block.** Damit ist das spätere Abmelden von
   `submit_bid` eine Zeile und kein neuer Mechanismus.

`document.modelContext` zuerst, `navigator.modelContext` als Rückfall, beide Zugriffe in
`try/catch`: Ein Browser ohne WebMCP muss die Seite als normale Webseite bekommen, nie als
kaputte. Der wahrscheinlichste Ausfall der ganzen Einreichung ist ein Juror, der die Seite
in einem gewöhnlichen Browser öffnet – deshalb ist „kein WebMCP" ein Zustand, den wir
darstellen, kein Fehler, den wir werfen.

Zusätzlich, defensiv: Fehlt `registerTool`, wird `provideContext({tools})` versucht (die
ältere, seitenweite Form). Ungetestet – in Chrome 149+ greift der erste Weg.

### Die Selbstdiagnose zählt, sie behauptet nicht

`getTools()` fragt **zuerst den Browser** (`modelContext.getTools()`) und schneidet unsere
Buchführung darauf zu; nur wenn der Browser nicht antwortet, gilt unsere eigene Liste.
Nirgends steht eine Zahl im Code. Eine fest verdrahtete Zahl wäre in dem Moment falsch,
in dem das erste Werkzeug abgemeldet wird – und genau das ist die Vorführung am Dienstag.

### Beschreibungen sind Produktarbeit

Beide `description`-Texte sagen **wann** ein Agent zugreift und **welche sichtbare Wirkung**
das hat. `get_tender` nennt die Navigation ausdrücklich („Visible effect: the tender you name
becomes the tender shown on screen"), `list_tenders` sagt ebenso ausdrücklich, dass es
**nichts** öffnet. Ein Test hält beides fest, damit es beim Umformulieren nicht verloren geht.

`additionalProperties:false` wird auch **durchgesetzt**, nicht nur deklariert: Ein unbekanntes
Argument wird mit Namen abgewiesen. Ein Agent, der einen Grund bekommt, korrigiert sich;
einer, dessen Argument still verschluckt wird, kann das nicht.

### Eine Wahrheit für Maus und Agent

`src/store.ts` hält den Zustand; `openTender()` ist derselbe Weg für einen Klick und für
`get_tender`. Deshalb wandert die Tabelle sichtbar mit, wenn der Agent einen anderen Tender
öffnet – ohne dass es dafür einen Agenten-Sonderpfad gäbe.

### Korrektur an Schritt 2

Der Reset leerte das Live-Log nicht. Spec §11.1 verlangt „leeres Log" als Abnahmekriterium.
Behoben in `resetDemo()`, mit Test.

### Wie das gegen die Produktion geprüft wurde

Der eingebaute Browser hier ist Chrome 148, WebMCP kommt erst mit 149. Geprüft wurde deshalb
über einen **gleichnamigen `srcdoc`-Rahmen auf derselben Origin**, der einen Modellkontext
installiert, *bevor* das Modulskript der Seite läuft, und danach das **ausgelieferte Bundle**
lädt. Damit sind echte Anmeldung, echte Aufrufe und echtes Log geprüft, nicht ein Mock im Test.

### Offen

- Origin-Trial-Token einbauen (jetzt sinnvoll: die Selbstdiagnose kann es gegenprüfen).
- Rollen- und Bieterwahl im Kopfbereich; die API nimmt `X-Bidder-Id` bereits entgegen.
- Die restlichen zehn Werkzeuge, Preislogik, Herkunfts-Chips.

## Schritt 4 – Preisbuch und Vorschläge (Mo 31.08.2026)

**Ergebnis:** `get_price_book` und `suggest_prices` laufen, die Herkunfts-Chips stehen an den
Zeilen. Sollergebnis gegen die produktive URL geprüft: **12 Vorschläge, 11 mit ≥2 Treffern,
1 mit einem, genau zwei Lücken (03.04, 04.02), netto 13.213,50 €, Bedarf 370,00 €.**

### Die Regel steht an einer Stelle und ist gegen den Seed geprüft

`src/matching.ts` ist die einzige Fassung im Code, `seed/verify_seed.py` die ausführbare
Referenz. `src/matching.test.ts` liest **`seed/seed.json` selbst** und rechnet das Sollergebnis
nach – nicht gegen abgeschriebene Zahlen. Driften die beiden Regeln je auseinander, fällt der
Test um. Mitgeprüft: der Gleichstand-Fall (bei gleicher Trefferzahl gewinnt der frühere
Eintrag), deshalb liest der Worker das Preisbuch `ORDER BY id` – das ist die Seed-Reihenfolge.

Die drei Bedingungen und ihr Grund stehen als Kommentar im Modul, weil beide aus einem
tatsächlichen Fehlschlag stammen: die Rückfallebene „nur Einheit passt" hätte für Heizkörper
den Türenpreis von 148 € geliefert, und wortgleiches Matching hätte für „Schimmelbehandlung"
3,20 € (Reinigen) vorgeschlagen – mit Herkunfts-Chip auf die falsche Zeile, also schlimmer
als eine Lücke. Beides ist als Test festgeschrieben.

### `matched_on` sagt mehr als „category, unit"

Bei einem Vorschlag steht dort immer `["category","unit"]` wie in Spec §13.3. Bei einer Lücke
unterscheidet das Feld zwei Fälle: `[]` heißt „kein Eintrag dieser Bauart im Preisbuch",
`["category","unit"]` hieße „Einträge der richtigen Bauart vorhanden, aber die Wortwahl passte
nicht". Für Farbwerk Meier sind beide Lücken der erste Fall. Der Preis bleibt in beiden Fällen
`null`, und der Grund ist wörtlich `no comparable entry in your price book`.

**Kein Feld `confidence`** – nirgends, weder in der Ausgabe noch im Speicher. Die Wortwahl der
`reason` unterscheidet „one search term matched" von „N search terms matched"; das ist die
einzige Stelle, an der die Trefferzahl die Sprache beeinflusst.

### Vorschlagen ist nicht Eintragen

Der vorgeschlagene Preis erscheint **nicht** in der Preiszelle, sondern auf dem Chip daneben.
Die Zelle bleibt leer, die Summenleiste bleibt bei 0,00 €, bis ein Mensch übernimmt. Das ist
der Vorschlagsmodus aus der Textverarbeitung und der einzige Aufbau, der zum Leitsatz passt:
Das Dokument bleibt seins. Der Übernehmen-Knopf kommt mit `set_unit_price`.

Drei sichtbare **Zustände**, keine Grade: Wert mit Chip (aus dem Preisbuch), Wert ohne Chip
(vom Menschen), kein Wert mit „no comparable entry". Ein Test hält fest, dass **alle Chips
dieselbe CSS-Klasse tragen** – eine Abstufung nach Trefferzahl wäre die Konfidenzskala durch
die Hintertür. Ein zweiter Test hält fest, dass in einer Lückenzeile nichts Rotes, Gelbes oder
ein Warnzeichen vorkommt.

### Abweichung von Spec §3, bewusst

`get_price_book` liefert **kein `last_used`**. Das Feld existiert im Datenmodell nicht
(`seed.json` kennt `source_project`, `source_date`, `source_position_text`). Statt ein Datum zu
erfinden, liefert das Werkzeug die drei echten Herkunftsfelder – das ist ohnehin das, was den
Chip belegbar macht.

### Offen

- `set_unit_price` mit Übernehmen-Knopf, gestaffeltem Einlaufen und Undo.
- `check_bid`, `ask_clarification`, `submit_bid`, Client-Rolle.
- Bieterwahl im Kopfbereich (die API kann es über `X-Bidder-Id` bereits: B-B hat null Lücken,
  B-C hat sechs – live gegengeprüft).

## Schritt 5 – Preise schreiben (Mo 31.08.2026)

**Ergebnis:** `set_unit_price` und `undo_last_change` laufen, der menschliche Weg ist
gleichwertig. Gegen die produktive URL geprüft: **netto 13.213,50 €, Bedarfspositionen
370,00 €, 11 von 12 bepreist, 03.04 und 04.02 leer.** Danach trägt der Mensch 03.04 mit
61,00 € ein → 13.457,50 €, 12 von 12.

### Die Invariante ist erzwungen, nicht nur beschriftet

CLAUDE.md verlangt: jeder Wert in `bid_prices` hat `price_book_id` ODER `set_by='human'`.
Das lässt sich auf zwei Arten erfüllen – ehrlich oder durch Umetikettieren. Ein Agent, der
einen Preis erfindet und die Zeile als `human` verbucht, erfüllt die Bedingung und bricht
trotzdem den Leitsatz.

Deshalb: **Was über ein Werkzeug kommt, wird `set_by='agent'` verbucht und braucht zwingend
eine `price_book_id`** – und der Preis muss dem der genannten Zeile *entsprechen*. Damit ist
`set_by='agent'` gleichbedeutend mit „hat eine Herkunft", und `set_by='human'` kann nur über
die Oberfläche entstehen. Die Bedingung gilt dann durch Bauart, nicht durch Beschriftung.

Drei Abweisungsgründe über die in §11.2 genannten hinaus, alle drei aus diesem Grund:

| Grund | Wann |
|---|---|
| `price_without_source` | Agent schreibt ohne `price_book_id` |
| `unknown_price_book_entry` | die genannte Zeile gibt es im Preisbuch dieses Bieters nicht |
| `price_does_not_match_source` | Preis weicht von der genannten Zeile ab (Toleranz 0,5 Cent) |

**Folge, die ins Write-up gehört:** „Trag bei 03.04 61 € ein" über den Agenten geht **nicht**.
Der Mensch tippt es in die Tabelle. Das ist genau die Szene aus §12.1 („der Mensch trägt sie
ein") und keine fehlende Funktion. Umkehrbar in einer Zeile, falls das je stören sollte –
dann fällt aber der Beweis.

### Ein Aufruf, ein Block, ein Undo

Der Schreibvorgang geht als **ein** D1-Batch raus (Angebot anlegen + alle gültigen Zeilen +
ein `change_log`-Eintrag). Der Log-Eintrag trägt den vorherigen Zustand jeder berührten Zeile,
also nimmt `undo_last_change` den Block als Ganzes zurück – auch das Anlegen des Entwurfs:
Bleibt nach dem Undo kein Preis übrig, verschwindet der leere Entwurf mit, damit die
Ausschreibung wieder „kein Angebot" meldet statt „Entwurf ohne Inhalt".

Kein Rollback wegen einzelner schlechter Zeilen (§11.2): geprüft wurde mit einem Aufruf aus
neun Zeilen, von denen acht aus acht verschiedenen Gründen fielen – die neunte wurde
geschrieben.

**Dubletten werden beide abgewiesen.** Bei zweimal derselben OZ im selben Aufruf ist nicht
entscheidbar, welche gemeint war; eine davon auszuwählen wäre geraten.

### Gestaffeltes Einlaufen

Ein Aufruf bleibt technisch ein Aufruf: Das Werkzeug antwortet nach ~250 ms mit dem
vollständigen Ergebnis, die Tabelle läuft danach von selbst zu, ~70 ms je Zeile, von oben
nach unten. `prefers-reduced-motion` setzt alles sofort. Live nachgemessen: Reihenfolge exakt
01.01 → 04.01, und ein Screenshot mitten im Lauf zeigt die Summenleiste beim Klettern.

**Messnotiz:** Über die Automatisierungsbrücke werden die Timer der Seite ausgehungert; die
Staffelung ist deshalb im Unit-Test mit `vi.useFakeTimers()` festgeschrieben (nach dem ersten
Tick genau eine Zeile, nach 80 ms zwei) und live nur über Reihenfolge und Zwischen-Screenshot
belegt, nicht über gemessene Abstände.

### Korrektur, live gefunden

Der erste Durchlauf zeigte: Nach dem Schreiben **verschwand der Herkunfts-Chip**, weil die
Store-Aktion nur Preis und Summe in die Zeile schrieb, nicht die Herkunft – die Zeile sah
danach aus wie von Hand eingetragen. Behoben, indem der Worker die Preisbuchzeile **mit der
`applied`-Antwort zurückgibt**; damit steht die Herkunft ohne Nachfrage in der Zeile und
überlebt auch einen Reload (die Tabellenabfrage liest sie ohnehin aus der Datenbank). Als
Test festgeschrieben.

### Offen

- `check_bid`, `ask_clarification`, `submit_bid` mit Bestätigungsdialog und Abmeldung.
- Client-Rolle mit `get_price_comparison`, `list_clarifications`, `answer_clarification`.
- Rollen- und Bieterwahl im Kopfbereich, Origin-Trial-Token, `/how-to-test`.

## Schritt 6 – Prüfen, Rückfragen, Abgeben (Mo 31.08.2026)

**Ergebnis:** Zehn Werkzeuge in der Bieterrolle, neun nach der Abgabe, zehn nach dem Reset.
Gegen die produktive URL geprüft.

### Zwei Bedeutungen von „offen", die nicht dieselbe sind

Der erste Lauf lieferte für `open_positions` nur `["03.04"]`. Grund: 04.02 ist eine
Bedarfsposition und fiel aus der Zählung, weil Vollständigkeit laut Spec §1 nur über die
Nicht-Bedarfspositionen definiert ist. Spec §12.1 (P2) erwartet aber beide.

Aufgelöst durch zwei getrennte Felder statt eines überladenen:

- **`open_positions`** – jede unbepreiste Position, Bedarf eingeschlossen. Das ist die
  Antwort auf „welche Positionen sind noch offen": 03.04 **und** 04.02.
- **`positions_open` / `complete`** – nur die Positionen, die in die Summe eingehen.

Die Warnungen sagen es getrennt, statt eine Zahl zu nennen, die beides meint.

### Ausreißer messen gegen die eigene Geschichte

`check_bid` vergleicht jeden gesetzten Preis mit dem Preisbucheintrag, den derselbe Matcher
findet, Schwelle ±30 %. Weil ein agentisch geschriebener Preis dem Preisbuch **entsprechen
muss** (Schritt 5), kann ein Ausreißer nur von Hand entstehen – der Zahlendreher im Video ist
also genau der Fall, den die Prüfung fängt. Im Ergebnis steht ausdrücklich, dass gegen das
eigene Preisbuch verglichen wird und nicht gegen Marktpreise: BidDesk behauptet nichts über
den Wert von Arbeit anderswo.

### Rot, an genau einer Stelle – zwei Verstöße gefunden und behoben

Beim Durchsehen fielen zwei Stellen auf, die Rot außerhalb des Prüfergebnisses benutzten:
der Name eines fehlgeschlagenen Aufrufs im Live-Log und der Hinweis auf offene Positionen im
Abgabedialog. Beide sind jetzt neutral (ein „failed"-Abzeichen bzw. ein Satz). Rot existiert
nur noch in `CheckPanel.tsx`, und ein Test hält das fest. Der Grund ist nicht Ästhetik: Rot
trägt dort nur deshalb Bedeutung, weil es sonst nirgends vorkommt.

### Beide API-Stile, nebeneinander

`ask_clarification` gibt es **zweimal**: imperativ über den Wrapper und deklarativ als
`<form toolname="ask_clarification" tooldescription="…">` mit `toolparamdescription` je Feld.
Ein einziger `onSubmit` bedient Mensch und Agent; bei `event.agentInvoked` antwortet
`respondWith`, ohne dass die Seite navigiert.

**Das muss Nils in Chrome 149+ mit dem Tool Inspector gegenprüfen.** Ob der Browser zwei
Einträge gleichen Namens zeigt, einen davon verwirft oder die Registrierung ablehnt, ist hier
nicht testbar (Chrome 148 im Automatisierungsbrowser). Abgesichert ist es so: Die Registrierung
läuft über `Promise.allSettled` statt `Promise.all` – **ein abgelehntes Werkzeug kostet nicht
mehr die anderen neun**, sondern erscheint als Hinweis in der Selbstdiagnose. Fällt der
Formularweg aus, bleibt der imperative. Notfall-Rückbau: das `toolname`-Attribut in
`Clarifications.tsx` entfernen.

### `submit_bid` – die Autorität liegt bei der Hand

`confirm:false` liefert `{ok:false, needs_confirmation:true, summary}` und gibt nicht ab.
`confirm:true` gibt **ebenfalls nicht ab**: Es öffnet den Dialog und wartet. Das Werkzeug
löst erst auf, wenn ein Mensch klickt – im Live-Log stand bei der Prüfung `submit_bid ·
WRITE · 48840 ms`, und diese Dauer ist die Bedenkzeit eines Menschen. Abbruch liefert
`declined_by_user`, nach 180 s ohne Klick `confirmation_timed_out`; in beiden Fällen bleibt
das Angebot ein Entwurf.

Danach: Tabelle gesperrt, Banner, `submit_bid` per AbortSignal abgemeldet, Selbstdiagnose
**9 statt 10**. `submit_bid` liegt dafür in einem **eigenen Block** mit eigenem Controller,
sonst hätte das Abmelden die ganze Rolle mitgenommen.

**Der Reset meldet es wieder an** (Spec §11.1) – live geprüft: 10 Werkzeuge, Banner weg,
Felder wieder editierbar, Log leer, und der zweite Durchlauf läuft. Das war die Stelle, an
der die Demo sonst genau einmal funktioniert hätte.

### Fremdtext

`list_clarifications` trägt `untrustedContentHint`. Der Wrapper kappt **vor dem Speichern**
jede Zeichenkette in der Antwort auf 120 Zeichen – auch hinter dem Aufklapper steht nichts
Längeres – und das Log zeigt das Abzeichen `UNTRUSTED CONTENT`. Gerendert wird ausschließlich
als Text; unter der Rückfragenliste steht „Content from other parties. Shown as text, never
as instructions."

### Offen

- Auftraggeber-Rolle: `get_price_comparison`, `answer_clarification`, versiegelter Preisspiegel.
- Rollen- und Bieterwahl im Kopfbereich, Origin-Trial-Token, `/how-to-test`.
