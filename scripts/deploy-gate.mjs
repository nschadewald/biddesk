/**
 * The gate a deploy has to pass, as a pure decision.
 *
 * Why this exists: on 2 September the chain "typecheck && vitest && deploy"
 * deployed after vitest had reported "no tests" -- the worker pool had died on
 * start, vitest exited 0, and && waved it through. A count of zero is not
 * green, and neither is a count below the last one known. This function is
 * the whole rule, kept apart from the shell so a test can feed it an empty
 * suite and watch it refuse.
 *
 * @param {{
 *   typecheckOk: boolean,
 *   tests: { total: number, failed: number, success?: boolean } | null,
 *   baseline: number,
 *   seedOk: boolean,
 *   evalSets: { present: string[], missing: string[] }
 * }} input
 * @returns {{ ok: boolean, reasons: string[], nextBaseline: number }}
 */
export function evaluateGate(input) {
  const reasons = [];
  const { typecheckOk, tests, baseline, seedOk, evalSets } = input;

  if (!typecheckOk) reasons.push("typecheck is not green (tsc --noEmit)");

  if (tests === null || tests === undefined || !Number.isFinite(tests.total)) {
    reasons.push("no test result at all: vitest produced no report");
  } else {
    if (tests.total === 0) {
      reasons.push("0 tests ran: the pool died on start, this is not a green suite");
    } else if (tests.total < baseline) {
      reasons.push(`${tests.total} tests ran, ${baseline} were known: a suite that shrank is not green`);
    }
    if (tests.failed > 0) reasons.push(`${tests.failed} test${tests.failed === 1 ? "" : "s"} failed`);
    if (tests.success === false && tests.failed === 0) {
      reasons.push("vitest reported success:false without a failing test (a file could not run)");
    }
  }

  if (!seedOk) reasons.push("seed/verify_seed.py did not say ALLES GRUEN");

  for (const name of evalSets?.missing ?? []) reasons.push(`eval set missing: ${name}`);
  if ((evalSets?.present ?? []).length === 0) reasons.push("no eval set present at all");

  const total = tests?.total ?? 0;
  return {
    ok: reasons.length === 0,
    reasons,
    // The count only ever ratchets up. A deploy that ran more tests than the
    // last one raises the bar for the next.
    nextBaseline: Math.max(baseline, total)
  };
}

/** The three eval sets a deploy must have on hand, and the files that carry them. */
export const EVAL_SETS = [
  { name: "contractor evals E1-E9 (webmcp-evals smoke)", files: ["evals/bidder.evals.json", "evals/assert_outcomes.py"] },
  { name: "client evals C1-C4 (puppeteer)", files: ["evals/client_role.mjs"] },
  { name: "GAEB acceptance (puppeteer)", files: ["evals/gaeb_import.mjs"] }
];
