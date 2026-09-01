/**
 * The client-role eval, and the two role properties.
 *
 * `webmcp-evals smoke` opens a fresh page per case and calls tools by name. It
 * cannot reach the client role, because there is no tool that switches roles --
 * that is deliberate, and it is the very property under test: in the contractor
 * role the client's tools do not exist. So this case drives a real Chrome the
 * way a person would, switches the role in the header, and then calls the
 * client tools that appear.
 *
 *   node evals/client_role.mjs [--url https://...]
 *
 * Needs Chrome 149+ locally. No API key and no model.
 */

import puppeteer from "puppeteer-core";

const url =
  process.argv.includes("--url")
    ? process.argv[process.argv.indexOf("--url") + 1]
    : "https://biddesk.n-schadewald.workers.dev";

const CHROME =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

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

  // getTools() answers with a Promise in Chrome 152, and executeTool takes a
  // RegisteredTool handle plus its arguments as a JSON string.
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

  const toolNames = () =>
    page.evaluate(async () => [...(await document.modelContext.getTools())].map((t) => t.name));

  const bidderTools = await toolNames();
  console.log(`Chrome sees ${bidderTools.length} tools in the contractor role`);
  check("contractor role registers ten tools", bidderTools.length === 10, bidderTools.length);
  check(
    "the client's tools do not exist here at all",
    !bidderTools.includes("get_price_comparison") && !bidderTools.includes("answer_clarification"),
    bidderTools
  );

  // Switch the role the way a person does: the select in the header.
  await page.select("header select", "client");
  await new Promise((r) => setTimeout(r, 3500));

  const clientTools = (await toolNames()).sort();
  check(
    "client role registers exactly its five tools",
    JSON.stringify(clientTools) ===
      JSON.stringify(
        [
          "answer_clarification",
          "get_price_comparison",
          "get_tender",
          "list_clarifications",
          "list_tenders"
        ].sort()
      ),
    clientTools
  );
  check(
    "and the contractor's writing tools are gone",
    !clientTools.includes("set_unit_price") && !clientTools.includes("submit_bid"),
    clientTools
  );

  console.log("\nE6 · Compare all bids for the facade tender");
  const closed = await call("get_price_comparison", { tender_id: "T-2026-009" });
  check("the closed tender is not sealed", closed.sealed === false);
  check("three bids compared, ranked cheapest first", closed.bidders?.length === 3
    && closed.bidders.every((b, i) => b.rank === i + 1)
    && closed.bidders[0].total_net <= closed.bidders[1].total_net,
    closed.bidders?.map((b) => [b.name, b.total_net]));
  const scaffolding = closed.positions?.find((p) => p.oz === "01.01");
  check("scaffolding: 11,50 / 13,20 / 27,80 with median 13,20",
    Math.abs(scaffolding.median - 13.2) < 0.001 && Math.abs(scaffolding.min - 11.5) < 0.001
    && Math.abs(scaffolding.max - 27.8) < 0.001,
    [scaffolding?.min, scaffolding?.median, scaffolding?.max]);
  check("Colorpoint marked, and nobody else, on that one position",
    JSON.stringify(scaffolding.outliers) === JSON.stringify(["B-C"])
    && closed.positions.filter((p) => p.outliers.length > 0).map((p) => p.oz).join() === "01.01",
    scaffolding?.outliers);

  console.log("\nE9 · An open tender stays sealed, even from the client's own agent");
  const open = await call("get_price_comparison", { tender_id: "T-2026-014" });
  check("sealed while the tender is open", open.sealed === true);
  check("bids counted and timed, nothing else", open.bids_received >= 2
    && open.positions.length === 0 && open.bidders.length === 0,
    [open.bids_received, open.positions?.length, open.bidders?.length]);
  const blob = JSON.stringify(open);
  check("no price anywhere in the answer",
    !blob.includes("unit_price") && !blob.includes("total_net"));

  console.log("\nE10 · The client answers a bidder question, for everyone");
  const before = await call("list_clarifications", { tender_id: "T-2026-014", status: "open" });
  const question = before.questions[0];
  const answered = await call("answer_clarification", {
    question_id: question.id,
    answer: "Eval run: the dado colour is RAL 7035."
  });
  check("published to all bidders", answered.published_to === "all bidders", answered);
  const after = await call("list_clarifications", { tender_id: "T-2026-014" });
  const updated = after.questions.find((q) => q.id === question.id);
  check("the question is answered and carries the answer",
    updated.status === "answered" && updated.answer.startsWith("Eval run:"),
    [updated?.status, updated?.answer]);

  console.log();
  console.log(ok ? "ALLES GRUEN" : "NICHT GRUEN");
} finally {
  await browser.close();
}

process.exit(ok ? 0 : 1);
