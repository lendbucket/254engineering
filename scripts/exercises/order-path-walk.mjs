// THE ORDER PATH, ON DEVELOPMENT, FROM ORDER TO SEALED LETTER TO REFUND. Operator ruling 1 of 2026-10-07, option B.
//
//   node node_modules/tsx/dist/cli.mjs scripts/exercises/order-path-walk.mjs
//
// It LEAVES ROWS ON DEVELOPMENT FOR GOOD, because sealed and append-only records refuse deletes: two orders, their
// payments and refund, two files, a seal act and its locked document, and audit events. Every one is labelled as
// test data (is_demo, -DEMO- numbers, "not a real" names and addresses), and the three test accounts it makes live
// on @order-walk.invalid, outside the probe sweep's domain, and are suspended when it ends. The test engineer exists
// only inside the child process; compliance-audit fails the board if it ever reaches the shipped register.
//
// Opens the gate with the repository's own fixture (config patched on disk and restored, as every gated audit does),
// takes the machine lock, and runs the walk in a child process so it reads the open gate at module load.
import { spawnSync } from "node:child_process";
const ROOT = new URL("../../", import.meta.url).href;
const { withGateConditionsMet, FIXTURE_ENV } = await import(ROOT + "scripts/lib/gate-fixture.mjs");
const { takeLock } = await import(ROOT + "scripts/lib/machine-lock.mjs");
const release = await takeLock({ project: "254engineering", label: "order path walk", onWait: (h) => console.log(`waiting on ${h.project}`) });
try {
  await withGateConditionsMet(async () => {
    const r = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--conditions=react-server", "scripts/exercises/order-path-walk-child.mjs"], {
      encoding: "utf8",
      env: { ...process.env, ...FIXTURE_ENV, LAUNCH_MODE: "live", ORDER_PAYMENTS_FAKE: "1" },
      maxBuffer: 64 * 1024 * 1024,
    });
    process.stdout.write(r.stdout);
    process.stdout.write(r.stderr.split(/\r?\n/).filter((l) => !/DeprecationWarning|trace-deprecation/.test(l)).join("\n"));
    console.log(`\nchild exit ${r.status}`);
  });
} finally {
  release();
}
