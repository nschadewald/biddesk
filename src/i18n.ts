import { useAppState } from "./store";
import type { Language } from "./types";

/**
 * Every visible string in the application, in both languages.
 *
 * Why a dictionary and not a ternary per string: a German painter is the
 * audience and an English-speaking jury is a special case of it, so a screen
 * built after this one has to inherit the second language for free. Scattered
 * ternaries rot at the first new screen -- somebody adds one string in English
 * "for now" and the German half is quietly incomplete. Here it cannot be: `de`
 * is typed as `typeof en`, so a missing key is a compile error rather than
 * something noticed during a demo.
 *
 * What is deliberately NOT in here:
 *   - tool names, descriptions, schemas and results (src/webmcp/tools.ts). An
 *     agent reads English, a person reads their own language. The only parts of
 *     a tool result that follow the language are the position texts and the
 *     document labels, and the Worker resolves those -- not the client.
 *   - the live log rows: they print what a tool sent and received, so they are
 *     tool data and stay English.
 *   - /how-to-test, which is written for the jury.
 *   - amounts and quantities. 13.213,50 EUR reads the same in both languages,
 *     see src/format.ts.
 *
 * The German half addresses the reader as Sie, never du -- house rule, and a
 * test in i18n.test.ts holds the line.
 */

const en = {
  header: {
    actingAs: "Acting as",
    roleBidder: "Contractor",
    roleClient: "Client",
    biddingAs: "Bidding as",
    language: "Language",
    howToTest: "How to test in 60 seconds",
    views: "Screen",
    viewBid: "Bid",
    viewPriceBook: "Price book"
  },

  app: {
    loadingTender: "Loading tender…",
    loadFailed: "Could not load the tender."
  },

  bid: {
    meta: (id: string, client: string, city: string, positions: number, due: string) =>
      `${id} · ${client} · ${city} · ${positions} positions · due ${due}`,
    submittedBanner: "Submitted. The prices are locked and cannot be changed.",
    netTotal: "Net total",
    contingencyTotal: "Contingency positions",
    priced: "Priced",
    pricedValue: (done: number, total: number) => `${done} of ${total}`,
    applyAll: (n: number) => `Apply all suggestions (${n})`,
    checkBid: "Check bid",
    undo: "Undo",
    submitBid: "Submit bid",
    columnItem: "Item",
    columnDescription: "Description",
    columnQuantity: "Qty",
    columnUnit: "Unit",
    columnUnitPrice: "Unit price",
    columnTotal: "Total",
    // Says where this is set. The names, streets and firms in the seed are
    // German because the case is: a German public tender runs on GAEB files,
    // VOB rules and a tax clearance certificate. Without this line, German
    // proper nouns beside English position texts read as a half-finished
    // translation. It also puts the "everything here is invented" notice on
    // the screen, where it used to live only in the README.
    scene: "A German public tender (VOB/GAEB). Names, prices and firms are invented."
  },

  row: {
    contingency: "contingency",
    unitPriceFor: (oz: string) => `Unit price for ${oz}`,
    use: "Use",
    // What the chip IS, in words. The whole product claim rests on this value
    // being a real past quote of this firm's -- and before, the chip only said
    // "Luegallee 40 · March 2026", which you had to already know to read.
    //
    // Two parts because the chip sets them on two lines. A single string wrapped
    // where the column happened to end: four ragged lines in German, three in
    // English. Same words, same order, a line break where the middle dot was.
    chipLead: "from your quote",
    chipWhere: (project: string, month: string) => `${project} · ${month}`,
    originalLine: "the line you priced back then",
    noComparableEntry: "no comparable entry",
    // A price with no source is a person's price. Said on the row, so the three
    // states of section 13.3 stay apart: chip, plain text, empty.
    setByYou: "set by you",
    // The confirmation an agent's sourceless proposal waits behind. Small, on
    // the row, no modal: the submit dialog stays the one moment that stops the
    // screen. The honesty line is design, not small print.
    confirmTitle: "Confirm this price?",
    confirmMath: (price: string, quantity: string, unit: string, total: string) =>
      `${price} × ${quantity} ${unit} = ${total}`,
    notFromPriceBook: "not from your price book — you are setting this price yourself",
    replaces: (current: string) => `replaces ${current}`,
    remarkOnly: "price unchanged — this adds a remark",
    rationaleLabel: "Rationale",
    confirm: "Confirm",
    discard: "Discard",
    notWritten: "not written",
    matched: (terms: number, on: string) => `matched_terms ${terms} · matched_on ${on}`,
    // Why a row was refused, in words. The machine-readable code stays beside
    // it: a person needs the sentence, an agent needs the code.
    rejection: {
      missing_position: "This row carried no item number.",
      bid_already_submitted: "The bid has been handed in. Prices are locked.",
      duplicate_position: "The same item number appears twice in one call.",
      unknown_position: "This tender has no such item number.",
      price_not_a_number: "The unit price was not a number.",
      price_negative: "A unit price cannot be negative.",
      price_too_large: "The unit price is implausibly high.",
      unknown_price_book_entry: "That price book line does not belong to this contractor.",
      price_without_source:
        "An agent may only write a price it can trace to your price book. Type it into the table yourself.",
      price_does_not_match_source: "The price differs from the price book line it names."
    } as Record<string, string>
  },

  check: {
    title: "Check result",
    close: "Close",
    nothingToFlag: "Nothing to flag.",
    findings: (n: number) => `${n} finding${n === 1 ? "" : "s"}.`,
    allPriced: "Every position is priced.",
    deadline: (date: string) => `Deadline ${date}`,
    daysLeft: (n: number) => `${n} days left`,
    daysAgo: (n: number) => `${n} days ago`,
    openPositions: "Positions without a price",
    outlier: (oz: string) => `${oz} is off your own past price`,
    // Split around the price book id, which is set in monospace between them.
    outlierAgainst: (price: string, reference: string) => `${price} against ${reference} from`,
    outlierDeviation: (deviation: string) => `, ${deviation} %`,
    documentExpired: "Expired document",
    documentMissing: "Missing document",
    validUntil: (date: string) => ` · valid until ${date}`,
    // The document confirmation. It says what the page did NOT do -- upload,
    // check -- because the page has not seen the certificate. That sentence is
    // the design, not the small print.
    confirmDocumentTitle: "Confirm this document?",
    confirmDocumentBody: (date: string) =>
      `You confirm that a certificate valid until ${date} exists. Nothing is uploaded or checked here.`,
    documentDates: (previous: string | null, next: string) =>
      `${previous ?? "not on file"} → ${next}`,
    footnote: "Compared against this contractor's own price book, not against market rates."
  },

  submit: {
    title: "Hand in this bid?",
    subtitle: (id: string) =>
      `${id} · this cannot be undone. After submitting, the prices are locked.`,
    netTotal: "Net total",
    contingencyTotal: "Contingency positions",
    positionsPriced: "Positions priced",
    positionsPricedValue: (done: number, total: number) => `${done} of ${total}`,
    stillOpen: (n: number) => `${n} position${n === 1 ? " is" : "s are"} still without a price.`,
    cancel: "Cancel",
    confirm: "Submit bid",
    // What keeps the bid from going out. Listed beside the button, with the
    // check's own sentence under each item: the three ways out of a blocker
    // are exactly the three ways this page offers.
    blocked: (n: number) =>
      `Cannot be handed in yet: ${n} thing${n === 1 ? "" : "s"} in the way.`,
    blockerOpen: (oz: string, text: string) => `${oz} ${text} — no price`,
    blockerExpired: (label: string, date: string) => `${label} — expired ${date}`,
    blockerMissing: (label: string) => `${label} — not on file`
  },

  panel: {
    title: "Agent panel",
    hide: "Hide",
    show: "Agent panel",
    tryThese: "Try these",
    copied: "Copied",
    liveLog: "Live log",
    clear: "Clear",
    logEmpty: "tool calls appear here",
    logStaysHere: "This log stays in your browser. Nothing is sent anywhere.",
    reset: "Reset demo",
    resetting: "Resetting…",
    detected: (n: number) => `WebMCP detected · ${n} ${n === 1 ? "tool" : "tools"} registered`,
    notAvailable: "WebMCP not available in this browser",
    openPanelOrSee: "Open the panel, or see",
    howToTest: "how to test",
    twoWays: "Two ways to get it:",
    wayChatGpt: "Open this page in the ChatGPT desktop app browser.",
    wayChromeBefore: "Or use Chrome and switch on",
    wayChromeAfter: ", then reload.",
    readableWithout:
      "Everything on this page stays readable without WebMCP. Only the tools are missing.",
    badgeRead: "read",
    badgeForm: "form",
    // A tool the page offers but the browser does not vouch for. Shown, never
    // counted: a self-diagnosis that claims more than the browser is advertising.
    badgeUnconfirmedForm: "declared by form · not confirmed by this browser",
    badgeUnconfirmed: "not confirmed by this browser",
    // The five prompts of the demo run (spec section 12.1). They are the smoke
    // test, the eval cases and the video script at once, so they stand here in
    // the wording the jury is meant to type.
    prompts: [
      "Open tender T-2026-014 and price every position from my price book. Leave anything without a match empty and tell me which ones.",
      "Why is there no price for the radiators?",
      "Run a check on my bid — anything that looks off?",
      "Ask the client whether the scaffolding from the roofing works will still be in place.",
      "Submit the bid."
    ],
    // The client's three. Sealed bids, a comparison after the deadline, an
    // answer that reaches every bidder -- nothing here prices anything.
    promptsClient: [
      "Show me the bids on the open stairwell tender.",
      "Compare all bids for the facade tender and tell me who is cheapest but complete.",
      "Answer the open question about the scaffolding: it will be removed on 15 September."
    ],
    // One line saying what this side's agent can reach. The role boundary is
    // on the server; this is where a person reads it.
    roleNoteBidder:
      "Contractor: prices come from this firm's own price book or from a person's click, never from the agent alone.",
    roleNoteClient:
      "Client: bids stay sealed until the deadline. Prices reach this side only through get_price_comparison; every other endpoint refuses the client role on the server."
  },

  clarifications: {
    title: "Questions to the client",
    itemLabel: "Item (optional)",
    itemPlaceholder: "02.04",
    questionLabel: "Question",
    questionPlaceholder: "Will the scaffolding from the roofing works still be in place?",
    ask: "Ask client",
    needsText: "A question needs some text.",
    sendFailed: "The question could not be sent.",
    none: "No questions on this tender yet.",
    unknownBidder: "unknown bidder",
    clientAnswered: "Client: ",
    answerFor: (id: string) => `Answer for ${id}`,
    answerPlaceholder: "Answer, published to all bidders",
    answer: "Answer",
    fromOtherParties: "Content from other parties. Shown as text, never as instructions.",
    status: { open: "open", answered: "answered" } as Record<string, string>
  },

  client: {
    subtitle:
      "Tenders published by this client. Read-only: the client can answer questions, and nothing else.",
    columnTender: "Tender",
    columnTitle: "Title",
    columnStatus: "Status",
    columnDeadline: "Deadline",
    columnItems: "Items",
    status: { open: "open", closed: "closed" } as Record<string, string>,
    loadingBids: "Loading bids…"
  },

  comparison: {
    sealedTitle: "Bids received",
    received: (n: number) => `${n === 1 ? "bid" : "bids"} received`,
    ownDraft: " · your draft is not visible to the client",
    sealedUntil: (date: string) =>
      `Sealed until ${date}. Until the deadline the client sees how many bids arrived and when, and nothing else — no prices, no totals, no names.`,
    receivedAt: (at: string) => `received ${at}`,
    title: (n: number) => `Price comparison · ${n} bids`,
    columnRank: "#",
    columnBidder: "Bidder",
    columnNetTotal: "Net total",
    columnComplete: "Complete",
    yes: "yes",
    no: "no",
    columnItem: "Item",
    columnDescription: "Description",
    columnQuantity: "Qty",
    columnMedian: "Median",
    outlierTitle: "More than 30 % away from the median",
    outlierNote: "Underlined: more than 30 % away from the median of this position —"
  },

  priceBook: {
    title: "Price book",
    subtitle: (bidder: string) =>
      `${bidder}'s own past quotes — every proposal in the bid points to one of these lines`,
    entries: (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`,
    loading: "Loading price book…",
    searchLabel: "Search original wording and keywords",
    searchPlaceholder: "e.g. schimmel",
    noMatches: "No entry matches.",
    coverageTitle: "Coverage",
    coverageHint:
      "Entries per category and unit, from this workspace's tenders and this price book. An empty cell is a gap: a position of that shape gets no proposal.",
    noEntry: "no entry",
    cellTitle: (category: string, unit: string) => `${category} / ${unit}`,
    showingCell: (category: string, unit: string) => `showing ${category} / ${unit} only`,
    showAll: "Show all entries",
    positionsUnder: (n: number) =>
      `${n} position${n === 1 ? "" : "s"} in this workspace ${n === 1 ? "falls" : "fall"} under it:`,
    noPositionsUnder: "No position in this workspace has this shape.",
    // Word for word what check_bid says about such a position. A test holds
    // the two together.
    actionNoEntry: (category: string, unit: string) =>
      `no entry for ${category}/${unit} — set the price yourself, or ask your agent to derive one; you confirm it.`,
    columnOriginal: "Original line",
    columnProject: "Project",
    columnDate: "Date",
    columnPrice: "Unit price",
    columnKeywords: "Keywords",
    neverTranslated:
      "Original lines, project names and keywords are the record and are never translated."
  },

  importZone: {
    reading: "Reading the file…",
    prompt: "Drop a GAEB DA XML file (.x83 / .X83) here to import a bill of quantities",
    orChoose: "or choose one",
    imported: (positions: number, tenderId: string) =>
      `Imported ${positions} position${positions === 1 ? "" : "s"} as ${tenderId}. Price it from your price book.`,
    failed: "That file could not be read.",
    error: {
      not_xml: "That file is not valid XML.",
      no_positions: "No positions found. Is this a GAEB DA XML (X83) bill of quantities?",
      no_quantities: "Positions were found but none carried a quantity and a unit."
    } as Record<string, string>
  }
};

/** German has to cover every key. `Copy` is what turns a gap into a build error. */
type Copy = typeof en;

const de: Copy = {
  header: {
    actingAs: "Rolle",
    roleBidder: "Handwerksbetrieb",
    roleClient: "Auftraggeber",
    biddingAs: "Bieter",
    language: "Sprache",
    howToTest: "In 60 Sekunden testen (englisch)",
    views: "Ansicht",
    viewBid: "Angebot",
    viewPriceBook: "Preisbuch"
  },

  app: {
    loadingTender: "Ausschreibung wird geladen…",
    loadFailed: "Die Ausschreibung konnte nicht geladen werden."
  },

  bid: {
    meta: (id, client, city, positions, due) =>
      `${id} · ${client} · ${city} · ${positions} Positionen · Frist ${due}`,
    submittedBanner: "Abgegeben. Die Preise sind gesperrt und nicht mehr änderbar.",
    netTotal: "Nettosumme",
    contingencyTotal: "Bedarfspositionen",
    priced: "Bepreist",
    pricedValue: (done, total) => `${done} von ${total}`,
    applyAll: (n) => `Alle Vorschläge übernehmen (${n})`,
    checkBid: "Angebot prüfen",
    undo: "Rückgängig",
    submitBid: "Angebot abgeben",
    columnItem: "OZ",
    columnDescription: "Bezeichnung",
    columnQuantity: "Menge",
    columnUnit: "Einheit",
    columnUnitPrice: "Einheitspreis",
    columnTotal: "Gesamt",
    scene: "Eine deutsche Ausschreibung (VOB/GAEB). Namen, Preise und Firmen sind erfunden."
  },

  row: {
    contingency: "Bedarf",
    unitPriceFor: (oz) => `Einheitspreis für ${oz}`,
    use: "Übernehmen",
    chipLead: "aus Ihrem Angebot",
    chipWhere: (project, month) => `${project} · ${month}`,
    originalLine: "die Zeile, die Sie damals bepreist haben",
    noComparableEntry: "kein vergleichbarer Eintrag",
    setByYou: "von Ihnen gesetzt",
    confirmTitle: "Diesen Preis bestätigen?",
    confirmMath: (price, quantity, unit, total) => `${price} × ${quantity} ${unit} = ${total}`,
    notFromPriceBook: "nicht aus Ihrem Preisbuch — diesen Preis setzen Sie selbst",
    replaces: (current) => `ersetzt ${current}`,
    remarkOnly: "Preis unverändert — das fügt eine Bemerkung hinzu",
    rationaleLabel: "Herleitung",
    confirm: "Bestätigen",
    discard: "Verwerfen",
    notWritten: "nicht übernommen",
    matched: (terms, on) => `matched_terms ${terms} · matched_on ${on}`,
    rejection: {
      missing_position: "Diese Zeile trug keine Ordnungszahl.",
      bid_already_submitted: "Das Angebot ist abgegeben. Die Preise sind gesperrt.",
      duplicate_position: "Dieselbe Ordnungszahl kommt im selben Aufruf zweimal vor.",
      unknown_position: "Diese Ordnungszahl gibt es in dieser Ausschreibung nicht.",
      price_not_a_number: "Der Einheitspreis war keine Zahl.",
      price_negative: "Ein Einheitspreis kann nicht negativ sein.",
      price_too_large: "Der Einheitspreis ist unplausibel hoch.",
      unknown_price_book_entry: "Diese Preisbuchzeile gehört nicht zu diesem Betrieb.",
      price_without_source:
        "Ein Agent darf nur Preise schreiben, die er auf Ihr Preisbuch zurückführen kann. Tragen Sie ihn selbst in die Tabelle ein.",
      price_does_not_match_source: "Der Preis weicht von der genannten Preisbuchzeile ab."
    }
  },

  check: {
    title: "Prüfergebnis",
    close: "Schließen",
    nothingToFlag: "Nichts zu beanstanden.",
    findings: (n) => (n === 1 ? "1 Befund." : `${n} Befunde.`),
    allPriced: "Alle Positionen sind bepreist.",
    deadline: (date) => `Frist ${date}`,
    daysLeft: (n) => (n === 1 ? "noch 1 Tag" : `noch ${n} Tage`),
    daysAgo: (n) => (n === 1 ? "vor 1 Tag" : `vor ${n} Tagen`),
    openPositions: "Positionen ohne Preis",
    outlier: (oz) => `${oz} weicht von Ihrem eigenen früheren Preis ab`,
    outlierAgainst: (price, reference) => `${price} gegenüber ${reference} aus`,
    outlierDeviation: (deviation) => `, ${deviation} %`,
    documentExpired: "Abgelaufener Nachweis",
    documentMissing: "Fehlender Nachweis",
    validUntil: (date) => ` · gültig bis ${date}`,
    confirmDocumentTitle: "Diesen Nachweis bestätigen?",
    confirmDocumentBody: (date) =>
      `Sie bestätigen, dass ein bis ${date} gültiger Nachweis vorliegt. Hochgeladen oder geprüft wird hier nichts.`,
    documentDates: (previous, next) => `${previous ?? "nicht hinterlegt"} → ${next}`,
    footnote:
      "Verglichen wird mit dem eigenen Preisbuch dieses Betriebs, nicht mit Marktpreisen."
  },

  submit: {
    title: "Dieses Angebot abgeben?",
    subtitle: (id) =>
      `${id} · Das lässt sich nicht rückgängig machen. Nach der Abgabe sind die Preise gesperrt.`,
    netTotal: "Nettosumme",
    contingencyTotal: "Bedarfspositionen",
    positionsPriced: "Bepreiste Positionen",
    positionsPricedValue: (done, total) => `${done} von ${total}`,
    stillOpen: (n) =>
      n === 1 ? "1 Position ist noch ohne Preis." : `${n} Positionen sind noch ohne Preis.`,
    cancel: "Abbrechen",
    confirm: "Angebot abgeben",
    blocked: (n) =>
      n === 1 ? "Noch nicht abgabefähig: 1 Hindernis." : `Noch nicht abgabefähig: ${n} Hindernisse.`,
    blockerOpen: (oz, text) => `${oz} ${text} — kein Preis`,
    blockerExpired: (label, date) => `${label} — abgelaufen am ${date}`,
    blockerMissing: (label) => `${label} — nicht hinterlegt`
  },

  panel: {
    title: "Agenten-Panel",
    hide: "Ausblenden",
    show: "Agenten-Panel",
    tryThese: "Zum Ausprobieren",
    copied: "Kopiert",
    liveLog: "Live-Protokoll",
    clear: "Leeren",
    logEmpty: "hier erscheinen die Werkzeugaufrufe",
    logStaysHere: "Dieses Protokoll bleibt in Ihrem Browser. Es wird nichts übertragen.",
    reset: "Demo zurücksetzen",
    resetting: "Wird zurückgesetzt…",
    detected: (n) => `WebMCP erkannt · ${n} ${n === 1 ? "Werkzeug" : "Werkzeuge"} angemeldet`,
    notAvailable: "WebMCP steht in diesem Browser nicht zur Verfügung",
    openPanelOrSee: "Panel öffnen, oder",
    howToTest: "Testanleitung lesen",
    twoWays: "Zwei Wege dorthin:",
    wayChatGpt: "Diese Seite im Browser der ChatGPT-Desktop-App öffnen.",
    wayChromeBefore: "Oder Chrome nehmen und",
    wayChromeAfter: " einschalten, dann neu laden.",
    readableWithout:
      "Diese Seite bleibt auch ohne WebMCP vollständig lesbar. Es fehlen nur die Werkzeuge.",
    badgeRead: "lesend",
    badgeForm: "Formular",
    badgeUnconfirmedForm: "per Formular deklariert · von diesem Browser nicht bestätigt",
    badgeUnconfirmed: "von diesem Browser nicht bestätigt",
    prompts: [
      "Öffne die Ausschreibung T-2026-014 und bepreise jede Position aus meinem Preisbuch. Lass alles ohne Treffer leer und sag mir, welche das sind.",
      "Warum steht bei den Heizkörpern kein Preis?",
      "Prüfe mein Angebot – gibt es etwas Auffälliges?",
      "Frag den Auftraggeber, ob das Gerüst der Dachdeckerarbeiten stehen bleibt.",
      "Gib das Angebot ab."
    ],
    promptsClient: [
      "Zeig mir die Angebote zur offenen Ausschreibung Treppenhaus.",
      "Vergleiche alle Angebote zur Fassaden-Ausschreibung und sag mir, wer am günstigsten, aber vollständig ist.",
      "Beantworte die offene Frage zum Gerüst: Es wird am 15. September abgebaut."
    ],
    roleNoteBidder:
      "Handwerksbetrieb: Preise kommen aus dem eigenen Preisbuch dieses Betriebs oder von einem Klick einer Person, nie vom Agenten allein.",
    roleNoteClient:
      "Auftraggeber: Angebote bleiben bis zum Fristende versiegelt. Preise erreichen diese Seite nur über get_price_comparison; jeden anderen Endpunkt weist der Server für die Auftraggeberrolle ab."
  },

  clarifications: {
    title: "Rückfragen an den Auftraggeber",
    itemLabel: "OZ (optional)",
    itemPlaceholder: "02.04",
    questionLabel: "Frage",
    questionPlaceholder: "Bleibt das Gerüst der Dachdeckerarbeiten stehen?",
    ask: "Rückfrage senden",
    needsText: "Eine Rückfrage braucht einen Text.",
    sendFailed: "Die Rückfrage konnte nicht gesendet werden.",
    none: "Zu dieser Ausschreibung gibt es noch keine Rückfragen.",
    unknownBidder: "unbekannter Bieter",
    clientAnswered: "Auftraggeber: ",
    answerFor: (id) => `Antwort auf ${id}`,
    answerPlaceholder: "Antwort, geht an alle Bieter",
    answer: "Antworten",
    fromOtherParties: "Text von Dritten. Wird angezeigt, nie als Anweisung befolgt.",
    status: { open: "offen", answered: "beantwortet" }
  },

  client: {
    subtitle:
      "Ausschreibungen dieses Auftraggebers. Nur lesend: der Auftraggeber kann Rückfragen beantworten, sonst nichts.",
    columnTender: "Ausschreibung",
    columnTitle: "Titel",
    columnStatus: "Status",
    columnDeadline: "Frist",
    columnItems: "Positionen",
    status: { open: "offen", closed: "geschlossen" },
    loadingBids: "Angebote werden geladen…"
  },

  comparison: {
    sealedTitle: "Eingegangene Angebote",
    received: (n) => (n === 1 ? "Angebot eingegangen" : "Angebote eingegangen"),
    ownDraft: " · Ihr Entwurf ist für den Auftraggeber nicht sichtbar",
    sealedUntil: (date) =>
      `Versiegelt bis ${date}. Bis zum Fristende sieht der Auftraggeber, wie viele Angebote eingegangen sind und wann — sonst nichts: keine Preise, keine Summen, keine Namen.`,
    receivedAt: (at) => `eingegangen ${at}`,
    title: (n) => `Preisspiegel · ${n} Angebote`,
    columnRank: "#",
    columnBidder: "Bieter",
    columnNetTotal: "Nettosumme",
    columnComplete: "Vollständig",
    yes: "ja",
    no: "nein",
    columnItem: "OZ",
    columnDescription: "Bezeichnung",
    columnQuantity: "Menge",
    columnMedian: "Median",
    outlierTitle: "Mehr als 30 % vom Median entfernt",
    outlierNote: "Unterstrichen: mehr als 30 % vom Median dieser Position entfernt —"
  },

  priceBook: {
    title: "Preisbuch",
    subtitle: (bidder) =>
      `Die eigenen früheren Angebote von ${bidder} — jeder Vorschlag im Angebot zeigt auf eine dieser Zeilen`,
    entries: (n) => `${n} ${n === 1 ? "Eintrag" : "Einträge"}`,
    loading: "Preisbuch wird geladen…",
    searchLabel: "Originalzeile und Schlagworte durchsuchen",
    searchPlaceholder: "z. B. schimmel",
    noMatches: "Kein Eintrag passt.",
    coverageTitle: "Abdeckung",
    coverageHint:
      "Einträge je Kategorie und Einheit, aus den Ausschreibungen dieses Arbeitsbereichs und diesem Preisbuch. Eine leere Zelle ist eine Lücke: Eine Position dieser Bauart bekommt keinen Vorschlag.",
    noEntry: "kein Eintrag",
    cellTitle: (category, unit) => `${category} / ${unit}`,
    showingCell: (category, unit) => `nur ${category} / ${unit}`,
    showAll: "Alle Einträge zeigen",
    positionsUnder: (n) =>
      `${n} ${n === 1 ? "Position" : "Positionen"} in diesem Arbeitsbereich ${n === 1 ? "fällt" : "fallen"} darunter:`,
    noPositionsUnder: "Keine Position in diesem Arbeitsbereich hat diese Bauart.",
    actionNoEntry: (category, unit) =>
      `kein Eintrag für ${category}/${unit} — setzen Sie den Preis selbst, oder lassen Sie ihn von Ihrem Agenten herleiten; Sie bestätigen ihn.`,
    columnOriginal: "Originalzeile",
    columnProject: "Projekt",
    columnDate: "Datum",
    columnPrice: "Einheitspreis",
    columnKeywords: "Schlagworte",
    neverTranslated:
      "Originalzeilen, Projektnamen und Schlagworte sind der Beleg und werden nie übersetzt."
  },

  importZone: {
    reading: "Datei wird gelesen…",
    prompt:
      "GAEB-DA-XML-Datei (.x83 / .X83) hier ablegen, um ein Leistungsverzeichnis einzulesen",
    orChoose: "oder eine auswählen",
    imported: (positions, tenderId) =>
      `${positions} ${positions === 1 ? "Position" : "Positionen"} als ${tenderId} eingelesen. Jetzt aus dem Preisbuch bepreisen.`,
    failed: "Diese Datei konnte nicht gelesen werden.",
    error: {
      not_xml: "Diese Datei ist kein gültiges XML.",
      no_positions:
        "Keine Positionen gefunden. Ist das ein GAEB-DA-XML-Leistungsverzeichnis (X83)?",
      no_quantities: "Es wurden Positionen gefunden, aber keine mit Menge und Einheit."
    }
  }
};

const dictionaries: Record<Language, Copy> = { en, de };

export function copyFor(language: Language): Copy {
  return dictionaries[language];
}

/** The copy for the language the visitor picked. Re-renders when it changes. */
export function useCopy(): Copy {
  return dictionaries[useAppState().language];
}

export type { Copy };
