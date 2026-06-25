# Foreman

A control plane for trustworthy AI agents.

**Live:** https://foreman-mauve.vercel.app · **Case study:** [CASE_STUDY.md](./CASE_STUDY.md) · **Walkthrough:** [DEMO.md](./DEMO.md)

> Foreman is a generalized version of a product in production. The production
> system is under NDA; this is the public, built-from-scratch equivalent.

Wiring an LLM to a few tools is easy. Making an agent safe to run inside a real
organization is the hard part: what it is allowed to do, what needs a human's
sign-off, what it remembered, what it actually did, and whether it is getting
better or worse over time. Foreman is the layer that handles those parts.

Create an agent, configure its tools and permissions, run it, gate risky actions
behind human approval, keep a full audit trail, and score it with an eval suite.

The first agent that runs on it is a real tool: an **AI-agents market-intelligence
researcher** that tracks the public agent-product landscape and hands you cited
briefs, surfacing only what is new since last time.

## Demo

**Watch a real run, no key required:** the static walkthrough at
[foreman-mauve.vercel.app/demo](https://foreman-mauve.vercel.app/demo) shows a full
run end to end - live trace, human-in-the-loop approval, a cited report, and the
audit trail as live SQL against the run's own rows - without an operator key or any
token spend.

<!-- Screen recording: on github.com, click "Edit" on this file and drag the .mov onto
     the line below. GitHub uploads it to its CDN and inserts an inline video player
     automatically (supports .mp4/.mov/.webm up to ~100MB). Then delete this comment. -->

<!-- DRAG THE SCREEN RECORDING HERE -->

## The lifecycle

1. **Create** an agent (name, role, model).
2. **Configure** its tools (`allow` / `require approval` / `deny`), memory, and budget.
3. **Run** a task and watch the live execution trace.
4. **Approve** high-risk actions in a human-in-the-loop queue.
5. **Audit** every run and decision.
6. **Evaluate** against a fixed test suite with a quality scorecard.

## Stack

- Next.js (App Router) + Tailwind, deployed on Vercel.
- Claude API for the agent loop (tool use, step/token budgets, approval checkpoints).
- Neon (serverless Postgres) for agents, runs, traces, approvals, findings, and evals.

## Status

Early build. See [PRD.md](./PRD.md) for the full spec and phased plan.

- [x] Phase 0 - spec + scaffold + schema
- [x] Phase 1 - researcher agent loop, tools, API, live trace UI (verified end-to-end)
- [x] Phase 2 - permission model + approval queue + audit log (verified)
- [x] Phase 3 - eval suite: citation-validity check + LLM-as-judge + scorecard (verified)
- [x] R5 - expose Foreman over MCP (stdio): run_research / list_briefs / get_brief (verified)
- [x] Deployed (Vercel) + case study + walkthrough
- [ ] Next - generalize into a multi-agent workbench; Streamable-HTTP MCP transport

First live run (Haiku 4.5 + Brave free): 25 tool calls, 3 cited findings saved,
paused at `publish_brief`, resumed on approval, published the brief.

### Techniques implemented (verified live)

- **Extended thinking** - the agent reasons before acting; thinking blocks are
  persisted and shown in the trace.
- **Prompt caching** - cache_control on the system prompt, tools, and a moving
  conversation breakpoint; cuts billable input tokens sharply on multi-turn runs.
- **Context engineering** - cross-run memory hydrated into the opening context,
  plus context compaction (eliding old tool results past a threshold) so long
  runs stay within the window.
- **Human-in-the-loop governance** - per-tool allow / require-approval / deny,
  an approval queue, and a full audit trail.
- **Graceful convergence** - on budget exhaustion the agent is forced to publish
  with what it has rather than failing.
- **SSRF protection** - `fetch_url` refuses private / loopback / metadata targets.

## Local development

Set up `.env.local` with `DATABASE_URL` (Neon), `ANTHROPIC_API_KEY`, and
`BRAVE_API_KEY` (see `.env.local.example`; `op://` references work via `op run`).

```bash
npm install
npm run db:migrate     # apply the schema to your Neon database
npm run db:seed        # create the "AI Agents Market Researcher" agent
npm run dev            # http://localhost:3000/agents
```

Then open `/agents`, hit Run on the researcher, and watch the trace. When it
proposes `publish_brief` it will pause for your approval. Database schema lives
in `db-migrations/`.

Useful scripts: `npm run doctor` (check keys), `npm run reset-memory` (clear the
researcher's accumulated memory/findings before a clean demo).

## MCP server

Foreman is also an MCP server, so any MCP client can drive it. Tools:
`run_research(task)`, `list_briefs(limit)`, `get_brief(brief_id)`. (Approvals are
auto-granted in MCP mode, logged as `mcp-client`.)

```bash
npm run mcp          # stdio MCP server
```

Add it to an MCP client (e.g. Claude Desktop / Claude Code) config:

```json
{
  "mcpServers": {
    "foreman": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/foreman"
    }
  }
}
```

## Deploying (Vercel)

Two production concerns are handled in code:

- **Background execution.** Runs and evals execute via `after()` rather than
  blocking the HTTP response, so the request returns immediately with an id and
  the UI polls / auto-refreshes for progress. API routes set `maxDuration = 300`;
  on Vercel this needs Fluid Compute (or a plan whose function limit covers a
  full run). For much longer workloads, move the drivers to a queue.
- **Access gate.** Set `FOREMAN_OPERATOR_KEY` in the Vercel project. Read-only
  browsing stays public (good for a portfolio link); the paid endpoints
  (`/api/runs`, `/api/approvals`, `/api/evals`) require the key. The UI prompts
  for it once and remembers it.

Set `DATABASE_URL`, `ANTHROPIC_API_KEY`, `BRAVE_API_KEY`, and
`FOREMAN_OPERATOR_KEY` as Vercel environment variables, then deploy.

## Notes

All data is public (the researcher reads public sources only). No personal or
client data. Built as a working tool and a reference implementation of governed,
auditable, evaluated agents.
