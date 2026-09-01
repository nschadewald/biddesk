# Prompt für Claude Code — Freigabe DE/EN mit sechs Festlegungen

---

**Freigabe für deinen Plan. Deine Analyse trifft zu, besonders der Punkt zu `useWebMCP`.
Sechs Festlegungen, dann bau.**

Vorab: `docs/11-verbesserungs-backlog.md` existiert, ist aber im Hauptbaum **untracked** —
deshalb fehlt sie in deinem Worktree. Du brauchst sie für diesen Auftrag nicht.

**1 · Sprache als Header, ausgewertet an der Mapping-Stelle.** `X-Language`, zum
Fetch-Zeitpunkt aus dem Store gelesen, genau wie `X-Workspace-Id` und `X-Bidder-Id`.
Ausgewertet in `toPosition`/`toTender` in `src/server.ts` — nicht im Frontend dupliziert.
**Ohne Header gilt `en`.** Evals, `/how-to-test` und `seed/verify_seed.py` senden keinen
Header und dürfen sich um kein Zeichen verändern.

**2 · Das Matching wird nicht angefasst.** `findMatch` bleibt fest auf `text_de` und den
deutschen Schlagworten, in jeder Sprache. **Abnahme:** `suggest_prices` auf T-2026-014 mit
B-A liefert in beiden Sprachen identisch 12 Vorschläge, genau 2× none (03.04, 04.02),
netto 13.213,50 €.

**3 · Keine Neuregistrierung durch Sprache.** Werkzeugnamen, -beschreibungen und -schemas
bleiben englisch, ausnahmslos. Sprache kommt in keine Abhängigkeitsliste von `useWebMCP`.
**Abnahme:** Ein Sprachwechsel löst kein `toolchange` aus, die Zahl in der Selbstdiagnose
ändert sich nicht, und im Live-Log erscheint kein Registrierungsereignis.

**4 · Wörterbuch-Ebene, keine Ternäre in Komponenten.** Und ab diesem Commit gilt
ausnahmslos: **kein hartkodierter sichtbarer String mehr**, auch nicht in den Bildschirmen,
die danach kommen. Sonst verrottet die Zweisprachigkeit im nächsten Auftrag.

**5 · Beträge und Mengen bleiben in beiden Sprachen `de-DE`** (13.213,50 €). Die Begründung
steht schon in `src/format.ts`, und die Zahl ist an sechs Stellen als feste Prüfzahl
dokumentiert. **Datumsformate folgen der Sprache** (`de-DE` / `en-GB`) — sie kommen in
keiner Prüfzahl vor.

**6 · Englisch bleibt englisch, wo es Werkzeugdaten sind.** `/how-to-test`, das Live-Log,
Fehlerobjekte (`{ok:false, error, hint}`) und alles, was ein Werkzeug zurückgibt außer den
Positionstexten und Nachweis-Bezeichnungen. Die Sprachwahl wird pro Browser gemerkt,
Vorgabe englisch — ein Juror ohne Vorgeschichte sieht Englisch.

**Abnahme insgesamt:** `npm test`, `npm run typecheck`, `python3 seed/verify_seed.py`, beide
Eval-Sätze grün. Deploy, 15 Sekunden warten, dann P1–P5 einmal auf Englisch durch. Danach
`docs/07-technik-entscheidungen.md` um einen Abschnitt ergänzen.

**Wenn du fertig bist, melde dich mit dem Stand — der nächste Auftrag liegt schon.**
