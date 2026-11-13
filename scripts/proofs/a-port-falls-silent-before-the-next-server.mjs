/**
 * A PORT FALLS SILENT BEFORE THE NEXT SERVER STARTS ON IT. Board 42505750069
 * (2026-11-08): the next writers audit found port 4300 still answering after
 * native-audit stopped its server, refused to start, correctly, and fourteen
 * audits never ran. BACKLOG, "THE WRITERS SHARD CAN STOP ON ITS OWN SERVER";
 * built under Robert's overnight orders of 2026-11-13, item 3.
 *
 *   node scripts/proofs/a-port-falls-silent-before-the-next-server.mjs
 *
 *   A  waitUntilFree, against real sockets on this machine: a server that
 *      closes after a moment is waited out; one that never closes is not, and
 *      the wait ends at its bound rather than hanging.
 *   B  startNextServer waits before it refuses, refuses only after the bound,
 *      and names the listener when it does; stop() waits for the port too.
 *
 * Makes no Next server; the two listeners it opens are its own and are closed.
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { waitUntilFree, listenerOn, PORT_RELEASE_MS } from "../lib/dev-server.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const listen = () =>
  new Promise((resolve) => {
    const server = http.createServer((_, res) => res.end("held"));
    server.listen(0, "localhost", () => resolve(server));
  });

console.log("A  waitUntilFree, on real sockets");
{
  const nothing = await waitUntilFree("http://localhost:1", 1000);
  check("A: a port nothing answers on is free at once", nothing === true);

  const closing = await listen();
  const closingBase = `http://localhost:${closing.address().port}`;
  setTimeout(() => {
    closing.closeAllConnections?.();
    closing.close();
  }, 1500);
  const t0 = Date.now();
  const freed = await waitUntilFree(closingBase, 10_000);
  check("A: a server that closes after a moment is waited out, not refused", freed === true, `${Date.now() - t0} ms`);

  const held = await listen();
  const heldPort = held.address().port;
  const t1 = Date.now();
  const stillHeld = await waitUntilFree(`http://localhost:${heldPort}`, 2000);
  const took = Date.now() - t1;
  check("A: a server that never closes is not waited out", stillHeld === false);
  check("A: and the wait ends at its bound rather than hanging", took >= 2000 && took < 6000, `${took} ms against a 2000 ms bound`);
  check("A: the listener is named for the refusal, or the reason it could not be", typeof listenerOn(heldPort) === "string" && listenerOn(heldPort).length > 0, listenerOn(heldPort));
  held.closeAllConnections?.();
  held.close();
}

console.log("B  the starter and the stopper use it");
{
  const src = readFileSync("scripts/lib/dev-server.mjs", "utf8");
  const start = src.indexOf("export async function startNextServer");
  const body = src.slice(start);
  const waitAt = body.indexOf("await waitUntilFree(base, PORT_RELEASE_MS)");
  const refuseAt = body.indexOf("Refusing to start");
  check("B: startNextServer waits for the port before it refuses", waitAt > 0 && refuseAt > waitAt, `wait at ${waitAt}, refusal at ${refuseAt}`);
  check("B: and the refusal names the listener", /Listening: \$\{listenerOn\(port\)\}/.test(body));
  check("B: stop() stops the tree and then waits for the port", /await stopTree\(child\);\s*\n\s*if \(!\(await waitUntilFree\(base, PORT_RELEASE_MS\)\)\)/.test(body));
  check("B: the bound is thirty seconds", PORT_RELEASE_MS === 30_000, String(PORT_RELEASE_MS));
}

console.log(wrong === 0 ? "\nPASS: a port falls silent before the next server starts on it." : `\nFAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
