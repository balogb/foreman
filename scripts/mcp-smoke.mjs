// Smoke test for the Foreman MCP server: spawns it, lists tools, and calls
// list_briefs (no Anthropic cost). Usage: node scripts/mcp-smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["--env-file-if-exists=.env.local", "--import", "tsx", "scripts/mcp-server.ts"],
});

const client = new Client({ name: "foreman-smoke", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name).join(", "));

const res = await client.callTool({ name: "list_briefs", arguments: { limit: 5 } });
const text = (res.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
console.log("list_briefs ->\n" + text.split("\n").slice(0, 6).join("\n"));

await client.close();
console.log("OK: MCP server handshake + tool call succeeded.");
