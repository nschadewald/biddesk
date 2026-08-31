# BidDesk – der Fall in Klartext

Für alle, die nicht aus der Technik kommen: Kundengespräch, Website, LinkedIn, Video-Text.
Stand 28.08.2026. Grundlage: `docs/03-spec-biddesk.md`. Alle Firmen, Preise und Personen sind erfunden.

---

## 1. Worum es geht

Wer bauen oder sanieren lässt – eine Hausverwaltung, eine Kommune, ein Wohnungsunternehmen –, schreibt die Arbeiten aus. Das Herzstück jeder Ausschreibung ist das **Leistungsverzeichnis**: eine nummerierte Liste dessen, was gemacht werden soll, mit Mengen und Einheiten. 320 m² Wandfläche streichen. 45 m Geländer lackieren. 10 Türen.

Der Handwerksbetrieb, der den Auftrag will, muss zu **jeder einzelnen Zeile** einen Preis schreiben. Genau da steigen viele kleine Betriebe aus. Nicht weil sie die Arbeit nicht könnten, sondern weil das Bepreisen einen Abend kostet – und man am Ende nicht weiß, ob man ihn umsonst investiert hat.

BidDesk ist der Ort, an dem diese Liste bepreist wird – vom Meister gemeinsam mit seinem KI-Assistenten.

---

## 2. Der Dienstagabend, wie er heute läuft

*Erzähltes Szenario, keine Messung: Die Personen und Zahlen darin sind typische Größenordnungen aus Praxisberichten, keine erhobenen Daten. Belastbare Zahlen zum Aufwand je Angebot liegen uns bisher nicht vor – wenn wir welche zitieren, dann mit Quelle.*

Andreas Meier hat einen Malerbetrieb mit sechs Leuten. Dienstagmorgen kommt die Mail einer Hausverwaltung: Treppenhaus streichen, Mehrfamilienhaus, vier Etagen. Im Anhang ein PDF mit 46 Seiten. Drei davon sind die eigentliche Arbeit – 14 Positionen. Der Rest sind Vorbemerkungen, Nachweise, Vertragsbedingungen. Abgabe in zehn Tagen.

Meier ist bis 18 Uhr auf der Baustelle. Also setzt er sich abends um acht an den Küchentisch: PDF links, Excel rechts. Er tippt Position für Position ab. Bei „Sockelanstrich Latex bis 1,50 m" hält er an – was hat er dafür letztes Jahr genommen? Er sucht in alten Angeboten, findet das falsche, schätzt schließlich. Dann merkt er, dass zwei der Positionen Bedarfspositionen sind, die gar nicht in die Angebotssumme dürfen. Rechnet neu.

Um halb elf hat er ein Angebot. Er ist nicht sicher, ob er sich irgendwo vertan hat. Er weiß nicht, ob er zu hoch liegt oder zu tief. Er schickt es ab und hört vier Wochen nichts.

Beim nächsten Mal, wenn die Woche voll ist, lässt er es. **Der Betrieb verliert einen möglichen Auftrag, die Verwaltung verliert einen Bieter.** Genau darüber klagt das Handwerk seit Jahren: Ein Schlossermeister berichtete der Deutschen Handwerks Zeitung von 40 Seiten Vorbemerkungen für 20 Meter Geländer; ein Malermeister von Eignungsnachweisen und Fünf-Jahres-Referenzen für schlichte Streicharbeiten.

---

## 3. Derselbe Abend mit BidDesk

Meier bekommt statt des PDFs einen Link. Er öffnet ihn – kein Login, keine Registrierung. Er sieht die Ausschreibung als Tabelle: 14 Zeilen, nicht 46 Seiten. Daneben sein eigenes Preisbuch, also das, was er in den letzten Jahren für vergleichbare Arbeiten genommen hat.

Jetzt sagt er seinem KI-Assistenten – auf Deutsch, in einem Satz:

> „Bepreise das Treppenhaus aus meinem Preisbuch und sag mir, wo du dir unsicher bist."

Und dann passiert das, worauf es ankommt: **Die Tabelle füllt sich auf Meiers Bildschirm.** Nicht im Chat, nicht als Textwüste zum Kopieren – in der Tabelle, Zeile für Zeile, während er zusieht.

- Bei „Sockelanstrich Latex" steht ein Preis und daneben, woher er kommt: aus seinem Angebot Luegallee vom März.
- Bei „Heizkörperlack" steht kein Preis, sondern: *dazu finde ich bei dir nichts Vergleichbares.* Meier trägt ihn selbst ein.
- Unten läuft die Summe mit. Die zwei Bedarfspositionen stehen separat – der Assistent kennt die Regel.

Meier sagt: **„Prüf das mal."** Antwort: Drei Positionen sind noch offen. Eine liegt 40 % über deinem üblichen Preis – sieht nach einem Zahlendreher aus. Deine Unbedenklichkeitsbescheinigung ist älter als sechs Monate. Und die Frist läuft in vier Tagen ab.

Er sagt: **„Frag die Verwaltung, ob das Gerüst vom Dachdecker noch steht."** Die Frage geht raus; die Antwort kommt zurück und ist für alle Bieter sichtbar – so, wie es sich in einem Vergabeverfahren gehört.

Zum Schluss: **„Gib ab."** Und hier bleibt der Assistent stehen. Es öffnet sich ein Fenster mit der Endsumme, und Meier muss selbst klicken. Danach ist die Abgabe-Funktion für den Assistenten schlicht nicht mehr da.

Aus zwei Stunden Abtippen werden zwanzig Minuten Prüfen. Was der Betrieb behält: **die Entscheidung über jeden einzelnen Preis.**

---

## 4. Die andere Seite: die Hausverwaltung

Bei der Verwaltung liegen drei Angebote. Früher: drei PDFs nebeneinander, Positionen von Hand vergleichen.

Jetzt sagt die Sachbearbeiterin: „Vergleich die drei Angebote und sag mir, wer günstig ist, ohne unvollständig zu sein." Sie bekommt einen Preisspiegel – Position für Position, wer wo wie weit abweicht, wer eine Position vergessen hat, wer bei der Vorarbeit auffällig billig und beim Lack auffällig teuer ist.

Vergeben tut sie. Nicht der Assistent.

---

## 5. Was daran neu ist – ohne ein einziges Fachwort

Heute bedienen KI-Assistenten eine Website wie ein Fremder eine **unbeschriftete Maschine**: Sie schauen auf den Bildschirm, raten, wo der richtige Knopf ist, und drücken. Das geht oft gut und gelegentlich furchtbar schief – ein falscher Knopf ist eben auch nur ein Knopf.

**WebMCP dreht das um. Die Website legt dem Assistenten ein beschriftetes Bedienpult hin:**

> „Das hier sind die dreizehn Dinge, die du bei mir tun kannst. Das brauchst du jeweils dafür. Diese acht ändern nichts, die darfst du jederzeit. Und diese eine gibt ein verbindliches Angebot ab – dafür braucht es die Hand eines Menschen."

Dazu kommt der zweite Punkt, der im Video am meisten hermacht: **Mensch und Assistent arbeiten auf demselben Bildschirm.** Kein Hin- und Herkopieren zwischen Chatfenster und Programm. Der Assistent trägt ein, der Mensch korrigiert eine Zeile, der Assistent rechnet mit der Korrektur weiter.

Drei Sätze zur Einordnung, falls jemand fragt:

- WebMCP ist ein **offener Standard** (W3C, vorangetrieben von Google und Microsoft), kein Produkt eines einzelnen Anbieters.
- **ChatGPT** kann das seit Ende August 2026 im eigenen Browser, **Chrome** befindet sich im Testbetrieb, Gemini ist angekündigt.
- Es ist **früh**. Fast keine Website der Welt hat das bisher. Genau das ist der Grund, warum es sich lohnt, jetzt eine zu bauen.

---

## 6. Warum das für unsere Kunden interessant ist

Die Ausschreibung ist nur das Beispiel. Das Muster dahinter ist überall dasselbe, und es passt auf viele Abläufe im Mittelstand:

1. Es gibt eine **Maske mit strukturierten Daten** – Positionen, Mengen, Felder.
2. Es gibt einen **Menschen mit Fachurteil**, der nicht ersetzt werden soll.
3. Am Ende steht eine **verbindliche Handlung**, die niemals allein von einer Maschine ausgelöst werden darf.

Angebotserfassung, Stammdatenpflege, Reklamationsbearbeitung, Bestellvorschläge, Zeit- und Leistungserfassung – überall dasselbe Muster.

Die drei Fragen, die im Kundengespräch die Arbeit machen:

- **Welche Ihrer Masken füllt bei Ihnen jemand abends aus?**
- **Woher kämen die Werte, wenn ein Assistent sie vorschlagen sollte?** (Das ist die Preisbuch-Frage – und meistens die eigentliche Aufgabe.)
- **Welche eine Aktion darf er niemals allein auslösen?**

---

## 7. Was BidDesk nicht ist

Ehrlichkeit hält das Gespräch sauber:

- Es ist eine **Demo**, kein Produkt. Firmen, Preise und Ausschreibungen sind erfunden.
- Es hängt **nicht an echten Vergabeplattformen**. Das wäre der nächste Schritt, nicht dieser.
- Im Hintergrund läuft **kein KI-Modell, das Preise erfindet**. Die Vorschläge kommen aus dem Preisbuch des Betriebs, und zu jedem Vorschlag steht, aus welchem alten Angebot er stammt. Was die KI beisteuert, ist das Zuordnen und Nachrechnen – nicht das Raten.
- Der Assistent gehört dem Nutzer, nicht uns. BidDesk stellt nur die Werkzeuge bereit.

---

## 8. Sätze, die man direkt verwenden kann

**Für die Website:**
> Wir haben eine Ausschreibung so umgebaut, dass der KI-Assistent des Handwerkers sie bepreisen kann – und der Meister trotzdem jeden Preis selbst verantwortet.

**Fürs Kundengespräch:**
> Stellen Sie sich vor, Ihre Software hätte ein beschriftetes Bedienpult für KI-Assistenten. Nicht „die KI klickt sich irgendwie durch", sondern: Diese Dinge darfst du, diese nur mit Unterschrift.

**Für LinkedIn (Aufhänger):**
> Ein Malermeister braucht zwei Stunden, um 14 Zeilen zu bepreisen. Nicht weil er langsam ist – sondern weil die Werte in fünf alten Angeboten stecken. Wir haben in sechs Tagen gebaut, wie das anders geht.
