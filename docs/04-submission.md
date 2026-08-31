# BidDesk – Submission-Checkliste (Devpost)

Deadline Do 03.09.2026 22:00 Berlin. Plan: Mi 02.09. abends einreichen. Alle Materialien auf Englisch.

## Devpost-Felder
- [ ] Project name: **BidDesk**
- [ ] Tagline (≤ ~60 Zeichen): "The agent-ready tender room for building trades"
- [ ] Live URL (funktioniert ohne Login in ChatGPT-Desktop-Browser und Chrome mit Flag)
- [ ] Video-URL (YouTube, öffentlich, < 3:00, Audio)
- [ ] Repo-URL (öffentlich, MIT-Lizenz im About sichtbar)
- [ ] Built with: WebMCP, React, TypeScript, Hono, Cloudflare Workers, D1
- [ ] Bilder: 3–5 Screenshots (Bid-Screen mit Agent Panel, Preisspiegel, Bestätigungsdialog, Tool Inspector)
- [ ] Sponsor-Kategorien anhaken (Cloudflare; Chrome), falls das Formular sie abfragt
- [ ] Teammitglieder (bis 3 für Merch)

## Textbeschreibung – Gerüst (vier Pflichtpunkte, je 1–2 Absätze)

1. **Why WebMCP fits this use case** – Ein Leistungsverzeichnis ist strukturierte Daten (positions, quantities, units). Agenten sollen darauf arbeiten, nicht auf einem 40-seitigen PDF oder einem gescrapten DOM. WebMCP macht die Bepreisung zu benannten, typisierten Werkzeugen mit klaren Grenzen (read-only vs. write, confirmation for submit).
2. **How it improves the user experience** – Kontraktor beschreibt in einem Satz, was er will; Positionen füllen sich live, Vorschläge sind erklärbar (based on price book entry X), Mensch übernimmt/korrigiert Zeile für Zeile; Check statt Bauchgefühl; Frage an den Auftraggeber ohne Kontextwechsel.
3. **Capabilities for humans and agents together** – dieselbe Tabelle, dieselben Store-Aktionen; Agent setzt Preise, Mensch zieht sie zurück (undo), Agent rechnet nach; Abgabe braucht beide (agent proposes, human confirms); Client-Agent vergleicht, Client-Mensch entscheidet.
4. **WebMCP implementation** – 13 Tools (10 bidder, 3 client), imperativ + ein deklaratives Formular; document/navigator-Fallback; annotations (readOnlyHint, untrustedContentHint); kontextabhängige Registrierung mit AbortSignal/toolchange; Live-Log; Evals-Ergebnisse; Security-Modell; Cloudflare Workers + D1 mit Workspace-Isolation.

**Zwei Punkte, die im Write-up nicht fehlen dürfen:** (a) *Provenance* – kein Preis ohne Herkunft aus einer früheren Zeile des Betriebs, bei fehlendem Treffer sagt das Tool das, statt zu schätzen; (b) *deliberately missing tools* – es gibt kein Werkzeug, um das Leistungsverzeichnis zu ändern, nichts zum Löschen, nichts zum Abgeben ohne menschlichen Klick. Beides zeigt Grenzziehung statt fehlender Zeit.

Zusätzlich, entlang der Kriterien: **Impact** (Zielgruppe: Handwerksbetriebe und Hausverwaltungen; Belege nur mit Quelle – aktuell: Praktiker-Aussagen ZDH/DHZ 2022), **Creativity** (kein Shop, kein Pizza-Konfigurator; Multi-Party auf einer Seite), **Execution** (Workspace, Reset, Undo, Dialog, Evals). Kurzer Abschnitt "What's next": GAEB import/export, real public tender feed.

## Video-Skript (Ziel 2:30, englisches Voice-over, KI-Stimme ok)

**Reihenfolge-Prinzip: erst sehen, dann vertrauen, dann rechnen.** Die Zusammenarbeit muss im Bild sein, bevor irgendetwas erklärt wird – „capabilities for humans and agents together" steht wörtlich in den Pflichtangaben. Die Problemgeschichte kostet zu viel Zeit, um vorne zu stehen; der gesparte Abend kommt zum Schluss als Satz, nicht als Szene.

- **0:00–0:15 Hook, ohne Vorrede:** Die Tabelle füllt sich Zeile für Zeile, während eine Hand eine Zeile korrigiert und der Rest weiterläuft. Ein Satz Voice-over: was hier gerade passiert.
- **0:15–0:35 Problem, kurz:** 46-Seiten-PDF neben der Tabelle, Küchentisch, Frist. Warum kleine Betriebe aussteigen.
- **0:35–1:00 Vertrauen:** Herkunfts-Chip zeigen und anklicken (Originalzeile aus dem alten Angebot); die zwei leeren Positionen – „no comparable entry" –, die der Mensch selbst einträgt. Kernsatz: es rät nichts.
- **1:00–1:30 Prüfen und rückfragen:** „Check" bringt offene Positionen, Ausreißer, abgelaufenen Nachweis, Frist. Rückfrage an den Auftraggeber, Antwort für alle sichtbar.
- **1:30–1:45 Grenze:** „Submit" → Bestätigungsdialog, der Mensch klickt; danach ist das Tool für den Agenten weg.
- **1:45–2:00 Zweiter Akt:** Rollenwechsel zum Auftraggeber, Preisspiegel per Prompt.
- **2:00–2:15 Chrome + Tool Inspector:** Tool-Liste, Annotations, ein manueller Aufruf.
- **2:15–2:30 Abbinder:** Architektur in einem Bild, Standard-Einordnung, „built in 6 days for the WebMCP Challenge".
- Aufnahme: OBS oder Windows-Spielleiste, 1080p, Cursor sichtbar; Schnitt DaVinci/Clipchamp; Voice-over-Text vorher schreiben (Cowork).

## README-Anforderungen
- [ ] "How to test in 60 seconds" (Chrome-Flag, ChatGPT-Desktop, 5 Prompts)
- [ ] Tool-Tabelle (Name, Rolle, readOnly, Beschreibung)
- [ ] Architektur-Skizze
- [ ] Eval-Ergebnisse
- [ ] Security-Modell
- [ ] Prior work statement: "Built from scratch during the submission period (Aug 28 – Sep 3, 2026)."
- [ ] Lizenz: MIT (LICENSE-Datei im Root)

## Vor dem Absenden
- [ ] Frischer Browser, frischer Workspace: Prompts 1–5 in ChatGPT-Desktop, dann in Chrome
- [ ] Zweite Person testet nur mit README
- [ ] Video öffentlich, Untertitel optional
- [ ] Repo: keine Secrets, `.dev.vars` ignoriert, Lizenz im About erkannt
- [ ] Devpost-Formular vollständig, Vorschau geprüft, **Submit** (nicht nur Save)
