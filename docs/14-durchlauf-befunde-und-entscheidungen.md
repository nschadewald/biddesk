# Befunde aus dem Demo-Durchlauf und was daraus folgt

Stand Di 01.09., 13:40 Berlin. Grundlage: Nils' Durchlauf als Verkaufsgespräch.
Verbindlich gegenüber der Rangliste in `docs/11`.

## Warum Claude Code `docs/11` nicht findet

Claude Code arbeitet im Worktree `.claude/worktrees/biddesk-de-en-switcher-51424a` auf
Commit `e48bc74`. `docs/10` bis `docs/14` sind im Hauptbaum **untracked** — untracked
Dateien existieren in einem Worktree nicht. Kein Fehler von Claude Code.
Abhilfe: `git add docs/ && git commit -m "Endspurt-Dokumente"` im Hauptbaum, danach die
Dateien über den absoluten Pfad nennen.

## Die Befunde, sortiert

Vier der sieben Punkte sind **ein** Befund, und es ist der wichtigste des Tages:

> **An drei Stellen endet die Demo mit „geht nicht, mach du" — und zwar genau dann, wenn
> der Nutzer im Chat sitzt und nicht auf die Seite wechseln will.**
> Leere Position ohne Preisbucheintrag · abgewiesener freier Preis · abgelaufener Nachweis.

Das ist kein fehlender Bildschirm. Das ist eine fehlende Bewegung. Der Leitsatz aus §13.1
sagt „der Agent hat keine eigene Autorität" — daraus wurde im Bau „der Agent hört auf".
Das ist nicht dasselbe. `submit_bid` macht es seit dem ersten Tag richtig vor:
**keine eigene Autorität heißt Bestätigung, nicht Sackgasse.**

Damit ist die Rangliste aus `docs/11` überholt. Der Preisbuch-Bildschirm (Platz 2) war damit
begründet, Prompt 2 „auch visuell" zu beantworten. Der Durchlauf sagt: An dieser Stelle wird
nicht auf einen Bildschirm gewechselt. Er bleibt richtig für „Execution", rutscht aber hinter
den geführten Ausweg.

Die übrigen Befunde:

- **Herkunfts-Chip** („Luegallee 40, März 2026 ist nicht erkennbar als altes Angebot"):
  billigster Gewinn der ganzen Liste. Reine Beschriftung, kein Risiko, große Wirkung —
  es ist der Beleg, auf dem die gesamte Produktaussage ruht, und er sagt nicht, was er ist.
- **Deutsche Eigennamen in der englischen Fassung**: siehe Entscheidung 3.

## Entscheidungen

**1 · Der geführte Ausweg wird gebaut, der Leitsatz bleibt.**
`set_unit_price` ohne `price_book_id` antwortet nicht mehr mit einem Fehler, sondern mit
`needs_confirmation` — Dialog an der Zeile, menschlicher Klick schreibt, verbucht als
`set_by='human'` ohne Herkunft. Das ist wahrheitsgemäß: eine menschliche Hand hat genau
diesen Wert freigegeben. Die Invariante („`price_book_id` **oder** `set_by='human'`, nie
etwas Drittes") bleibt unangetastet, und der Agent kann weiterhin **allein** keinen Wert
ohne Herkunft schreiben.

Der Satz im Write-up wird dadurch besser, nicht schwächer:

> *No price enters a bid without either a traceable source in this firm's own history or a
> person's hand on that exact value.*

**2 · Kein dreizehntes Werkzeug vor Mittwochmittag.**
Punkt 7 (Nachweis über den Chat erneuern) verlangt eines. Es ist billig, **nachdem** das
Bestätigungsmuster steht — dann hängt nur ein zweites Objekt daran. Entscheidung Mittwoch
12:00 nach Zeitstand, nicht vorher. Bis dahin bekommt `check_bid` je Befund einen festen,
von uns formulierten Handlungssatz.

**3 · Beträge bleiben in beiden Sprachen deutsch formatiert** (13.213,50 €). Es ist ein
Euro-Betrag in einem deutschen Vergabeverfahren; die Zahl ist an sechs Stellen als feste
Prüfzahl dokumentiert. Datumsformate folgen der Sprache — sie kommen in keiner Prüfzahl vor.

**4 · Die englische Fassung zieht nicht nach Kalifornien um, sie erklärt sich.**
Eigennamen bleiben deutsch; eine Szene-Zeile im Kopf sagt, dass es ein deutsches
Vergabeverfahren ist und dass alle Daten erfunden sind. Grund: GAEB X83, VOB und die
Unbedenklichkeitsbescheinigung sind die Substanz des Falls und der stärkste technische
Beweis. Freigegeben von Nils am 01.09.

**5 · X84-Export findet nicht statt.** Unverändert.

## Neue Reihenfolge

1. **DE/EN** (läuft) — freigegeben mit sechs Festlegungen, siehe unten.
2. **Herkunfts-Chip beschriften und Szene-Zeile setzen** — 45 Minuten, kein Risiko.
3. **Der geführte Ausweg** — der eigentliche Gewinn aus dem Durchlauf.
4. **Preisbuch-Bildschirm** (`docs/13`) — unverändert gültig, nur später.
5. **Nachweis über den Chat** — Entscheidung Mittwoch 12:00.
6. Eigene Altangebote importieren · Nachweis-Ansicht — nur, wenn 1–5 stehen.
