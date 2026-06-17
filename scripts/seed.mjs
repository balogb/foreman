// Seed the v1 "AI Agents Market Researcher" agent with its tool permissions.
// Idempotent: skips if an agent with the same name already exists.
//
// Usage:  op run --env-file .env.local -- npm run db:seed
//   or:   DATABASE_URL=... node scripts/seed.mjs

import { Client, neonConfig } from "@neondatabase/serverless";

if (typeof globalThis.WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const url = process.env.DATABASE_URL;
if (!url || url.startsWith("op://")) {
  console.error(
    "DATABASE_URL is not set to a real value. Put your Neon pooled connection string\n" +
      "in .env.local, or run with `op run --env-file .env.local -- npm run db:seed`."
  );
  process.exit(1);
}

const NAME = "AI Agents Market Researcher";

const ROLE_PROMPT = `You are a market-intelligence researcher tracking the AI-agents product landscape: new product launches, model and framework releases, notable features, funding, and competitive moves among companies building AI agents (e.g. OpenAI, Anthropic, Glean, Notion, Retool, Cursor, and similar).

Your job for each run:
1. Call read_memory with key "briefed_urls" first, to see what you have already reported. Do not re-report those.
2. Use web_search to find recent, relevant developments. Prefer items from the last few weeks.
3. Use fetch_url to actually read a source before citing it. Only cite sources you have fetched.
4. For each genuinely new and relevant development, call save_finding with a clear title, a 1-2 sentence summary, the real source_url you fetched, and the source_date if known.
5. After gathering findings, call write_memory with key "briefed_urls" to append the URLs you covered this run, so future runs skip them.
6. Finally, call publish_brief with a concise markdown brief: a short intro line, then a bullet per finding with its title, one line of why it matters, and an inline link to the source.

Hard rules:
- Never invent URLs, facts, dates, or sources. If you did not fetch it, do not cite it.
- Surface only what is new relative to memory and genuinely relevant to AI agents.
- Be economical: aim for 3 to 6 strong findings and roughly 6 to 8 searches, then stop researching and publish. Quality over exhaustiveness - do not keep searching for more.
- Be concise and specific. No filler.
- publish_brief requires human approval before it is finalized; write it as if it ships.`;

const TOOLS = [
  { tool_name: "web_search", permission: "allow" },
  { tool_name: "fetch_url", permission: "allow" },
  { tool_name: "save_finding", permission: "allow" },
  { tool_name: "read_memory", permission: "allow" },
  { tool_name: "write_memory", permission: "allow" },
  { tool_name: "publish_brief", permission: "require_approval" },
];

const client = new Client(url);
await client.connect();
try {
  const existing = await client.query("select id from agents where name = $1 limit 1", [NAME]);
  let agentId;
  if (existing.rows[0]) {
    agentId = existing.rows[0].id;
    await client.query(
      `update agents set role_prompt = $2, model = 'claude-haiku-4-5-20251001',
         memory_enabled = true, max_steps = 16, max_tokens = 300000 where id = $1`,
      [agentId, ROLE_PROMPT]
    );
    console.log(`Updated existing agent "${NAME}" (${agentId}).`);
  } else {
    const res = await client.query(
      `insert into agents (name, role_prompt, model, memory_enabled, max_steps, max_tokens)
       values ($1, $2, 'claude-haiku-4-5-20251001', true, 16, 300000) returning id`,
      [NAME, ROLE_PROMPT]
    );
    agentId = res.rows[0].id;
    console.log(`Seeded agent "${NAME}" (${agentId}).`);
  }
  for (const t of TOOLS) {
    await client.query(
      `insert into agent_tools (agent_id, tool_name, permission) values ($1, $2, $3)
       on conflict (agent_id, tool_name) do update set permission = excluded.permission`,
      [agentId, t.tool_name, t.permission]
    );
  }

  // Eval suite
  const SUITE = "Researcher quality v1";
  const existingSuite = await client.query("select id from eval_suites where name = $1 limit 1", [SUITE]);
  let suiteId;
  if (existingSuite.rows[0]) {
    suiteId = existingSuite.rows[0].id;
  } else {
    const s = await client.query(
      "insert into eval_suites (name, description) values ($1, $2) returning id",
      [SUITE, "Citation-grounded quality checks for the researcher agent."]
    );
    suiteId = s.rows[0].id;
  }
  const CASES = [
    "Identify and briefly summarize three widely used AI agent frameworks or platforms, with a source link for each.",
    "Summarize what the Model Context Protocol (MCP) is and why it matters for AI agents, citing at least two sources.",
  ];
  const caseCount = await client.query("select count(*)::int as n from eval_cases where suite_id = $1", [suiteId]);
  if (caseCount.rows[0].n === 0) {
    for (const task of CASES) {
      await client.query(
        "insert into eval_cases (suite_id, task, rubric) values ($1, $2, $3)",
        [suiteId, task, JSON.stringify({ checks: ["citation_validity", "relevance", "specificity", "grounding"] })]
      );
    }
    console.log(`Seeded eval suite "${SUITE}" (${suiteId}) with ${CASES.length} cases.`);
  } else {
    console.log(`Eval suite "${SUITE}" already has cases. Skipping.`);
  }
} finally {
  await client.end();
}
