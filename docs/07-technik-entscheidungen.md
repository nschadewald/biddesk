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
