// Minimal forward-only migration runner for Neon Postgres.
// Applies every *.sql file in db-migrations/ in lexical order, tracking applied
// files in a _migrations table so re-runs are idempotent.
//
// Usage:  DATABASE_URL=... node scripts/migrate.mjs
//   or:   op run --env-file .env.local -- npm run db:migrate

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, neonConfig } from "@neondatabase/serverless";

// Neon's Client uses WebSockets. Node 22+ has a global WebSocket; wire it
// explicitly so this never depends on the library's auto-detection.
if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "db-migrations");

const url = process.env.DATABASE_URL;
if (!url || url.startsWith("op://")) {
  console.error(
    "DATABASE_URL is not set to a real value.\n" +
      "Put your Neon pooled connection string in .env.local (replacing the op:// placeholder),\n" +
      "or run with `op run --env-file .env.local -- npm run db:migrate`."
  );
  process.exit(1);
}

function connError(err) {
  if (err && typeof err === "object") {
    if (err.message) return err.message;
    if (err.error && err.error.message) return err.error.message;
  }
  return String(err);
}

const client = new Client(url);

try {
  try {
    await client.connect();
  } catch (err) {
    console.error(`\nCould not connect to the database: ${connError(err)}`);
    console.error(
      "DATABASE_URL must be a Neon connection string (the @neondatabase/serverless\n" +
        "driver only talks to Neon hosts - it will not connect to plain RDS/other Postgres).\n" +
        "Use the pooled string from your Neon project (host contains '-pooler')."
    );
    process.exit(1);
  }

  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query("select name from _migrations")).rows.map((r) => r.name)
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`apply  ${file} ... `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into _migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log("ok");
      count++;
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      throw err;
    }
  }
  console.log(count ? `\nApplied ${count} migration(s).` : "\nUp to date.");
} finally {
  await client.end();
}
