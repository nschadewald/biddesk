# Seed-Daten für BidDesk

Fertig zum Einspielen. **Quelle der Wahrheit ist `seed.json`** – `schema.sql`, `seed.sql` und die GAEB-Datei werden daraus erzeugt. Wenn sich etwas ändert: `seed.json` anfassen, dann `python3 build_outputs.py`, dann `python3 verify_seed.py`.

| Datei | Zweck |
|---|---|
| `seed.json` | Alle Inhalte, zweisprachig. Massgeblich. |
| `schema.sql` | D1-Schema (SQLite). Jede Tabelle hat `workspace_id`. |
| `seed.sql` | Alle INSERTs. **`{{WS}}` vor dem Ausführen durch die Workspace-ID ersetzen.** |
| `gaeb/T-2026-014.x83` | GAEB-DA-XML-Beispieldatei für den Import am Mittwoch. |
| `build_outputs.py` | Erzeugt schema/seed/GAEB aus `seed.json`. |
| `verify_seed.py` | Prüft alles. Muss „ALLES GRUEN" sagen. |

Einspielen (Beispiel):

```bash
wrangler d1 execute biddesk --file=seed/schema.sql
sed 's/{{WS}}/<workspace-id>/g' seed/seed.sql > /tmp/seed-ws.sql
wrangler d1 execute biddesk --file=/tmp/seed-ws.sql
```

## Inhalt

3 Ausschreibungen (25 Positionen), 3 Bieter, 34 Preisbuch-Einträge, 3 abgegebene Angebote, 2 Rückfragen. Alle Firmen, Projekte und Preise sind **erfunden** – keine Marktdaten.

- **T-2026-014 Malerarbeiten Treppenhaus, Rheinallee 12** – Haupt-Demo, 14 Positionen, 2 Bedarfspositionen.
- **T-2026-015 Kellergang, Kaiserswerther Str. 88** – 6 Positionen, damit `list_tenders` etwas zu filtern hat.
- **T-2026-009 Fassade, Luegallee 40** – abgeschlossen, 3 abgegebene Angebote. Füttert den Preisspiegel sofort, ohne dass ein Juror erst etwas abgeben muss.

Bieter: **B-A Farbwerk Meier GmbH** (Demo-Bieter), B-B Malerei Brandt & Sohn (Premium, vollständig), B-C Colorpoint Anstrich UG (günstig, grosse Lücken).

## Die drei bewusst gesetzten Szenen

1. **Zwei Lücken bei B-A** – Position `03.04` (Heizkörper, metal/St) und `04.02` (Stundenlohn, labour/h). Farbwerk Meier hat für diese Kombination aus Kategorie und Einheit keinen Eintrag. `suggest_prices` liefert dort `confidence: none` und **keinen Preis**. Das ist die Kernszene des Videos: Alles füllt sich, zwei Zeilen bleiben stehen, der Mensch trägt sie ein. `verify_seed.py` prüft, dass es genau diese zwei sind – nicht mehr, nicht weniger.
2. **Ein abgelaufener Nachweis bei B-A** – die Unbedenklichkeitsbescheinigung ist seit 20 Tagen ungültig. Das ist der Fund von `check_bid`.
3. **Ein Ausreisser im Preisspiegel** – B-C hat bei T-2026-009 Position `01.01` (Gerüst) 27,80 € statt rund 11–13 €, also gut das Doppelte. Damit zeigt der Preisspiegel sofort etwas.

## Zwei Dinge, die den Demo-Tod verhindern

- **Fristen sind relativ.** `seed.sql` schreibt `date('now','+10 day')`, nicht ein festes Datum. Die Jurierung läuft bis zum 21.09. – ein fest verdrahteter Abgabetermin am 10.09. wäre in der zweiten Woche abgelaufen und `check_bid` hätte allen Juroren „Frist überschritten" gemeldet. Bitte nicht auf feste Daten umstellen.
- **Nachweis-Gültigkeiten ebenfalls relativ**, aus demselben Grund.

## Regel für `suggest_prices` (Stand 31.08.)

**Kategorie UND Einheit müssen übereinstimmen, sonst kein Vorschlag.** Konfidenz danach über Keyword-Überschneidung: `high` ab 2 Treffern, `medium` bei 1, `low` bei 0. Kein Rückfall auf „nur Einheit passt" – dabei wäre für „Heizkörper lackieren" der Türenpreis von 148 € vorgeschlagen worden, also genau der geratene Wert, den das Produkt nie liefern soll. `verify_seed.py` enthält die Regel als ausführbare Referenz.

## Zur GAEB-Datei

`gaeb/T-2026-014.x83` ist eine **handgebaute, strukturtreue Probe** im Format GAEB DA XML 3.2 (DA83) – Namensraum, `GAEBInfo`, `PrjInfo`, `Award/AwardInfo`, `BoQ/BoQBody/BoQCtgy/Itemlist/Item` mit `Qty`, `QU` und `Description/CompleteText`. Sie ist **kein Export aus einem zertifizierten AVA-Programm**. Zwei Konsequenzen:

- Den Importer **defensiv** schreiben: nach Elementnamen suchen, nicht auf strikte Reihenfolge oder vollständige Schema-Gültigkeit bauen.
- Die Kennzeichnung der Bedarfsposition steht als `<Provis>Yes</Provis>` im `Item`. Diese Schreibweise ist nicht sicher verifiziert. Der Importer soll deshalb **zwei Signale akzeptieren**: das `Provis`-Element oder die Zugehörigkeit zur Kategorie `04`. Für das Video reicht das; für eine Produktaussage müsste eine echte Exportdatei gegengeprüft werden.

Einheiten sind im GAEB deutsch (`St`, `psch`), im Datenmodell englisch (`pcs`, `psch`) – die Zuordnung steht in `build_outputs.py`.
