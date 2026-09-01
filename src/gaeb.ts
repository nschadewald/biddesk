/**
 * GAEB DA XML (X83) import.
 *
 * X83 is the file a German bill of quantities actually travels in, produced by
 * the client's AVA software. Seed data proves the interaction; this proves the
 * ENTRANCE -- that a tender can come from outside, as a file, the way it does in
 * practice.
 *
 * Written defensively on purpose. Our fixtures are hand-built and structurally
 * faithful, not certified exports, so the parser searches by local element name
 * and never relies on namespace, ordering or full schema validity:
 *
 *  - element lookup ignores the namespace, because exporters differ,
 *  - the item number is assembled from the category and item RNoPart attributes,
 *    with a fallback to a running number when an exporter omits them,
 *  - the short text comes from OutlineText, falling back to the detail text and
 *    then to the category label,
 *  - units are normalised across spellings (St, Stk, Stck, m², qm, Std, ...),
 *  - a contingency position is recognised from a Provis element OR from the
 *    category being labelled as one, because the Provis spelling is not verified
 *    against a certified export (see seed/README.md).
 *
 * The category is DERIVED from the German text, not read from the file: GAEB
 * category labels are free text and differ between offices, so mapping them
 * would only work for files we have already seen. Deriving is safe here because
 * a category never becomes a price. The worst a wrong category can do is cost a
 * suggestion, and a missing suggestion is an empty field, which is exactly what
 * this application does with anything it cannot source.
 */

export type ImportedPosition = {
  oz: string;
  text: string;
  long_text: string | null;
  quantity: number;
  unit: string;
  category: string;
  contingency: boolean;
};

export type ImportedTender = {
  title: string;
  reference: string | null;
  client: string | null;
  positions: ImportedPosition[];
};

/** Spellings we have seen or can reasonably expect, mapped to our own units. */
const UNITS: Record<string, string> = {
  m2: "m2", "m²": "m2", qm: "m2", quadratmeter: "m2",
  m: "m", lfm: "m", lfdm: "m", "lfd.m": "m", meter: "m",
  m3: "m3", "m³": "m3", cbm: "m3",
  st: "pcs", stk: "pcs", stck: "pcs", "st.": "pcs", stueck: "pcs", stück: "pcs", pcs: "pcs",
  h: "h", std: "h", "std.": "h", stunde: "h", stunden: "h",
  psch: "psch", pausch: "psch", "psch.": "psch", pau: "psch",
  kg: "kg", t: "t", l: "l"
};

export function normaliseUnit(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  return UNITS[key] ?? key;
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}

/**
 * The trade category, derived from the wording. Order matters: preparation is
 * decided by what is being DONE, the rest by what is being worked ON, so
 * "clean and sand the wall" is preparation while "primer on the wall" is wall
 * work -- which is how the trade reads it too.
 */
const CATEGORY_RULES: { category: string; terms: string[] }[] = [
  { category: "labour", terms: ["stundenlohn", "stundensatz", "geselle", "regiearbeit", "helfer"] },
  {
    category: "prep",
    terms: [
      "baustelleneinrichtung", "abdecken", "anschleifen", "reinigen", "spachteln",
      "ausbessern", "entfernen", "geruest", "schimmel", "abkleben", "abwaschen"
    ]
  },
  { category: "ceiling", terms: ["decke"] },
  { category: "metal", terms: ["stahl", "metall", "gelaender", "heizkoerper", "eisen", "verzinkt", "rohr"] },
  { category: "wood", terms: ["holz", "handlauf", "tuer", "zarge", "fenster", "parkett", "furnier"] },
  { category: "wall", terms: ["wand", "waend", "sockel", "fassade", "putz", "tapete", "grundierung", "laibung"] }
];

/** The category the wording alone decides, or null when it decides nothing. */
function classify(text: string): string | null {
  const folded = fold(text);
  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => folded.includes(term))) return rule.category;
  }
  return null;
}

/**
 * The position's own text decides. A category label is consulted only when the
 * text says nothing, and never otherwise.
 *
 * This is not a nicety. A real bill of quantities puts "Wandflächen" and
 * "Deckenflächen" under one heading called "Wand- und Deckenflächen"; letting
 * that heading vote gave every position under it the ceiling category, and the
 * wall position was then offered the ceiling price of 9,10 EUR instead of its
 * own 8,40 EUR -- a wrong price wearing a correct source chip, which is the one
 * outcome this application exists to prevent. Found by importing a file the
 * parser had not seen.
 */
export function deriveCategory(text: string, categoryLabel?: string | null): string {
  return classify(text) ?? classify(categoryLabel ?? "") ?? "prep";
}

const CONTINGENCY_TERMS = ["bedarfsposition", "bedarfspositionen", "eventualposition", "provis"];

/** Every descendant with this local name, whatever namespace it carries. */
function tags(node: Element | Document, name: string): Element[] {
  const found: Element[] = [];
  const all = node.getElementsByTagName("*");
  for (let index = 0; index < all.length; index += 1) {
    const element = all[index]!;
    if (element.localName === name) found.push(element);
  }
  return found;
}

function firstText(node: Element, name: string): string | null {
  const [element] = tags(node, name);
  const text = element?.textContent?.trim();
  return text && text.length > 0 ? text : null;
}

function collapse(value: string | null): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text && text.length > 0 ? text : null;
}

/** The nearest enclosing category element, for the item number and its label. */
function categoryOf(item: Element): Element | null {
  let node: Element | null = item.parentElement;
  while (node) {
    if (node.localName === "BoQCtgy") return node;
    node = node.parentElement;
  }
  return null;
}

export function parseGaeb(xml: string): ImportedTender {
  const document_ = new DOMParser().parseFromString(xml, "application/xml");
  if (tags(document_, "parsererror").length > 0 || document_.querySelector("parsererror")) {
    throw new Error("That file is not valid XML.");
  }

  const items = tags(document_, "Item");
  if (items.length === 0) {
    throw new Error("No positions found. Is this a GAEB DA XML (X83) bill of quantities?");
  }

  const [projectInfo] = tags(document_, "PrjInfo");
  const [boqInfo] = tags(document_, "BoQInfo");
  const title =
    collapse(projectInfo ? firstText(projectInfo, "NamePrj") : null) ??
    collapse(boqInfo ? firstText(boqInfo, "Name") : null) ??
    "Imported tender";
  const reference =
    collapse(projectInfo ? firstText(projectInfo, "LblPrj") : null) ??
    collapse(boqInfo ? firstText(boqInfo, "LblBoQ") : null);
  const [owner] = tags(document_, "OWN");
  const client = collapse(owner ? firstText(owner, "Name") : null);

  const positions: ImportedPosition[] = [];
  let running = 0;

  for (const item of items) {
    const quantityText = firstText(item, "Qty");
    const unitText = firstText(item, "QU");
    if (quantityText === null || unitText === null) continue;
    const quantity = Number(quantityText.replace(",", "."));
    if (!Number.isFinite(quantity)) continue;

    const category = categoryOf(item);
    const categoryNumber = category?.getAttribute("RNoPart")?.trim();
    const itemNumber = item.getAttribute("RNoPart")?.trim();
    running += 1;
    const oz =
      categoryNumber && itemNumber
        ? `${categoryNumber}.${itemNumber}`
        : (itemNumber ?? String(running).padStart(2, "0"));

    const categoryLabel = category ? collapse(firstText(category, "LblTx")) : null;
    const outline = collapse(firstText(item, "TextOutlTxt")) ?? collapse(firstText(item, "OutlTxt"));
    const detail = collapse(firstText(item, "DetailTxt"));
    const text = outline ?? detail ?? categoryLabel ?? `Position ${oz}`;

    const provis = tags(item, "Provis")[0]?.textContent?.trim().toLowerCase();
    const flaggedByElement = provis !== undefined && provis !== "no" && provis !== "false";
    const flaggedByCategory = CONTINGENCY_TERMS.some((term) =>
      fold(categoryLabel ?? "").includes(term)
    );

    positions.push({
      oz,
      text,
      long_text: detail && detail !== text ? detail : null,
      quantity,
      unit: normaliseUnit(unitText),
      category: deriveCategory(text, categoryLabel),
      contingency: flaggedByElement || flaggedByCategory
    });
  }

  if (positions.length === 0) {
    throw new Error("Positions were found but none carried a quantity and a unit.");
  }

  return { title, reference, client, positions };
}
