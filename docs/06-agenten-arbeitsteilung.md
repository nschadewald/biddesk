# Arbeitsteilung Claude Code / Codex – und der Startschuss

Stand: Montag, 31.08.2026, 12:45 Uhr. **Gate um 18:00 – noch gut 5 Stunden.** Nichts in diesem Dokument darf länger als zehn Minuten Einrichtung kosten.

## Grundregel

**Ein Codebase, ein Fahrer.** Zwei Agenten gleichzeitig an derselben Anwendung sind bei diesem Zeitbudget kein Beschleuniger, sondern eine Fehlerquelle: Store, Tool-Registrierung und Tabellenkomponente hängen zusammen; zwei parallele Schreiber erzeugen Konflikte, die ein Mensch auflösen muss – und der Mensch ist ohnehin der Engpass.

- **Claude Code fährt die Anwendung.** Der Projektordner, `CLAUDE.md`, `spec.md` und `seed/` sind für diesen Weg geschrieben, der Cloudflare-Token liegt auf dem Rechner.
- **Codex bekommt einen zweiten Sitz – aber nur auf abgeschlossenen Modulen mit klarer Schnittstelle**, die niemand sonst anfasst. Erster sinnvoller Einsatz ist **Dienstag**, nicht heute.

## Was Codex bekommt (und was nicht)

Geeignet, weil dateischarf trennbar und ohne UI-Berührung:

| Aufgabe | Schnittstelle | Wann |
|---|---|---|
| **GAEB-X83-Parser** | `parseGaebX83(xml: string): {title, positions[]}` + Fixture `seed/gaeb/T-2026-014.x83` | Di ab mittag, Merge Di 18:00 |
| **Eval-Suite** | liest die fünf Prompts aus `docs/03-spec-biddesk.md` §12.1, schreibt Ergebnis-Tabelle | Di abends |
| **README-Rohbau** | eigenes File, kein Code | Di abends |

**Nicht geeignet:** alles, was Store, Tool-Wrapper, Tabelle, Agent-Panel oder Schema berührt. Dort gilt: nur Claude Code.

**Merge-Protokoll:** Codex arbeitet in einem eigenen Branch oder Unterordner, liefert **eine** Datei plus Tests, Merge zu einem festgelegten Zeitpunkt durch Claude Code. Kein Cross-Editing, keine gleichzeitigen Commits auf `main`.

## Zu „Spec-driven development" / Spec Kit

Wir machen das bereits – nur ohne Werkzeugzeremonie. `spec.md` (425 Zeilen) enthält Datenmodell, Werkzeuge mit Schemas, Designregeln, Betriebsregeln, Abnahmekriterien und einen binären Gate-Test; `seed/` liefert geprüfte Daten, `verify_seed.py` ist eine ausführbare Referenz der Matching-Regel. Heute noch ein Spec-Framework einzuführen hieße, dieselbe Arbeit in ein neues Format zu übertragen – ein bis zwei Stunden, die wir nicht haben. **Nach der Einreichung** kann man das gern nachziehen, wenn daraus ein Produkt wird.

## Startschuss – die nächsten drei Schritte

1. **Repo und Deploy-Pfad (Ziel: 13:30).** Leere App auf der endgültigen Worker-URL. Erst danach Fachlogik.
2. **Schema und Seed (Ziel: 14:30).** `seed/schema.sql` und `seed/seed.sql` einspielen, Workspace-Anlage, Reset.
3. **Tool-Wrapper und zwei Lese-Werkzeuge (Ziel: 17:00).** `document.modelContext` mit Fallback, Log, `list_tenders`, `get_tender`. Danach eine Stunde Puffer für den ChatGPT-Test.

## Prompt 1 für Claude Code (jetzt, im Projektordner starten)

```
Lies zuerst CLAUDE.md, spec.md und seed/README.md vollständig. Danach baust du Schritt 1
von docs/03-spec-biddesk.md §9: den Deploy-Pfad, sonst nichts.

Ziel dieses Auftrags (nichts darüber hinaus):
- React + Vite + TypeScript + Tailwind, Backend Hono auf Cloudflare Workers, D1.
- Basis: das Cloudflare-Beispiel cloudflare/agents/examples/webmcp-react. Prüfe, ob dessen
  Hook document.modelContext unterstützt; wenn nicht, notiere es, baue aber noch nichts um.
- Ein Worker liefert API unter /api/* und die statischen Assets.
- Die App zeigt vorerst nur: Kopfzeile "BidDesk" und die Zeile "deploy path ok".
- D1-Datenbank "biddesk" anlegen, wrangler.toml konfigurieren, KEINE Tokens ins Repo.
- Git-Repo initialisieren, MIT-Lizenz als LICENSE, erster Commit.
- Mit wrangler deployen und mir die produktive URL nennen.

Danach STOPP und berichte: URL, was funktioniert, was du beim Template geändert hast.
Baue keine Werkzeuge, kein Schema, keine Oberfläche – das ist Auftrag 2.
```

## Prompt 2 (direkt danach)

```
Jetzt Schritt 2: Daten und Workspace.
- seed/schema.sql gegen die D1-Datenbank ausführen.
- POST /api/workspace legt einen Workspace an und spielt seed/seed.sql mit ersetztem {{WS}}
  in EINEM D1-Batch ein. POST /api/workspace/:id/reset macht dasselbe nach vorherigem Löschen.
- Die Workspace-ID lebt ausschließlich in localStorage. KEIN ?ws=-Parameter (siehe CLAUDE.md).
- Unbekannte oder gelöschte Workspace-ID: still einen neuen anlegen, niemals ein Fehlerbildschirm.
- GET /api/tenders und /api/tenders/:id liefern Ausschreibung und Positionen.
- Die Startseite zeigt die 14 Positionen von T-2026-014 als Tabelle mit Menge und Einheit,
  Preisspalte leer, Summe 0,00 €. Kein Login, kein Modal.
- python3 seed/verify_seed.py muss weiterhin ALLES GRUEN sagen.
Deployen, dann STOPP und berichten.
```

## Prompt 3 (Gate-Sprint)

```
Schritt 3: Tool-Wrapper und zwei Lese-Werkzeuge – exakt nach spec.md §3 und §11.
- Zentraler Wrapper: document.modelContext, Fallback navigator.modelContext, jeder Aufruf
  ins Live-Log, Fehler immer als {ok:false,error,hint}, niemals werfen. Ausgaben sind reines JSON.
- Registriere list_tenders und get_tender mit readOnlyHint und vollständigem inputSchema
  (additionalProperties:false, Feldbeschreibungen).
- Agent-Panel rechts, standardmäßig offen, mit: Selbstdiagnose-Zeile (zählt über getTools(),
  NIE eine feste Zahl), Live-Log, den Beispiel-Prompts aus spec.md §12.1, Reset-Knopf.
- Deployen. Dann sage mir, was ich im ChatGPT-Desktop-Browser tun muss, um get_tender
  aufzurufen, und was ich im Live-Log sehen sollte.
```

## Gate-Prüfung um 18:00 (bestanden / nicht bestanden)

1. Produktive URL liefert die Anwendung – kein 404, kein „Hello World".
2. Frischer Browser ohne gespeicherten Workspace zeigt die 14 Positionen aus dem Seed.
3. ChatGPT-Desktop ruft `get_tender` auf dieser URL auf, der Aufruf steht im Live-Log.

Nicht bestanden → GAEB entfällt endgültig, Auftraggeberteil wird bedingt, Dienstag beginnt mit der offenen Bedingung.
