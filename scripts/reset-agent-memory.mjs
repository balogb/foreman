// Demo hygiene: clear an agent's accumulated memory and findings so fresh runs
// produce full briefs (the researcher otherwise dedupes everything as "already
// covered"). Does NOT touch runs/briefs history. Defaults to the researcher.
//
// Usage: npm run reset-memory   (or pass a name: node scripts/reset-agent-memory.mjs "Some Agent")

import { Client, neonConfig } from "@neondatabase/serverless";

if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const url = process.env.DATABASE_URL;
if (!url || url.startsWith("op://")) {
  console.error("DATABASE_URL is not set to a real value.");
  process.exit(1);
}

const NAME = process.argv[2] || "AI Agents Market Researcher";

const client = new Client(url);
await client.connect();
try {
  const a = await client.query("select id from agents where name = $1 limit 1", [NAME]);
  if (!a.rows[0]) {
    console.error(`Agent "${NAME}" not found.`);
    process.exit(1);
  }
  const agentId = a.rows[0].id;
  const mem = await client.query("delete from memory where agent_id = $1", [agentId]);
  const find = await client.query("delete from findings where agent_id = $1", [agentId]);
  console.log(`Reset "${NAME}": cleared ${mem.rowCount} memory row(s), ${find.rowCount} finding(s).`);
} finally {
  await client.end();
}
