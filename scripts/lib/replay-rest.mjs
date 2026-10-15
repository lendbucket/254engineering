/**
 * A STAND-IN FOR POSTGREST, OVER A REPLAYED DATABASE.
 *
 * Why it exists. Some guarantees can only be proven by running the real
 * application against a real schema: the webhook's money paths (0075) are the
 * first. Development refuses deletes on every money table, so a proof run
 * there would leave probe charges, refunds and audit rows on it for ever,
 * which CLAUDE.md section 6b refuses ("exercised inside migration-audit's
 * replayed database, which is thrown away, rather than by a live audit"). And
 * this repository has no Postgres connection to development, only PostgREST.
 *
 * So a proof replays every migration into PGlite (as migration-audit and the
 * 0068 proof do), starts this server on a port, and points a production build
 * of the app at it as SUPABASE_URL. The app's own supabase-js client talks to
 * it exactly as it talks to PostgREST; nothing in src/ knows.
 *
 * WHAT IT SPEAKS, AND IT REFUSES THE REST. The subset of PostgREST the app's
 * queries use: select with a column list, the filters eq, neq, gt, gte, lt,
 * lte, like, ilike, is and in, their not. forms, or=(...), json paths with ->
 * and ->>, order, limit and offset, count=exact with HEAD, single, insert with
 * return=representation, upsert with on_conflict and merge or ignore, update,
 * delete, and rpc. Anything else (an embedded resource, an unknown operator)
 * answers 400 with what it could not do, so a proof fails loudly rather than
 * reading an answer this server made up.
 *
 * EVERY VALUE IS SENT AS TEXT AND CAST TO THE COLUMN'S OWN TYPE, read from the
 * catalog, the way PostgREST hands Postgres a string. That is also how "now"
 * (DB_NOW) becomes the database's clock rather than the machine's.
 *
 * Errors carry Postgres's own code, message and detail, with PostgREST's
 * statuses for the codes the app branches on (23505 is 409).
 */
import http from "node:http";

const STATUS_FOR_CODE = { "23505": 409, "23503": 409, "23514": 400, "42501": 403, P0001: 400, PGRST116: 406 };

class RestError extends Error {
  constructor(status, body) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

const refuse = (what) => new RestError(400, { code: "STANDIN", message: `the replay stand-in does not support ${what}`, details: null, hint: null });

const ident = (name) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw refuse(`the identifier ${JSON.stringify(name)}`);
  return `"${name}"`;
};

export async function startReplayRest(db, port) {
  const typeCache = new Map();
  async function columnTypes(table) {
    if (typeCache.has(table)) return typeCache.get(table);
    const res = await db.query(
      `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type
         from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = $1 and a.attnum > 0 and not a.attisdropped`,
      [table],
    );
    if (res.rows.length === 0) throw new RestError(404, { code: "42P01", message: `relation "public.${table}" does not exist`, details: null, hint: null });
    const types = new Map(res.rows.map((r) => [r.name, r.type]));
    typeCache.set(table, types);
    return types;
  }

  const fnCache = new Map();
  async function functionArgs(fn) {
    if (fnCache.has(fn)) return fnCache.get(fn);
    const res = await db.query(
      `select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types,
              format_type(p.prorettype, null) as returns, p.proretset as set
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1`,
      [fn],
    );
    if (res.rows.length !== 1) throw new RestError(404, { code: "PGRST202", message: `function public.${fn} not found`, details: null, hint: null });
    const row = res.rows[0];
    const out = { names: row.names ?? [], types: row.types ?? [], returns: row.returns, set: row.set };
    fnCache.set(fn, out);
    return out;
  }

  /* A value as Postgres text, so the cast to the column's type does the parsing. */
  function asText(value, type) {
    if (value === null || value === undefined) return null;
    if (type && /json/.test(type)) return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `{${value.map((v) => (v === null ? "NULL" : `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)).join(",")}}`;
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  /* A column reference: plain, or a json path with -> and ->>. */
  function columnRef(spec, types) {
    const parts = spec.split(/(->>|->)/);
    const base = parts[0];
    if (!types.has(base)) throw new RestError(400, { code: "42703", message: `column ${base} does not exist`, details: null, hint: null });
    let sql = ident(base);
    for (let i = 1; i < parts.length; i += 2) {
      const key = parts[i + 1];
      sql += /^\d+$/.test(key) ? `${parts[i]}${key}` : `${parts[i]}'${key.replace(/'/g, "''")}'`;
    }
    return { sql, type: parts.length > 1 ? (parts[parts.length - 2] === "->>" ? "text" : "jsonb") : types.get(base) };
  }

  function splitTop(s) {
    const out = [];
    let depth = 0, quoted = false, cur = "";
    for (const ch of s) {
      if (ch === '"') quoted = !quoted;
      if (!quoted && ch === "(") depth += 1;
      if (!quoted && ch === ")") depth -= 1;
      if (!quoted && depth === 0 && ch === ",") { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cur !== "") out.push(cur);
    return out;
  }

  /* One filter, column and "op.value", into SQL with its parameters appended. */
  function filterSql(column, expr, types, params) {
    const col = columnRef(column, types);
    let negate = false;
    let rest = expr;
    if (rest.startsWith("not.")) { negate = true; rest = rest.slice(4); }
    const dot = rest.indexOf(".");
    if (dot === -1) throw refuse(`the filter ${column}=${expr}`);
    const op = rest.slice(0, dot);
    const value = rest.slice(dot + 1);
    const param = (v) => { params.push(v); return `$${params.length}::text::${col.type}`; };
    let sql;
    if (op === "eq") sql = `${col.sql} = ${param(value)}`;
    else if (op === "neq") sql = `${col.sql} <> ${param(value)}`;
    else if (op === "gt") sql = `${col.sql} > ${param(value)}`;
    else if (op === "gte") sql = `${col.sql} >= ${param(value)}`;
    else if (op === "lt") sql = `${col.sql} < ${param(value)}`;
    else if (op === "lte") sql = `${col.sql} <= ${param(value)}`;
    else if (op === "like" || op === "ilike") {
      params.push(value.replace(/\*/g, "%"));
      sql = `${col.sql}::text ${op === "like" ? "like" : "ilike"} $${params.length}::text`;
    } else if (op === "is") {
      const v = value.toLowerCase();
      if (!["null", "true", "false", "unknown"].includes(v)) throw refuse(`is.${value}`);
      sql = `${col.sql} is ${v}`;
    } else if (op === "in") {
      if (!value.startsWith("(") || !value.endsWith(")")) throw refuse(`in.${value}`);
      const items = splitTop(value.slice(1, -1)).map((v) => v.replace(/^"(.*)"$/, "$1"));
      sql = items.length === 0 ? "false" : `${col.sql} in (${items.map((v) => param(v)).join(", ")})`;
    } else {
      throw refuse(`the operator ${op}`);
    }
    return negate ? `not (${sql})` : sql;
  }

  function orSql(expr, types, params) {
    if (!expr.startsWith("(") || !expr.endsWith(")")) throw refuse(`or=${expr}`);
    const parts = splitTop(expr.slice(1, -1)).map((term) => {
      const first = term.indexOf(".");
      return filterSql(term.slice(0, first), term.slice(first + 1), types, params);
    });
    return `(${parts.join(" or ")})`;
  }

  const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

  function whereClause(search, types, params) {
    const clauses = [];
    for (const [key, value] of search) {
      if (RESERVED.has(key)) continue;
      if (key === "or") clauses.push(orSql(value, types, params));
      else if (key === "and") throw refuse("and=(...)");
      else clauses.push(filterSql(key, value, types, params));
    }
    return clauses.length ? ` where ${clauses.join(" and ")}` : "";
  }

  function selectList(select, types) {
    if (!select || select === "*") return "*";
    return splitTop(select).map((raw) => {
      const item = raw.trim();
      if (item === "*") return "*";
      if (item.includes("(")) throw refuse(`the embedded resource ${item}`);
      const [alias, spec] = item.includes(":") ? item.split(":") : [null, item];
      const col = columnRef(spec, types);
      const name = alias ?? spec.split(/->>|->/).pop();
      return `${col.sql} as ${ident(name)}`;
    }).join(", ");
  }

  function orderBy(order, types) {
    if (!order) return "";
    return ` order by ${order.split(",").map((term) => {
      const [col, ...mods] = term.split(".");
      const ref = columnRef(col, types).sql;
      const dir = mods.includes("desc") ? "desc" : "asc";
      const nulls = mods.includes("nullsfirst") ? " nulls first" : mods.includes("nullslast") ? " nulls last" : "";
      return `${ref} ${dir}${nulls}`;
    }).join(", ")}`;
  }

  function clean(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v instanceof Date ? v.toISOString() : typeof v === "bigint" ? Number(v) : v;
    }
    return out;
  }

  async function handleTable(method, table, search, headers, body) {
    const types = await columnTypes(table);
    const prefer = String(headers["prefer"] ?? "");
    const wantsObject = String(headers["accept"] ?? "").includes("vnd.pgrst.object+json");
    const representation = prefer.includes("return=representation");
    const select = search.get("select");
    const params = [];

    if (method === "GET" || method === "HEAD") {
      const where = whereClause(search, types, params);
      const limit = search.get("limit");
      const offset = search.get("offset");
      const sql =
        `select ${selectList(select, types)} from public.${ident(table)}${where}${orderBy(search.get("order"), types)}` +
        `${limit ? ` limit ${Number(limit)}` : ""}${offset ? ` offset ${Number(offset)}` : ""}`;
      const rows = method === "HEAD" ? [] : (await db.query(sql, params)).rows.map(clean);
      let total = null;
      if (/count=exact/.test(prefer)) {
        const countParams = [];
        const countWhere = whereClause(search, types, countParams);
        total = Number((await db.query(`select count(*)::int as n from public.${ident(table)}${countWhere}`, countParams)).rows[0].n);
      }
      return respond(rows, { wantsObject, total, head: method === "HEAD" });
    }

    if (method === "POST") {
      const values = Array.isArray(body) ? body : [body];
      const upsert = /resolution=(merge|ignore)-duplicates/.exec(prefer);
      const out = [];
      await db.exec("begin");
      try {
        for (const row of values) {
          const keys = Object.keys(row);
          const p = [];
          const cols = keys.map((k) => { if (!types.has(k)) throw new RestError(400, { code: "PGRST204", message: `column ${k} does not exist`, details: null, hint: null }); return ident(k); });
          const vals = keys.map((k) => { p.push(asText(row[k], types.get(k))); return `$${p.length}::text::${types.get(k)}`; });
          let conflict = "";
          if (upsert) {
            const target = search.get("on_conflict");
            const targetSql = target ? `(${target.split(",").map(ident).join(", ")})` : "";
            conflict = upsert[1] === "ignore"
              ? ` on conflict ${targetSql} do nothing`
              : ` on conflict ${targetSql} do update set ${keys.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(", ")}`;
          }
          const sql = keys.length
            ? `insert into public.${ident(table)} (${cols.join(", ")}) values (${vals.join(", ")})${conflict} returning ${selectList(select, types)}`
            : `insert into public.${ident(table)} default values returning ${selectList(select, types)}`;
          out.push(...(await db.query(sql, p)).rows.map(clean));
        }
        await db.exec("commit");
      } catch (err) {
        await db.exec("rollback");
        throw err;
      }
      return representation ? respond(out, { wantsObject, status: 201 }) : { status: 201, body: "" };
    }

    if (method === "PATCH") {
      const keys = Object.keys(body ?? {});
      const sets = keys.map((k) => {
        if (!types.has(k)) throw new RestError(400, { code: "PGRST204", message: `column ${k} does not exist`, details: null, hint: null });
        params.push(asText(body[k], types.get(k)));
        return `${ident(k)} = $${params.length}::text::${types.get(k)}`;
      });
      const where = whereClause(search, types, params);
      const rows = (await db.query(`update public.${ident(table)} set ${sets.join(", ")}${where} returning ${selectList(select, types)}`, params)).rows.map(clean);
      return representation ? respond(rows, { wantsObject }) : { status: 204, body: "" };
    }

    if (method === "DELETE") {
      const where = whereClause(search, types, params);
      const rows = (await db.query(`delete from public.${ident(table)}${where} returning ${selectList(select, types)}`, params)).rows.map(clean);
      return representation ? respond(rows, { wantsObject }) : { status: 204, body: "" };
    }

    throw refuse(`the method ${method}`);
  }

  function respond(rows, { wantsObject, total = null, head = false, status = 200 }) {
    const headers = {};
    if (total !== null) headers["content-range"] = `${rows.length ? `0-${rows.length - 1}` : "*"}/${total}`;
    if (head) return { status, body: "", headers };
    if (wantsObject) {
      if (rows.length !== 1) {
        throw new RestError(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null });
      }
      return { status, body: JSON.stringify(rows[0]), headers };
    }
    return { status, body: JSON.stringify(rows), headers };
  }

  async function handleRpc(fn, body) {
    const args = await functionArgs(fn);
    const params = [];
    const named = Object.entries(body ?? {}).map(([name, value]) => {
      const i = args.names.indexOf(name);
      if (i === -1) throw new RestError(404, { code: "PGRST202", message: `function public.${fn} has no argument ${name}`, details: null, hint: null });
      params.push(asText(value, args.types[i]));
      return `${ident(name)} => $${params.length}::text::${args.types[i]}`;
    });
    const res = await db.query(`select * from public.${ident(fn)}(${named.join(", ")})`, params);
    const rows = res.rows.map(clean);
    const scalar = res.fields.length === 1 && res.fields[0].name === fn;
    if (scalar && !args.set) return { status: 200, body: JSON.stringify(rows[0]?.[fn] ?? null) };
    return { status: 200, body: JSON.stringify(scalar ? rows.map((r) => r[fn]) : rows) };
  }

  const requests = [];
  let queue = Promise.resolve();

  /*
   * HOLDING A REQUEST, for the proofs of a cut off write. "before" holds it
   * without touching the database, so the write never happened; "after" runs
   * it, commits, and then never answers, so the write happened and the caller
   * cannot know. The application's own 20 second bound abandons both.
   */
  const holds = [];
  const held = [];
  const holdRule = (method, path) => {
    const i = holds.findIndex((h) => h.method === method && h.path === path && h.remaining > 0);
    if (i === -1) return null;
    holds[i].remaining -= 1;
    return holds[i].mode;
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const pathOnly = new URL(req.url, "http://replay").pathname;
      const mode = holdRule(req.method, pathOnly);
      if (mode === "before") {
        requests.push({ method: req.method, path: pathOnly, held: "before" });
        held.push(res);
        return;
      }
      /* One at a time: PGlite is one connection, and a function call is one statement. */
      queue = queue.then(async () => {
        const url = new URL(req.url, "http://replay");
        const raw = Buffer.concat(chunks).toString("utf8");
        requests.push({ method: req.method, path: url.pathname, ...(mode ? { held: mode } : {}) });
        let out;
        try {
          const body = raw ? JSON.parse(raw) : null;
          const rpc = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(url.pathname);
          const table = /^\/rest\/v1\/([a-z_0-9]+)$/.exec(url.pathname);
          if (rpc && req.method === "POST") out = await handleRpc(rpc[1], body);
          else if (table) out = await handleTable(req.method, table[1], url.searchParams, req.headers, body);
          else throw refuse(`the path ${url.pathname}`);
        } catch (err) {
          const status = err instanceof RestError ? err.status : STATUS_FOR_CODE[err.code] ?? 400;
          const body = err instanceof RestError
            ? err.body
            : { code: err.code ?? null, message: err.message, details: err.detail ?? null, hint: err.hint ?? null };
          out = { status, body: JSON.stringify(body) };
        }
        if (mode === "after") {
          held.push(res);
          return;
        }
        res.writeHead(out.status, { "content-type": "application/json", ...(out.headers ?? {}) });
        res.end(out.body);
      });
    });
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    /** Hold the next `times` requests matching method and path, "before" or "after" the database. */
    hold: (method, path, mode, times = 1) => holds.push({ method, path, mode, remaining: times }),
    /** Drop every held connection and forget every rule. */
    releaseHeld: () => {
      for (const r of held.splice(0)) r.destroy();
      holds.splice(0);
    },
    close: () =>
      new Promise((resolve) => {
        for (const r of held.splice(0)) r.destroy();
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
