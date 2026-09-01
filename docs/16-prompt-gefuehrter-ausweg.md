# Prompt für Claude Code — Herkunfts-Chip und der geführte Ausweg

Einsetzen, sobald DE/EN grün ist. Alle sichtbaren Strings über die neue Wörterbuch-Ebene.

---

**Zwei Aufträge aus dem Demo-Durchlauf. Der erste ist klein, der zweite ist der wichtigste
Umbau seit dem Bau von `submit_bid`.**

## Auftrag 1 — der Herkunfts-Chip sagt nicht, was er ist

Auf dem Chip steht heute „Luegallee 40 · March 2026". Dass das eine Zeile aus einem
**eigenen alten Angebot dieses Betriebs** ist, steht nirgends — man muss es wissen. Damit
ist der Beleg, auf dem die gesamte Produktaussage ruht, im Bildschirm unlesbar.

- Der Chip trägt die Herkunft in Worten: `from your quote · Luegallee 40 · March 2026`
  bzw. `aus deinem Angebot · Luegallee 40 · März 2026`.
- Beim Öffnen steht über der Originalzeile eine Zeile, die sagt, was sie ist:
  `the line you priced back then` / `die Zeile, die du damals bepreist hast`. Darunter wie
  bisher `matched_terms` und `matched_on`.
- **Alle Chips bleiben untereinander gleich** — keine Farbe, kein Gewicht, keine Abstufung.
  §13.3 gilt unverändert: Zustände, keine Grade.

## Auftrag 1b — die englische Fassung sagt nicht, wo sie spielt

**Befund:** In der englischen Oberfläche stehen deutsche Firmen, Straßen und Projekte neben
englischen Positionstexten. Das wirkt halb übersetzt, und ein Juror kann sich darin nicht
verorten.

**Entschieden gegen Umziehen, für Erklären.** Die Eigennamen bleiben deutsch — es sind
Eigennamen, und der Fall *ist* ein deutsches Vergabeverfahren: GAEB X83, VOB,
Unbedenklichkeitsbescheinigung, Bedarfsposition. Eine kalifornische Firma, die nach deutscher
Norm in Euro bietet, wäre weniger stimmig, nicht mehr.

Gebaut wird stattdessen eine **Szene-Zeile über der Ausschreibung**, zweisprachig:

- EN: `A German public tender (VOB/GAEB). Names, prices and firms are invented.`
- DE: `Eine deutsche Ausschreibung (VOB/GAEB). Namen, Preise und Firmen sind erfunden.`

Eine Zeile, klein gesetzt, unter dem Tender-Titel. Sie beantwortet die Frage, bevor sie
gestellt wird, und erledigt nebenbei den Hinweis, dass alle Daten erfunden sind — der steht
bisher nur im README.

## Auftrag 2 — Sackgassen werden Wege

**Befund:** An drei Stellen endet die Demo mit „geht nicht, mach du" — leere Position ohne
Preisbucheintrag, abgewiesener freier Preis, abgelaufener Nachweis. Genau dann sitzt der
Nutzer im Chat und wechselt nicht auf die Seite. Aus „der Agent hat keine eigene Autorität"
ist im Bau „der Agent hört auf" geworden. Das ist nicht dasselbe. `submit_bid` macht es
richtig vor.

**Der Leitsatz bleibt unverändert:** Der Agent bringt keinen Geschäftsfakt selbst hervor und
hat keine eigene Autorität. Was gebaut wird, ist die zweite Hälfte des Musters, das es schon
gibt.

### Was gebaut wird

**a) `set_unit_price` ohne `price_book_id` antwortet nicht mehr mit einem Fehler.**
Stattdessen `{ ok: true, status: "needs_confirmation", ... }` — genau wie
`submit_bid confirm:false`. Es öffnet sich eine Bestätigung **an der Zeile** mit: OZ,
Positionstext, Menge, Einheit, vorgeschlagener Einheitspreis, daraus folgende Zeilensumme.
Erst der menschliche Klick schreibt. Verbucht wird `set_by='human'` ohne `price_book_id` —
wahrheitsgemäß, weil eine menschliche Hand genau diesen Wert freigegeben hat.

**b) Neues optionales Feld `rationale`** an `set_unit_price` (String, höchstens 240 Zeichen):
die Herleitung, die im Bestätigungsfenster steht („aus 12 Heizkörpern × 25 Min bei deinem
Stundensatz von 58 €"). Sie ist Formulierung, kein Geschäftsfakt — der Agent darf sie frei
schreiben. Gespeichert wird sie in der vorhandenen Spalte `bid_prices.note`. **Keine
Schemaänderung.**

**c) In der Bestätigung steht, woher der Wert *nicht* kommt:** eine Zeile
`not from your price book — you are setting this price yourself` /
`nicht aus deinem Preisbuch — diesen Preis setzt du selbst`. Ehrlichkeit als Gestaltung,
nicht als Kleingedrucktes.

**d) Die Bestätigung an der Zeile ist sichtbar etwas anderes als der Abgabedialog.**
Klein, an der Zeile, kein Modal. Der Abgabedialog bleibt der einzige Moment, der den
Bildschirm anhält — er ist der Höhepunkt und darf keine Konkurrenz bekommen.

**e) Die Werkzeugbeschreibungen führen den Agenten in diesen Weg.** In `suggest_prices`:
Wenn eine Position keinen Treffer hat, soll der Agent dem Menschen einen Weg vorschlagen —
nach der Berechnungsgrundlage fragen (Aufwand, Stundensatz, Vergleichsposition) und das
Ergebnis über `set_unit_price` mit `rationale` anbieten; die Seite holt dann die
Bestätigung ein. Das steuert die Kette über die Beschreibung, nicht über neue Werkzeuge.

**f) `check_bid` gibt zu jedem Befund einen Handlungssatz** — fest von uns formuliert, nicht
vom Agenten erfunden. Offene Position: „no entry for metal/pcs — set the price yourself, or
add this kind of work to your price book." Nachweis: „upload a current certificate, or set a
new expiry date."

### Was ausdrücklich nicht gebaut wird

- **Kein dreizehntes Werkzeug.** Der Nachweis über den Chat (Punkt 7 aus dem Durchlauf)
  wird Mittwoch 12:00 nach Zeitstand entschieden, nicht jetzt.
- **Kein Schreibzugriff des Agenten auf das Preisbuch.** Ein Agent, der einen Preisbucheintrag
  anlegt und danach „belegt" daraus bepreist, hätte die Herkunft gewaschen. Preisbucheinträge
  entstehen nur durch einen Menschen über die Oberfläche — dieselbe Regel wie beim GAEB-Import.

### Abnahme

- Die Invariante hält unverändert: Jede Zeile in `bid_prices` hat **entweder** eine
  `price_book_id` (dann `set_by='agent'`, und der Preis gleicht der Preisbuchzeile)
  **oder** `set_by='human'`. Kein dritter Fall. Bestehender Test bleibt grün.
- **Neuer Test:** `set_unit_price` ohne `price_book_id` und ohne Bestätigung schreibt
  **nichts** — weder in `bid_prices` noch ins `change_log`.
- **Neuer Eval-Fall E6:** „Set position 03.04 to 61 euros." → `needs_confirmation`, kein
  Schreibvorgang im Log, Bestätigung sichtbar; nach dem Klick `set_by='human'`,
  `price_book_id` NULL, Summe um 61 × Menge höher.
- P1–P5 unverändert. E1 weiterhin 12 applied, 0 rejected, netto 13.213,50 €.
- `README.md`, `spec.md §13.1/§13.3c` und `docs/08-devpost-text.md` bekommen den präzisierten
  Satz — **im selben Commit**:
  > *No price enters a bid without either a traceable source in this firm's own history or a
  > person's hand on that exact value.*
  Known Limitation 5 („Der Agent kann keinen frei genannten Preis eintragen") wird
  umgeschrieben: er kann ihn **vorschlagen**, eintragen tut ihn die Bestätigung.
  Known Limitation 6 (Browsersteuerung, §13.3d) bleibt wörtlich stehen — sie gilt unverändert.
- `docs/07` um einen Abschnitt ergänzen.
