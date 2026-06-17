# Foreman - PRD

*Working name; easy to rename. "Foreman" = the layer that supervises a crew of agents so the work is safe to run.*

A control plane for trustworthy AI agents: create an agent, configure its tools and permissions, run it, gate risky actions behind human approval, keep a full audit trail, and score it with an eval suite. The first agent that runs on it is a real, useful tool - an AI-agents market-intelligence researcher.

## Problem

Wiring an LLM to a few tools is easy. Making an agent safe to run inside a real organization is not. The hard parts - what it is allowed to do, what needs a human's sign-off, what it remembered, what it actually did, and whether it is getting better or worse over time - are exactly what gets skipped in demos and exactly what blocks adoption in practice. Foreman is the layer that handles those parts.

## Users

- **Operator:** someone who wants a researcher agent that tracks the AI-agents product landscape and returns cited briefs they can trust, plus a workbench to keep extending.
- **Non-technical operator:** stand up, govern, and trust an agent without reading code.

## Goals / Non-goals

**Goals**
- Exercise the full agent lifecycle end to end: create -> configure -> run -> approve -> audit -> evaluate.
- Be genuinely functional: the v1 researcher produces briefs worth reading.
- Be a stable, extensible core so adding a second tool or domain is an increment, not a rewrite.
- Deploy to a public URL anyone can try.

**Non-goals (v1)**
- Multi-tenant auth, billing, teams. Single operator.
- A large tool marketplace. A small, real tool registry.
- Model training / fine-tuning. Inference + orchestration only.
- Any personal or sensitive data. Public sources only.

## The lifecycle (what the product does)

1. **Create** - define an agent: name, role/system prompt, model.
2. **Configure** - pick tools from a registry; set each tool to `allow` / `require-approval` / `deny`; toggle memory on/off; set a budget cap (max steps / tokens).
3. **Run** - give it a task; watch a live execution trace: reasoning steps, tool calls, retrieved context, memory reads/writes, token + step spend.
4. **Approve** - any `require-approval` tool call pauses in an approval queue showing the proposed action and the agent's rationale; operator approves or rejects; the decision is logged and the run resumes or aborts.
5. **Audit** - every run and every approval decision is recorded in a reviewable, filterable log (who/what/when/why).
6. **Evaluate** - a named test suite runs the agent against fixed tasks and scores results against a rubric; a dashboard shows pass rate and regressions across runs.

## v1 agent: AI-agents market-intelligence researcher

**Job:** monitor a curated set of public sources for movement in the AI-agents space and produce a cited brief of what is *new* since last time.

**Tools (the v1 registry):**
- `web_search` (allow) - find candidate sources.
- `fetch_url` (allow) - read a page.
- `save_finding` (allow) - write a finding to the store with source + date.
- `read_memory` / `write_memory` (allow) - what has already been briefed, so it surfaces only new items.
- `publish_brief` (**require-approval**) - the gated action. Compiles findings into a brief; a human approves before it is finalized/sent. This is the demo's human-in-the-loop moment.

**Memory:** a store of prior findings and briefs, so the agent dedupes against what I have already seen and reports deltas.

**Eval rubric (scored 0-1 each, weighted):**
- Citation validity - every claim maps to a fetched source URL (no fabrication).
- Recency - findings are genuinely new vs. the memory store.
- Relevance - on-topic for the agent ecosystem.
- No-hallucination check - an LLM judge plus a hard check that cited URLs were actually fetched in the run.

**Metrics that prove product judgment:** brief precision (useful items / total items), citation-validity rate, approval edit rate (how often I change what it proposed), and eval pass-rate trend over time.

## Demo script (~5 min)

Create the researcher -> configure its tools and set `publish_brief` to require approval -> run "what changed in the agent-platform space this week" -> watch it search, fetch, remember, and dedupe in the trace -> it pauses for approval on `publish_brief` with a drafted brief + rationale -> approve -> show the finalized brief with citations -> open the audit log for the run -> run the eval suite -> show the scorecard and the citation-validity rate.

## Architecture

- **Frontend / app:** Next.js + Tailwind on Vercel (public URL).
- **Agent loop:** Claude API (tool use), server-side orchestration with step/token budgets and a pause/resume checkpoint for approvals.
- **Tools:** typed registry; web search + fetch; a memory/findings store.
- **Persistence:** Neon (serverless Postgres) - agents, runs, steps, tool calls, approvals, findings, eval results.
- **Eval:** a runner that executes the agent over a fixed task set and writes scored results.
- **Secrets:** Anthropic key etc. via env / 1Password reference, never committed.

## Build phases

- **Phase 0 - spec + scaffold:** this PRD, repo init, Next.js + Neon skeleton, schema.
- **Phase 1 - vertical agent works:** the researcher runs end-to-end with the trace view; findings persist. *Functional and beneficial here.*
- **Phase 2 - governance:** permission model + approval queue + audit log. *This is the differentiator.*
- **Phase 3 - eval:** test suite + scorecard dashboard.
- **Phase 4 - generalize + deploy:** extract the tool registry / agent-config UI so a second agent or tool is an increment; deploy public; write the case study + demo recording.

## Honesty constraints

- Frame status accurately at each phase: "built / working in demo," never "in production with users" until that is true.
- All sources public; no personal or client data. Prior client and personal project work informs the design but is never named, linked, or exposed (client systems are under NDA).
