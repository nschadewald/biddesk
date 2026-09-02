# Technik-Entscheidungen und Befunde

Laufendes Protokoll. Unten eine Überschrift je Bauschritt aus `docs/03-spec-biddesk.md` §9;
oben das, was davon übrig bleibt, wenn man den Code schon hat.

---

# Was diese Session gelernt hat

Alles hier steht so **nicht im Code** – entweder weil es eine Plattformeigenheit ist, die man
erst im Betrieb bemerkt, oder weil der Code heute nur noch das Ergebnis zeigt und nicht mehr
den Fehlschlag davor. Elf Bauschritte, 31.08.–01.09.2026.

## Plattform: Cloudflare und D1

**D1 begrenzt die Terme in einem zusammengesetzten SELECT.** Neun `UNION ALL`-Zweige quittiert
D1 mit `too many terms in compound SELECT` (`SQLITE_ERROR 7500`). Für „eine Zahl je Tabelle"
also **skalare Unterabfragen in einer Zeile** statt einer Union. Betraf zuerst ein Prüfskript,
dann die Bauweise des Preisspiegels – der holt heute **eine** Abfrage mit Joins und faltet in
JavaScript.

**Cloudflare beantwortet `Python-urllib` mit Fehler 1010** („The owner of this website has banned
your browser"). Jedes Prüf- und Eval-Skript gegen die produktive URL braucht einen eigenen
`User-Agent`; Browser und Puppeteer sind nicht betroffen. Kostet zehn Minuten Ratlosigkeit,
wenn man es nicht weiß.

**Nach einem Deploy propagieren die Assets rund 15 Sekunden.** In den ersten Sekunden danach
kommen 404 auf `/`, Cloudflare-Fehler 1042 auf `/api/*` und teilweise fehlgeschlagene
Eval-Läufe (einmal 2/11, einmal 5/11, beide Male ohne Codefehler). **Vor einem Prüflauf warten**,
sonst jagt man Gespenster. Gilt auch für den Freeze-Deploy am Mittwoch.

**`?raw`-Importe bündeln `seed/seed.sql` in den Worker.** Ein `npm run build` reicht zum
Einbündeln, es gibt keinen zweiten Weg, den Seed „einzuspielen".

## Messen: wo die Instrumente lügen

**`getBoundingClientRect()` misst die Layoutbox, nicht das Gemalte.** Eine Tabelle in einem
`overflow-x-auto`-Container ragt rechnerisch heraus, obwohl sie sichtbar abgeschnitten ist. Ein
erster Messlauf meldete deshalb eine Überlappung bei 1024 px, die es nicht gab. Richtig gemessen
wird **am Scroll-Container**, plus `scrollWidth > clientWidth` für „scrollt wirklich".

**Die Automatisierungsbrücke hungert die Timer der Seite aus.** Eine Staffelung von 70 ms je
Zeile ist darüber nicht messbar – sie erscheint entweder als ein Sprung oder als eine Sekunde
je Zeile. Belegt wurde sie deshalb dreifach anders: Unit-Test mit `vi.useFakeTimers()`,
gemessene **Reihenfolge** (streng von oben nach unten) und ein Screenshot mitten im Lauf.

**Ein Git-Worktree unter `.claude/`** enthielt eine zweite Kopie aller Testdateien; vitest zählte
24 Dateien und 194 Tests statt 12 und 97. In `vitest.config.ts` ausgeschlossen. Eine Zahl, die
im README steht, muss stimmen.

## Layout: `minmax(0, 1fr)`

Die Preis- und Summenspalte schob sich unter das Agent-Panel. Ursache war nicht absolute
Positionierung, sondern eine Grid-Spalte **ohne Mindestbreite null**: Bei `1fr` darf eine breite
Tabelle die Spaltenbreite mitbestimmen. `grid-cols-[minmax(0,1fr)_auto]` verbietet das. Jede
breite Tabelle sitzt zusätzlich in einem eigenen `overflow-x-auto`, damit sie in sich scrollt
statt die Seite zu schieben.

Unterhalb des Umbruchpunkts stapelt sich das Panel und klappt ein – aber `order-first`, denn
unter einer vierzehnzeiligen Tabelle wäre die Selbstdiagnose beim Ankommen außerhalb des Bildes,
und sie ist die Einstiegshilfe.

## WebMCP: der deklarative Weg hat drei Fallen

Ein Formular mit `toolname` wird vom Browser zu einem Werkzeug. Alle drei folgenden Fehler
zeigen sich **ausschließlich** auf einem Browser, der das umsetzt – auf Chrome 148 ist der
imperative Zwilling aktiv und alles wirkt gesund. Zusammen bedeuteten sie:
`ask_clarification` meldete Erfolg und legte **nie** eine Rückfrage an.

1. **`toolautosubmit` fehlte.** Ohne das Attribut füllt der Browser die Felder und wartet auf
   einen menschlichen Klick. Der Aufruf des Agenten hängt (Puppeteer lief in den Timeout),
   nichts wird abgeschickt, und die CLI meldet nur `pending form submission`. Eine Rückfrage ist
   ein gewöhnlicher, umkehrbarer Schreibvorgang – der Agent darf sie abschließen. Das eine, was
   eine Hand braucht, ist bewusst **kein** Formular.
2. **React-kontrollierte Felder werden zurückgesetzt.** Der Browser schreibt direkt ins DOM,
   React bemerkt es nicht und stellt beim nächsten Rendern den Zustandswert wieder her – und es
   rendert dauernd, allein das Live-Log genügt. Der Submit las zwei leere Felder. Formularfelder
   für Werkzeuge gehören **unkontrolliert**.
3. **`form.reset()` bricht den laufenden Aufruf ab.** Der Browser antwortet wörtlich mit
   `Tool execution cancelled by a form reset`. Zurückgesetzt wird nur noch, wenn ein **Mensch**
   abgeschickt hat (`event.agentInvoked === false`).

Dazu: **`respondWith` muss synchron im Dispatch aufgerufen werden**, mit einem noch laufenden
Promise – nicht nach einem `await`. Und: Das Formular kennt **kein** `tender_id`, es fragt zu
dem, was offen ist; der imperative Zwilling verlangte es zunächst. **Ein Name darf nicht zwei
Verträge haben**, je nachdem welcher Browser ihn bedient.

## WebMCP: gemessene API-Wirklichkeit in Chrome 152

- `document.modelContext` ist da, **`navigator.modelContext` nicht**. Der Fallback bleibt
  richtig, aber „Chrome bedient beides" stimmt für 152 nicht.
- **`getTools()` liefert ein Promise**, kein Array. Wer synchron auf `Array.isArray` prüft,
  fällt still auf die eigene Buchführung zurück – bei uns mit richtigem Ergebnis, aber die
  Browserliste wird nie benutzt.
- **`executeTool(tool, args)` erwartet ein `RegisteredTool`-Objekt** (aus `getTools()`) und die
  Argumente als **JSON-String**, nicht als Objekt. Beides falsch zu machen kostet zwei Anläufe.
- `SubmitEvent.prototype` trägt `respondWith` und `agentInvoked`. Das ist die belastbare
  **Feature-Erkennung** für den deklarativen Weg – zuverlässiger als aus `getTools()` zu raten.
- Der **Origin Trial funktioniert ohne Flag**: normales Chrome 152, `<meta http-equiv=
  "origin-trial">` im Kopf, Selbstdiagnose zählt zehn Werkzeuge.

## GAEB: die Kategorie kommt aus dem Positionstext, nie aus der Überschrift

Ein X83 nennt keine Kategorie, die zu unserem Preisbuch passt, und GAEB-Überschriften sind
Freitext, je Büro anders. Abgeleitet wird deshalb aus dem **Wortlaut der Position**.

Der erste Versuch berücksichtigte Positionstext **und** Überschrift – und produzierte prompt
einen **falschen Preis mit korrektem Herkunfts-Chip**, also genau das, wogegen dieses Produkt
gebaut ist: Ein echtes Leistungsverzeichnis fasst Wand- und Deckenarbeiten unter eine
Überschrift („Wand- und Deckenflächen"). Die enthält „Decken", also bekam auch die Wandposition
`ceiling` und damit **9,10 €** statt ihrer eigenen **8,40 €**.

Jetzt entscheidet der Positionstext allein; die Überschrift wird nur befragt, wenn er nichts
hergibt. **Auf den eigenen Beispieldateien wäre das nie aufgefallen**, weil unsere eigenen
Überschriften sortenrein sind – das ist das Argument für die fremde Testdatei in einem Satz.

Sicher ist das Ableiten überhaupt nur, weil **aus einer Kategorie nie ein Preis wird**: Eine
falsche kostet einen Vorschlag, und ein fehlender Vorschlag ist ein leeres Feld.

## Arbeitsweise, die sich bewährt hat

**Gegen die Produktion prüfen, nicht gegen den lokalen Stand.** Jeder Schritt endete mit einem
Skript gegen die deployte URL. Vier Fehler wären sonst durchgerutscht: der verschwindende
Herkunfts-Chip, der stehengebliebene `my_bid_status`, die drei Formularfehler und der falsche
Kategoriepreis. Kein einziger davon war im Unit-Test sichtbar.

**Tests gegen `seed/seed.json` rechnen, nicht gegen abgeschriebene Zahlen.** `matching.test.ts`
und `comparison.test.ts` lesen den Seed selbst. Als sich der Seed in Schritt 8 änderte, fiel
sofort auf, dass Colorpoint jetzt sieben statt sechs Lücken hat – statt dass eine Zahl im Test
still falsch geworden wäre.

**Prüfskripte lügen auch.** Drei „Fehlschläge" waren Fehler im Skript, nicht im Produkt: zu
weit gefasste Zeilenzählung über alle Workspaces, ein Substring-Treffer auf eine Seed-Rückfrage,
und `getBoundingClientRect` (siehe oben). Erst das Skript prüfen, dann das Produkt verdächtigen.

---

# Protokoll je Bauschritt

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

## Schritt 7 – Auftraggeber-Rolle und Rollenwahl (Mo 31.08.2026)

**Ergebnis:** Zwölf verschiedene Werkzeuge, zehn in der Bieterrolle, fünf beim Auftraggeber.
Rollen- und Bieterwahl im Kopfbereich. Gegen die produktive URL geprüft.

### `ask_clarification` genau einmal – und wie das entschieden wird

Die Spec lehnt doppelte Namen ab, also darf das Werkzeug **entweder** deklarativ **oder**
imperativ existieren. Die Entscheidung fällt über eine echte Feature-Erkennung statt über
eine Vermutung: Die deklarative API erweitert `SubmitEvent` um `respondWith`/`agentInvoked`.

```ts
"respondWith" in SubmitEvent.prototype || "agentInvoked" in SubmitEvent.prototype
```

Ist das da, zählt allein das Formular; fehlt es, wird der imperative Zwilling angemeldet.
Wo der Browser zusätzlich `getTools()` anbietet, wird die Erkennung damit bestätigt.

Die Selbstdiagnose zählt **beide Stile in einer Liste**, das Formular mit dem Abzeichen
`form`. **In beiden Fällen zehn Werkzeuge** in der Bieterrolle – neun imperative plus das
Formular, oder zehn imperative. Ein Test hält beide Wege fest.

Wichtig dabei: `declareFormTool` trägt nur ein, **wenn der Browser Formular-Werkzeuge
versteht**. Sonst würde die Selbstdiagnose ein Werkzeug behaupten, das der Browser nie
erzeugt hat – der erste Testlauf zeigte genau das (elf statt zehn in jsdom).

### Wartezeit auf den Menschen getrennt ausgewiesen

`LogEntry` hat jetzt `waited_for_human_ms` neben `duration_ms`. Die Store-Aktion
`requestSubmit` misst, wie lange der Dialog offen stand, und meldet es; der Wrapper zieht es
von der Aufrufdauer ab. Im Log steht `48 ms + 12.4 s waiting for a person` statt
`12448 ms`. Grund: Eine zusammengerechnete Zahl liest sich wie eine langsame Anwendung,
während sie in Wahrheit eine sorgfältige ist.

### Rollen sind getrennt, weil die Werkzeuge getrennt sind

Beim Wechsel meldet ein `AbortController` neun Werkzeuge ab und ein zweiter Block fünf an –
`toolchange` feuert für beides. In der Bieterrolle **existieren** `get_price_comparison` und
`answer_clarification` nicht; das ist keine Rechteprüfung, an der ein Agent vorbeikommen
könnte. Ein Test hält beide Richtungen fest.

### Versiegelt ist ein Zweig, kein Schalter

`get_price_comparison` hat für eine offene Ausschreibung **keinen Codepfad, der einen Preis
zurückgibt**: Es antwortet mit Anzahl, Eingangszeitpunkten und `sealed_until`, und die Felder
`positions` und `bidders` sind leer. Geprüft wurde auch der Antworttext selbst – die
Zeichenketten `unit_price` und `total_net` kommen darin nicht vor.

Nach der Demo-Abgabe springt der Zähler von 2 auf 3 und bleibt versiegelt. Hat der gewählte
Bieter einen Entwurf, steht dort „2 bids received · your draft is not visible to the client".

Der Preisspiegel selbst kommt aus **einer** Abfrage mit Joins, in JS gefaltet – kein
`UNION ALL` (D1-Termgrenze, siehe Schritt 2). `src/comparison.test.ts` rechnet die Sollwerte
gegen `seed/seed.json` nach: Brandt 16.749,50 €, Colorpoint 10.993,50 €, und auf der
geschlossenen T-2026-009 Median 13,20 € mit Colorpoint als einzigem Ausreißer.

### Korrektur, live gefunden

Nach dem ersten Schreibvorgang blieb `my_bid_status` auf `none` stehen, weil `set_unit_price`
nur die Zeilen aktualisiert. Folge: Die Auftraggeberansicht zeigte die Zeile „your draft is
not visible to the client" nie. Behoben – die erste angenommene Zeile setzt den Status lokal
auf `draft` (der Server hat den Entwurf gerade angelegt), und ein Rollenwechsel liest den
Tender ohnehin neu. Mit Test.

### Beobachtung für das Video, kein Fehler

Der Bieterwechsel beweist §13.2 im Werkzeugergebnis für alle drei (2 / 0 / 6 Lücken), **auf
dem Bildschirm** aber nur für Farbwerk Meier: Brandt und Colorpoint haben im Seed bereits
abgegeben, ihre Tabelle ist also gesperrt und zeigt ihre eigenen Preise. Das ist richtig so
(und selbst ein Beweis für die Trennung), nur eben ein anderes Bild als erwartet.
T-2026-015 taugt als Ersatz **nicht** – dort haben alle drei dieselbe eine Lücke.
Für das Video heißt das: den Wechsel über die Werkzeugantwort zeigen, nicht über die Tabelle.

### Offen

- Origin-Trial-Token, `/how-to-test`, README, Evals.
- Der Doppelname-Test im Tool Inspector (Chrome 149+) ist mit dieser Änderung gegenstandslos:
  es wird nur noch genau eine Fassung angemeldet.

## Schritt 8 – Seed, Origin Trial, Einstiegshilfe (Mo 31.08.2026)

**Ergebnis:** Neuer Seed ausgeliefert, Origin-Trial-Token in der Seite, `/how-to-test` und
README stehen. Gegen die produktive URL geprüft.

### Seed

`seed.sql` wird per `?raw` in den Worker gebündelt, ein `npm run build` reicht also zum
Einbündeln. In einem frischen Workspace gegengeprüft:

| | |
|---|---|
| T-2026-014, Meier | 2 Lücken (03.04, 04.02), netto **13.213,50 €**, Bedarf 370,00 € |
| T-2026-015 | Meier **1** (03.01) · Brandt **0** · Colorpoint **2** (02.03, 03.01) |
| T-2026-009 | Median 13,20 €, Colorpoint einziger Ausreißer – unverändert |
| `verify_seed.py` | ALLES GRUEN, inklusive der neuen T-2026-015-Prüfung |

**Nebenwirkung, die auffallen wird:** Colorpoint hat auf T-2026-014 jetzt **sieben** Lücken
statt sechs – der gestrichene `ceiling/m2`-Eintrag fehlt dort bei 02.03. Das ist die Folge
derselben Änderung, die T-2026-015 dreiteilig macht, und kein Fehler. `matching.test.ts` liest
die Erwartung jetzt aus `seed.json` (`deliberate_gaps.secondary_tender`) statt aus
abgeschriebenen Listen, damit die nächste Seed-Änderung den Test nicht still falsch macht.

### Origin Trial – eingebaut, hier aber nicht abschließend prüfbar

Der Token steht als `<meta http-equiv="origin-trial">` im `<head>` und übersteht den Build.
Geprüft ist, was von hier aus prüfbar ist:

- Der ausgelieferte HTML-Kopf trägt das Meta-Tag (aus der Produktion gelesen).
- Der Token dekodiert zu `origin: https://biddesk.n-schadewald.workers.dev:443`,
  `feature: WebMCP`, `expiry: 17.11.2026` – die Origin stimmt, und er läuft nach dem
  Jurierungsende (21.09.) ab, nicht davor.
- **Kein Rückschritt:** Die Seite lädt unverändert, 14 Zeilen, keine Konsolenfehler.

**Nicht geprüft, weil hier nicht prüfbar:** ob Chrome ohne Flag damit WebMCP freischaltet.
Der Automatisierungsbrowser ist **Chrome 148**; WebMCP kommt mit 149. Ein Origin Trial
schaltet nur frei, was der Build überhaupt kennt. Die Abnahme aus dem Auftrag – *normales
Chrome ohne Flag, Selbstdiagnose zählt* – muss auf einem Rechner mit Chrome 149+ laufen.
Fällt sie durch: Meta-Tag aus `index.html` entfernen, Flag bleibt der Testweg, Satz ins README.

### `/how-to-test`

Zwei Seiten, kein Router: Der Worker liefert für jeden Pfad `index.html`, und `client.tsx`
wählt anhand von `location.pathname`. Eine Router-Abhängigkeit hätte hier nichts gebracht.

Der **Handoff-Hinweis steht ganz oben**, vor allem anderen, in einem hervorgehobenen Kasten.
Das ist die Lehre vom 31.08.: Wird die eine Nachfrage von ChatGPT abgelehnt, verweigert es für
den Rest der Unterhaltung, und die Seite sieht funktionslos aus. Ohne diesen Satz zieht ein
Juror den falschen Schluss, und kein Code der Welt hilft dagegen.

Der Kasten ist bernsteinfarben. Das ist die einzige Farbe außerhalb des Prüfergebnisses in der
ganzen Anwendung; sie steht auf einer Hilfeseite, nicht am Artefakt, und markiert keinen
Zustand des Angebots. Wenn das zu weit geht, ist es eine Zeile.

### Offen

- Chrome-149-Abnahme des Origin Trials (siehe oben).
- WebMCP-Evals, Lighthouse-Agentic-Audit, GAEB-Import (Zeitbox Mi vormittag).
- Devpost-Text und Video.

## Schritt 9 – Layout und zwei Befunde aus dem ChatGPT-Durchlauf (Di 01.09.2026)

### §13.3d ist bestätigt – die Datenbank sagt es

Aus dem Durchlauf-Workspace `88738e98-3eda-43a0-b05e-9d91310be6be` (angelegt 01.09. 05:52):

| Zeile | Preis | `set_by` | `price_book_id` |
|---|---|---|---|
| 01.01 … 04.01 (zwölf Zeilen) | aus dem Preisbuch | `agent` | PB-A-001 … PB-A-012 |
| **03.04** | **61,00 €** | **`human`** | **keine** |

Das `change_log` zeigt die Trennung noch deutlicher: **Block 34** um 05:54:34 enthält alle
zwölf Zeilen in einem Zug (`created_bid: true`). **Block 35** um 06:05:50 – elf Minuten
später – enthält **genau eine** Zeile, 03.04, `previous: null`.

Das Live-Log selbst lebt nur im Browser und ist weg. Der Beweis ist aber stärker als das Log:
Über `set_unit_price` **kann** dieser Wert nicht gekommen sein, denn dieser Kanal verbucht als
`agent` und weist eine Zeile ohne `price_book_id` mit `price_without_source` ab. Ein
Einzelzeilen-Schreibvorgang mit `set_by='human'` entsteht ausschließlich über das
Tabellenfeld. Die Erklärung aus §13.3d – der Agent hat wie ein Mensch getippt – ist damit
nicht nur plausibel, sondern die einzige mögliche.

Die zentrale Aussage im README ist auf die präzise Fassung umgestellt und als **sechste**
Known Limitation aufgenommen; der frühere Satz „`set_by='human'` kann nur von einem Menschen
an der Tastatur stammen" stand danach im Widerspruch dazu und ist ebenfalls korrigiert.

### Layout: echtes Grid statt Flex-Nebeneinander

`grid-cols-[minmax(0,1fr)_auto]`. Das `0` in `minmax` ist der eigentliche Punkt: ohne
Mindestbreite null bestimmt eine breite Tabelle die Spaltenbreite mit, und genau dadurch
schob sie sich unter das Panel. Jede breite Tabelle sitzt jetzt zusätzlich in einem eigenen
`overflow-x-auto`; das Panel ist auf `lg:w-80` (320 px statt 384 px) verschmälert.

Gemessen (nicht geschätzt) bei echten Viewport-Breiten:

| Breite | Tabellenbereich endet | Panel beginnt | Überlappung | Seite scrollt waagerecht |
|---|---|---|---|---|
| 1240 px | 881 px | 905 px | nein | nein |
| 1024 px | 669 px | 689 px | nein (Tabelle scrollt in sich: 744 > 649) | nein |
| 900 px | – | gestapelt | nein | nein |

**Messfehler unterwegs, der fast zu einer Fehldiagnose geführt hätte:** `getBoundingClientRect()`
auf der Tabelle liefert deren Layoutbox, nicht das Gemalte – innerhalb eines
Overflow-Containers ragt sie rechnerisch heraus, obwohl sie sichtbar abgeschnitten ist.
Richtig gemessen wird am Scroll-Container plus `scrollWidth > clientWidth`.

Unter `lg` stapelt sich das Panel und ist **eingeklappt, aber nicht stumm**: Die
Selbstdiagnose bleibt als eine Zeile stehen, mit Link auf `/how-to-test`. Und sie steht
`order-first` – unter einer vierzehnzeiligen Tabelle wäre die Einstiegshilfe beim Ankommen
außerhalb des Bildes gewesen.

### `submit_bid confirm:false` ist kein Fehlschlag

Der Wrapper las jedes `ok:false` als Fehler, und `summariseOutput` machte aus dem fehlenden
`error`-Feld ein „unknown". Ausgerechnet der sicherste Weg durch die Anwendung sah damit
kaputt aus. Neu: ein dritter Ausgang `needs_confirmation`. Im Log steht jetzt

```
08:23:18 · submit_bid · AWAITING CONFIRMATION · WRITE · 173 ms
  in  tender_id: T-2026-014 · confirm: false
  out waiting for a person · 13213.5 EUR net
```

Die Rückgabe des Werkzeugs bleibt unverändert `{ok:false, needs_confirmation:true, summary}`
wie in Spec §3 – geändert wurde nur, wie das Log sie liest. Zweitens: Ein Fehler ohne
`error`-Feld heißt jetzt „no reason given" statt „unknown". Beides mit Test.

### Prompt 2 ausgetauscht

Alt: „Which positions are still open and what's my total right now?" – nach P1 redundant, der
Agent hatte das gerade selbst gesagt. Neu: **„Why is there no price for the radiators?"**
Der Prompt fragt die Kernaussage ab, statt sie zu wiederholen: Der Agent muss die Lücke
erklären und darf **keine Zahl anbieten**. Nachgezogen in Agent-Panel, `/how-to-test`,
`spec.md` §12.1 und `docs/03-spec-biddesk.md`.

### Offen

- Chrome-149-Abnahme des Origin Trials.
- Evals, Lighthouse, GAEB (Zeitbox Mi vormittag), Devpost-Text, Video.

## Schritt 10 – Belege: Evals und Lighthouse (Di 01.09.2026)

### Chrome 152 ist auf diesem Rechner – damit fiel nebenbei die Abnahme aus Schritt 8

Der Automatisierungsbrowser hier ist Chrome 148, aber **lokal installiert ist Chrome 152**.
Puppeteer startet ihn, die Evals laufen darüber, und die Sonde meldet:

```
hasDocumentModelContext: true, hasNavigatorModelContext: false
diagnosis: "WebMCP detected · 10 tools registered"
```

**Ohne `chrome://flags`.** Damit ist der **Origin Trial abgenommen** – die offene Frage aus
Schritt 8 ist beantwortet. Nebenbei bestätigt: `document.modelContext` ist der richtige
Primärpfad, `navigator.modelContext` gibt es in 152 nicht mehr.

### Drei echte Fehler, die nur die Evals finden konnten

Alle drei betreffen **ausschließlich** den deklarativen Weg und sind auf Chrome 148 unsichtbar.
`ask_clarification` meldete Erfolg und legte nie eine Rückfrage an – Prompt 4 wäre im Video
stillschweigend wirkungslos gewesen.

1. **`toolautosubmit` fehlte.** Ohne das Attribut füllt der Browser die Felder und wartet auf
   einen menschlichen Klick: Der Aufruf des Agenten hängt (Puppeteer lief in den Timeout) und
   nichts wird abgeschickt. Eine Rückfrage ist ein gewöhnlicher, umkehrbarer Schreibvorgang –
   der Agent darf ihn abschließen. Das eine, was eine Hand braucht, ist kein Formular.
2. **Die Formularfelder waren React-kontrolliert.** Der Browser schreibt direkt ins DOM, React
   bemerkt das nicht und setzt beim nächsten Rendern den Zustandswert zurück – und es rendert
   dauernd, allein das Live-Log genügt. Jetzt unkontrolliert.
3. **Unser eigenes `form.reset()` brach den Aufruf ab.** Der Browser antwortet darauf wörtlich
   mit `Tool execution cancelled by a form reset`. Zurückgesetzt wird jetzt nur noch, wenn ein
   **Mensch** abgeschickt hat (`event.agentInvoked === false`).

Dazu eine Unstimmigkeit, die der erste Lauf zeigte: Das Formular kennt **kein** `tender_id` –
es fragt zu dem, was offen ist. Der imperative Zwilling verlangte es aber. Ein Name mit zwei
Verträgen, je nach Browser. `tender_id` ist jetzt optional und fällt auf den offenen Tender
zurück.

### Was die Evals prüfen, und was nicht

`webmcp-evals smoke` prüft die **Werkzeugkette** gegen die echte Seite, ohne Modell und ohne
API-Schlüssel. Es sieht aber nicht an, **was zurückkam**. Spec §6 verlangt beides, deshalb
`evals/assert_outcomes.py`: Es ruft die offizielle CLI auf, liest deren Ausgaben und behauptet
je Fall das sichtbare Ergebnis. **11 von 11 Schritten, 7 Fälle, drei saubere Läufe
hintereinander.**

Die Rollentrennung ist der Grund, warum die Client-Fälle (heute C1–C3; bis zum 02.09. E6/E9/E10
genannt, dann einheitlich umnummeriert, weil E6 und E7 als CLI-Fälle dazukamen) nicht über die
CLI laufen: Es gibt kein
Werkzeug, das die Rolle wechselt – genau die Eigenschaft, um die es geht. `evals/client_role.mjs`
fährt dafür ein echtes Chrome und schaltet im Kopfbereich um wie ein Mensch. Zehn Werkzeuge als
Bieter, fünf als Auftraggeber, und `get_price_comparison` existiert auf der Bieterseite nicht.

**Nicht abgedeckt:** ob ein Modell die richtige Kette *wählt*. Das braucht `webmcp-evals browser`
mit API-Schlüssel; hier ist keiner gesetzt, und ich nehme dafür keinen fremden. Steht so im README.

### Lighthouse: 0,75

Kategorie „Agentic Browsing", Lighthouse 13.4.1. `agent-accessibility-tree`,
`webmcp-registered-tools`, `webmcp-schema-validity` und `cumulative-layout-shift` (0.006) je 1,
`webmcp-form-coverage` nicht anwendbar – und **`llms-txt` mit 0**, weil es die Datei nicht gibt.

Bewusst **nicht** nachgebessert: Der Auftrag sagte „keine neuen Funktionen" und „ein ehrlicher
Wert schlägt keinen Wert". Eine Datei anzulegen, nachdem man das Audit gelesen hat, misst nicht
mehr das Gebaute. `/llms.txt` sind zehn Zeilen, falls die Entscheidung anders ausfällt – dann
aber bitte vor dem Freeze und mit neu gemessener Zahl.

### Zwei Messhinweise

- **Direkt nach einem Deploy schlagen Läufe fehl** (einmal 2/11, einmal 5/11), bis die Assets
  propagiert sind. Rund 15 Sekunden warten, dann ist es reproduzierbar sauber.
- **Ein Git-Worktree unter `.claude/`** enthielt eine zweite Kopie aller Testdateien; vitest
  zählte 24 Dateien und 194 Tests statt 12 und 97. In `vitest.config.ts` ausgeschlossen – eine
  Zahl, die im README steht, muss stimmen.

### API-Notizen aus Chrome 152 (für Mittwoch)

- `document.modelContext.getTools()` liefert ein **Promise**, kein Array. Unsere Prüfung auf
  `Array.isArray` schlägt fehl und fällt auf die eigene Buchführung zurück – Ergebnis stimmt,
  aber die Browserliste wird nie benutzt. Kein Fehler, nur eine Feststellung.
- `executeTool(tool, args)` erwartet ein **RegisteredTool-Objekt** und die Argumente als
  **JSON-String**, nicht als Objekt.

### Offen

- GAEB (Zeitbox Mi vormittag), Devpost-Text, Video.
- Falls gewünscht: `/llms.txt` und eine neue Lighthouse-Messung.

## Schritt 11 – llms.txt, GAEB (Di 01.09.2026, 10:20–11:00)

### llms.txt: 0,75 → 1,00, und beide Zahlen bleiben stehen

`public/llms.txt` beschreibt in zwanzig Zeilen, was die Seite ist, was die zwölf Werkzeuge je
Rolle tun, wo `/how-to-test` und das README liegen und dass es eine Demo ohne Anmeldung ist.
Danach neu gemessen: **Agentic Browsing 1,00**, `llms-txt` von 0 auf 1.

Im README stehen **beide Spalten**. Die erste ist, was die Anwendung erreichte, **bevor jemand
das Audit gelesen hatte**; die zweite, was sie erreicht, nachdem eine Datei genau deswegen
entstanden ist. Nur die 1,00 zu zeigen hieße zu behaupten, wir hätten daran gedacht.

### Worktree: war nie im Index

`git ls-files .claude` ist leer – der Worktree lag nur in `.git/info/exclude`, also lokal in
diesem Checkout. Nichts zu entfernen. `.gitignore` deckt jetzt `.claude/` und `.evals/` ab,
damit die Ausnahme einen Klon überlebt.

### GAEB: BESTANDEN, um 10:50, Zeitbox war 13:00

Der Test war binär, und er ist bestanden: `seed/gaeb/T-2026-021.x83` – eine Datei, die der
Parser nicht kennt – wird auf die Seite gezogen, erzeugt T-2026-021 mit allen neun Positionen
und ist danach bepreisbar. **Ohne Codeänderung.** Nachvollziehbar mit
`node evals/gaeb_import.mjs`.

Die zweite Datei ist absichtlich in jeder Hinsicht anders gebaut, in der ein Parser hätte
schummeln können: Namensraum-Präfix an jedem Element, drei Ebenen Kategorieverschachtelung,
andere Überschriften, Einheiten als `m²`/`Stk`/`Std.`/`psch.`, deutsche Dezimalkommata, eine
Position ohne OutlineText und **kein einziges `Provis`-Element** – die Bedarfspositionen werden
allein an der Überschrift „Eventualpositionen" erkannt. Ergebnis: acht von neun Preisen aus dem
Preisbuch von Farbwerk Meier, jeder mit Herkunft; die neunte ist der Stundenlohn, den dieser
Betrieb nicht führt, und bleibt leer.

**Die Kategorie wird aus dem Wortlaut abgeleitet, nicht aus der Datei gelesen.** GAEB-Kategorie-
bezeichnungen sind Freitext und je Büro anders; eine Zuordnungstabelle funktionierte nur für
Dateien, die wir schon gesehen haben. Sicher ist das Ableiten, weil aus einer Kategorie nie ein
Preis wird: Eine falsche kostet einen Vorschlag, und ein fehlender Vorschlag ist ein leeres
Feld. Gegen die Einordnung im Seed gemessen: **25 von 25**.

**Kein Werkzeug für den Import.** Das Leistungsverzeichnis ist das Dokument des Auftraggebers;
im Vergabeverfahren darf ein Bieter daran nichts anlegen, und der Agent auch nicht. Ein Mensch
zieht die Datei hinein, danach kann der Agent bepreisen wie überall sonst. Es bleibt bei zwölf
Werkzeugen.

### Der Fehler, den erst die fremde Datei zeigte

Der erste Lauf war „bestanden" – und lieferte trotzdem einen **falschen Preis mit korrektem
Herkunfts-Chip**, also genau das, wogegen dieses Produkt gebaut ist.

Ein echtes Leistungsverzeichnis fasst Wand- und Deckenarbeiten unter eine Überschrift:
„Wand- und Deckenflächen". Die Ableitung berücksichtigte Positionstext **und** Überschrift; die
Überschrift enthält „Decken", also bekam auch die Wandposition die Kategorie `ceiling` – und
damit den Deckenpreis **9,10 €** statt ihrer eigenen **8,40 €**. Belegt, nachvollziehbar,
falsch.

Jetzt entscheidet der Positionstext allein; die Überschrift wird nur befragt, wenn er nichts
hergibt. Danach: 21.01 → 2,90 € (Grundierung Wand), 21.02 → 8,40 € (Wand), 21.03 → 9,10 €
(Decke). Als Test festgeschrieben.

Das ist das Argument für die fremde Datei in einem Satz: Auf unseren eigenen Beispielen wäre
dieser Fehler nie aufgefallen, weil unsere eigenen Überschriften sortenrein sind.

### Stand

112 Unit-Tests, Bieter-Evals 11/11, Client-Evals grün, `verify_seed.py` grün, Lighthouse 1,00,
GAEB bestanden.

### Offen

- Devpost-Text und Video.

## Schritt 12 – DE/EN-Umschalter (Di 01.09.2026)

**Zielkorrektur, die den Schritt auslöst:** Die Demo soll Kunden gewinnen. Publikum sind
deutsche Handwerksbetriebe und Hausverwaltungen; die Jury ist ein Sonderfall davon. Ein
Malermeister sieht sich keine englische Oberfläche an. Damit rutscht der Umschalter von
Spec §8 (Stretch) auf Platz eins – und Englisch bleibt trotzdem die Vorgabe, weil ein Juror
ohne Vorgeschichte in der Sprache ankommen muss, in der er testet.

### Die Sprache reist im Header und wird an genau einer Stelle aufgelöst

`X-Language`, neben `X-Workspace-Id` und `X-Bidder-Id`, **zum Zeitpunkt des Fetch** aus
`src/api.ts` gelesen – nicht aus einer Komponente mitgegeben. Ausgewertet wird sie im Worker
in `toTender`/`toPosition` und in der Nachweisliste; ohne Header gilt `en`.

Zwei Folgen, beide gewollt:

- **Die Evals, `/how-to-test` und `seed/verify_seed.py` senden keinen Header** und haben sich
  um kein Zeichen geändert. Live gegengeprüft: ohne Header kommt exakt der bisherige englische
  Text zurück.
- **Die Nutzlast wird schlanker statt breiter.** `text_de`, `long_text_de`, `title_de` und
  `label_de` sind aus der API verschwunden: Der Worker schickt **einen** Text je Feld. Zwei
  Fassungen auszuliefern hieße, die Entscheidung ein zweites Mal im Frontend zu treffen – und
  die Werkzeuge, die genau diese Objekte zurückgeben, würden die nicht gefragte Sprache
  mitleaken. Nebenbei ist `get_tender` damit näher an Spec §3 als vorher.

### Was der Sprachwechsel ausdrücklich NICHT tut

`useWebMCP` hängt an `[role]` und `[role, canSubmit]`. Die Sprache steht in keiner dieser
Listen und in keinem `inputSchema`. Ein Wechsel meldet also **nichts** ab und **nichts** an,
`toolchange` feuert nicht, und die Selbstdiagnose zählt dieselbe Zahl weiter. Als Test
festgeschrieben, indem `registerTool` gezählt wird: vor und nach dem Wechsel gleich viele
Aufrufe, und die Diagnose sagt danach „WebMCP erkannt · 10 Werkzeuge angemeldet".

Der Grund ist nicht Sparsamkeit: Ein `toolchange` ist eine Mitteilung an den Agenten, dass
sich sein Werkzeugkasten geändert hat. Dass ein Mensch die Sprache seines Bildschirms
umstellt, ist keine solche Änderung.

### Die Grenze: Werkzeuge sprechen Englisch, Menschen lesen Deutsch

Englisch bleiben ausnahmslos Werkzeugnamen, Beschreibungen, Schemas, `reason`-Texte, die
`warnings` aus `check_bid`, die Fehlerobjekte `{ok:false,error,hint}` – und die Zeilen im
Live-Protokoll, weil die zeigen, was tatsächlich über die Grenze ging. Der **Rahmen** um das
Protokoll folgt der Sprache, die Zeilen darin nicht.

Der Sprache folgen genau zwei Dinge aus dem Werkzeugergebnis: die **Positionstexte** und die
**Nachweis-Bezeichnungen**. Beides ist das, was ein Mensch auf Papier vor sich hat. Sichtbar
wird das im Prüfergebnis: dort steht in der deutschen Fassung „Unbedenklichkeitsbescheinigung",
während die englische Warnung, die derselbe Aufruf an den Agenten zurückgibt, unverändert
englisch bleibt.

Auch die **Beispiel-Prompts** sind übersetzt. Wer auf Deutsch arbeitet, tippt auf Deutsch, und
den Werkzeugen ist die Sprache des Satzes gleichgültig.

### Zahlen bleiben deutsch, Datumsangaben folgen der Sprache

`formatEuro`/`formatQuantity` bleiben in **beiden** Sprachen `de-DE`. Die 13.213,50 € stehen an
sechs Stellen als feste Prüfzahl (Spec, README, `verify_seed.py`, Evals); ein Tausenderpunkt,
der mit der Oberflächensprache wandert, würde diese Zahlen sprachabhängig machen, ohne dass
irgendjemand etwas davon hätte. Datumsangaben kommen in keiner Prüfzahl vor und folgen deshalb
der Sprache (`de-DE` / `en-GB`).

### Wörterbuch statt Ternäre – und warum das eine Regel ist, kein Stil

Alle sichtbaren Zeichenketten stehen in `src/i18n.ts`. Die deutsche Hälfte ist als
`typeof en` typisiert, ein fehlender Schlüssel ist damit ein **Compilerfehler**. Ein Test
ergänzt die andere Verfallsart: vorhandener, aber leerer Schlüssel.

Ab diesem Commit gilt: **kein hartkodierter sichtbarer String mehr**, auch nicht in Schirmen,
die später dazukommen. Ohne diese Regel schreibt der nächste Auftrag einen Text „erstmal auf
Englisch" hin, und die Zweisprachigkeit ist still wieder halb.

Zwei Ausnahmen, beide begründet: `/how-to-test` bleibt englisch (Juroren-Seite), und die
Sprachauswahl nennt jede Sprache in ihrer eigenen Sprache – wer „Deutsch" sucht, sucht das
Wort, das er kennt, nicht dessen Übersetzung.

### Der Fehler, den erst der Wechsel *zurück* gezeigt hat

Der erste Durchlauf sah richtig aus: Umschalten auf Deutsch, alles deutsch. Zurück auf
Englisch – und die **Ausschreibungsliste des Auftraggebers stand weiter auf Deutsch**.
Ursache: `selectLanguage` las nur die geöffnete Ausschreibung neu, nicht die Liste und nicht
ein offenes Prüfergebnis. Beides hängt an Texten aus dem Worker.

Jetzt liest der Wechsel nach, was auf dem Bildschirm steht: die offene Ausschreibung immer,
das Prüfergebnis wenn eines offen ist, Liste und Preisspiegel in der Auftraggeberrolle.
**Nicht** nachgelesen werden die Vorschläge – von einem Vorschlag sieht ein Mensch den
Quellen-Chip und die Preisbuchzeile, und beides ist nicht übersetzt.

Das ist der Grund, warum man einen Umschalter in beide Richtungen prüft: Der Hinweg zeigt,
dass Übersetzungen ankommen, der Rückweg zeigt, was man beim Nachladen vergessen hat.

### Stand

122 Unit-Tests, Bieter-Evals 11/11, Client-Evals grün, GAEB bestanden, `verify_seed.py` grün –
alle vier nach dem Deploy des Umschalters erneut gefahren. `src/HowToTest.tsx`, `evals/` und
`seed/` sind unverändert.

### Offen

- Devpost-Text und Video.
- Der Umschalter ist in keinem Eval-Fall abgedeckt: die Evals fahren die englische Vorgabe.
  Geprüft ist er über Unit-Tests und einen Durchlauf beider Sprachen in beiden Rollen auf der
  produktiven URL, nicht über die CLI. **Nachgezogen in Schritt 13.**

## Schritt 13 – Der Beleg sagt jetzt, was er ist (Di 01.09.2026)

### Der Herkunfts-Chip war für Eingeweihte geschrieben

Auf dem Chip stand `480,00 € Luegallee 40, March 2026`. Wer weiß, was diese Anwendung tut,
liest darin „das kommt aus einem eigenen alten Angebot dieses Betriebs". Wer es nicht weiß –
also jeder Juror in der ersten Minute und jeder Kunde im Verkaufsgespräch – liest zwei
Eigennamen ohne Aussage. Damit war der Beleg, auf dem die **gesamte** Produktaussage ruht, im
Bildschirm nicht lesbar. Ein Beweis, den niemand als Beweis erkennt, ist keiner.

Jetzt trägt der Chip die Herkunft in Worten: `from your quote · Luegallee 40 · March 2026`
bzw. `aus deinem Angebot · Luegallee 40 · März 2026`. Beim Öffnen steht über der Originalzeile,
was sie ist – „the line you priced back then" / „die Zeile, die du damals bepreist hast" –,
darunter unverändert `matched_terms`/`matched_on`.

**Der Text bricht um, statt zu kürzen.** Die Preisspalte ist 240 px breit, der Satz ist länger.
Ein Abschneiden hätte genau die Belegteile geschluckt, die neu dazugekommen sind: Projekt und
Datum. Eine Zeile mehr Höhe ist billiger als eine Behauptung ohne ihren Beleg.

§13.3 gilt unverändert: Alle Chips sehen gleich aus, keine Farbe, kein Gewicht, keine
Abstufung nach Trefferzahl. Ein Test hält weiterhin fest, dass zwei Chips mit einem bzw. vier
Treffern dieselbe CSS-Klasse tragen – und ein neuer, dass ein von Hand eingetragener Preis
**keinen** Chip bekommt und sich die Worte des Belegs also nicht ausleihen kann.

### Die englische Fassung sagt jetzt, wo sie spielt

Befund aus dem Verkaufsgespräch: deutsche Firmen, Straßen und Projekte neben englischen
Positionstexten wirken halb übersetzt. Entschieden wurde **gegen Umziehen und für Erklären** –
der Fall *ist* ein deutsches Vergabeverfahren: GAEB X83, VOB, Unbedenklichkeitsbescheinigung.
Die Eigennamen englisch zu machen hieße, den Realitätsbeweis wegzuwerfen, der das Beste an
diesem Projekt ist.

Stattdessen eine Zeile unter dem Titel, klein gesetzt: *„A German public tender (VOB/GAEB).
Names, prices and firms are invented."* Sie erledigt nebenbei den Hinweis, dass alle Daten
erfunden sind – der stand bisher nur im README, also dort, wo ein Juror mit dem Bildschirm vor
sich gerade nicht ist.

### Der Sprachtest, gegen die eigene Sabotage geprüft

Die Garantie „ein Vorschlag hängt nicht an der Anzeigesprache" hielt bisher **nur durch
Bauart**: Die Vorschlagsabfrage holt `text_de`. Eine spätere Änderung an dieser einen Zeile
wäre stillschweigend durchgegangen – der Bildschirm sähe in beiden Sprachen richtig aus,
während die Vorschläge wandern.

`src/server.test.ts` fährt dafür die **echte Worker-Route** gegen eine D1-Attrappe. Zwei
Eigenschaften machen den Test wirksam:

1. **Die Attrappe liefert nur die Spalten, die das SQL erfragt, unter den Namen, unter denen es
   sie erfragt.** Sie zerlegt dazu die Spaltenliste des SELECT. Eine auf `text_en` umgeschriebene
   Abfrage bekommt also eine Zeile *ohne* `text_de`, eine auf `text_en AS text_de` umgeschriebene
   bekommt deutsche Schlüssel mit englischem Inhalt.
2. **Die Vorlage widerspricht sich in den zwei Sprachen absichtlich.** „Wandflächen zweimal
   Anstrich" trifft zwei deutsche Schlagworte, „Two coats emulsion, walls" trifft keines.

Damit fängt der Test zwei verschiedene Fehler statt nur einen: Gleichheit allein würde eine
dauerhaft auf Englisch umgestellte Abfrage durchlassen, weil dann *beide* Aufrufe gleich falsch
wären. Deshalb prüft der zweite Fall zusätzlich, dass das Ergebnis das **deutsche** ist.

**Beides gegengeprüft, indem der Code absichtlich kaputtgemacht wurde:**

| Sabotage | Reaktion |
|---|---|
| `text_de` → `text_en AS text_de` | 1 Test rot („derives the proposals from the German short text") |
| Abfrage folgt `readLanguage(c)` | 2 Tests rot (Gleichheit **und** Herkunft) |

Danach zurückgesetzt und `git diff` gegen HEAD geprüft, damit von der Sabotage nichts stehen
bleibt. Ein Test, den man nicht einmal hat scheitern sehen, ist eine Vermutung.

Warum kein Eval-Fall: Ein Eval hängt an einem Modell, das eine Kette wählt. Für eine Invariante
ist das das falsche Instrument – sie muss auch dann fallen, wenn niemand einen Prompt tippt.

### `spec.md` und `docs/03` sind deckungsgleich – das ist die gute Nachricht und die Warnung

Beim Nachziehen von §8 gegengeprüft: Die beiden Dateien unterscheiden sich in **null**
inhaltlichen Zeilen, einzig `spec.md` trägt oben zwei Zeilen Snapshot-Kommentar. Es gibt also
heute keine Drift, die man auflösen müsste.

Bestehen bleibt trotzdem, dass zwei Kopien derselben Spec auseinanderlaufen **können** und
beide öffentlich sind. Der Snapshot-Kommentar sagt das jetzt ausdrücklich. Die eigentliche
Entscheidung – welche der beiden verschwindet – ist keine Technikfrage und steht aus.

### Stand

128 Unit-Tests in 15 Dateien (neu: `src/server.test.ts`), Bieter-Evals 11/11, Client-Evals grün, GAEB
bestanden, `verify_seed.py` grün.

### Offen

- Devpost-Text und Video.
- ~~**Du oder Sie.**~~ Entschieden am 02.09.: **Sie** (Markenregel MERKUR Impulse), umgesetzt
  in Schritt 15. Ein Test hält jetzt fest, dass die deutsche Hälfte kein „du" mehr enthält.
- Eine der beiden Spec-Kopien sollte verschwinden (siehe oben).

## Schritt 14 – ChatGPT sah neun Werkzeuge, die Seite zählte zehn (Mi 02.09.2026)

### Der Befund

ChatGPTs eigene Werkzeugansicht: „Verfügbare Website-Tools (9) · 6 mit Lesezugriff, 3 mit
Schreibzugriff". Es fehlte `ask_clarification`. Das Agent-Panel sagte gleichzeitig „10 tools
registered", mit `ask_clarification FORM`. Prompt 4 kam trotzdem durch – der Screenshot zeigte
wie: Die Frage stand **getippt im Formularfeld, nicht gesendet**. Der Agent hatte ins Formular
geschrieben, weil er das Werkzeug nicht sah. §13.3d, nur ungewollt.

### Die Ursache: Feature-Erkennung mit Sichtbarkeit verwechselt

`useWebMCP` meldete den imperativen Zwilling nur an, wenn `declarativeWorks` falsch war – und
das war `supportsDeclarativeTools() && (known === null || known.has("ask_clarification"))`.
In ChatGPT ist die `SubmitEvent`-Erweiterung vorhanden (Chromium-Unterbau), aber die
Agentenschicht listet Formular-Werkzeuge nicht. `known === null` hieß „der Browser sagt nichts",
und daraus wurde „dann wird es schon gehen". Die Selbstdiagnose zählte das Formular, weil die
Registry es **annahm**, nicht weil ein Browser es bestätigt hatte.

Dazu die Notiz aus Schritt 10, die hier zuschlug: `getTools()` liefert in Chrome 152 ein
**Promise**. Die Prüfung auf `Array.isArray` fiel deshalb immer auf die eigene Buchführung
zurück – die Browserliste wurde nie benutzt, und die Selbstdiagnose war seit Schritt 3 in
Wahrheit eine Selbstbeschreibung.

### Die Beweislast ist umgedreht

Der deklarative Pfad gilt als bestätigt **nur, wenn der Browser ihn listet**. Kann der Browser
das nicht bestätigen, wird der Zwilling angemeldet. Die Selbstdiagnose zählt, was der Browser
listet; liefert er keine Liste, zählen nur die imperativ registrierten Werkzeuge, und das
Formular erscheint als „declared by form · not confirmed by this browser" – sichtbar, nicht
gezählt.

Drei gemessene Tatsachen aus Chrome 152 bestimmen, wie das gebaut ist (Sonde per Puppeteer,
nicht geschätzt):

| Messung | Wert |
|---|---|
| `getTools()` | Promise, löst zu einem Array von Objekten `{name, title, description, inputSchema, origin, window}` |
| Formular-Werkzeug gelistet | **~30 ms nach** dem DOM-Einfügen des `<form toolname>`, dabei `toolchange` **am Modellkontext** (nicht am `document`) |
| Imperative Werkzeuge gelistet | ~275 ms **vor** dem Formular – die Rolle wird registriert, bevor die Tabelle geladen ist |
| Doppelname | `registerTool` wird mit `InvalidStateError: Duplicate tool name` **abgewiesen**; das Formular-Werkzeug bleibt |
| Formular entfernt / wieder eingefügt | Werkzeug binnen ~22 ms weg bzw. ~44 ms wieder da |

Daraus folgt: Die Entscheidung über den Zwilling darf **nicht** beim Registrieren des
Rollenblocks fallen (da existiert das Formular noch gar nicht), sondern erst nach einem
Wartefenster ab Deklaration. `declareFormTool` setzt das Formular auf `pending`, fragt den
Browser sofort, bei jedem `toolchange` und bei 150/300/600 ms erneut; nach 600 ms ohne Listung
ist es `unconfirmed`, und erst dann meldet der Hook den Zwilling an. Solange `pending`, wird
unter dem Namen nichts registriert – sonst gäbe es in Chrome die Kollision. Wo der Browser
gar kein `getTools` hat, ist das Formular sofort `unconfirmed`.

Das Urteil über ein Formular ist das des Zustandsautomaten, **kein Namensvergleich**: Sobald
ein Zwilling unter demselben Namen registriert ist, kann die Browserliste nicht mehr sagen,
welchen der beiden sie meint.

### Als Test festgeschrieben

`src/webmcp/useWebMCP.test.tsx`, mit einem Browser-Stub in drei Ausprägungen und `getTools()`
als Promise wie in Chrome 152: Browser listet das Formular → kein Zwilling, während der
Wartezeit nichts registriert; Browser listet Werkzeuge, aber nie das Formular → nach 600 ms
Zwilling, zehn bestätigt, das Formular daneben unbestätigt; kein `getTools` → Zwilling sofort,
Selbstdiagnose ohne das Formular. Dazu der Rollenwechsel, der Zwilling und Formularstatus
mitnimmt. `registry.test.ts` prüft jetzt außerdem, dass ein Promise aus `getTools()` abgewartet
wird und dass ein vom Browser gelistetes, von uns nie angebotenes Werkzeug trotzdem zählt.

### Abnahme in ChatGPT – gemessen, nicht vermutet (02.09., Nils)

Nach dem Deploy von `36d25bb` zeigt ChatGPTs Werkzeugansicht **10 Werkzeuge, 4 mit
Schreibzugriff**; das Agent-Panel zählt **10**; am Formular steht „ask_clarification ·
declared by form · not confirmed by this browser". Das ist genau der vorhergesagte Pfad:
**ChatGPT listet das Formular-Werkzeug nicht**, das Formular bleibt nach 600 ms
`unconfirmed`, der Zwilling wird angemeldet, und ChatGPT nimmt diese späte Registrierung auf.
Damit ist auch die Frage beantwortet, ob ChatGPT auf `toolchange` reagiert oder seine Liste
beim Laden einfriert: Es reagiert. Die Alternative – imperativ zuerst, überall, und `toolname`
erst nach Nachweis – ist nicht nötig.

Chrome 152 zeigt weiterhin zehn mit dem Formular als bestätigtem Werkzeug (Client-Eval und
Panel-Sonde), also je Browser die richtige der beiden Fassungen unter demselben Namen.

**Das Muster gilt ab jetzt für jede Feature-Erkennung in `src/webmcp/`:** Die Präsenz einer
API beweist die API, nicht die Fähigkeit. Beweislast beim Browser.

### Ein Befund über uns selbst

Die Selbstdiagnose hatte seit Schritt 3 behauptet, sie zähle „über `getTools()`". Sie tat es
nie: `getTools()` liefert in Chrome 152 ein Promise, `Array.isArray` darauf ist falsch, und der
Rückfall auf die eigene Buchführung war still. Die Zahl stimmte – aus Glück, nicht aus Messung.
Das steht jetzt so im README, weil Ehrlichkeit über die eigene Messung die Sorte Beleg ist, die
diese Einreichung trägt.

### Stand

133 Unit-Tests in 16 Dateien, Bieter-Evals 11/11, Client-Evals grün, GAEB bestanden,
`verify_seed.py` grün, ChatGPT 10/4/10.

### Offen

- Devpost-Text und Video.
- Eine der beiden Spec-Kopien.

## Schritt 15 – Vier Befunde aus dem zweiten Durchlauf (Mi 02.09.2026)

### Rückfragen folgen jetzt der Sprache – die aus dem Seed, und nur die

Deutsche Oberfläche, aber Q-001 und Q-002 standen englisch da. Die Seed-Rückfragen und
-Antworten sind jetzt zweisprachig (`question_en/de`, `answer_en/de` in `seed.json`) und
werden an **derselben Mapping-Stelle** wie die Positionstexte über `X-Language` gewählt.

Zwei Entscheidungen dabei:

- **Additiv statt Umbenennen.** Die Datenbank behält `question`/`answer` und bekommt
  `question_de`/`answer_de` dazu. Grund: Die Live-Datenbank hat Workspaces von Juroren.
  Ein `RENAME COLUMN` hätte zwischen Migration und Deploy entweder den alten oder den neuen
  Worker gebrochen; zwei `ADD COLUMN` brechen keinen von beiden. Der Worker fällt bei `NULL`
  auf den englischen Text zurück, deshalb bleiben auch die Rückfragen in **bestehenden**
  Workspaces lesbar (englisch, bis zum nächsten Reset).
- **Fremdtext übersetzt niemand.** Was ein Mensch oder ein Agent eingibt, bekommt keine
  zweite Sprache – die `_de`-Spalten bleiben `NULL`, und die Frage kommt in beiden Sprachen
  zurück, wie sie getippt wurde. `server.test.ts` prüft beides an einer Seed- und einer
  getippten Zeile und hält fest, dass keine `_de`-Schlüssel in die Nutzlast lecken. Live
  gegengeprüft mit einer deutsch getippten Frage in einem frischen Workspace.

### Das Live-Log überlebt das Neuladen

Der Tester las ein leeres Log nach F5 als „meine Historie ist weg", während jeder Preis noch
da war – und die Lesart ist fair, denn das Log **ist** der Beleg dessen, was der Agent getan
hat. Es liegt jetzt in `localStorage` unter `biddesk.log.<workspace>`, derselbe Ring von 100.
„This log stays in your browser. Nothing is sent anywhere." bleibt wörtlich wahr – es bleibt
jetzt nur auch.

Gebunden wird es an genau einer Stelle: `set()` im Store, dem einzigen Ort, an dem die
Workspace-Kennung wechselt. Ein Reset leert Bild und Speicher. Beschädigter Speicher startet
leer statt gar nicht; ein Browser, der Speicher verweigert, bekommt das Log wie bisher nur im
Arbeitsspeicher. Als Test: fünf Fälle in `log.test.ts`, darunter der echte Kaltstart über
`vi.resetModules()`. Live in Chrome 152 gemessen: zwei Zeilen vor dem Neuladen, dieselben
zwei danach, nach Reset leer und der Schlüssel entfernt, nach erneutem Laden weiter leer.

**Messnotiz:** Die erste Sonde meldete überall `[]` – weil Puppeteer 800 px breit öffnet und
das Panel darunter eingeklappt ist: kein `<ol>`, kein Reset-Knopf. Erst das Skript prüfen,
dann das Produkt verdächtigen (Schritt 9 lässt grüßen).

### Szene-Zeile auch beim Auftraggeber, und Sie statt du

Die Zeile „A German public tender (VOB/GAEB). Names, prices and firms are invented." steht
jetzt auch unter dem Titel der Auftraggeberansicht, mit Test über den Rollenwechsel. Und die
deutsche Fassung siezt durchgehend (Markenregel MERKUR Impulse): „aus Ihrem Angebot", „die
Zeile, die Sie damals bepreist haben". Ein Test in `i18n.test.ts` sucht die deutsche Hälfte
nach `du|dir|dich|dein*` ab, damit das so bleibt.

### Zweite Stelle, die eine API-Präsenz für einen Funktionsnachweis hält

Beim Bauen gesucht, eine gefunden, **nicht geändert**: `WebMCPStatus.supported` – die grüne
Kopfzeile „WebMCP detected" – kommt aus dem Rollenblock: Sie ist wahr, sobald ein Modellkontext
existiert und dessen `registerTool`-Aufrufe aufgelöst wurden. Das ist immerhin ein
Rundgang und keine bloße Präsenzprüfung, aber es ist nicht die Browserliste. Ein Browser, der
Registrierungen annimmt und nichts listet, bekäme „WebMCP detected · 0 tools registered". Die
Zahl daneben ist seit Schritt 14 ehrlich; die Überschrift könnte es enger sein. Bewusst
gelassen: Kein bekannter Browser verhält sich so, und ein `supported`, das erst nach dem
ersten `getTools()` wahr wird, hieße für Chrome 152 eine Sekunde „nicht verfügbar" beim
Laden. Wenn es je zuschlägt, ist es eine Zeile in `useWebMCP`.

### Stand

142 Unit-Tests in 16 Dateien, Bieter-Evals 11/11 (P1–P5 englisch nach dem Deploy), Client-Evals
grün, GAEB bestanden, `verify_seed.py` grün.

### Offen

- Devpost-Text und Video.
- Eine der beiden Spec-Kopien.

## Schritt 16 – Sackgassen werden Wege (Mi 02.09.2026)

### Der Befund

Zwei Durchläufe fanden dieselbe Stelle: An drei Punkten endete die Demo mit „geht nicht,
tragen Sie es selbst ein" – leere Position ohne Preisbucheintrag, abgewiesener freier Preis,
abgelaufener Nachweis. Genau dann sitzt der Nutzer im Chat und wechselt nicht auf die Seite.
Der Kollege fand den Weg trotzdem: Der Agent tippte ins Formular (§13.3d) – und als er
danach eine Bemerkung „nach eigener Kalkulation" wollte, hieß es, Bemerkungen gebe es nur mit
Preisbuchnachweis. Genau umgekehrt wäre richtig.

Aus dem Leitsatz „der Agent hat keine eigene Autorität" war im Bau „der Agent hört auf"
geworden. `submit_bid` macht seit Tag eins vor, wie es richtig geht: keine eigene Autorität
heißt **Bestätigung, nicht Sackgasse**. Gebaut wurde die zweite Hälfte dieses Musters.

### Was gebaut ist, und wo die Wahrheit dabei bleibt

`set_unit_price` teilt einen Aufruf in zwei Wege. Zeilen **mit** `price_book_id` gehen wie
bisher an den Worker, der sie gegen das Preisbuch prüft. Zeilen **ohne** erreichen den Worker
nicht: Sie werden auf der Seite zur Bestätigung an der Zeile – klein, kein Modal, mit
Rechnung („61,00 € × 4 pcs = 244,00 €"), mit der Herleitung des Agenten (`rationale`, max.
240 Zeichen) und mit dem Satz, woher der Wert **nicht** kommt: „not from your price book —
you are setting this price yourself". Erst der Klick schreibt, und zwar über exakt denselben
Weg wie eine Eingabe in die Tabelle: `set_by='human'`, keine `price_book_id`, die Herleitung
als `note`, ein `change_log`-Block. `undo_last_change` kennt ihn deshalb.

Die Antwort ist `{ ok:true, status:"needs_confirmation", pending:[…], applied, rejected }`.
Im Live-Log steht sie als **AWAITING CONFIRMATION**, weder als `applied` noch als `rejected`
– dieselbe dritte Wahrheit wie für `submit_bid confirm:false` aus Schritt 9.

Drei Entscheidungen, die man leicht anders hätte treffen können:

- **Die Regeln werden nicht dupliziert.** Die Seite prüft die quellenlosen Zeilen mit
  demselben `planPriceWrites` aus `src/pricing.ts` wie der Worker, nur mit `setBy:"human"`
  – denn genau das macht die Bestätigung aus ihnen. Unbekannte OZ, keine Zahl, negativ,
  gesperrtes Angebot: dieselben Codes, im selben `rejected`.
- **Menschenpreise sagen jetzt, was sie sind:** „von Ihnen gesetzt · Herleitung" als Text,
  nie als Chip. Die drei Zustände aus §13.3 bleiben unverwechselbar; der Test aus CC-02, dass
  ein Menschenpreis keinen Chip bekommt, ist grün geblieben.
- **`check_bid` sagt zu jedem Befund, was zu tun ist** – fest von uns formuliert,
  zweisprachig über `X-Language`, als `actions`. Dabei fiel auf, dass „offen" drei Dinge sein
  kann: nichts dieser Bauart im Preisbuch (herleiten lassen), Bauart vorhanden, Wortlaut
  passte nicht (Preisbuch nachsehen), oder ein **Vorschlag liegt schon da**, den der Mensch nur
  nicht übernommen hat. Der dritte Fall hätte mit „herleiten" den langen Weg empfohlen; er
  hat seinen eigenen Satz bekommen.

Ein Fehler, den erst der Store-Test zeigte: `writeRow` trug `set_by` und `source` in die
Zeile, aber nicht `note` – eine bestätigte Herleitung wäre erst nach dem Neuladen sichtbar
gewesen. Behoben.

### Die Invariante hält – und die Sabotage-Probe sagt es

Jede Zeile in `bid_prices` hat entweder eine `price_book_id` (dann `set_by='agent'`, Preis
gleich Preisbuchzeile) oder `set_by='human'`. Kein dritter Fall. Der `setBy === "agent"`-Block
in `pricing.ts` steht unverändert; er ist jetzt Netz unter dem Netz, weil ein Werkzeugaufruf
ohne Quelle den Worker gar nicht mehr erreicht.

Probe wie in CC-02: Prüfung `price_without_source` aus dem Block entfernt, Tests gefahren:

| Test | |
|---|---|
| `pricing.test.ts` · refuses an agent price that carries no price book line | rot |
| `pricing.test.ts` · lets no agent row through without the line it came from, whatever else is in the batch | rot |
| `server.test.ts` · writes nothing at all for an agent's price without a source – no row, no change_log block | rot |

Zurückgesetzt, `git diff src/pricing.ts` leer, 18/18 wieder grün. Der Server-Test misst dabei
nicht die Antwort, sondern ob `db.batch` überhaupt aufgerufen wurde – null Aufrufe heißt null
Zeilen in `bid_prices` und null Blöcke im `change_log`.

### Gemessen, nicht vermutet

Eval-Fall **E6** („Set position 03.04 to 61 euros.") ersetzt E7: `needs_confirmation`,
`pending` mit 03.04/61/244 und Herleitung, `applied` und `rejected` leer, danach `check_bid`
mit netto **13.213,50 €** unverändert und 03.04 weiter offen, plus der Handlungssatz. 12/12
Schritte über 7 Fälle; E1 weiterhin 12 applied, 0 rejected, 13.213,50 €. E8 (Preis
widerspricht seiner Quelle) bleibt eine Abweisung – das ist ein anderer Fehler.

Der Klick selbst ist kein Eval-Fall (ein Modell drückt keinen Knopf auf der Seite), sondern
ein UI-Test: nach dem Klick `set_by='human'`, `price_book_id NULL`, netto **13.457,50 €**
(61 × 4 Stück; 03.04 ist keine Bedarfsposition). Live in Chrome 152 mit Puppeteer nachgefahren:
Log-Zeile `set_unit_price AWAITING CONFIRMATION WRITE 10 ms … waiting for a person · 1 to
confirm`, Summe vor dem Klick 13.213,50 €, nach dem Klick 13.457,50 €, Zeile „set by you · 4
radiators at 25 min each at your rate of 58 EUR", `check_bid` offen nur noch 04.02,
`undo_last_change` → 1 Block zurück, 13.213,50 €.

### Was ausdrücklich nicht gebaut wurde

Kein dreizehntes Werkzeug (Nachweis über den Chat ist CC-06). Kein Schreibzugriff des Agenten
aufs Preisbuch – ein Agent, der sich einen Eintrag anlegt und danach „belegt" daraus bepreist,
hätte die Herkunft gewaschen; Einträge entstehen nur durch einen Menschen über die Oberfläche,
wie beim GAEB-Import. Keine neue Garantie gegen Browsersteuerung: Ein Agent, der den Browser
steuert, kann die Bestätigung klicken wie ein Mensch – Known Limitation 6 (§13.3d) bleibt
wörtlich. Die Bestätigung ist ein Seiten-Tor, kein Kryptobeweis; genau wie bei `submit_bid`.

### Stand

159 Unit-Tests in 16 Dateien, Bieter-Evals 12/12 (P1–P5 + E6 + E8, englisch nach dem Deploy),
Client-Evals grün, GAEB bestanden, `verify_seed.py` grün. README, spec §12.3/§13.1/§13.3c (beide
Kopien), docs/08, `llms.txt` und CLAUDE.md tragen den präzisierten Satz.

### Offen

- Devpost-Text und Video.
- Eine der beiden Spec-Kopien.
- ~~CC-06: der Nachweis über den Chat (Entscheidung Mi 12:00).~~ Gebaut als CC-05, Schritt 17.

## Schritt 17 – Der dritte Weg: der Nachweis über den Chat (Mi 02.09.2026)

### Der Befund

Der Durchlauf fand drei Sackgassen. CC-04 hat zwei davon zu Wegen gemacht; die dritte endete
noch mit „upload a current certificate, or set a new expiry date" – also: auf die Seite
wechseln. Der Tester wollte genau das nicht: „Meine neue Unbedenklichkeitsbescheinigung ist
vom 15.08.2026" im Chat sagen und fertig sein. Dasselbe Muster, ein zweites Objekt.

### Das dreizehnte Werkzeug – und warum es sagt, was es nicht tut

`set_document_validity` ist das einzige Werkzeug, das nach der Zählung in spec §12.2 noch
dazukam. Es nimmt `doc_type` (Enum der vier Pflichtnachweise, damit der Agent keine
Schreibweise rät) und `valid_until` (ISO-Datum) und antwortet `{ ok:true,
status:"needs_confirmation", pending:[{ doc_type, label, previous_valid_until, valid_until }] }`
– genau wie `set_unit_price` ohne Quelle. **Es schreibt nichts.** Die Bestätigung erscheint im
Prüfpanel an dem Befund, den sie erledigt; ist kein Prüfergebnis offen, wird eines geholt (ein
Lesevorgang), damit Befund und Ausweg zusammen auf dem Bildschirm stehen. Erst der Klick
schreibt `bidder_documents.valid_until` – per Upsert, damit auch ein noch nicht hinterlegter
Nachweis angelegt werden kann, wenn ein Mensch ihn nennt und bestätigt.

Der Satz in der Bestätigung ist die Entscheidung: **„You confirm that a certificate valid until
15 Aug 2027 exists. Nothing is uploaded or checked here."** Die Seite hat den Nachweis nicht
gesehen. Sie darf deshalb nicht so tun, als hätte sie ihn geprüft – und sie sagt es an der
Stelle, an der der Mensch klickt, nicht im Kleingedruckten. Dasselbe steht in der
Werkzeugbeschreibung, weil ein Agent sonst „ich habe den Nachweis hinterlegt" sagen würde, wo
er nur ein Datum weitergereicht hat: *nothing is uploaded, nothing is verified; the page
records the date a person states and the person confirms it.*

Drei Ränder, bewusst gesetzt:

- **Ein Datum in der Vergangenheit ist ein Fehler** (`date_in_the_past`, mit hint), keine
  Bestätigung – ein abgelaufener Nachweis lässt sich nicht als gültig verbuchen. Das gilt auch,
  wenn das Datum dem hinterlegten gleicht: Das Seed-Datum der Unbedenklichkeitsbescheinigung
  liegt in der Vergangenheit, und „schon gültig bis" wäre dort eine Lüge. Der Test für den
  Gleichheitsfall braucht deshalb einen **gültigen** Nachweis – der erste Entwurf der Tests hatte
  das übersehen, und der Fehler war im Test, nicht im Produkt.
- **Gleiches Datum wie hinterlegt** (bei gültigem Nachweis): `status:"unchanged"`, „already
  valid until …; nothing to do." Kein Fehler, keine Bestätigung, kein Schreibvorgang – auf der
  Seite wie im Worker.
- **Kein `undo_last_change`**, und das Werkzeug **bleibt nach der Abgabe registriert**:
  Nachweise sind Stammdaten des Bieters. Das Angebot ist gesperrt, nicht der Betrieb. Deshalb
  liegt es im Rollenblock, nicht im `submit_bid`-Block.

Der Handlungssatz aus CC-04 für Nachweise heißt jetzt „tell your agent the new expiry date —
you confirm it on the page — or upload a current certificate." Der Weg steht im Befund.

### Zählung

Dreizehn verschiedene Werkzeuge; Bieterrolle 11, nach der Abgabe 10, Auftraggeber 5. Die
Selbstdiagnose brauchte **keine Änderung** – sie zählt seit Schritt 14, was der Browser
bestätigt, und hätte sie eine gebraucht, wäre das der Fehler gewesen. Chrome 152 live:
„WebMCP detected · 11 tools registered"; Client-Eval „Chrome sees 11 tools in the contractor
role". Die Abnahme in ChatGPT (11, 5 mit Schreibzugriff, dieselbe Zahl im Panel) steht aus.

### Die Sabotage-Probe

Test: `set_document_validity` ohne Bestätigung schreibt nichts (kein Aufruf von
`/api/documents/…`, der Eintrag steht unter `pendingDocuments`). Sabotage: im Werkzeug direkt
nach dem Vorschlag `confirmDocumentValidity` aufgerufen – der Schreibpfad ohne Bestätigung.

| Test | |
|---|---|
| `tools.test.ts` · relays a document date for the person to confirm, and writes nothing | **rot** |

Zurückgesetzt, `git diff` zeigt nur die CC-05-Änderungen, 24/24 wieder grün. Der Worker prüft
Datum und Typ noch einmal selbst (`server.test.ts`: Vergangenheit, unbekannter Typ und
unlesbares Datum → kein `run`; gleiches Datum → `changed:false`, kein `run`; neues Datum →
genau ein `INSERT … ON CONFLICT`, mit beiden Bezeichnungen gebunden).

### Gemessen, nicht vermutet

Eval **E7** („My new tax clearance certificate is valid until 15 August 2027."):
`needs_confirmation`, `pending` mit `tax_clearance`, altem Datum 2026-08-13 und 2027-08-15,
danach `check_bid` mit der Bescheinigung **weiterhin als abgelaufen** und dem neuen
Handlungssatz. 14/14 Schritte über 8 Fälle; E1 weiterhin 12/0/13.213,50; E6 unverändert.

Der Klick als UI-Test (`App.test.tsx`): Bestätigung mit „12 Aug 2026 → 15 Aug 2027" und dem
Satz, dass nichts hochgeladen oder geprüft wird; nach dem Klick ein `POST
/api/documents/tax_clearance` mit `{ valid_until: "2027-08-15" }`, und der Befund „Expired
document" ist weg. Live in Chrome 152 nachgefahren: Log-Zeile `set_document_validity AWAITING
CONFIRMATION WRITE 165 ms … waiting for a person · 1 to confirm`, `check_bid` vor dem Klick
`[tax_clearance, expired]`, danach `[]`; dasselbe Datum noch einmal → `unchanged`;
`2020-01-01` → `date_in_the_past` mit hint.

### Was nicht gebaut wurde

Kein Upload, keine Prüfung, kein Dateispeicher – Nachweise sind Metadaten, jetzt als Known
Limitation 7 in README und spec. Keine Änderung an Nachweisen anderer Bieter, keine
Auftraggeberrolle. Keine neue Garantie gegen Browsersteuerung; Known Limitation 6 steht
wörtlich.

### Stand

170 Unit-Tests in 16 Dateien, Bieter-Evals 14/14 (P1–P5 + E6 + E7 + E8, englisch nach dem
Deploy), Client-Evals grün (11 Werkzeuge), GAEB bestanden, `verify_seed.py` grün.

### Offen

- ChatGPT-Abnahme der Zählung 11 / 5 / 11 (Nils).
- Devpost-Text und Video.
- Eine der beiden Spec-Kopien.

## Schritt 18 – Textpass, Zahlenabgleich, Freeze (Mi 02.09.2026)

Kein neues Verhalten. Nur Wahrheit zwischen Code, README, Spec, Evals und den beiden
Einreichungstexten (`docs/08`, `docs/09`) samt dem Klartext-Fall (`docs/05`).

**Eine Nummerierung überall.** Die README führte E6/E9/E10 für die Client-Fälle, während
`bidder.evals.json` seit CC-04 ein eigenes E6 (Preis wartet) und seit CC-05 ein E7 (Nachweis
wartet) hat. Jetzt: Bieterfälle **E1–E8** wie in der JSON, Client-Fälle **C1–C3** –
C1 die Rollen-Eigenschaft (elf/fünf, die Client-Werkzeuge existieren beim Bieter nicht),
C2 der Preisspiegel (geschlossen vollständig, offen versiegelt), C3 die beantwortete Rückfrage.
README-Tabelle, `assert_outcomes.py`, `client_role.mjs` und dieses Dokument tragen dieselben
Namen; `docs/08` nennt keine Nummern.

**Die Eval-Zeile.** „11 of 11 steps across 7 cases" stammte aus Schritt 10. Heute: **14 von 14
Schritten über 8 Fälle**, dreimal hintereinander sauber gegen den eingefrorenen Build gefahren –
die drei Läufe wurden für diesen Satz gefahren, nicht aus der Erinnerung übernommen.

**Abweichungen in den Cowork-Texten**, gegen Code und README geprüft: `docs/05` sagte „Diese
acht ändern nichts" – es sind **sieben** Lesewerkzeuge (`readOnlyHint`: check_bid,
get_price_book, get_price_comparison, get_tender, list_clarifications, list_tenders,
suggest_prices; sechs schreibende; zusammen dreizehn). Korrigiert. Alles andere in `docs/05`,
`docs/08`, `docs/09` – 13 / 11 / 10 / 5, acht Fälle, 14 Schritte, 13.213,50 €, 13.457,50 €,
Lighthouse 1,00 nach 0,75, Known Limitations 1–7, ~30 ms / 600 ms – stimmt mit dem Code
überein. Nicht korrigiert, weil kein Zahlen- oder Werkzeugfehler: `docs/08` verortet die
Selbstdiagnose „in the header" (sie steht im Agent-Panel); `docs/09` nennt das alte
Ablaufdatum der Bescheinigung als „12 Aug 2026" – der Seed rechnet relativ, am Aufnahmetag
steht dort das Datum von vor 20 Tagen.

**Kein Deploy.** `public/llms.txt` hat sich in diesem Pass nicht geändert; der Freeze-Build ist
`701d45c3` aus CC-05. Live geprüft: `/`, `/how-to-test`, `/llms.txt` je 200, Selbstdiagnose
„WebMCP detected · 11 tools registered".

### Stand (Freeze)

170 Unit-Tests in 16 Dateien · Typecheck sauber · `verify_seed.py` grün · Bieter-Evals 14/14
(E1–E8), dreimal hintereinander · Client-Evals C1–C3 grün · GAEB bestanden · Deploy `701d45c3`.
Ab dem Commit dieses Schritts: kein Code mehr, bis Video und erste Einreichung stehen. Ausnahme
nur bei demo-blockierendem Fehler (Seite lädt nicht, Reset defekt, P1–P5 oder einer der drei
Sätze aus `docs/09` schlägt fehl) – dann beheben, deployen, volle Matrix erneut, neuer
Freeze-Stand.

### Offen

- ChatGPT-Abnahme der Zählung 11 / 5 / 11 (Nils).
- Video und Devpost-Einreichung.
- Eine der beiden Spec-Kopien – nach der Einreichung.

## Schritt 19 – Der Preisbuch-Bildschirm (Mi 02.09.2026, Freeze-Fenster bis 16:30)

### Warum, und warum jetzt

Das Preisbuch ist die zentrale Idee des Produkts und war im Bildschirm unsichtbar – man kam nur
über `get_price_book` daran. Für die Jury ist das die Lücke bei „a complete product experience",
im Kundengespräch die Stelle, an der „Woher kämen die Werte?" keine Antwort im Bild hatte. Der
Freeze aus Schritt 18 wurde dafür um ein Fenster verlängert; der erste Anlauf um 14:48 wurde nach
Regel gemeldet statt begonnen, weil zwölf Minuten nicht reichen, und mit neuer Box um 16:30
gebaut.

### Reiner Lesebereich

Zweite Ansicht neben dem Angebot, nur Bieterrolle, aus dem Kopf erreichbar (`Angebot` /
`Preisbuch`) – **kein Routenwechsel**, also kein Neuladen und kein verlorener Workspace; das
Angebot bleibt der Einstieg. Kein Werkzeug, kein Endpunkt, keine Schreibfläche: `GET
/api/price-book` liefert die Liste, `GET /api/tenders` und `GET /api/tenders/:id` die Achsen
der Matrix. Der Demo-Pfad ist unberührt; die Werkzeugzahl bleibt 11/10/5.

Drei Dinge, die den Bildschirm wahr halten:

- **Dieselbe `normalise()`** wie im Matcher (`src/matching.ts`) für die Suche über Originalzeile
  und Schlagworte – keine zweite Implementierung, sonst zeigte der Bildschirm eine andere Wahrheit
  als der Agent. Getestet: „schimmel", „SCHIMMEL", „Gerüst"/„geruest".
- **Die Achsen entstehen aus den Daten**: Kategorien und Einheiten der Ausschreibungen dieses
  Workspace, vereinigt mit denen des Preisbuchs – nie aus einer Liste im Code. Ein Test nimmt
  `labour` aus beiden Quellen und sieht die Zeile verschwinden, bringt `kg` über eine Position
  herein und sieht die Spalte erscheinen. Für Farbwerk Meier ist **metal / pcs leer** – die
  Heizkörper-Lücke aus Prompt 2, zum ersten Mal als Bild; Brandt hat die Zelle, Colorpoint nicht.
- **Abdeckung ist eine Zahl oder nichts.** Keine Prozente, keine Balken, keine Farbe (§13.3).
  Der Bieterwechsel im Kopf tauscht Liste und Matrix sofort: 12 / 15 / 7 Einträge, 7 / 9 / 4
  besetzte Zellen. Das ist der Beweis aus §13.2 Punkt 1 als Bild.

Klick auf eine leere Zelle: welche Positionen aus welchen Ausschreibungen darunterfallen, und
darunter der Handlungssatz aus Schritt 16 – **wörtlich derselbe wie in `check_bid`**; ein Test in
`server.test.ts` hält die Kopie in `src/i18n.ts` und den Worker-Text zusammen, in beiden Sprachen.
Rückweg: „no comparable entry" im Angebot ist jetzt anklickbar und öffnet die Matrix mit der
passenden Zelle.

Originalzeilen, Projektnamen und Schlagworte werden in keiner Sprache übersetzt; der Bildschirm
sagt das unten in einem Satz.

### Platz für Schritt 20

Die Ansicht ist in Abschnitte gebaut (Kopf, Abdeckung, Suche und Liste). Das Einfügen alter
Angebote (CC-09) bekommt einen eigenen Abschnitt darunter, ohne dass hier etwas umgebaut werden
muss.

### Der Fund: Ein Bildschirm darf die Werkzeugzahl nicht bewegen

Die erste Live-Sonde meldete auf der Preisbuch-Ansicht **„10 tools registered"** – im
Angebots-Bildschirm 11. Ursache: Das Rückfragen-Formular ist das deklarative `ask_clarification`,
und es stand nur im Angebots-Bildschirm im DOM. Wechselt die Ansicht, verlässt das Formular das
DOM, Chrome zieht das Werkzeug binnen ~20 ms ab (Schritt 14), der Zustandsautomat geht auf
`absent`, und auch der imperative Zwilling wird nicht angemeldet – ein Agent auf der
Preisbuch-Ansicht hätte keine Rückfrage stellen können. In ChatGPT dasselbe über den Zwilling.

„Wenn er den Demo-Pfad auch nur berührt, ist er falsch gebaut": Er berührte ihn. Behoben, indem
der Rückfragen-Abschnitt auch unter dem Preisbuch steht – nicht zum Lesen, sondern damit das
Formular auf der Seite bleibt. Danach gemessen: 11 im Angebot, 11 im Preisbuch, Formular im DOM,
`getTools()` listet `ask_clarification`, 11 nach dem Rückweg. jsdom hätte das nie gezeigt (ohne
`SubmitEvent`-Erweiterung ist der Zwilling immer da); nur der echte Browser konnte es.

Zweiter kleiner Fund, im Testlauf: Der erste App-Test (unverändert seit Tag eins) lief unter Last
in 6,8 s in die 5-s-Standardfrist. Frist in `vitest.config.ts` auf 15 s – ein Timeout ist kein
Befund über den Code.

### Stand

178 Unit-Tests in 17 Dateien (neu: `src/priceBook.test.ts` gegen `seed.json`), Typecheck sauber,
`verify_seed.py` grün, Bieter-Evals 14/14 (E1 weiterhin 12/0/13.213,50, E6 13.457,50 nach Klick),
Client-Evals C1–C3 grün (11 Werkzeuge), GAEB bestanden. Deploy **`3a71db0a`**; live in beiden
Sprachen geprüft: 12 / 7 / 15 Einträge je Bieter, `metal / pcs` leer für Meier und Colorpoint,
Rückweg von 03.04 in die Zelle mit den zwei Positionen dieser Bauart (T-2026-014 · 03.04,
T-2026-015 · 03.01) und dem Handlungssatz.

### Offen

- ChatGPT-Abnahme der Zählung 11 / 5 / 11 (Nils).
- ~~CC-09 (Altangebote einfügen)~~ gestrichen (Mi 16:30, keine Änderung nach der Frist), CC-09 ist jetzt die Rollengrenze (Schritt 20). Video, Devpost-Einreichung.
- Eine der beiden Spec-Kopien – nach der Einreichung.

## Schritt 20 – Die Rollengrenze wird serverseitig (Mi 02.09.2026, 16:30–19:30)

### Der Fehler, und wie er entstand

Die Auftraggeberrolle versprach auf dem Bildschirm: versiegelt, keine Preise, keine Summen, keine
Namen. `get_price_comparison` hielt das auch. Gleichzeitig waren `get_tender` und `list_tenders`
als „gemeinsame" Werkzeuge in beiden Rollen registriert, `api.ts` schickte `X-Bidder-Id` bei jedem
Aufruf mit (die Bieterwahl überlebte den Rollenwechsel), und der Worker kannte keine Rolle – er
hatte nie eine gebraucht. `get_tender(T-2026-014)` lieferte dem Auftraggeber deshalb den
vollständigen Entwurf des zuletzt gewählten Bieters: `my_unit_price`, `line_total`, `set_by`,
`note`, `source` mit `price_book_id`, dazu `required_documents` mit Gültigkeiten und
`my_bid_status`. Zwei Werkzeugpfade, zwei Wahrheiten – in einem Produkt, dessen These die
Vertrauensgrenze ist.

Entstanden ist das aus einer Entscheidung von Tag eins, die damals richtig war und es blieb, bis
sie allein stand: *Rollen werden durch Registrierung getrennt, nicht durch Rechte* (Header.tsx,
useWebMCP.ts, README, spec §12.2). Der Satz stimmt für die Client-Werkzeuge beim Bieter und für
die Bieter-Werkzeuge beim Client – die gibt es dort schlicht nicht. Er stimmte nie für die drei
Werkzeuge, die beide Rollen haben, weil ein gemeinsames Werkzeug an einem rollenlosen Worker
zwangsläufig dieselbe Antwort für beide Seiten holt. Die Rolle lebte nur im Store und in der
Werkzeugliste; kein Byte davon erreichte den Server.

### Wie er gefunden wurde

Extern. Zwei unabhängige Reviews am Mittwochnachmittag, beide mit demselben Befund, beide im Code
nachvollzogen. Intern war er unsichtbar, und der Grund ist die eigentliche Lehre:

**Warum 178 grüne Tests ihn nicht sahen.** `tools.test.ts` führte `get_tender` in der
Client-Liste als *Sollzustand* („Client: three shared plus two of its own. Five.") und prüfte nur
die Namen. `client_role.mjs` (C1) prüfte, dass die Client-Werkzeuge beim Bieter *nicht
existieren* – die richtige Richtung, aber nur die eine. C2 prüfte den Preisspiegel auf
Versiegelung und fand keinen Preis, weil dieser eine Pfad tatsächlich dicht war. Kein Test hat je
`get_tender` **als Client** aufgerufen und in die Antwort geschaut. Ein Test, der eine Liste
gegen sich selbst prüft, prüft eine Konvention, keine Eigenschaft. Die Eigenschaft heißt: „Was
der Auftraggeber bekommt, enthält keinen Preis" – und die stand nirgends als Assertion.

### Was gebaut wurde

**Teil A – die Rolle wird serverseitig.**
- `X-Role: bidder | client` reist wie `X-Language`: zum Fetch-Zeitpunkt in `api.ts` gesetzt, vom
  Store bei `selectRole` gestellt, im Worker an **einer** Stelle gelesen (`readRole`, in
  `requireWorkspace` in die Variablen gelegt). Ohne Header gilt `bidder` – Evals, `/how-to-test`
  und `verify_seed.py` sehen, was sie immer sahen. In der Client-Rolle schickt `api.ts` kein
  `X-Bidder-Id` mehr mit.
- **Projektion je Rolle im Worker.** `GET /api/tenders` als Client ohne `bidder_id` und
  `my_bid_status`; `GET /api/tenders/:id` als Client mit Positionen aus genau sieben Feldern,
  ohne `required_documents`, ohne Bieterbezug, mit `role:"client"` – und der Client-Zweig löst gar
  keinen Bieter auf und joint keine `bids`, `bid_prices`, `bidder_documents`. `types.ts` sagt es
  als Union (`BidderTenderDetail | ClientTenderDetail`), der Store verengt über `bidderDetail()`.
- **Verweigerung je Rolle.** `bidderOnly` auf price-book, suggestions, prices, check, submit,
  undo, documents, Rückfrage stellen; `clientOnly` auf comparison und answer. Antwort `403 {
  ok:false, error:"role_not_allowed", hint }`, der hint nennt `get_price_comparison` als den
  einen Weg. Reihenfolge: unbekannter Workspace bleibt 404, dann erst 403.
- **Beschreibungen je Rolle.** `sharedToolsFor(role)` liefert die drei gemeinsamen Werkzeuge mit
  gleichem Namen, gleichem Schema und rollenabhängigem Text; die Client-Fassung von `get_tender`
  sagt „returns NO prices" und nennt `get_price_comparison`. Werkzeugzahl 13 / 11 / 10 / 5
  unverändert, Test hält beide Listen gleich in Schema und Annotationen.
- `untrustedContentHint` auf `get_tender` in beiden Rollen: Positionstexte kommen vom
  Auftraggeber oder aus einer GAEB-Datei.
- Die Zeile „your draft is not visible to the client" kannte der Client-Read bisher über
  `my_bid_status`. Das Bit heißt jetzt `ownDraftPending`, wird beim Rollenwechsel aus dem
  Bieter-Bildschirm gemerkt und nie vom Worker geliefert.

**Teil B – Blocker sind keine Bestätigung.** `submissionBlockers()` in `src/submission.ts` ist
die eine Funktion: offene Nicht-Bedarfspositionen, abgelaufene **und fehlende** Pflichtnachweise
(Colorpoint hält im Seed kein Referenzprojekt – der Fall ist echt); Bedarfspositionen blockieren
nie. `check_bid` liefert `blockers`, `submit_bid` antwortet `{ ok:true, status:"blocked",
blockers, summary }` mit `confirm:false` und `true`, ohne Dialog; ohne Blocker `{ ok:true,
status:"needs_confirmation", summary }`. `ok:false` zusammen mit `needs_confirmation:true` gibt
es nicht mehr. Der Worker weist `POST /submit` bei Blockern mit `409 bid_blocked` ab – dieselbe
Funktion, frisch gelesen. Im UI: Abgabeknopf deaktiviert, darunter die Liste mit den
Handlungssätzen aus CC-04/05 (Preis setzen oder herleiten lassen · Nachweisdatum nennen). Log:
Kennzeichnung `BLOCKED`, Kurzform „blocked · 2 in the way · open_position, document_expired".

**Teil C – Auftraggeber-Prompts.** Das Panel zeigt je Rolle eigene Beispielsätze und eine
Erklärzeile, zweisprachig, in `src/i18n.ts`; Rollenwechsel aktualisiert Prompts, Zahl und
Erklärtext gemeinsam.

### Die Sabotage-Probe

Test: für B-A, B-B, B-C, Rolle Client, `GET /api/tenders/T-2026-014` mit gestagtem
bepreisten Entwurf – die Antwort enthält **rekursiv** keinen der Schlüssel `my_unit_price`,
`line_total`, `set_by`, `note`, `source`, `price_book_id`, `required_documents`, `bidder_id`,
`my_bid_status`, `valid_until`; dieselbe Antwort ohne Header trägt sie alle. Sabotage:
`readRole` fest auf `bidder`.

| Test | |
|---|---|
| `server.test.ts` · hands the client a tender with no key of any bid in it, recursively | **rot** |
| `server.test.ts` · refuses every contractor endpoint to the client with 403 | **rot** |
| `server.test.ts` · keeps the price comparison sealed for the client | **rot** (403 statt sealed) |
| die übrigen 17, darunter „refuses the client endpoints to the contractor" | grün |

Zurückgesetzt, 20/20, Typecheck sauber. Ein erster Anlauf der Probe hatte die Rolle
versehentlich auf einen ungültigen Wert gesetzt (14 rot) – auch aufschlussreich, aber nicht die
verabredete Probe; deshalb wiederholt.

### Was nicht gebaut wurde

Kein Login, keine Autorisierung – Known Limitation 3 steht wörtlich. Der Rollenwechsel ist ein
Demo-Mechanismus; **innerhalb** der Demo ist die Grenze jetzt echt und liegt dort, wo sie
hingehört. `/api/tenders/import` bleibt ohne Rollenwächter: ein Mensch zieht die Datei hinein,
dafür gibt es kein Werkzeug.

### Gemessen, nicht vermutet

Deploy **`bf452d58`** (17:16), Live-Matrix danach: Bieter-Evals **14/14 Schritte über 8 Fälle**,
E1 weiterhin 12 / 0 / 13.213,50 €, **E5 jetzt `blocked`** mit `[("open_position","03.04"),
("document_expired","tax_clearance")]` und `ok:true` ohne `needs_confirmation`, E6 und E7
unverändert (13.457,50 € nach Klick; Nachweisdatum wartet). Client-Evals **C1–C4** grün: 11 / 5
Werkzeuge, Preisspiegel geschlossen vollständig und offen versiegelt, **C4** – ein bepreister
Entwurf als Bieter, dann als Auftraggeber `get_tender` und `list_tenders`: vierzehn Positionen zu
je sieben Feldern, rekursiv keiner der zehn Bid-Schlüssel. GAEB bestanden (T-2026-021: acht
Vorschläge, eine Lücke, 6.319,45 €). Direkte API-Probe mit frischem Workspace: Bieter schreibt
01.01 = 480, Auftraggeber-Read ohne jeden Bid-Schlüssel, Bieter-Read mit Preis und vier
Nachweisen; price-book, check, suggestions als Client → 403, comparison als Bieter → 403,
comparison als Client versiegelt ohne `unit_price`; `POST /submit` → `409 bid_blocked` mit der
Liste. Live-Oberfläche: Auftraggeberrolle zeigt eigene Erklärzeile und die drei
Auftraggeber-Prompts, Bieterrolle wie vorher.

Ein Stolperer im Ablauf, notiert, weil er wieder passieren kann: In der Kette „typecheck → vitest
→ deploy" meldete vitest einmal **„no tests"** (Pool-Start unter Last abgestorben, Exit 0), und die
Kette deployte trotzdem. Die Suite war fünf Minuten davor auf demselben Code grün und wurde
danach noch einmal im Vordergrund gefahren (18 Dateien, 202 Tests) – ein „no tests" ist kein
Grün, und `&&` schützt nicht davor.

### Stand

202 Unit-Tests in 18 Dateien (neu: `src/submission.test.ts`, 20 in `server.test.ts`), Typecheck
sauber, `verify_seed.py` grün, Bieter-Evals 14/14, Client-Evals C1–C4, GAEB bestanden. Deploy
**`bf452d58`** = neuer Freeze-Stand.

### Offen

- ChatGPT-Abnahme der Zählung 11 / 5 / 11 (Nils).
- Video, Devpost-Einreichung.
- Eine der beiden Spec-Kopien – nach der Einreichung.

## Schritt 21 – Das Panel als Stichwortkarte des Skripts (Mi 02.09.2026, CC-10 Teil 0b)

Das Video (`docs/09`) führt sieben Sätze vor, das Panel zeigte fünf. Wer mitliest, tippt, was
dort steht – also stehen dort jetzt die sieben in Skriptreihenfolge: bepreisen, Lücke erklären,
Preis diktieren (wartet auf den Klick), prüfen, neue Bescheinigung nennen (wartet auf den Klick),
Auftraggeber fragen, abgeben. Nur `src/i18n.ts`, Auftraggeberrolle unverändert.

Eine Entscheidung zum Ton: Die Beispielsätze sind keine Oberflächentexte, sondern das, was die
Person ihrem Agenten sagt. Deshalb Imperativ („Öffne", „Setz", „Gib ab") und „mein
Stundensatz", nicht die Sie-Form. Der Sie-Test aus CC-03 nimmt `panel.prompts*` seitdem
ausdrücklich aus, mit Kommentar – nicht weil ein Satz rot wurde (keiner enthält du/dir/dich/dein),
sondern damit die Ausnahme dokumentiert ist, bevor jemand einen Satz mit „dein" braucht. Ein
Test hält Anzahl (7 / 3) und Reihenfolge in beiden Sprachen.

### Stand

203 Unit-Tests in 18 Dateien, Typecheck sauber. Deploy **`4d89d7cf`** (17:54), danach Bieter-Evals
14/14 und Client-Evals C1–C4 grün, Chrome 152 zählt 11 Werkzeuge; die sieben Sätze stehen live
im Panel. Commit `7b31a42`.

Am Rande, weil es der Wächter aus Schritt 22 nicht fängt: Der Commit scheiterte zuerst an einer
verwaisten `.git/index.lock` (0 Byte, kein git-Prozess – der Fallstrick aus dem Handover), und
die Kette „add && commit; deploy" deployte den Arbeitsbaum trotzdem, weil der Deploy hinter einem
Semikolon stand. Der Build war der richtige, der Commit kam vier Minuten später. Lehre: Deploy
und Commit nie mit `;` verketten.

## Schritt 22 – Der Deploy-Wächter (Mi 02.09.2026, CC-10 Teil 1)

### Warum

Schritt 20, Nachtrag: „typecheck → vitest → deploy" deployte, nachdem vitest **„no tests"**
gemeldet hatte – der Worker-Pool war beim Start gestorben, vitest beendete sich mit 0, und `&&`
winkte durch. Die Suite war fünf Minuten davor grün gewesen, also ging es gut. Es hätte nicht
gut gehen müssen. Ein Exit-Code sagt „nichts ist gescheitert"; er sagt nicht „etwas wurde
geprüft".

### Was der Wächter tut

`npm run deploy` ruft `scripts/deploy.mjs` und sonst nichts. Vor dem Build:

- `tsc --noEmit`;
- die Unit-Suite über den JSON-Reporter von vitest **gezählt**, nicht am Exit-Code abgelesen:
  null Tests sind rot, weniger als die letzte bekannte Zahl in `scripts/test-baseline.json` sind
  rot, ein fehlgeschlagener Test ist rot; die Zahl rastet nur nach oben und die Datei wird
  mitcommittet;
- `seed/verify_seed.py` muss „ALLES GRUEN" sagen;
- die drei Eval-Sätze müssen auf der Platte liegen (`bidder.evals.json` + `assert_outcomes.py`,
  `client_role.mjs`, `gaeb_import.mjs`).

Ein einziger Grund, und nichts wird gebaut. Danach `vite build`, `wrangler deploy`, 15 Sekunden
für die Edge, dann **alle drei Eval-Sätze gleichzeitig gegen die Live-URL**. Ein rotes Eval macht
den Deploy nicht rückgängig – dazu hat das Skript keine Befugnis –, aber es beendet den Schritt
mit Fehler und nennt den Rollback-Befehl mit der Version, die vorher lief. `npm run deploy:gate`
fährt nur das Tor.

Die Entscheidung selbst ist eine reine Funktion (`scripts/deploy-gate.mjs`, `evaluateGate`),
getrennt von der Shell, damit ein Test sie mit einer leeren Suite füttern kann.

### Die Probe

| | |
|---|---|
| `deploy-gate.test.ts` · leere Suite (0 Tests, Exit grün) | **rot**, „0 tests ran" |
| · geschrumpfte Suite (150 statt 203) | **rot** |
| · ein Fehlschlag, roter Typecheck, roter Seed, fehlender Eval-Satz – je einzeln | je **rot**, mit genau einem Grund |
| · kein Report | **rot** |
| · grün, 210 statt 203 | ok, Basis rastet auf 210 |
| Live: `deploy:gate` mit Basis 9999 | **verweigert**: „209 tests ran, 9999 were known", nichts gebaut |

Die erste Live-Probe verweigerte aus **allen** Gründen gleichzeitig – Typecheck, kein Report,
Seed, alle drei Sätze fehlen. Ursache: `new URL("..", import.meta.url).pathname` liefert den
Projektpfad mit `%20` für das Leerzeichen in „The WebMCP Challenge", und jeder Aufruf lief in
einem Ordner, den es nicht gibt. `fileURLToPath` statt `.pathname`. Ohne die Probe wäre der
Wächter mit einem Fehler ausgeliefert worden, der auf dem Laptop nie aufgefallen wäre, bis
jemand `npm run deploy` in einem Pfad ohne Leerzeichen anders erlebt als hier.

### Stand

209 Unit-Tests in 19 Dateien (neu: `scripts/deploy-gate.test.ts`, 6 Tests), Typecheck sauber,
Basiszahl 209. Erster Deploy über den Wächter: **`b94e8863`** (18:12) – Tor bestanden mit 209
gezählten Tests, Build, Deploy, 15 s, alle drei Eval-Sätze grün, „deploy accepted". Commit
`a803b01`. Eine Kleinigkeit blieb offen: `wrangler deployments list` ließ sich nicht auf die
vorherige Versions-Id parsen („previous version unknown"), der Rollback-Befehl im Fehlerfall
nennt dann keine Id – `npx wrangler rollback` fragt sie interaktiv ab.

## Schritt 23 – Toolbudget (Mi 02.09.2026, CC-10 Teil 2)

### Warum

Zwei Reviews zählten acht von dreizehn Beschreibungen über 500 Zeichen und zwei Antworten über
1.500. Was ein Agent liest, kostet ihn Kontext, und den hat er dann nicht für die Person. Die
langen Beschreibungen waren aus gutem Grund lang geworden – jede Sackgasse aus CC-04 und CC-05
hatte ihren Satz in jedem Werkzeug bekommen, das sie berührte –, aber ein Satz, der dreimal
steht, ist zweimal zu viel.

### Was sich geändert hat

**Beschreibungen.** Jede sagt in dieser Reihenfolge: Zweck, wann, sichtbarer Effekt,
Sicherheitsgrenze. Prozessregeln stehen einmal: der Preis ohne Quelle in `set_unit_price`, das
Nachweisdatum in `set_document_validity`, der Blocker in `submit_bid`; `suggest_prices` verweist
mit einem Halbsatz. Die Führung aus CC-04 bleibt (Herleiten → `rationale` → Bestätigung;
Nachweis → Datum nennen), nur kürzer.

| Beschreibung | vorher | nachher |
|---|---:|---:|
| `set_unit_price` | 1473 | 495 |
| `suggest_prices` | 1199 | 493 |
| `set_document_validity` | 1163 | 477 |
| `submit_bid` | 1127 | 492 |
| `check_bid` | 992 | 484 |
| `get_tender` (Bieter / Client) | 822 / 699 | 489 / 495 |
| `get_price_comparison` | 697 | 485 |
| `ask_clarification` | 696 | 479 |
| `list_tenders` (Bieter / Client) | 469 / 558 | 316 / 383 |
| `get_price_book` | 483 | 421 |
| `answer_clarification` | 451 | 378 |
| `list_clarifications` (Bieter / Client) | 425 / 406 | 361 / 331 |
| `undo_last_change` | 375 | 285 |
| längste Parameterbeschreibung | 231 (`price_book_id`) | 136 |

**Antworten.** Regel: Der Agent bekommt, worauf er handelt – `oz`, `text`, `quantity`, `unit`,
`category`, `contingency`, bei bepreisten Zeilen `my_unit_price`, `price_book_id`,
`source_project`, `source_date` (bei Menschenpreisen `set_by:"human"` und die Bemerkung). Die
Originalzeile des alten Angebots gehört dem Chip, nicht der Antwort. Unbepreiste Zeilen tragen
keine fünf leeren Preisfelder; `long_text` nur mit `include_long_text:true`; `get_price_book`
ohne Filter ist eine Zusammenfassung je Kategorie/Einheit mit Anzahl, mit `category`, `unit`
(neu, auch im Worker) oder `query` die Zeilen ohne `source_position_text`; `suggest_prices`
ohne die Originalzeile in `based_on`; `set_unit_price` ohne das `source`-Objekt in `applied`;
`check_bid` ohne `warnings` (sie wiederholen die Befunde auf Englisch) und ohne die zwei Zähler,
die in `totals` stehen. Die API ist unverändert – der Chip, das Preisbuch und die Tests am
Worker brauchen alles davon –, die Projektion sitzt in `tools.ts`. Kein neues Werkzeug.

| Antwort (Zeichen) | vorher | nachher |
|---|---:|---:|
| `get_tender` T-2026-014, unbepreist | 4493 | 2458 |
| `get_tender` T-2026-014, 12 Preise (nach Prompt 1) | ~4900 | 3796 |
| `get_price_book` Meier, ohne Filter | 3302 | 428 |
| `get_price_book` Meier, `category:"wall"` | – | 545 |
| `suggest_prices` T-2026-014 | 4071 | 3294 |
| `check_bid` (vorher: frisch, 14 offen; nachher: nach Prompt 1) | 4481 | 1099 |

Die 1.500 sind erreicht, wo die Daten es zulassen: Preisbuch-Zusammenfassung, gefiltertes
Preisbuch, `check_bid` nach Prompt 1. Wo die Daten vierzehn Positionen eines echten
Leistungsverzeichnisses mit Preisen sind, ist die kompakte Form das Budget – und die Decke im
Test die gemessene Größe plus Rand (2.600 / 4.000 / 3.500), damit der Test rot wird, wenn ein
Feld zurückkriecht, nicht wenn ein Positionstext ein Wort wächst. `src/webmcp/budget.test.ts`
misst gegen den echten Seed: die 14 Positionen, Meiers 12 Zeilen, die 12 Preise aus E1.

### Was beim Kürzen zweimal daneben ging

Die ersten Fassungen waren nach Gefühl auf 500 geschrieben und lagen bei 507 bis 665 – das Gefühl
irrt um zehn Prozent nach unten. Das Patch-Skript zählt seitdem die Laufzeitlänge, bevor es
schreibt, und bricht ab, wenn eine über 500 liegt; erst dann läuft der Test. Zweitens: Mein
eigener Test verlangte „Use it" in jeder Beschreibung und fiel über „Use that path" in
`set_unit_price` – der Test prüfte eine Wendung, nicht die Sache. Jetzt prüft er das Wort.

### Stand

218 Unit-Tests in 20 Dateien (neu: `src/webmcp/budget.test.ts`, 9 Tests), Typecheck sauber,
E1–E8 unverändert. Deploy: siehe unten.
