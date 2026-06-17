/**
 * Tool registry - the contract for what an agent can do.
 *
 * Each tool declares a name, a human description, an input schema (JSON Schema,
 * passed straight to the Claude API tool definition), a default permission, and
 * a risk level used by the UI to flag actions that should require approval.
 *
 * Phase 0 defines the contract only. Phase 1 wires `execute` implementations and
 * the agent loop; Phase 2 enforces the permission model and the approval queue.
 */

export type Permission = "allow" | "require_approval" | "deny";
export type Risk = "low" | "medium" | "high";

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  defaultPermission: Permission;
  risk: Risk;
}

export const TOOL_REGISTRY: Record<string, ToolSpec> = {
  web_search: {
    name: "web_search",
    description: "Search the public web for sources relevant to a query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        max_results: { type: "integer", description: "Max results (default 5)." },
      },
      required: ["query"],
    },
    defaultPermission: "allow",
    risk: "low",
  },
  fetch_url: {
    name: "fetch_url",
    description: "Fetch and extract the readable text of a public URL.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string", description: "Absolute URL to fetch." } },
      required: ["url"],
    },
    defaultPermission: "allow",
    risk: "low",
  },
  save_finding: {
    name: "save_finding",
    description:
      "Record a discrete finding with a source URL and date. Deduped against prior findings.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        source_url: { type: "string" },
        source_date: { type: "string", description: "ISO date of the source, if known." },
      },
      required: ["title", "source_url"],
    },
    defaultPermission: "allow",
    risk: "low",
  },
  read_memory: {
    name: "read_memory",
    description: "Read what the agent already knows so it surfaces only new items.",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
    },
    defaultPermission: "allow",
    risk: "low",
  },
  write_memory: {
    name: "write_memory",
    description: "Persist state for future runs (e.g. what has already been briefed).",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string" },
        value: { type: "object" },
      },
      required: ["key", "value"],
    },
    defaultPermission: "allow",
    risk: "medium",
  },
  publish_brief: {
    name: "publish_brief",
    description:
      "Compile findings into a brief and publish it. Gated: requires human approval before it is finalized.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Markdown brief with inline citations." },
      },
      required: ["title", "content"],
    },
    defaultPermission: "require_approval",
    risk: "high",
  },
};

export const TOOL_NAMES = Object.keys(TOOL_REGISTRY);
