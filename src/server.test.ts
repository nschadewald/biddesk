import { expect, it } from "vitest";
import { copyFor } from "./i18n";
import worker from "./server";

/**
 * The language guarantee, nailed down.
 *
 * `suggest_prices` must produce the same answer whether or not a person is
 * reading the screen in German: the same matches, the same price_book_id, the
 * same amounts, the same gaps. Today that holds because the suggestions query
 * asks for `text_de` outright -- the German short text, matched against German
 * keywords -- and never touches the interface language. That is an easy thing
 * to break in passing, and nothing would say so: the screen would look right in
 * both languages while the proposals quietly moved.
 *
 * An eval case is the wrong instrument for it, because an eval depends on a
 * model choosing a chain. This is the deterministic version: the real Worker
 * route, a stubbed D1, one fixture in which the German and the English text of
 * the same position match DIFFERENT things.
 */

const WS = "44444444-4444-4444-8444-444444444444";

/**
 * Positions whose two languages disagree on purpose.
 *
 * 01.01 matches two German keywords and none of the English words; 02.01 is
 * metal per piece, which this price book does not carry at all. So:
 *
 *   matched on text_de  ->  01.01 priced at 8.40, 02.01 a gap
 *   matched on text_en  ->  both are gaps
 *
 * Anything that made the query follow the language would show up as a
 * difference between the two calls; anything that switched it to English for
 * good would show up as a proposal going missing.
 */
const POSITION_DEFAULTS = {
  long_text_en: null,
  long_text_de: null,
  quantity: 320,
  contingency: 0,
  unit_price: null,
  set_by: null,
  id: null,
  source_project: null,
  source_date: null,
  source_position_text: null
};

const POSITIONS = [
  {
    ...POSITION_DEFAULTS,
    oz: "01.01",
    text_de: "Wandflächen zweimal Anstrich, waschbeständig",
    text_en: "Two coats emulsion, walls",
    unit: "m2",
    category: "wall",
    sort_no: 1
  },
  {
    ...POSITION_DEFAULTS,
    oz: "02.01",
    text_de: "Heizkörper inkl. Rohre lackieren",
    text_en: "Radiators incl. pipes",
    unit: "pcs",
    category: "metal",
    sort_no: 2
  }
];

const TENDER = {
  id: "T-2026-014",
  title_en: "Staircase painting works",
  title_de: "Malerarbeiten Treppenhaus",
  client_name: "Rheinpark Property Management",
  city: "Düsseldorf",
  trade: "painting",
  status: "open",
  due_date: "2026-09-10",
  positions_count: 2,
  my_bid_status: null
};

/**
 * Two questions: one from the seed, which the database holds in both
 * languages, and one a person typed, which it holds in one. The second must
 * come back as typed whatever the header says -- nobody translates other
 * parties' text.
 */
const CLARIFICATIONS = [
  {
    id: "Q-001",
    tender_id: "T-2026-014",
    oz: "01.01",
    question: "Will the scaffolding still be in place?",
    answer: "It will be removed on 15 September.",
    question_de: "Bleibt das Gerüst stehen?",
    answer_de: "Es wird am 15. September abgebaut.",
    status: "answered",
    created_at: "2026-08-30 12:00:00",
    name: "Farbwerk Meier GmbH"
  },
  {
    id: "Q-7f3a",
    tender_id: "T-2026-014",
    oz: null,
    question: "Können wir am Samstag arbeiten?",
    answer: null,
    question_de: null,
    answer_de: null,
    status: "open",
    created_at: "2026-09-02 09:00:00",
    name: "Farbwerk Meier GmbH"
  }
];

const PRICE_BOOK = [
  {
    id: "PB-A-005",
    category: "wall",
    unit: "m2",
    keywords: JSON.stringify(["anstrich", "wand"]),
    unit_price: 8.4,
    source_project: "Luegallee 40",
    source_date: "2026-03-14",
    source_position_text: "Wandflächen zweimal Dispersion"
  }
];

/**
 * Returns only the columns the SQL actually asked for, under the names it asked
 * for them by.
 *
 * That is the point of the stub rather than an accident of it. A query rewritten
 * to `text_en` hands back a row without `text_de`; one rewritten to
 * `text_en AS text_de` hands back German-looking keys holding English words.
 * Either way the matcher sees something different and the test falls over,
 * which is exactly what should happen.
 */
function project<T extends Record<string, unknown>>(sql: string, rows: T[]) {
  const selected = sql.slice(sql.search(/select/i) + 6, sql.search(/\sfrom\s/i));
  const columns = selected.split(",").map((part) => {
    const cleaned = part.trim().replace(/\s+/g, " ");
    const [expression, alias] = cleaned.split(/\s+as\s+/i);
    const source = expression!.trim().split(".").pop()!;
    return { source, key: (alias ?? source).trim() };
  });

  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const column of columns) out[column.key] = row[column.source];
    return out;
  });
}

/** Every batch the Worker sent, with the SQL and the bound values of each statement. */
let batches: { sql: string; args: unknown[] }[][] = [];
/** Every single statement the Worker ran outside a batch. */
let runs: { sql: string; args: unknown[] }[] = [];
/** The one document on file for this stub bidder. Expired, as in the seed. */
let documentOnFile = "2026-08-11";

function stubDb() {
  batches = [];
  runs = [];
  return {
    async batch(statements: { sql: string; args: unknown[] }[]) {
      batches.push(statements.map((statement) => ({ sql: statement.sql, args: statement.args })));
      return [];
    },
    prepare(sql: string) {
      const statement = {
        sql,
        args: [] as unknown[],
        bind: (...args: unknown[]) => {
          statement.args = args;
          return statement;
        },
        async run() {
          runs.push({ sql, args: statement.args });
          return { success: true };
        },
        async first() {
          if (/from workspaces/i.test(sql)) return { present: 1 };
          if (/from bidders\b/i.test(sql)) return { id: "B-A" };
          if (/from bidder_documents/i.test(sql)) return { valid_until: documentOnFile };
          // Not projected: the tender query carries subselects, and the mapping
          // under test reads title_en / title_de by name anyway.
          if (/from tenders/i.test(sql)) return TENDER;
          return null;
        },
        async all() {
          if (/from positions/i.test(sql)) return { results: project(sql, POSITIONS) };
          if (/from price_book/i.test(sql)) return { results: project(sql, PRICE_BOOK) };
          if (/from clarifications/i.test(sql)) return { results: project(sql, CLARIFICATIONS) };
          return { results: [] };
        }
      };
      return statement;
    }
  };
}

async function get(path: string, language?: string) {
  const headers: Record<string, string> = { "X-Workspace-Id": WS };
  if (language) headers["X-Language"] = language;
  const response = await worker.fetch(
    new Request(`https://biddesk.test${path}`, { headers }),
    { DB: stubDb() } as unknown as Env,
    {} as ExecutionContext
  );
  return (await response.json()) as Record<string, unknown>;
}

async function post(path: string, body: unknown) {
  const response = await worker.fetch(
    new Request(`https://biddesk.test${path}`, {
      method: "POST",
      headers: { "X-Workspace-Id": WS, "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
    { DB: stubDb() } as unknown as Env,
    {} as ExecutionContext
  );
  return (await response.json()) as Record<string, unknown>;
}

it("proposes exactly the same prices in German as in English", async () => {
  const [neutral, english, german] = await Promise.all([
    get("/api/tenders/T-2026-014/suggestions"),
    get("/api/tenders/T-2026-014/suggestions", "en"),
    get("/api/tenders/T-2026-014/suggestions", "de")
  ]);

  // Byte for byte, including reason and matched_terms. A proposal is a business
  // fact; it must not depend on which language a person happens to read in.
  expect(german).toEqual(neutral);
  expect(english).toEqual(neutral);
});

it("derives the proposals from the German short text, in every language", async () => {
  // Not just "the same in both": the same AND right. Equality alone would still
  // pass if the query were switched to text_en for good, because both calls
  // would then be equally wrong.
  for (const language of [undefined, "en", "de"]) {
    const body = await get("/api/tenders/T-2026-014/suggestions", language);
    const suggestions = body.suggestions as {
      oz: string;
      unit_price: number | null;
      matched_terms: number;
      based_on: { price_book_id: string } | null;
    }[];

    expect(suggestions.map((entry) => entry.oz), String(language)).toEqual(["01.01", "02.01"]);

    // "Wandflächen zweimal Anstrich" carries two of the German keywords.
    // "Two coats emulsion, walls" carries none of them.
    expect(suggestions[0], String(language)).toMatchObject({
      unit_price: 8.4,
      matched_terms: 2,
      based_on: { price_book_id: "PB-A-005" }
    });

    // Metal per piece: nothing of that shape in the book, so no price at all.
    expect(suggestions[1], String(language)).toMatchObject({
      unit_price: null,
      matched_terms: 0,
      based_on: null
    });
  }
});

it("does change the position texts with the language, which is the other half", async () => {
  // The same header that must not move a proposal must move the words a person
  // reads. Both halves of the contract, in one file.
  const english = await get("/api/tenders/T-2026-014");
  const german = await get("/api/tenders/T-2026-014", "de");

  const text = (body: Record<string, unknown>) =>
    (body.positions as { text: string }[]).map((position) => position.text);

  expect(text(english)[0]).toBe("Two coats emulsion, walls");
  expect(text(german)[0]).toBe("Wandflächen zweimal Anstrich, waschbeständig");

  // And the document labels, which are the other thing a person holds on paper.
  const labels = (body: Record<string, unknown>) =>
    (body.required_documents as { label: string }[]).map((document) => document.label);
  expect(labels(english)).toContain("Tax clearance certificate");
  expect(labels(german)).toContain("Unbedenklichkeitsbescheinigung");
});

it("hands seed questions back in the reader's language, and typed ones as typed", async () => {
  const english = await get("/api/clarifications");
  const german = await get("/api/clarifications", "de");
  const rows = (body: Record<string, unknown>) =>
    body.questions as { id: string; question: string; answer: string | null }[];

  // The seed question follows the header, question and answer alike.
  expect(rows(english)[0]).toMatchObject({
    id: "Q-001",
    question: "Will the scaffolding still be in place?",
    answer: "It will be removed on 15 September."
  });
  expect(rows(german)[0]).toMatchObject({
    id: "Q-001",
    question: "Bleibt das Gerüst stehen?",
    answer: "Es wird am 15. September abgebaut."
  });

  // The typed one does not: it has no second language, so it comes back as
  // it was written, whichever language the screen is in.
  expect(rows(english)[1]).toMatchObject({ id: "Q-7f3a", question: "Können wir am Samstag arbeiten?" });
  expect(rows(german)[1]).toMatchObject({ id: "Q-7f3a", question: "Können wir am Samstag arbeiten?" });

  // And the German columns never leak into the payload: one text per field.
  for (const row of [...rows(english), ...rows(german)]) {
    expect(row).not.toHaveProperty("question_de");
    expect(row).not.toHaveProperty("answer_de");
  }
});

it("tells the person what to do about each finding, in their language", async () => {
  const english = await get("/api/tenders/T-2026-014/check");
  const german = await get("/api/tenders/T-2026-014/check", "de");
  const actions = (body: Record<string, unknown>) =>
    body.actions as { finding: string; oz?: string; action: string }[];

  // 01.01 has a proposal in the price book the person has not taken; 02.01 has
  // nothing of its shape at all. Two different ways out, neither a dead end.
  // (This stub holds no documents, so the four required ones get their own
  // sentence too; those are checked apart.)
  const open = (body: Record<string, unknown>) =>
    actions(body).filter((entry) => entry.finding === "open_position");
  expect(actions(english).filter((entry) => entry.finding === "document")).toHaveLength(4);
  expect(actions(english).find((entry) => entry.finding === "document")?.action).toBe(
    "tell your agent the expiry date of the certificate you hold — you confirm it on the page — or obtain one before the deadline."
  );
  expect(open(english)).toEqual([
    {
      finding: "open_position",
      oz: "01.01",
      action: "your price book proposes 8.4 from PB-A-005 — take it, or derive a price of your own; you confirm it."
    },
    {
      finding: "open_position",
      oz: "02.01",
      action: "no entry for metal/pcs — set the price yourself, or ask your agent to derive one; you confirm it."
    }
  ]);
  expect(actions(german)[1]!.action).toBe(
    "kein Eintrag für metal/pcs — setzen Sie den Preis selbst, oder lassen Sie ihn von Ihrem Agenten herleiten; Sie bestätigen ihn."
  );
  // The warnings an agent reads stay English whatever the header says.
  expect((german.warnings as string[])[0]).toMatch(/positions? without a price/);
});

it("writes nothing at all for an agent's price without a source -- no row, no change_log block", async () => {
  const body = await post("/api/tenders/T-2026-014/prices", {
    set_by: "agent",
    prices: [{ oz: "02.01", unit_price: 61 }]
  });

  expect(body).toMatchObject({ ok: true, applied: [] });
  expect((body.rejected as { reason: string }[])[0]!.reason).toBe("price_without_source");
  // The Worker never opened a batch: nothing reached bid_prices or change_log.
  expect(batches).toEqual([]);
});

it("writes a person's confirmed price as theirs, in a block undo will find", async () => {
  const body = await post("/api/tenders/T-2026-014/prices", {
    set_by: "human",
    prices: [{ oz: "02.01", unit_price: 61, note: "4 radiators at 25 min each at your rate of 58 EUR" }]
  });

  expect(body).toMatchObject({
    ok: true,
    applied: [{ oz: "02.01", unit_price: 61, set_by: "human", price_book_id: null, source: null }]
  });
  // One batch: the draft bid, the row, and the change_log block for undo.
  expect(batches).toHaveLength(1);
  const [batch] = batches;
  const priceRow = batch!.find((statement) => /INSERT INTO bid_prices/i.test(statement.sql))!;
  expect(priceRow.args).toContain("human");
  expect(priceRow.args).toContain("4 radiators at 25 min each at your rate of 58 EUR");
  expect(priceRow.args.at(-1)).toBeNull();
  expect(batch!.some((statement) => /INSERT INTO change_log/i.test(statement.sql))).toBe(true);
});

it("records a stated document date, with the label in the reader's language", async () => {
  const body = await post("/api/documents/tax_clearance", { valid_until: "2027-08-15" });

  expect(body).toEqual({
    ok: true,
    changed: true,
    doc_type: "tax_clearance",
    label: "Tax clearance certificate",
    previous_valid_until: "2026-08-11",
    valid_until: "2027-08-15"
  });
  expect(runs).toHaveLength(1);
  expect(runs[0]!.sql).toMatch(/INSERT INTO bidder_documents/i);
  expect(runs[0]!.args).toContain("2027-08-15");
  expect(runs[0]!.args).toContain("Unbedenklichkeitsbescheinigung");
});

it("refuses a date in the past and an unknown document, and writes nothing for either", async () => {
  const past = await post("/api/documents/tax_clearance", { valid_until: "2020-01-01" });
  expect(past).toMatchObject({ ok: false, error: "date_in_the_past" });
  expect(String(past.hint)).toContain("in the past");

  const unknown = await post("/api/documents/iso_9001", { valid_until: "2027-08-15" });
  expect(unknown).toMatchObject({ ok: false, error: "unknown_document" });
  expect(String(unknown.hint)).toContain("tax_clearance");

  const garbage = await post("/api/documents/tax_clearance", { valid_until: "15.08.2027" });
  expect(garbage).toMatchObject({ ok: false, error: "invalid_date" });

  expect(runs).toEqual([]);
});

it("treats a date already on file as nothing to do, not as an error", async () => {
  // A document still valid, restated with its own date. (Restating an expired
  // document's own date is a date in the past, and is answered as one.)
  documentOnFile = "2027-08-15";
  try {
    const body = await post("/api/documents/tax_clearance", { valid_until: "2027-08-15" });
    expect(body).toMatchObject({ ok: true, changed: false, valid_until: "2027-08-15" });
    expect(runs).toEqual([]);
  } finally {
    documentOnFile = "2026-08-11";
  }
});

it("says the same sentence about a gap on the price book screen as in the check", async () => {
  // The screen's wording is a copy of the Worker's, so the two are held
  // together here rather than trusted to stay alike.
  const english = await get("/api/tenders/T-2026-014/check");
  const german = await get("/api/tenders/T-2026-014/check", "de");
  const gap = (body: Record<string, unknown>) =>
    (body.actions as { finding: string; oz?: string; action: string }[]).find(
      (entry) => entry.finding === "open_position" && entry.oz === "02.01"
    )!.action;

  expect(gap(english)).toBe(copyFor("en").priceBook.actionNoEntry("metal", "pcs"));
  expect(gap(german)).toBe(copyFor("de").priceBook.actionNoEntry("metal", "pcs"));
});
