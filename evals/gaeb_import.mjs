/**
 * The GAEB go/no-go, run against the live URL in a real browser.
 *
 * The test the timebox was set against: a GAEB X83 file THE PARSER HAS NEVER
 * SEEN — different category labels, different unit spellings, a different number
 * of positions — is dropped on the page, produces a tender with every position,
 * quantity and unit, and is then priceable with suggest_prices, without a code
 * change. Anything less is a fail.
 *
 *   node evals/gaeb_import.mjs [--url https://...] [--file seed/gaeb/....x83]
 *
 * Needs Chrome 149+ locally. No API key and no model.
 */

import path from "node:path";
import puppeteer from "puppeteer-core";

const arg = (name, fallback) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;

const url = arg("--url", "https://biddesk.n-schadewald.workers.dev");
const file = path.resolve(arg("--file", "seed/gaeb/T-2026-021.x83"));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

let ok = true;
const check = (label, cond, detail = "") => {
  ok = ok && Boolean(cond);
  console.log(
    (cond ? "  OK   " : "  FEHLT ") + label + (detail !== "" ? ` - ${JSON.stringify(detail)}` : "")
  );
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-first-run", "--no-default-browser-check"]
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 3000));

  const call = (name, args = {}) =>
    page.evaluate(
      async (toolName, payload) => {
        const tools = await document.modelContext.getTools();
        const tool = [...tools].find((entry) => entry?.name === toolName);
        if (!tool) return { __missing: true };
        const raw = await document.modelContext.executeTool(tool, JSON.stringify(payload));
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      },
      name,
      args
    );

  const before = (await call("list_tenders", {})).tenders.map((t) => t.id);
  console.log(`Tenders before the import: ${before.join(", ")}`);
  console.log(`Importing ${path.basename(file)} …`);

  const input = await page.$('input[type="file"]');
  await input.uploadFile(file);
  await new Promise((r) => setTimeout(r, 5000));

  const message = await page.$eval("main", (el) => el.innerText);
  check("the page confirms the import", /Imported \d+ positions? as /.test(message),
    message.split("\n").find((l) => l.startsWith("Imported")));

  const after = await call("list_tenders", {});
  const fresh = after.tenders.filter((t) => !before.includes(t.id));
  check("exactly one new tender exists", fresh.length === 1, fresh.map((t) => t.id));
  const imported = fresh[0];
  check("it kept the reference from the file", imported?.id === "T-2026-021", imported?.id);
  check("and its project name", imported?.title?.includes("Innenanstrich Praxisräume"), imported?.title);
  check("with all nine positions", imported?.positions_count === 9, imported?.positions_count);

  const detail = await call("get_tender", { tender_id: imported.id });
  const positions = detail.positions;
  check("item numbers come from the file's own numbering",
    positions.map((p) => p.oz).join() === "10.01,10.02,10.03,21.01,21.02,21.03,30.01,90.01,90.02",
    positions.map((p) => p.oz));
  check("quantities survived, German decimal comma included",
    positions.map((p) => p.quantity).join() === "1,184.5,184.5,184.5,184.5,96,7,15,8",
    positions.map((p) => p.quantity));
  check("units were normalised from this file's spellings",
    positions.map((p) => p.unit).join() === "psch,m2,m2,m2,m2,m2,pcs,m2,h",
    positions.map((p) => p.unit));
  check("the two contingency positions were recognised without a Provis element",
    positions.filter((p) => p.contingency).map((p) => p.oz).join() === "90.01,90.02",
    positions.filter((p) => p.contingency).map((p) => p.oz));

  console.log("\nAnd now the point: is it priceable?");
  const suggested = await call("suggest_prices", { tender_id: imported.id });
  const priced = suggested.suggestions.filter((s) => s.unit_price !== null);
  const gaps = suggested.suggestions.filter((s) => s.unit_price === null);
  check("the price book produces real proposals for the imported tender",
    priced.length >= 6, priced.map((s) => [s.oz, s.unit_price]));
  check("every proposal carries the past line it came from",
    priced.every((s) => s.based_on?.price_book_id && s.based_on.source_project),
    priced[0]?.based_on);
  check("and the gaps stay gaps, with no invented price",
    gaps.every((s) => s.based_on === null && s.reason === "no comparable entry in your price book"),
    gaps.map((s) => s.oz));

  const write = await call("set_unit_price", {
    tender_id: imported.id,
    prices: priced.map((s) => ({
      oz: s.oz,
      unit_price: s.unit_price,
      price_book_id: s.based_on.price_book_id
    }))
  });
  check("the proposals can actually be written into a bid",
    write.applied.length === priced.length && write.rejected.length === 0,
    [write.applied?.length, write.rejected?.length]);
  check("and the bid has a real total",
    write.totals.net > 0, write.totals);

  console.log();
  console.log(ok ? "GAEB: BESTANDEN" : "GAEB: NICHT BESTANDEN");
} finally {
  await browser.close();
}

process.exit(ok ? 0 : 1);
