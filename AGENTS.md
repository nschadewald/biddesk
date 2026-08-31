# BidDesk – Regeln für jeden Agenten in diesem Repo

Gilt für Claude Code, Codex CLI und jeden anderen Agenten. **Einzige Quelle der Wahrheit: `spec.md`** (Schnappschuss aus `docs/03-spec-biddesk.md`). Ausführliche Arbeitsanweisungen: `CLAUDE.md`. Fertige Daten: `seed/` (`seed/README.md` zuerst lesen).

WebMCP Challenge (OpenAI/Devpost). **Feature Freeze Mi 02.09. 15:00, Einreichung bis 21:00, Deadline Do 03.09. 22:00 Berlin.**

## Leitsatz, dem sich alles unterordnet

„Ein Agent wird im Betrieb erst dann brauchbar, wenn er nichts erfindet, was im Angebot landet, und nichts allein verbindlich macht – dann aber sofort."
Was diesen Satz nicht stützt, wird nicht gebaut.

## Zehn Regeln, die nicht verhandelbar sind

1. **Trennlinie Formulierung vs. Geschäftsfakt.** Preis, Menge, Frist, Nachweisstatus, Summe darf kein Agent selbst hervorbringen – nur holen, lesen, rechnen. Prüfbar: jeder Wert in `bid_prices` hat `price_book_id` ODER `set_by='human'`, nie etwas Drittes.
2. **`suggest_prices`:** Kategorie UND Einheit müssen passen; Keyword-Treffer als Teilstring auf normalisiertem Text (deutsche Komposita); mindestens ein Treffer, sonst kein Vorschlag. Sollergebnis B-A auf T-2026-014: 12 Vorschläge, genau 2× ohne (03.04, 04.02), netto 13.213,50 €.
3. **Das Leistungsverzeichnis ist unantastbar.** Kein Werkzeug ändert Positionen, Mengen oder Texte. Kein Löschen. Kein Anlegen von Ausschreibungen im MVP.
4. **`submit_bid` ist die einzige destruktive Aktion** und braucht immer den Klick eines Menschen; danach wird das Werkzeug abgemeldet.
5. **Alle Quellen-Chips sehen gleich aus.** Keine Konfidenzskala, keine Prozente, keine Ampel an Preisen. `matched_terms`/`matched_on` erst beim Öffnen des Chips.
6. **Offene Ausschreibungen sind versiegelt.** `get_price_comparison` liefert vor Fristende nur Anzahl und Eingangszeit, keine Preise.
7. **Werkzeuge über den zentralen Wrapper:** `document.modelContext` mit Fallback `navigator.modelContext`; nie werfen, Fehler als `{ok:false,error,hint}`; Ausgaben sind reines JSON, kein HTML; jeder Aufruf ins Live-Log.
8. **Selbstdiagnose zählt über `getTools()`**, nie eine fest verdrahtete Zahl.
9. **Kein Login, kein `?ws=`-Parameter.** Zustand nur in localStorage. Fristen und Nachweis-Gültigkeiten bleiben relativ (`date('now','+N day')`).
10. **Kein LLM im Backend.** Die Intelligenz sitzt im Agenten des Nutzers.

## Arbeitsteilung

Claude Code fährt die Anwendung. Codex arbeitet ausschließlich auf abgeschlossenen Modulen mit fester Schnittstelle (GAEB-Parser, Evals, README) in eigenem Branch, Merge durch Claude Code zum vereinbarten Zeitpunkt. Kein Cross-Editing an Store, Tool-Wrapper, Tabelle, Agent-Panel oder Schema. Details: `docs/06-agenten-arbeitsteilung.md`.

## Nach jedem Schritt anhalten und berichten

Nicht durchlaufen. Der Engpass ist das Gegenlesen durch den Menschen, nicht die Tippgeschwindigkeit.
