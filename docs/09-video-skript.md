# Videoskript (Ziel 2:40, hart unter 3:00, englisches Voice-over) — Fassung Mi 02.09., 12:30

**Reihenfolge-Prinzip: erst sehen, dann vertrauen, dann den Weg zeigen, dann die Grenze.**
Die Zusammenarbeit muss im Bild sein, bevor irgendetwas erklärt wird. Neu gegenüber dem Entwurf
vom Morgen: Die Stelle, an der der Meister früher selbst tippen musste, ist jetzt der zweite
Höhepunkt — der Agent legt den Wert an die Zeile, der Mensch klickt. Dasselbe beim Nachweis.
Aufnahme im ChatGPT-Desktop-Browser, Fenster so breit, dass Tabelle und Agent-Panel
nebeneinander stehen. Frischer Workspace. Cursor sichtbar. Oberfläche auf **Englisch**.

---

## 0:00–0:15 · Hook, ohne Vorrede
**Bild:** Prompt 1 ist abgeschickt. Die Tabelle füllt sich gestaffelt von oben nach unten, Chips
erscheinen, die Summenleiste klettert. Eine Hand korrigiert *währenddessen* eine Zeile.
**VO:** "This is a German construction tender — fourteen line items a painting firm has to
price. Watch the table fill in. And watch what stays empty."

## 0:15–0:30 · Das Problem, kurz
**Bild:** Kurzer Schnitt auf das 46-Seiten-PDF neben der Tabelle, dann zurück.
**VO:** "Normally this is an evening at the kitchen table: a forty-six-page PDF, three pages of
which are the actual job, and the prices scattered across last year's quotes. Many small firms
skip tenders for exactly this reason."

## 0:30–0:50 · Vertrauen — die Herkunft
**Bild:** Auf einen Chip zoomen: „from your quote · Luegallee 40 · March 2026". Anklicken:
„the line you priced back then", die Originalzeile. Dann auf 03.04 und 04.02 — leer,
„no comparable entry".
**VO:** "Every price the agent wrote points back to a line in this firm's own price book — the
project, the date, the original item. And where the firm has never priced radiators, the agent
doesn't guess. It leaves the cell empty and says so."

## 0:50–1:15 · Der Weg — der zweite Höhepunkt
**Bild:** Prompt: *"Set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my
rate."* Im Log: `set_unit_price` · **AWAITING CONFIRMATION** · *waiting for a person*. An der
Zeile erscheint die kleine Bestätigung: „61,00 € × 4 pcs = 244,00 €", darunter „not from your
price book — you are setting this price yourself", darunter die Herleitung. Der Mensch klickt
**Confirm**. Die Zeile zeigt „set by you · 4 radiators × 25 min at my rate" — **kein Chip**.
Summe springt auf 13.457,50 €.
**VO:** "The agent can't write that number — it has no source for it. So it doesn't refuse, and
it doesn't pretend. It puts the price on the row, with its reasoning, and waits. The click is
his. Recorded as his — no chip, because it didn't come from the record. No authority of its own
means confirmation, not a dead end."

## 1:15–1:40 · Prüfen — und der dritte Weg
**Bild:** Prompt 3: *"Run a check on my bid — anything that looks off?"* Prüfergebnis: ein
Befund zur offenen Bedarfsposition, ein Ausreißer, **die abgelaufene Unbedenklichkeits-
bescheinigung in Rot**, Tage bis zur Frist. Jeder Befund mit seinem Handlungssatz.
**VO:** "Then: check the bid. An outlier against the firm's own history, a tax clearance
certificate that expired three weeks ago. The only red in the whole app — and next to each
finding, what to do about it."
**Bild:** Prompt: *"My new tax clearance certificate is valid until 15 August 2027."* Im
Check-Panel am roten Befund die Bestätigung: „12 Aug 2026 → 15 Aug 2027 · You confirm that a
certificate valid until 15 Aug 2027 exists. Nothing is uploaded or checked here." Klick. Der
Befund verschwindet.
**VO:** "Same pattern, different fact. Nothing is uploaded, nothing is verified — the page says
so in plain words. A person states it, a person confirms it, and the check goes quiet."
**Bild:** Prompt 4, Rückfrage erscheint in der Liste. Kurz.
**VO:** "A question to the client goes out from the same page, visible to every bidder."

## 1:40–1:55 · Die Grenze
**Bild:** Prompt 5. Der Agent liefert eine Zusammenfassung und hält an. Der Abgabedialog mit
der Endsumme — das einzige Modal im ganzen Video. Der Mensch klickt. Banner, Tabelle gesperrt.
**Bild:** Kurz auf die Selbstdiagnose: **11 → 10** Werkzeuge.
**VO:** "Submitting is binding, so the agent stops. It prepares, it summarises — a person
clicks. And afterwards the tool is gone from the agent's repertoire: eleven tools before, ten
after."

## 1:55–2:10 · Zweiter Akt
**Bild:** Rollenwechsel zum Auftraggeber. Offene Ausschreibung: Zähler 2 → 3, versiegelt.
Dann der Preisspiegel der geschlossenen Fassaden-Ausschreibung mit dem markierten Ausreißer.
**VO:** "The client sees the bid arrive — but not its prices. Sealed until the deadline, for
their agent too. On a closed tender, the full comparison: position by position, one bidder's
scaffolding at twice the median."

## 2:10–2:25 · Beweis
**Bild:** ChatGPTs eigene Werkzeugansicht (**„11 tools · 5 with write access"**), dann Chrome
ohne Flag mit der grünen Selbstdiagnose, dann kurz die Eval-Tabelle im README.
**VO:** "Thirteen tools — eleven for the contractor, five for the client. Read-only where it
reads, a confirmation wherever it commits. Eight eval cases, and the ones that matter most test
what the agent must not do on its own: fill a gap, write without a source, hand in."

## 2:25–2:40 · Abbinder
**Bild:** Architektur in einem Bild: Browser-Agent → Tools → Worker + D1. Darunter der Satz.
**VO:** "No model in the backend. The intelligence is the user's own agent; the site only
offers tools. And no price enters a bid without either a traceable source in this firm's own
history — or a person's hand on that exact value."

## Optionaler Beat (nur wenn unter 2:45, sonst weglassen)
**Bild:** Eine GAEB-X83-Datei wird auf die Seite gezogen, eine neue Ausschreibung entsteht.
**VO:** "And this is where a tender actually comes from: a GAEB file out of the client's
tendering software. Dragged in, priced with the same tools."

---

## Für den Aufnehmenden — bitte zuerst lesen

**Was aufgenommen wird:** https://biddesk.n-schadewald.workers.dev im **ChatGPT-Desktop-Browser**
(nicht Chrome, nicht extern). Modell **5.6 Sol** oder Terra — bei Luna ist WebMCP deaktiviert,
und dann fehlt auch die Frage nach dem Arbeitsmodus.

**Der Handoff.** ChatGPT fragt einmal nach dem Arbeitsmodus. **Annehmen.** Wird er abgelehnt,
verweigert ChatGPT für den Rest der Unterhaltung und die Seite sieht funktionslos aus, obwohl
alles korrekt läuft. Abhilfe: neue Unterhaltung. Kommt die Frage gar nicht: Modell prüfen.

**Vor jeder Aufnahme:**
1. „Reset demo" im Agent-Panel drücken — Tabelle leer, Summe 0,00 €, Log leer.
2. Sprache auf **English** (Kopfzeile). Das Video ist für die Jury; die deutsche Fassung kommt
   nach der Einreichung.
3. Fensterbreite prüfen: Tabelle und Agent-Panel müssen **nebeneinander** stehen, ohne
   Überlappung (ab ca. 1240 px). Darunter klappt das Panel weg und die halbe Aussage fehlt.
4. Die grüne Zeile oben rechts muss „WebMCP detected · **11** tools registered" sagen. Sagt
   sie das nicht, ist der Browser falsch oder der Stand alt — nicht aufnehmen.
5. ChatGPTs Werkzeugansicht (Pfeil in der Adresszeile) muss **11 · 5 mit Schreibzugriff**
   zeigen. Zeigt sie 9 oder 10, ist der Stand alt — nicht aufnehmen.
6. Nach einem Deploy 15 Sekunden warten, sonst laufen Aufrufe ins Leere.

**Was zwingend im Bild sein muss**, sonst fehlt der Beweis: die grüne Selbstdiagnose mit der
Werkzeugzahl · das Live-Log rechts während der Aufrufe, einschließlich **AWAITING
CONFIRMATION** · die Herkunfts-Chips mit „from your quote" · die zwei leeren Zeilen mit „no
comparable entry" · **die Bestätigung an der Zeile** bei 03.04 und danach „set by you" ohne Chip
· **die Bestätigung im Check-Panel** beim Nachweis und der verschwindende rote Befund · der
Abgabedialog · die Werkzeugzahl **nach** der Abgabe (11 → 10) · ChatGPTs eigene Werkzeugansicht.

**Nicht wegschneiden:** das gestaffelte Einlaufen der Zeilen bei Prompt 1, und die Sekunde
zwischen „AWAITING CONFIRMATION" im Log und dem Klick. Beides ist die Kernaussage in Bewegung.

**Die drei Sätze, wörtlich** (der Agent soll die Kette selbst wählen — nicht nachhelfen):
- *"Set 03.04 to 61 euros — four radiators, twenty-five minutes each, at my rate."*
- *"My new tax clearance certificate is valid until 15 August 2027."*
- *"Submit the bid."*

**Freeze-Regel, wichtig:** Die Oberfläche darf sich zwischen Aufnahme und Einreichung nicht
mehr ändern, sonst zeigt das Video ein anderes Produkt als die Live-URL. Stand für diese
Aufnahme: nach CC-06 (Textpass), Commit-Hash in `notes/prompts/README.md`.

## Produktionshinweise
- **Sicherungsaufnahme zuerst:** einmal ungeschnitten komplett durchlaufen und mitschneiden,
  bevor geschnitten wird.
- Aufnahme 1080p, OBS oder Windows-Spielleiste. Schnitt Clipchamp/DaVinci.
- Voice-over: englischer Text vorher einsprechen oder KI-Stimme; Tempo ruhig, keine Musik über
  den Sprechstellen.
- YouTube: öffentlich, unter 3:00, Titel "BidDesk — an agent-ready tender room (WebMCP Challenge)".
