import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadTender, readStoredLanguage, setLanguage } from "./api";
import { formatDate, formatEuro, formatMonthYear, formatQuantity } from "./format";
import { copyFor } from "./i18n";

const WS = "77777777-7777-4777-8777-777777777777";

/** Every leaf of the copy tree, as "path" -> rendered string. */
function leaves(node: unknown, path = ""): Record<string, string> {
  if (typeof node === "string") return { [path]: node };
  // A parameterised string is called with stand-in values, so a missing German
  // half shows up here as an empty result rather than as a runtime surprise.
  if (typeof node === "function") {
    const stub = (node as (...args: unknown[]) => string)("1", "2", "3", "4", "5");
    return { [path]: String(stub) };
  }
  if (Array.isArray(node)) {
    return Object.assign({}, ...node.map((entry, index) => leaves(entry, `${path}[${index}]`)));
  }
  if (node && typeof node === "object") {
    return Object.assign(
      {},
      ...Object.entries(node).map(([key, value]) =>
        leaves(value, path === "" ? key : `${path}.${key}`)
      )
    );
  }
  return {};
}

const en = leaves(copyFor("en"));
const de = leaves(copyFor("de"));

it("says everything in both languages, and says something in each", () => {
  // The compiler already refuses a missing key; this catches the other way a
  // second language rots -- a key that is present but empty.
  expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  expect(Object.entries(de).filter(([, value]) => value.trim().length === 0)).toEqual([]);
  expect(Object.entries(en).filter(([, value]) => value.trim().length === 0)).toEqual([]);
});

it("actually translated the words a contractor reads first", () => {
  // A spot check, not a rule: some values are the same in both on purpose
  // ("Median", "#", the item-number placeholder).
  for (const key of [
    "bid.netTotal",
    "bid.checkBid",
    "bid.submitBid",
    "bid.columnUnitPrice",
    "row.noComparableEntry",
    "check.title",
    "submit.title",
    "panel.reset",
    "clarifications.title",
    "comparison.sealedTitle"
  ]) {
    expect(de[key], key).not.toBe(en[key]);
  }
});

it("addresses the reader as Sie, never as du", () => {
  // House rule. The chip once said "aus deinem Angebot" beside four strings
  // that said "Ihr", and a German reader notices that in the first minute.
  //
  // The example prompts are left out on purpose: there the PERSON speaks to
  // their agent ("Öffne", "Setz", "Gib ab"), so they are imperatives by
  // design, not the page addressing its reader.
  const informal = /\b(du|dir|dich|dein\w*)\b/i;
  const offenders = Object.entries(de)
    .filter(([key]) => !key.startsWith("panel.prompts"))
    .filter(([, value]) => informal.test(value));
  expect(offenders).toEqual([]);
});

it("lists the seven prompts of the contractor's demo in the order of the script, in both languages", () => {
  // docs/09: price from the book, explain the gap, dictate a price, check,
  // state a renewed certificate, ask the client, submit. The panel is the
  // script's cue card, so the order is the script's, and the client keeps its
  // own three.
  const english = copyFor("en").panel.prompts;
  const german = copyFor("de").panel.prompts;
  expect(english).toHaveLength(7);
  expect(german).toHaveLength(7);

  const order = [/T-2026-014/, /radiators|Heizkörper/, /03\.04.*61/, /check|Prüfe/, /2027/, /scaffolding|Gerüst/, /^(Submit the bid\.|Gib das Angebot ab\.)$/];
  order.forEach((pattern, index) => {
    expect(english[index], `en ${index + 1}`).toMatch(pattern);
    expect(german[index], `de ${index + 1}`).toMatch(pattern);
  });

  // The person speaks to the agent: imperatives, no "Sie" formula in the German.
  expect(german[2]).toBe("Setz 03.04 auf 61 Euro — vier Heizkörper, je 25 Minuten, zu meinem Stundensatz.");
  expect(german[4]).toBe("Meine neue Unbedenklichkeitsbescheinigung gilt bis 15. August 2027.");

  expect(copyFor("en").panel.promptsClient).toHaveLength(3);
  expect(copyFor("de").panel.promptsClient).toHaveLength(3);
});

it("keeps the tool names out of the dictionary", () => {
  // Tools are English in both languages, by rule. If a tool name ever appears
  // as a translatable string, that rule has been broken somewhere.
  const values = Object.values(de).join(" ");
  for (const tool of ["get_tender", "suggest_prices", "set_unit_price", "submit_bid"]) {
    expect(values).not.toContain(tool);
  }
  // matched_terms / matched_on are the exception: they are printed as the field
  // names they are, in both languages, because they are tool data on display.
  expect(de["row.matched"]).toContain("matched_terms");
});

it("formats money the German way in both languages, and dates in each", () => {
  // The reference figures (13.213,50 EUR) are quoted in the spec, the README
  // and seed/verify_seed.py. They must not move with the interface language.
  // The gap before the sign is a non-breaking space, the one Intl emits. What
  // the reference figures are about is the digits and the separators.
  expect(formatEuro(13213.5)).toBe("13.213,50 €");
  expect(formatQuantity(320)).toBe("320");

  expect(formatDate("2026-09-10", "en")).toBe("10 Sept 2026");
  expect(formatDate("2026-09-10", "de")).toBe("10. Sept. 2026");
  expect(formatMonthYear("2026-03-14", "en")).toBe("March 2026");
  expect(formatMonthYear("2026-03-14", "de")).toBe("März 2026");
});

beforeEach(() => {
  localStorage.clear();
  setLanguage("en");
});

afterEach(() => {
  setLanguage("en");
  vi.unstubAllGlobals();
});

it("sends the chosen language as a header, read at the moment of the fetch", async () => {
  const sent: (Record<string, string> | undefined)[] = [];
  const fetchMock = vi.fn(async (_input: string, init?: { headers?: unknown }) => {
    sent.push(init?.headers as Record<string, string> | undefined);
    return new Response(
      JSON.stringify({ ok: true, tender: { id: "T-2026-014" }, positions: [] }),
      { headers: { "content-type": "application/json" } }
    );
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

  await loadTender("T-2026-014", WS);
  expect(sent[0]).toMatchObject({ "X-Language": "en" });

  // Read at the moment of the fetch, not captured when a component rendered.
  setLanguage("de");
  await loadTender("T-2026-014", WS);
  expect(sent[1]).toMatchObject({ "X-Language": "de" });
});

it("remembers the choice per browser and starts in English without one", () => {
  expect(readStoredLanguage()).toBe("en");
  setLanguage("de");
  expect(localStorage.getItem("biddesk.language")).toBe("de");
  expect(readStoredLanguage()).toBe("de");

  // Nonsense in storage is English, not a broken screen.
  localStorage.setItem("biddesk.language", "klingon");
  expect(readStoredLanguage()).toBe("en");
});

it("survives a browser that refuses localStorage", () => {
  const boom = () => {
    throw new Error("localStorage is disabled");
  };
  vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });

  expect(readStoredLanguage()).toBe("en");
  expect(() => setLanguage("de")).not.toThrow();
});
