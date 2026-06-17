# Foreman - walkthrough

A short guided tour of the live app: https://foreman-mauve.vercel.app

> Foreman is a generalized version of a product in production. The production
> system is under NDA; this is the public, built-from-scratch equivalent.

Foreman is built around one idea: wiring an LLM to tools is the easy part; what
makes an agent safe to run inside a real organization - permissions, human
approval, an audit trail, context limits, and a way to measure quality - is the
hard part most demos skip. Each step below shows a piece of that.

Read-only browsing is public, so you can explore past runs, briefs, and eval
scorecards freely. Running an agent (which spends model budget) is gated behind an
operator key.

## 1. The agent and its permissions

Open `/agents` and look at the researcher's tool list. Each tool is set to
`allow`, `require-approval`, or `deny` - searching and reading are allowed,
publishing requires a human. An agent's blast radius is a deliberate
configuration decision, set before it ever runs.

## 2. Run it - the live trace

Start a run and watch the trace stream: the agent's reasoning, its searches and
page fetches, the findings it saves, and the occasional context-compaction event
where it sheds old tool output to stay within the window. The trace is full
observability - exactly what the agent did and why, which is the raw material for
an audit.

## 3. The approval gate

The run pauses at `publish_brief` and surfaces an approval card with the proposed
brief and the agent's rationale. The agent did all the work, but it cannot take
the consequential action - publishing - without a human. In a regulated or
enterprise setting, that gate is the difference between a demo and something you
can deploy. Approve, and the run resumes and publishes the cited brief.

## 4. Audit and evaluation

The run page is the audit trail: every step, tool call, and approval decision,
including who approved. Open `/evals` and a scorecard to see two quality signals:
**citation validity** (programmatic - every URL a brief cites must have actually
been fetched during the run, so it cannot hallucinate a source) and an independent
**LLM judge** on relevance, specificity, and grounding. Some cases fail by design -
the eval exists to catch real regressions, not to produce a flattering number.

## 5. MCP

Foreman is also an MCP server, so any MCP client (Claude Desktop, Claude Code) can
drive it: `run_research`, `list_briefs`, `get_brief`.

## In short

Permissions, a human approval gate, a full audit trail, evals that catch
regressions, and cost discipline (Haiku plus prompt caching put a full run at a
few cents) - the layer that makes an agent trustworthy enough to run on real work.

## Roadmap

Streamable-HTTP MCP transport; a job queue for long runs; multi-agent
orchestration; per-user auth with row-level security.
