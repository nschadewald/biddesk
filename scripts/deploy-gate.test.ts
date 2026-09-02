import { expect, it } from "vitest";
import { EVAL_SETS, evaluateGate } from "./deploy-gate.mjs";

/**
 * The deploy gate, fed what the shell would feed it. The case this exists
 * for is the first one: an empty suite that exited 0.
 */

const green = {
  typecheckOk: true,
  tests: { total: 203, failed: 0, success: true },
  baseline: 203,
  seedOk: true,
  evalSets: { present: EVAL_SETS.map((set) => set.name), missing: [] as string[] }
};

it("refuses an empty suite, even one that exited green", () => {
  const verdict = evaluateGate({ ...green, tests: { total: 0, failed: 0, success: true } });
  expect(verdict.ok).toBe(false);
  expect(verdict.reasons.join(" ")).toMatch(/0 tests ran/);
});

it("refuses a suite that shrank below the last known count", () => {
  const verdict = evaluateGate({ ...green, tests: { total: 150, failed: 0, success: true } });
  expect(verdict.ok).toBe(false);
  expect(verdict.reasons.join(" ")).toMatch(/150 tests ran, 203 were known/);
});

it("refuses a failing test, a red typecheck, a red seed, and a missing eval set -- each on its own", () => {
  expect(evaluateGate({ ...green, tests: { total: 203, failed: 1, success: false } }).reasons).toEqual([
    "1 test failed"
  ]);
  expect(evaluateGate({ ...green, typecheckOk: false }).reasons).toEqual([
    "typecheck is not green (tsc --noEmit)"
  ]);
  expect(evaluateGate({ ...green, seedOk: false }).reasons).toEqual([
    "seed/verify_seed.py did not say ALLES GRUEN"
  ]);
  expect(
    evaluateGate({
      ...green,
      evalSets: { present: [green.evalSets.present[0]!], missing: ["client evals C1-C4 (puppeteer)"] }
    }).reasons
  ).toEqual(["eval set missing: client evals C1-C4 (puppeteer)"]);
});

it("refuses when vitest produced no report at all", () => {
  const verdict = evaluateGate({ ...green, tests: null });
  expect(verdict.ok).toBe(false);
  expect(verdict.reasons[0]).toMatch(/no test result/);
});

it("passes a green run and ratchets the baseline up, never down", () => {
  expect(evaluateGate(green)).toEqual({ ok: true, reasons: [], nextBaseline: 203 });
  expect(evaluateGate({ ...green, tests: { total: 210, failed: 0, success: true } }).nextBaseline).toBe(210);
  // A shrunken run is refused, and the baseline does not move for it either.
  expect(evaluateGate({ ...green, tests: { total: 150, failed: 0, success: true } }).nextBaseline).toBe(203);
});

it("names the three eval sets a deploy must have on hand", () => {
  expect(EVAL_SETS.map((set) => set.files).flat()).toEqual([
    "evals/bidder.evals.json",
    "evals/assert_outcomes.py",
    "evals/client_role.mjs",
    "evals/gaeb_import.mjs"
  ]);
});
