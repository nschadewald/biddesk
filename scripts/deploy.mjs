/**
 * The guarded deploy. `npm run deploy` runs this and nothing else.
 *
 *   node scripts/deploy.mjs              gate, build, deploy, wait, evals
 *   node scripts/deploy.mjs --gate-only  the gate alone, no deploy
 *
 * Before anything is built: typecheck, the unit suite counted (not just
 * exited), seed/verify_seed.py, and the three eval sets present on disk. Any
 * one of them red and nothing is deployed. After the deploy: fifteen seconds
 * for the edge to settle, then all three eval sets against the live URL. A red
 * eval does not undo the deploy -- nothing here has that authority -- but it
 * ends the step with a failure and the rollback command in the message, so a
 * bad build never passes as a good one.
 *
 * Born on 2 September, when "typecheck && vitest && deploy" deployed after
 * vitest had said "no tests" and exited 0.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EVAL_SETS, evaluateGate } from "./deploy-gate.mjs";

// fileURLToPath, not .pathname: the project lives in a folder with a space,
// and a percent-encoded path made every check fail at once on the first probe.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE_FILE = join(ROOT, "scripts", "test-baseline.json");
const LIVE_URL = "https://biddesk.n-schadewald.workers.dev";
const SETTLE_MS = 15_000;
const gateOnly = process.argv.includes("--gate-only");

const say = (line) => process.stdout.write(`${line}\n`);

/** Runs a command to completion. Windows needs the shell for npx and python. */
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd ?? ROOT,
    shell: true,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    code: result.status ?? 1,
    out: `${result.stdout ?? ""}${result.stderr ?? ""}`
  };
}

function readBaseline() {
  try {
    return Number(JSON.parse(readFileSync(BASELINE_FILE, "utf8")).tests) || 0;
  } catch {
    return 0;
  }
}

/** vitest's own JSON report, so the count is read, never inferred from an exit code. */
function runUnitSuite() {
  const reportFile = join(mkdtempSync(join(tmpdir(), "biddesk-vitest-")), "report.json");
  const { code } = run("npx", ["vitest", "run", "--reporter=json", `--outputFile=${reportFile}`]);
  if (!existsSync(reportFile)) return { tests: null, code };
  try {
    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    return {
      code,
      tests: {
        total: report.numTotalTests ?? 0,
        failed: report.numFailedTests ?? 0,
        success: report.success !== false
      }
    };
  } catch {
    return { tests: null, code };
  }
}

function evalSetsOnDisk() {
  const present = [];
  const missing = [];
  for (const set of EVAL_SETS) {
    (set.files.every((file) => existsSync(join(ROOT, file))) ? present : missing).push(set.name);
  }
  return { present, missing };
}

/**
 * The version this script accepted last time, for the rollback command.
 * Kept in a file of our own: `wrangler deployments list` waits for a terminal
 * and never answered inside the guard, so the first two runs said "previous
 * version unknown". A file the guard writes itself cannot hang.
 */
const LAST_DEPLOY_FILE = join(ROOT, "scripts", "last-deploy.json");

function lastAcceptedVersion() {
  try {
    return JSON.parse(readFileSync(LAST_DEPLOY_FILE, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function rememberAcceptedVersion(version) {
  writeFileSync(
    LAST_DEPLOY_FILE,
    `${JSON.stringify({ version, at: new Date().toISOString() }, null, 2)}\n`
  );
}

// ---------------------------------------------------------------- the gate

say("deploy gate · typecheck");
const typecheckOk = run("npx", ["tsc", "--noEmit"]).code === 0;

say("deploy gate · unit suite, counted");
const { tests } = runUnitSuite();
say(`  ${tests ? `${tests.total} tests, ${tests.failed} failed` : "no report"}`);

say("deploy gate · seed");
const seed = run("python", ["verify_seed.py"], { cwd: join(ROOT, "seed") });
const seedOk = seed.code === 0 && /ALLES GRUEN/.test(seed.out);

say("deploy gate · eval sets on disk");
const evalSets = evalSetsOnDisk();

const baseline = readBaseline();
const verdict = evaluateGate({ typecheckOk, tests, baseline, seedOk, evalSets });

if (!verdict.ok) {
  say("");
  say("DEPLOY REFUSED");
  for (const reason of verdict.reasons) say(`  - ${reason}`);
  say("Nothing was built and nothing was deployed.");
  process.exit(1);
}

if (verdict.nextBaseline > baseline) {
  writeFileSync(BASELINE_FILE, `${JSON.stringify({ tests: verdict.nextBaseline }, null, 2)}\n`);
  say(`  test baseline raised ${baseline} -> ${verdict.nextBaseline} (scripts/test-baseline.json, commit it)`);
}

say(`gate passed · ${tests.total} tests, typecheck, seed, ${evalSets.present.length} eval sets`);
if (gateOnly) process.exit(0);

// ---------------------------------------------------------------- the deploy

const previous = lastAcceptedVersion();
say(`deploying · last accepted version ${previous ?? "unknown"}`);

if (run("npx", ["vite", "build"], { inherit: true }).code !== 0) {
  say("DEPLOY REFUSED · vite build failed");
  process.exit(1);
}
const deployed = run("npx", ["wrangler", "deploy"]);
process.stdout.write(deployed.out);
if (deployed.code !== 0) {
  say("DEPLOY FAILED · wrangler deploy did not complete");
  process.exit(1);
}
const version = deployed.out.match(/Current Version ID:\s*([0-9a-f-]{36})/i)?.[1] ?? "unknown";

say(`deployed ${version} · waiting ${SETTLE_MS / 1000} s for the edge`);
await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

// ---------------------------------------------------------------- the evals

say("evals against the live URL, all three at once");
const runs = [
  { name: "contractor E1-E9", cmd: "python", args: ["evals/assert_outcomes.py", "--url", LIVE_URL], green: /ALLES GRUEN/ },
  { name: "client C1-C4", cmd: "node", args: ["evals/client_role.mjs", "--url", LIVE_URL], green: /ALLES GRUEN/ },
  { name: "GAEB", cmd: "node", args: ["evals/gaeb_import.mjs", "--url", LIVE_URL], green: /GAEB: BESTANDEN/ }
];
const results = await Promise.all(
  runs.map(
    (entry) =>
      new Promise((resolve) => {
        const result = run(entry.cmd, entry.args);
        resolve({ ...entry, ok: result.code === 0 && entry.green.test(result.out), out: result.out });
      })
  )
);

let allGreen = true;
for (const result of results) {
  say(`  ${result.ok ? "OK   " : "RED  "} ${result.name}`);
  if (!result.ok) {
    allGreen = false;
    process.stdout.write(result.out.split("\n").slice(-25).join("\n"));
    say("");
  }
}

if (!allGreen) {
  say("");
  say(`DEPLOY NOT ACCEPTED · ${version} is live but an eval set is red.`);
  say(`Roll back with: npx wrangler rollback${previous ? ` ${previous}` : ""}`);
  process.exit(1);
}

rememberAcceptedVersion(version);
say(`deploy accepted · ${version} · ${tests.total} unit tests · three eval sets green (scripts/last-deploy.json updated, commit it)`);
