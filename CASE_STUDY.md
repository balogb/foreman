# Foreman - Case Study

**A control plane for trustworthy AI agents.**

- Live: https://foreman-mauve.vercel.app
- Code: https://github.com/balogb/foreman
- Stack: Next.js 16, Claude API, Neon Postgres, Vercel

> Foreman is a generalized version of a product in production. The production
> system is under NDA, so no further information about it is provided here; this
> is the public, built-from-scratch equivalent on public data.

## What this proves (read this first)

Anyone can wire an LLM to a few tools and get an impressive-looking demo. The part
that actually decides whether an agent ships inside a real company - what it is
allowed to do, what needs a human's sign-off, a record of what it did, staying
inside the context window, and a way to know if it is any good - is the part most
demos skip. **Foreman is built entirely around that part.**

It demonstrates four things:

1. **Product judgment.** I recognized that the durable value in agents is the
   trust-and-evaluation layer, not the model call, and built the product around
   it. I scoped it vertical-first (one genuinely useful agent) while architecting
   it to generalize into a multi-agent workbench.
2. **Current technical depth.** Extended thinking, prompt caching, context
   engineering, an MCP server, and an evaluation harness are implemented and
   verified running in production - not described from having read about them.
3. **A governance instinct.** Per-tool permissions, a human-in-the-loop approval
   gate, and a complete audit trail are what make an agent safe to run in a
   regulated or enterprise setting. That is the hardest part to fake, and it is
   the part I most want to be building.
4. **Rigor and honesty.** The agent is measured by an eval suite that catches real
   failures (not vanity numbers); the system is cost-disciplined and deployed
   behind an access gate; and the status of every claim is stated plainly.

**In one sentence:** *I build agents an organization could actually trust to do
real work, and I can show you the governance, evaluation, and cost engineering
that makes that true.*

## The problem it answers

"Agentic AI" demos are everywhere, and most fall over the moment you ask the
questions a real adopter asks: Can it take an action I did not sanction? Who
approved that? What did it actually look at? What happens when the context fills
up? Is it getting better or worse over time? Those questions - not the model - are
what stall agents in real organizations. Foreman exists to answer them.

## What it does

The full agent lifecycle in one product:

1. **Create** an agent (name, role, model).
2. **Configure** its tools - each set to `allow`, `require approval`, or `deny` -
   plus memory and a budget. *(An agent's blast radius is a configuration
   decision, not an afterthought.)*
3. **Run** a task and watch the live execution trace - reasoning, tool calls,
   retrieved context, memory reads/writes. *(This is the observability and audit
   surface.)*
4. **Approve** - high-risk actions pause in a human-in-the-loop queue showing the
   proposed action and the agent's rationale. *(Nothing consequential happens
   without a person.)*
5. **Audit** - every run and every decision is recorded: who, what, when, why.
6. **Evaluate** - score the agent against a fixed suite with a quality scorecard.
   *(You can tell whether a change made the agent better or worse.)*

## The first agent

An **AI-agents market-intelligence researcher**: it searches public sources, reads
them, dedupes against its own memory of prior briefs, and publishes a cited brief
of what is new - with the publish step gated behind human approval. It is a real
tool (the briefs are worth reading) and the vehicle that exercises every part of
the platform.

## Architecture

- **App / UI:** Next.js 16 (App Router) + Tailwind on Vercel.
- **Agent loop:** Claude API tool-use loop with step and token budgets; run state
  is persisted so a run paused for approval can resume.
- **Persistence:** Neon serverless Postgres - agents, runs, an ordered step trace,
  tool calls, approvals, findings, briefs, agent memory, and eval results.
- **Execution:** runs and evals execute in the background (Next `after()`) so the
  request returns immediately and the UI polls for progress.
- **Access:** read-only browsing is public; the paid endpoints require an operator
  key, so a public URL cannot spend the model budget.

## Techniques - and what each one proves

Each technique is here to back a specific claim, not for novelty:

- **Extended thinking** - the agent reasons before acting, surfaced in the trace.
  *Proves:* fluency with current reasoning-model behavior, and a bias toward
  making agent decisions inspectable.
- **Prompt caching** - `cache_control` on the system prompt, tools, and a moving
  conversation breakpoint. *Proves:* production cost-engineering; billable input
  tokens drop sharply across a multi-turn run.
- **Context engineering** - cross-run memory is hydrated into the opening context,
  and a compaction pass elides old tool results as the window grows. *Proves:* I
  treat the context window as an engineered, finite resource - the literal
  "context and memory systems" these roles ask for.
- **Human-in-the-loop governance** - per-tool permissions, an approval queue, and a
  full audit trail (approvals record who decided: operator, eval-harness, or
  mcp-client). *Proves:* the core skill - making an agent safe to operate.
- **Evaluation** - a programmatic citation-validity check (every URL cited must
  have actually been fetched - an anti-hallucination guard) plus an LLM-as-judge
  on relevance, specificity, and grounding. *Proves:* I measure agent quality and
  catch regressions - rare in a portfolio, and the thing that separates a toy from
  a maintained product.
- **MCP server** - Foreman exposes `run_research`, `list_briefs`, `get_brief`.
  *Proves:* fluency with the emerging interoperability standard for agents.
- **Graceful degradation** - on budget exhaustion the agent is forced to publish
  with what it has rather than failing. *Proves:* product thinking about failure
  modes, not just the happy path.
- **SSRF guard** - `fetch_url` refuses private / loopback / cloud-metadata targets.
  *Proves:* security instinct for a tool that follows model-chosen URLs.

## Results

- The full lifecycle - create, configure, run, approve, audit, evaluate, and MCP
  access - is verified against live infrastructure, not just in tests.
- Representative eval run: one case scored **0.80 (pass)** and another **0.25
  (fail)**, where the eval correctly caught a real failure (the agent produced no
  brief). *The point:* the eval surfaces genuine problems, which is what makes it
  worth having.
- Prompt caching cut billable input tokens on a multi-turn run by roughly an order
  of magnitude; a full research run costs a few cents on Haiku 4.5.

## Engineering judgment on display

- Built vertical-first (one working agent) but architected to generalize.
- Status is framed honestly throughout - "built and verified," never inflated.
- Real bugs were found and fixed through live testing, not assumed away: the token
  budget was counting near-free cached reads and prematurely failing runs; a
  script runner transformed TypeScript to CommonJS and broke top-level `await`.

## What's next

- Streamable-HTTP MCP transport (so the MCP server works against the deployed URL).
- A job queue for very long runs (beyond a single function's window).
- Multi-agent orchestration and per-user auth with row-level security.

## Demo

A five-minute walkthrough - scripted so the point of each step is explicit - is in
[DEMO.md](./DEMO.md).
