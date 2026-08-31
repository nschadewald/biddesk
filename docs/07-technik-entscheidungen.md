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
