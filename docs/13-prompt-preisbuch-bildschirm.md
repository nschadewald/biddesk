# Prompt für Claude Code — Preisbuch-Bildschirm (Rangplatz 2)

Einsetzen, sobald der DE/EN-Umschalter grün ist. Befunde aus dem Demo-Durchlauf, die
**blockieren**, werden vorne angehängt und gehen diesem Auftrag vor.

---

**Preisbuch-Bildschirm bauen. Rangplatz 2 aus `docs/11-verbesserungs-backlog.md`.**

Die eigene Preishistorie ist die zentrale Idee dieses Produkts und im Bildschirm heute
unsichtbar — man kommt nur über einen Werkzeugaufruf daran. Das ändert dieser Auftrag.
Er beantwortet Demo-Prompt 2 („Why is there no price for the radiators?") auch visuell.

## Nicht bauen

- **Kein neues WebMCP-Werkzeug.** Die zwölf bleiben zwölf; die Selbstdiagnose zählt weiter über `getTools()`.
- **Keine Schreibfläche.** Reiner Lesebereich. Der Import eigener Altangebote ist der nächste
  Auftrag und landet in denselben Bildschirm — bau ihn so, dass dort später Platz ist.
- **Kein neuer API-Endpunkt.** `GET /api/price-book` steht (`src/server.ts:373`).
- Der Bid-Screen bleibt der Einstieg. Das Preisbuch ist ein zweiter Bereich, nicht die Startseite.

## Was gebaut wird

1. **Bereich „Price book" / „Preisbuch"**, aus dem Kopfbereich erreichbar, nur in der Bieterrolle.
   Zeigt das Preisbuch des **im Kopf gewählten** Bieters. Der Bieterwechsel wirkt sofort und
   sichtbar — das ist der stärkste Beweis aus §13.2 Punkt 1, und hier wird er zum ersten Mal
   ein Bild statt eines Arguments.

2. **Liste**, gruppiert nach Kategorie, darin nach Einheit. Je Zeile: Originalzeile
   (`source_position_text`), Projekt, Datum, Einheit, Preis, Schlagworte (`keywords`).

3. **Suche** über Originalzeile und Schlagworte. Teilstring auf normalisiertem Text, mit
   **derselben `normalise()` aus `src/matching.ts`** — keine zweite Implementierung. Wenn die
   Suche anders normalisiert als das Matching, zeigt der Bildschirm eine andere Wahrheit als
   der Agent, und der ganze Bereich wird zum Gegenbeweis statt zum Beleg.

4. **Abdeckungsmatrix, Kategorie × Einheit.** Gefüllte Zelle = Anzahl Einträge. Leere Zelle =
   „kein Eintrag". Die Achsen entstehen aus den Kategorien und Einheiten, die in den
   **Ausschreibungen dieses Workspace vorkommen**, vereinigt mit denen des Preisbuchs —
   **nie aus einer Liste im Code**. Für Farbwerk Meier muss `metal / pcs` sichtbar leer sein:
   das ist die Heizkörper-Lücke aus Prompt 2.

5. **Klick auf eine leere Zelle** zeigt, welche Positionen aus welchen Ausschreibungen darunter
   fallen — also was dem Betrieb durch diese Lücke entgeht.

6. **Rückweg aus der Tabelle:** „no comparable entry" im Bid-Screen wird anklickbar und führt in
   die Matrix mit der passenden Zelle vorausgewählt. Das ist die Stelle, an der im
   Kundengespräch die Frage „warum nicht?" fällt, und sie soll dort eine Antwort haben.

## Regeln

- **Originalzeilen, Projektnamen und Schlagworte werden nie übersetzt** und nie gekürzt
  dargestellt, in keiner Sprache. Sie sind einsprachig deutsch, weil sie Zeilen aus alten
  Angeboten dieses Betriebs sind. Ein übersetzter Beleg ist kein Beleg.
- **Keine Prozente, keine Balken, keine Ampel, keine Farbskala.** Abdeckung ist eine Anzahl
  oder nichts. Eine eingefärbte Matrix wäre die Konfidenzskala, die in §13.3 abgeschafft wurde,
  durch die Hintertür.
- **Alle sichtbaren Strings über den i18n-Mechanismus** aus dem DE/EN-Schritt. Ab jetzt gilt
  ausnahmslos: kein hartkodierter sichtbarer Text mehr, sonst verrottet die Zweisprachigkeit
  innerhalb eines Bildschirms.
- Das Leistungsverzeichnis bleibt unangetastet. Dieser Bereich schreibt nichts.
- Design wie gehabt: Arbeitsgerät, hell, dicht, zurückhaltend.

## Abnahme

- `npm test` und `npm run typecheck` grün. Neue Tests: Achsen der Matrix entstehen aus den
  Daten (nicht aus einer Konstante), und `metal / pcs` ist für B-A leer.
- Bieterwechsel im Kopf ändert Liste **und** Matrix; die drei Bieter haben sichtbar
  verschiedene Abdeckung.
- `python3 seed/verify_seed.py` weiterhin „ALLES GRUEN".
- **Der Demo-Pfad P1–P5 läuft unverändert.** `suggest_prices` auf T-2026-014 mit B-A liefert
  weiterhin 12 Vorschläge, genau 2× none (03.04, 04.02), netto 13.213,50 €. Dieser Bereich darf
  das Matching nicht anfassen.
- Deploy, **15 Sekunden warten**, dann prüfen: Bereich lädt, Suche „schimmel" findet die Zeile,
  `metal / pcs` ist leer, Rückweg aus „no comparable entry" funktioniert.
- `docs/07-technik-entscheidungen.md` um einen Abschnitt ergänzen: was entschieden wurde und warum.

---

## Danach, in dieser Reihenfolge

**Rangplatz 3 — eigene Altangebote importieren.** In denselben Bildschirm: eine Fläche, in die
ein Betrieb eigene Zeilen einfügt (Positionstext, Einheit, Preis, Projekt, Datum) und daraus sein
Preisbuch aufbaut. Wie beim GAEB-Import bringt **ein Mensch** die Daten, es gibt bewusst kein
Werkzeug dafür. **Im selben Commit** müssen mit: Known Limitation 2 in `README.md` (Zeile 250),
`docs/08-devpost-text.md` und `spec.md §12.3`. Alle drei sagen heute, das Preisbuch sei
vorbereitete Daten und der Import eigener Altangebote fehle. Bleibt der Text stehen, verkauft er
das Produkt unter Wert.

**Rangplatz 4 — Nachweis-Ansicht.** Entscheidung Mittwochmittag nach Zeitstand, nicht jetzt.

**Rangplatz 5 — X84-Export.** Findet nach heutiger Rechnung nicht statt. Begründung in
`docs/12`/Chat: X84 zahlt auf die Jury ein, nicht auf den Kunden — und die Zielkorrektur sagt
Kunde zuerst.
