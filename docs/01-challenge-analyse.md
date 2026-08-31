# WebMCP Challenge – Analyse & Brainstorming

Stand: Freitag, 28.08.2026 (Quelle: webmcp.devpost.com, Rules, Resources; Chrome-Docs; WebMCP-Spec; OpenAI-Ankündigungen 26./27.08.2026)

## 1. Eckdaten

- Veranstalter: OpenAI (über Devpost). Co-Sponsoren: Cloudflare, Vercel, Shopify, Google Chrome, Render, Netlify.
- Einreichungszeitraum: 25.08.2026 11:00 PT bis **03.09.2026 13:00 PT = Donnerstag, 03.09.2026, 22:00 Uhr Berlin**.
- Judging: 04.–21.09.2026. Gewinner: ca. 23.09.2026.
- Registrierte Teilnehmer: 2.853 (Stand 28.08.). Realistisch reichen erfahrungsgemäß 10–25 % davon tatsächlich ein.
- Preise: **Top 10** je 3.000 $ Cash + Codex Micro + 1 Jahr ChatGPT Pro + Merch (bis 3 Teammitglieder) + **Spotlight auf @OpenAIDevs**. Sponsorpreise zusätzlich: Cloudflare 10.000 $ Credits, Vercel 3.600 $ + 600 $ Credits, Netlify 500 $ Cash, Render 300 $ Credits, Shopify Limited-Edition-Gear, Chrome 3 Monate Google AI Ultra.
- Ausschluss: Belarus, Brasilien, China, Russland, Hongkong u. a. – Deutschland ist teilnahmeberechtigt.

## 2. Pflichtabgaben (Rules)

1. **Live-URL**, die Juroren im ChatGPT-Desktop-Browser oder in Chrome mit `chrome://flags/#enable-webmcp-testing` testen können. Auth ist erlaubt, aber optional (besser ohne – jede Reibung kostet Punkte).
2. **Textbeschreibung** mit vier Pflichtpunkten: (a) Warum WebMCP zum Use-Case passt, (b) wie es die User Experience verbessert, (c) welche Fähigkeiten für **Menschen und Agenten gemeinsam** entstehen, (d) Implementierungsdetails.
3. **Demo-Video** unter 3 Minuten, öffentlich auf YouTube, mit Audio; muss das laufende Projekt und die WebMCP-Nutzung zeigen.
4. **Öffentliches Repo** (GitHub/GitLab/Bitbucket) mit allem Code, Assets, Anleitung und einer **OSS-Lizenzdatei**, die im "About"-Bereich erkannt wird.
5. Alle Materialien auf **Englisch** (oder mit englischer Übersetzung).
6. Projekt muss im Zeitraum neu entstanden sein **oder** ein Bestandsprojekt "meaningfully extended using WebMCP" nach dem 25.08. – dann mit klarer Doku alt/neu.
7. Mehrere Einreichungen pro Person erlaubt, müssen sich substanziell unterscheiden.
8. IP: eigenes Werk, keine Rechte Dritter; Sponsor bekommt nur Lizenz zur Bewertung.

## 3. Bewertung – vier Kriterien, gleich gewichtet

1. **WebMCP Leverage** – "How thoroughly and skillfully does the project use WebMCP? Does the code reflect genuine effort and a working, non-trivial implementation?"
2. **Execution** – "a working or runnable project that has a complete, coherent product experience — not just a technical proof of concept"
3. **Potential Impact** – "a credible, specific case for solving a real problem for a real audience"
4. **Creativity & Ambition** – "How creative and novel is the concept and does the project differ from existing concepts?"

Jury: Andrew Galloni (Cloudflare), Alex Nahas (Erfinder von MCP-B, dem Vorläufer von WebMCP), Ilya Grigorik (Shopify), Jude Gao (Vercel/Next.js Core), Justin Rushing (OpenAI Browser Platform Lead), Sarah Drasner (Chrome), Sean Roberts (Netlify).

Lesart: Zwei Juroren sind Commerce-/Hosting-lastig, einer ist der WebMCP-Purist (Nahas), einer bewertet die ChatGPT-Browser-Erfahrung (Rushing), eine bewertet Web-Standard-Sauberkeit (Drasner). Commerce-Demos (Shop, Warenkorb) werden das häufigste Einreichungsmuster sein – dort ist Differenzierung am schwersten.

## 4. Technischer Stand WebMCP (relevant für "Leverage")

- Spec: W3C Web Machine Learning CG, Draft Report (Google + Microsoft als Editoren), nicht auf dem Standards-Track, API bewegt sich zwischen Drafts.
- **Seit dem Draft vom 21.07.2026 liegt die API unter `document.modelContext`**; `navigator.modelContext` ist deprecated, wird im Chrome-Origin-Trial (Chrome 149–156) aber noch bedient. → Beides unterstützen (Feature-Detection), das zeigt Spec-Kenntnis.
- Imperative API: `registerTool({ name, title, description, inputSchema, execute, annotations: { readOnlyHint, untrustedContentHint } }, { exposedTo, signal })`, dazu `getTools()`, `executeTool()`, Event `toolchange`.
- Deklarative API (Formular-Attribute wie `toolname`/`tooldescription`) ist im Spec noch "TODO", Chrome unterstützt sie bereits (Demo "Le Petit Bistro").
- Nur in origin-isolierten Dokumenten verfügbar; Permissions-Policy `tools` (Default `self`); Cross-Origin-iframes brauchen `allow="tools"`.
- Werkzeuge: Chrome "Model Context Tool Inspector" Extension, DevTools-Panel für WebMCP, **WebMCP Evals** (Testframework), Lighthouse hat seit 05/2026 Agentic-Browsing-Audits.
- **ChatGPT-Desktop-Browser**: WebMCP-Support seit ~26.08.2026 (ChatGPT Work/Codex + ChatGPT Sites). Laut Search Engine Journal (27.08.): nur mit GPT-5.6 Sol/Terra, nicht in Enterprise/Edu-Workspaces; Pfeil in der Adressleiste zeigt verfügbare Tools; Bestätigung vor sensiblen Aktionen.
- Realität laut Branchenblogs (Spronta, 07/2026): Adoption "approximately zero", noch kein Mainstream-Agent außer jetzt ChatGPT-Desktop; Gemini in Chrome angekündigt. → Die Jury sucht nach dem Beweis, dass WebMCP ein echtes Problem löst – nicht nach einem weiteren Pizza-Konfigurator.

Starter/Referenzen: Cloudflare `agents/examples/webmcp-react` (React + Vite + Hook, Workers-Deploy), Vercel `vercel/shop`, Google `webmcp-tools/demos`, Netlify Starter, npm `use-webmcp-tool`, Angular `angular.dev/ai/webmcp`, Google `modern-web-guidance` (WebMCP-Skill für Coding-Agents – direkt in Claude Code nutzbar).

## 5. Was eine Top-10-Einreichung ausmacht (These)

Bei geschätzt 300–600 Einreichungen und 7 Juroren mit ~2,5 Wochen Zeit gewinnt, wer in 60 Sekunden überzeugt und bei genauem Hinsehen Tiefe zeigt.

1. **Echte Domäne, echte Zielgruppe** – Kunden aus Bau/Handwerk/Immobilien/IT-Häusern sind ein Trumpf, den 90 % der Teilnehmer nicht haben. Nur validierte Aussagen verwenden (keine erfundenen Zahlen).
2. **Werkzeugtiefe statt Werkzeugzahl**: 8–15 Tools mit sauberen JSON-Schemas, `readOnlyHint` für Lese-Tools, Bestätigungsschritt für schreibende/destruktive Aktionen, `untrustedContentHint` für nutzergenerierte Inhalte, kontextabhängige Registrierung (`toolchange`, AbortSignal), imperativ + deklarativ gemischt.
3. **"Mensch und Agent gemeinsam" sichtbar machen**: UI aktualisiert sich live, wenn der Agent Tools aufruft; der Mensch kann eingreifen (Drag & Drop, Korrektur), der Agent arbeitet mit dem neuen Zustand weiter. Ein Tool wie `get_current_state` macht den Agenten zustandsbewusst.
4. **Agent-Panel auf der Seite**: Live-Log der Tool-Aufrufe, Liste der Tools, 3–5 Beispiel-Prompts zum Kopieren. Juroren sehen sofort, was sie tun sollen.
5. **Null Reibung**: kein Login, vorbefüllte Demo-Daten, Reset-Button, funktioniert in ChatGPT-Desktop **und** Chrome (beides testen!). README mit "How to test in 60 seconds".
6. **Sicherheit im Write-up**: Prompt-Injection-Grenzen, Permissions-Policy, warum welche Tools bestätigungspflichtig sind. Verweis auf Chrome "secure-tools"-Guide.
7. **Eval-Ergebnisse veröffentlichen** (WebMCP Evals) – kaum jemand macht das; starkes Leverage-Signal.
8. **Video 2:30**: 20 s Problem → 90 s Demo im ChatGPT-Desktop-Browser (Pfeil in Adressleiste, Bestätigungsdialog) → 20 s Chrome + Tool Inspector → 30 s Architektur/WebMCP-Details. Englische Stimme (KI-Voice-over ok).
9. **Cloudflare-Deploy** (Workers + D1 + R2): bestehender Stack, Cloudflare-Juror, größter Sponsorpreis.
10. **Mittwochabend einreichen**, nicht Donnerstag 22:00.

## 6. Ideen-Longlist

| # | Arbeitstitel | Kern | Leverage | Exec-Risiko | Impact | Kreativ | Marketingwert |
|---|---|---|---|---|---|---|---|
| A | **Handwerk Direkt** | Agent-ready Handwerksbetrieb: strukturierte Anfrage mit Fotos, Grobschätzung, Terminbuchung, Statusabfrage; Betriebsseite mit Dispo-Board | hoch | niedrig | hoch | mittel (Form+Booking ist das Standard-Demo-Muster) | hoch |
| B | **Baustellen-Koordinator** | Gemeinsames Gewerke-Terminboard mit Abhängigkeiten (Rohbau→Elektro→Trockenbau→Maler); Bauleiter und Gewerke lassen ihre Agenten Slots prüfen, vorschlagen, verschieben; Konfliktprüfung, Änderungsprotokoll | sehr hoch | mittel | hoch | hoch (Multi-Party-Koordination auf einer Seite) | sehr hoch |
| C | **E-Rechnung Werkbank** | XRechnung/ZUGFeRD aus Freitext oder Leistungsnachweis entwerfen, live validieren, visualisieren, exportieren | hoch | niedrig | hoch (Pflicht ab 2027/28) | hoch (einzig im Feld) | mittel (Zielgruppe breit, aber trocken) |
| D | **Mieterportal / Schadensmeldung** | Mieter-Agent meldet Schaden (Foto, Dringlichkeit), Handwerker-Termin, Status; Verwalter-Dashboard mit Triage-Tools | hoch | niedrig | mittel-hoch | mittel | hoch (Immobilien-Kunden) |
| E | **Bautagebuch** | Tagesberichte per Agent (Wetter, Personal, Fortschritt, Fotos), PDF-Export – baut auf Documentation-Agent-Erfahrung (D1/R2) auf | mittel | niedrig | mittel | niedrig-mittel | hoch |
| F | **Agent-ready KI-Reifegrad-Check** | MERKUR-Website: Besucher-Agent führt Assessment mit vorhandenem Firmenkontext durch, erzeugt Report, bucht Gespräch | mittel | niedrig | niedrig-mittel (Jury-Sicht) | mittel-hoch ("Beratung, die dein Agent konsultiert") | sehr hoch (direktes Lead-Gen) – Kandidat für Zweit-Einreichung |
| G | **B2B-Angebotskonfigurator Lichttechnik** | CPQ-lite mit Kompatibilitätsregeln, Agent konfiguriert, Mensch korrigiert, PDF-Angebot | hoch | mittel | mittel | niedrig (Commerce-Lane überfüllt) | mittel |
| H | **IT-Systemhaus-Kundenportal** | Tickets, Lizenzen, Status per Agent | mittel | niedrig | mittel | niedrig | mittel |

## 7. Empfehlung

**Favorit: B – Baustellen-Koordinator.** Beste Kombination aus Neuartigkeit (Multi-Party-Agenten-Koordination auf einer gemeinsamen Seite), glaubwürdigem Problem (Bauzeitverzögerung durch Gewerke-Abstimmung) und direktem Marketingnutzen für Bau-/Handwerkskunden. Zeigt "Mensch + Agent gemeinsam" am deutlichsten: Der Agent verschiebt einen Termin, das Board zeigt live die Folgekonflikte, der Bauleiter zieht per Drag & Drop, der Agent rechnet nach. Passt zur Paket-03-Erzählung ("fokussierte Anwendung ohne Schnickschnack").

Tool-Skizze (12 Tools): `get_project_state` (readOnly), `list_trades`, `list_tasks` (Filter), `get_dependencies`, `check_availability`, `propose_schedule` (readOnly, liefert Vorschlag + Konflikte), `apply_schedule` (schreibend, Bestätigung), `move_task` (schreibend, mit Folgeanalyse), `add_note` (untrustedContent), `report_delay`, `export_ics`, `get_change_log`. Deklarativ: einfaches Formular "Verzögerung melden".

**Sicherer Plan B: A – Handwerk Direkt** (geringstes Ausführungsrisiko, aber muss über Formular-Ausfüllen hinausgehen: Fotos, Schätzlogik, Zwei-Seitigkeit).

**Wildcard: C – E-Rechnung Werkbank** (niemand sonst baut das; Risiko, dass die Jury es nicht "fühlt").

**Zweit-Einreichung (nur bei Zeitreserve): F** – klein, direkt für MERKUR nutzbar.

## 8. 6-Tage-Plan (Deadline Do 03.09., 22:00)

- **Fr 28.08.**: Richtung entscheiden. Konzept: Datenmodell, Screens, Tool-Liste mit Schemas. Repo + Cloudflare-Scaffold (webmcp-react-Template). Chrome-Flag + Tool Inspector einrichten. ChatGPT-Desktop-Browser auf WebMCP prüfen.
- **Sa 29.08.**: Kern-App: UI, Datenmodell (D1), Seed-Daten, Reset.
- **So 30.08.**: Alle WebMCP-Tools, Agent-Panel (Live-Log, Prompts), document/navigator-Fallback, Annotations.
- **Mo 31.08.**: Tests in ChatGPT-Desktop + Chrome, WebMCP Evals, Security-Härtung, Polish, DE/EN-Umschaltung.
- **Di 01.09.**: Video (Skript, Aufnahme, Schnitt), Textbeschreibung, README, Lizenz (MIT/Apache-2.0).
- **Mi 02.09.**: Puffer, Fremdtest durch eine zweite Person, Einreichung am Abend.
- **Do 03.09.**: nur Notfallkorrekturen.

Arbeitsteilung analog @selbstehrlich: Technik über Claude Code (mit Google-`modern-web-guidance`-Skill), Konzept/Text/Video über Cowork; gemeinsames Gedächtnis in CLAUDE.md und docs/.

## 9. Marketing-Verwertung (unabhängig vom Ergebnis)

- Build-in-public auf LinkedIn (3–4 Posts DE): Entscheidung, Bauphase, Einreichung, Learnings.
- Case-Seite "Agent-ready Anwendungen" auf merkur-impulse.com mit Video (DE-Fassung des Demo-Videos für Kundengespräche).
- Einstiegsprodukt: "Agent-Readiness-Check für Ihr Kundenportal / Ihre Website" als Brücke in Paket 02/03.
- Positionierung: WebMCP ist ein **offener Standard** (W3C CG, Google/Microsoft), herstellerneutral – heute nutzbar mit ChatGPT-Desktop und Chrome, Gemini in Chrome angekündigt. Claude ist laut Branchenstand (07/2026) noch kein WebMCP-Konsument – ehrlich so kommunizieren, passt zur Partner-Neutralität.
- Bei Top 10: Spotlight @OpenAIDevs + Pressemitteilung an regionale Wirtschaftspresse (Düsseldorf/NRW) + Kundennewsletter.

## 10. Offene Fragen

1. Richtung: B, A, C oder etwas anderes?
2. Zeitbudget bis Donnerstag (Stunden/Tag), allein oder mit Verstärkung?
3. Ist ChatGPT Desktop (Plus/Pro/Team, GPT-5.6 Sol/Terra) verfügbar, um den Juroren-Pfad selbst zu testen?
4. Stack-Annahme: Cloudflare Workers + D1 (+ R2 für Fotos), React + Vite. Einverstanden?
