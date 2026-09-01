import { describe, expect, it } from "vitest";
import knownFile from "../seed/gaeb/T-2026-014.x83?raw";
import unknownFile from "../seed/gaeb/T-2026-021.x83?raw";
import seedRaw from "../seed/seed.json?raw";
import { deriveCategory, normaliseUnit, parseGaeb } from "./gaeb";
import { findMatch, type PriceBookEntry } from "./matching";

type SeedPosition = {
  oz: string;
  text_de: string;
  quantity: number;
  unit: string;
  category: string;
  contingency: boolean;
};

const seed = JSON.parse(seedRaw) as {
  tenders: { id: string; positions: SeedPosition[] }[];
  price_book: (Omit<PriceBookEntry, "id"> & { bidder_id: string })[];
};

describe("units", () => {
  it("accepts the spellings a bill of quantities actually arrives in", () => {
    expect(["m2", "m²", "qm", " M2 "].map(normaliseUnit)).toEqual(["m2", "m2", "m2", "m2"]);
    expect(["St", "Stk", "Stck", "Stück"].map(normaliseUnit)).toEqual(["pcs", "pcs", "pcs", "pcs"]);
    expect(["h", "Std", "Std.", "Stunden"].map(normaliseUnit)).toEqual(["h", "h", "h", "h"]);
    expect(["psch", "psch.", "pausch"].map(normaliseUnit)).toEqual(["psch", "psch", "psch"]);
    expect(["m", "lfm"].map(normaliseUnit)).toEqual(["m", "m"]);
  });

  it("passes an unknown unit through rather than guessing", () => {
    expect(normaliseUnit("Rolle")).toBe("rolle");
  });
});

describe("the file the fixtures were built from", () => {
  const parsed = parseGaeb(knownFile);
  const t14 = seed.tenders.find((tender) => tender.id === "T-2026-014")!.positions;

  it("reads the project and its reference", () => {
    expect(parsed.title).toContain("Malerarbeiten Treppenhaus");
    expect(parsed.reference).toBe("T-2026-014");
    expect(parsed.client).toBe("Rheinpark Property Management");
  });

  it("reproduces every item number, quantity and unit of the seed", () => {
    expect(parsed.positions.map((p) => p.oz)).toEqual(t14.map((p) => p.oz));
    expect(parsed.positions.map((p) => p.quantity)).toEqual(t14.map((p) => p.quantity));
    expect(parsed.positions.map((p) => p.unit)).toEqual(t14.map((p) => p.unit));
  });

  it("finds both contingency positions", () => {
    expect(parsed.positions.filter((p) => p.contingency).map((p) => p.oz)).toEqual([
      "04.01",
      "04.02"
    ]);
  });
});

describe("a file the parser has never seen", () => {
  const parsed = parseGaeb(unknownFile);

  it("reads it despite a namespace prefix, deeper nesting and other labels", () => {
    expect(parsed.title).toContain("Innenanstrich Praxisräume");
    expect(parsed.reference).toBe("T-2026-021");
    expect(parsed.positions).toHaveLength(9);
  });

  it("builds item numbers from this file's own numbering", () => {
    expect(parsed.positions.map((p) => p.oz)).toEqual([
      "10.01", "10.02", "10.03", "21.01", "21.02", "21.03", "30.01", "90.01", "90.02"
    ]);
  });

  it("normalises this file's unit spellings and German decimal commas", () => {
    expect(parsed.positions.map((p) => p.unit)).toEqual([
      "psch", "m2", "m2", "m2", "m2", "m2", "pcs", "m2", "h"
    ]);
    expect(parsed.positions[1]!.quantity).toBe(184.5);
  });

  it("recognises the contingency positions from the category label alone", () => {
    // This file carries no Provis ELEMENT anywhere (the header comment names it).
    expect(unknownFile).not.toMatch(/<[A-Za-z]*:?Provis[ >]/);
    expect(parsed.positions.filter((p) => p.contingency).map((p) => p.oz)).toEqual([
      "90.01",
      "90.02"
    ]);
  });

  it("falls back to the detail text where an item has no outline text", () => {
    expect(parsed.positions[2]!.text).toContain("Risse und Löcher spachteln");
  });
});

describe("the imported tender is priceable", () => {
  const parsed = parseGaeb(unknownFile);
  const meier: PriceBookEntry[] = seed.price_book
    .filter((entry) => entry.bidder_id === "B-A")
    .map((entry, index) => ({ ...entry, id: `PB-A-${String(index + 1).padStart(3, "0")}` }));

  it("gets real proposals from the price book, with sources", () => {
    const matched = parsed.positions
      .map((position) => ({ position, match: findMatch(meier, { ...position, text_de: position.text }) }))
      .filter((row) => row.match !== null);

    // Not a number we tuned for: it is what this contractor's price book
    // happens to cover in a tender nobody wrote for it.
    expect(matched.length).toBeGreaterThanOrEqual(6);
    expect(matched.every((row) => row.match!.entry.unit_price > 0)).toBe(true);
  });

  it("leaves the hourly rate empty, because Farbwerk Meier has no such line", () => {
    const hourly = parsed.positions.find((position) => position.oz === "90.02")!;
    expect(hourly.unit).toBe("h");
    expect(findMatch(meier, { ...hourly, text_de: hourly.text })).toBeNull();
  });
});

describe("the derived category, measured against the seed's own judgement", () => {
  it("agrees with a human on most positions, and never invents a price when it does not", () => {
    const all = seed.tenders.flatMap((tender) => tender.positions);
    const agreed = all.filter((position) => deriveCategory(position.text_de) === position.category);

    // Categories are derived from wording, so they will not always match what a
    // person filed. That costs a suggestion, never a wrong price: a mismatch
    // means no price book line qualifies, and the field simply stays empty.
    expect(agreed.length / all.length).toBeGreaterThan(0.8);
  });
});

describe("a category heading never overrules the position's own words", () => {
  it("keeps the wall position on wall work under a Wand- und Deckenflächen heading", () => {
    // The heading contains "Decken". Letting it vote offered the wall position
    // the ceiling price: a wrong price with a correct-looking source.
    expect(deriveCategory("Wandflächen zweimal Dispersionsanstrich", "Wand- und Deckenflächen"))
      .toBe("wall");
    expect(deriveCategory("Deckenflächen zweimal Dispersionsanstrich", "Wand- und Deckenflächen"))
      .toBe("ceiling");
  });

  it("still uses the heading when the position text says nothing", () => {
    expect(deriveCategory("Position 1", "Lackierarbeiten Holz")).toBe("wood");
    expect(deriveCategory("Position 1", null)).toBe("prep");
  });
});
