import { expect, it } from "vitest";
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

function stubDb() {
  return {
    prepare(sql: string) {
      const statement = {
        bind: () => statement,
        async first() {
          if (/from workspaces/i.test(sql)) return { present: 1 };
          if (/from bidders/i.test(sql)) return { id: "B-A" };
          // Not projected: the tender query carries subselects, and the mapping
          // under test reads title_en / title_de by name anyway.
          if (/from tenders/i.test(sql)) return TENDER;
          return null;
        },
        async all() {
          if (/from positions/i.test(sql)) return { results: project(sql, POSITIONS) };
          if (/from price_book/i.test(sql)) return { results: project(sql, PRICE_BOOK) };
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
