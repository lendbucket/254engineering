/**
 * EVERY INSERT INTO ORDERS OR FILES SAYS WHETHER IT IS A DEMONSTRATION.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/every-order-and-file-insert-says-whether-it-is-a-demo.mjs
 *
 * Found 2026-10-07 by the order path walk on development. A probe address gets
 * a -DEMO- reference (operator ruling of 2026-09-08) and the database requires
 * is_demo to agree with it (eng_orders_demo_reference_agrees,
 * eng_files_demo_number_agrees). placeOrder and the telephone job's billing
 * insert never set is_demo, so every order from an unroutable address was
 * refused with the raw constraint message, and nothing had ever placed one
 * through the product to notice.
 *
 * The class, not the instance: every `.insert(` on eng_service_orders or
 * eng_files under src must name is_demo, so the next insert written cannot
 * repeat it. Read from source, a stated proxy; the walk is what proved the
 * defect live.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p.split("\\").join("/"));
  }
};
walk("src");

const inserts = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const table of ["eng_service_orders", "eng_files"]) {
    const marker = `.from("${table}")`;
    let at = src.indexOf(marker);
    while (at >= 0) {
      /*
       * The chain that starts here, to its `.select(` or to a semicolon that
       * ends a line. Not to the first semicolon: the first version stopped
       * inside a comment in the insert ("by the same predicate; see ...") and
       * reported a flag that was there as missing.
       */
      const rest = src.slice(at);
      const stops = [rest.indexOf(".select("), rest.search(/;\s*\n/)].filter((n) => n >= 0);
      const chain = rest.slice(0, stops.length ? Math.min(...stops) : undefined);
      if (/^\.from\("[a-z_]+"\)\s*\.insert\(/.test(chain)) {
        inserts.push({ file: f, table, line: src.slice(0, at).split("\n").length, setsDemo: /\bis_demo\s*:/.test(chain) });
      }
      at = src.indexOf(marker, at + marker.length);
    }
  }
}

check("the source tree was read, and inserts were found to check", files.length > 100 && inserts.length >= 3, `${files.length} files, ${inserts.length} insert(s)`);
const silent = inserts.filter((i) => !i.setsDemo);
check(
  "every insert into eng_service_orders or eng_files sets is_demo",
  silent.length === 0,
  silent.map((i) => `${i.file}:${i.line} (${i.table})`).join("; ") || inserts.map((i) => `${i.file.split("/").pop()}:${i.line}`).join(", "),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: every insert into orders or files says whether it is a demonstration.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
