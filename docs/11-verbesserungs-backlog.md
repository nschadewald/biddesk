# Verbesserungs-Backlog — Kundendemo zuerst

**Zielkorrektur vom 01.09., 12:30 (Nils):** Das eigentliche Ziel ist eine **Demo, mit der Kunden gewonnen werden**. Die Challenge ist Beiwerk und Marketinganlass. Die Jury wird als *ein möglicher Kunde* behandelt — was einen Malermeister überzeugt, überzeugt auch sie. Eine verpasste Uhrzeit am Donnerstag ist schade, kein Beinbruch.

**Folge für die Rangliste:** Der DE/EN-Umschalter rutscht von Platz 4 auf Platz 1. Ein deutscher Handwerksmeister sieht sich keine englische Oberfläche an — damit ist die Sprache keine Annehmlichkeit mehr, sondern die Voraussetzung dafür, dass die Demo ihren Zweck überhaupt erfüllen kann.

**Neue Reihenfolge:** 1. DE/EN · 2. Preisbuch-Bildschirm · 3. Eigene Altangebote importieren · 4. Nachweis-Ansicht · 5. X84-Export.
Begründungen unverändert unten, nur die Nummerierung ist überholt.



Stand Di 01.09., 12:15. Neue Lage: Video ist automatisiert und jederzeit neu erzeugbar, Deadline ist Do 03.09. 22:00 Berlin. Damit ist der Mittwoch-Freeze aufgehoben.

## Neuer Zeitplan

- **Di Nachmittag:** vollständiger Durchlauf (Befunde sammeln), dann bauen.
- **Mi:** bauen, abends erste Fassung einreichen (siehe „Der Trick" unten).
- **Do bis 12:00:** letzte Verbesserungen. **Do 12:00 UI-Freeze**, damit die Videoautomatik einmal sauber durchläuft.
- **Do 17:00 harte interne Abgabe.** Nicht 22:00. YouTube-Verarbeitung, Formularfelder, Asset-Propagation und ein Fund um 21:30 sind zusammen der einzige Weg, dieses Projekt noch zu verlieren.

**Der Trick, der den Zielkonflikt auflöst:** Auf Devpost lässt sich eine Einreichung in aller Regel bis zum Fristende **bearbeiten**. Bitte auf der Devpost-Seite prüfen. Wenn das gilt: Mittwochabend eine vollständige, gültige Einreichung absenden — Live-URL, Video, Repo, Text — und donnerstags nur noch verbessern und aktualisieren. Dann hast du die Sicherheit der frühen Abgabe *und* den zusätzlichen Tag. Fällt donnerstags etwas aus, steht trotzdem eine komplette Einreichung.

## Wo die Bewertung noch Luft hat

**WebMCP Leverage — nahezu ausgereizt.** 12 Werkzeuge, beide API-Stile, Annotations, rollenabhängige Registrierung, Abmeldung nach der Abgabe, Feature-Erkennung, Evals über die offizielle CLI, Lighthouse 1,00, Origin Trial. Mehr Werkzeuge machen den Agenten schlechter, nicht besser. Hier gewinnt man nur noch durch bessere *Darstellung*, nicht durch mehr Substanz.

**Execution — hier liegt die größte Lücke.** „A complete product experience, not a proof of concept." Das Preisbuch ist die zentrale Idee des Produkts und im Bildschirm praktisch unsichtbar; man kommt nur über einen Werkzeugaufruf daran.

**Potential Impact — eine benannte Schwäche ist umwandelbar.** Known Limitation 2 lautet: „The price book is seeded data." Genau das ist der Unterschied zwischen Demo und Werkzeug.

**Creativity — der Befund aus §13.3d trägt schon viel.** Ausbaufähig in eine Richtung, die sonst niemand geht: Nachweisbarkeit als sichtbares Produktmerkmal.

## Rangliste (alle ohne ein einziges neues Werkzeug)

**1 · Preisbuch-Bildschirm** — Execution
Die eigene Preishistorie als eigener Bereich: durchsuchbar, nach Gewerk und Einheit gruppiert, mit sichtbaren Abdeckungslücken („metal/St: kein Eintrag"). Beantwortet Prompt 2 („Why is there no price for the radiators?") auch visuell und macht die Kernaussage anfassbar: Der Agent bewegt *dein* Wissen. Nutzt `get_price_book`, keine neue Werkzeugfläche. Aufwand ca. 2 h, Risiko niedrig (reiner Lesebereich, berührt den Demo-Pfad nicht).

**2 · Eigene Altangebote importieren** — Potential Impact
Eine Fläche, in die ein Betrieb eigene Zeilen einfügt (Positionstext, Einheit, Preis, Projekt, Datum) und daraus sein Preisbuch aufbaut — wie beim GAEB-Import: ein Mensch bringt die Datei, kein Werkzeug. Damit fällt Known Limitation 2 weg und aus „schöne Demo" wird „das könnte ein Betrieb am Montag benutzen". Aufwand ca. 2 h, Risiko niedrig.

**3 · Nachweis-Ansicht des Angebots** — Creativity + Leverage-Erzählung
Eine Ansicht über das fertige Angebot: je Position, wer den Wert gesetzt hat (Agent mit Quelle / Mensch), aus welchem Projekt und Datum er stammt, wann er geschrieben wurde. Als Datei exportierbar. Das dramatisiert die These und passt exakt zum Vergabekontext: ein **prüfbares Angebot**. Die Daten liegen alle vor (`bid_prices`, `change_log`), es ist eine Darstellung, keine Mechanik. Aufwand ca. 2 h.

**4 · DE/EN-Umschalter** — für dich, nicht für die Jury
Seed-Texte sind zweisprachig. Kundengespräche auf Deutsch. Aufwand ca. 1 h, Risiko sehr niedrig.

**5 · X84-Export des Angebots** — schließt die GAEB-Schleife
LV kommt als GAEB herein, Angebot geht als GAEB hinaus. Inhaltlich der stärkste verbleibende Zusatz, aber im Video kaum sichtbar. Aufwand 2–3 h. Nur wenn 1–4 stehen.

## Was weiterhin nicht gebaut wird

Ausschreibungen anlegen durch den Auftraggeber, weitere Werkzeuge, Live-Feed öffentlicher Ausschreibungen, Anmeldung. Alle vier wurden aus inhaltlichen Gründen abgelehnt, nicht aus Zeitmangel — die Gründe gelten mit mehr Zeit unverändert.

## Reihenfolge

Erst der vollständige Durchlauf mit Notizblock. Was dabei auffällt, ist wichtiger als diese Liste — es ist der Weg, den auch die Jury geht.
