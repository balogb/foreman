-- Foreman initial schema
-- Control plane for trustworthy agents: agents, their tool/permission config,
-- runs with full execution traces, human-in-the-loop approvals, an audit trail,
-- findings/briefs for the v1 researcher agent, agent memory, and the eval suite.
--
-- v1 is single-operator and all DB access goes through server-side API routes
-- using the DATABASE_URL connection (no public/browser client), so there is no
-- RLS layer. Per-owner RLS + an authenticated client arrive with auth (PRD non-goals).

create extension if not exists "pgcrypto";

-- updated_at trigger helper
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- agents: a configured agent (name, role, model, budget, memory toggle)
-- ---------------------------------------------------------------------------
create table agents (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  role_prompt   text not null,
  model         text not null default 'claude-haiku-4-5-20251001',
  memory_enabled boolean not null default true,
  max_steps     int not null default 20,
  max_tokens    int not null default 200000,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger agents_set_updated_at before update on agents
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- agent_tools: per-agent tool registry entry + permission
-- permission: allow | require_approval | deny
-- ---------------------------------------------------------------------------
create table agent_tools (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references agents(id) on delete cascade,
  tool_name   text not null,
  permission  text not null default 'allow'
              check (permission in ('allow','require_approval','deny')),
  created_at  timestamptz not null default now(),
  unique (agent_id, tool_name)
);
create index on agent_tools (agent_id);

-- ---------------------------------------------------------------------------
-- runs: one execution of an agent against a task
-- status: running | awaiting_approval | completed | failed | aborted
-- ---------------------------------------------------------------------------
create table runs (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references agents(id) on delete cascade,
  task          text not null,
  status        text not null default 'running'
                check (status in ('running','awaiting_approval','completed','failed','aborted')),
  result        text,
  error         text,
  -- full Anthropic messages array, persisted so a run paused for approval can resume
  messages      jsonb not null default '[]'::jsonb,
  total_tokens  int not null default 0,
  total_steps   int not null default 0,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create index on runs (agent_id, started_at desc);

-- ---------------------------------------------------------------------------
-- steps: ordered execution trace for a run
-- kind: reasoning | message | tool_call | tool_result
-- ---------------------------------------------------------------------------
create table steps (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references runs(id) on delete cascade,
  idx         int not null,
  kind        text not null
              check (kind in ('reasoning','message','tool_call','tool_result')),
  content     jsonb not null default '{}'::jsonb,
  tokens      int not null default 0,
  created_at  timestamptz not null default now(),
  unique (run_id, idx)
);
create index on steps (run_id, idx);

-- ---------------------------------------------------------------------------
-- tool_calls: a tool invocation within a run (the unit that may need approval)
-- status: pending | approved | rejected | executed | denied
--   pending  -> waiting on a human (permission require_approval)
--   denied   -> permission deny, never executed
--   approved -> human approved, will execute
--   rejected -> human rejected, will not execute
--   executed -> ran (either allow, or approved)
-- ---------------------------------------------------------------------------
create table tool_calls (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references runs(id) on delete cascade,
  step_id     uuid references steps(id) on delete set null,
  tool_use_id text,  -- Anthropic tool_use block id, to match results back on resume
  tool_name   text not null,
  args        jsonb not null default '{}'::jsonb,
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected','executed','denied')),
  result      jsonb,
  rationale   text,
  created_at  timestamptz not null default now(),
  executed_at timestamptz
);
create index on tool_calls (run_id);
create index on tool_calls (status) where status = 'pending';

-- ---------------------------------------------------------------------------
-- approvals: the human-in-the-loop decision log (audit trail of who/what/why)
-- ---------------------------------------------------------------------------
create table approvals (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references runs(id) on delete cascade,
  tool_call_id    uuid not null references tool_calls(id) on delete cascade,
  decision        text not null check (decision in ('approved','rejected')),
  decided_by      text not null default 'operator',
  proposed_action jsonb not null default '{}'::jsonb,
  rationale       text,
  decided_at      timestamptz not null default now()
);
create index on approvals (run_id);

-- ---------------------------------------------------------------------------
-- findings: discrete items the researcher agent surfaces (with source + date)
-- dedupe_key lets the agent avoid re-reporting what it has already seen
-- ---------------------------------------------------------------------------
create table findings (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references agents(id) on delete cascade,
  run_id        uuid references runs(id) on delete set null,
  title         text not null,
  summary       text,
  source_url    text not null,
  source_date   date,
  dedupe_key    text not null,
  discovered_at timestamptz not null default now(),
  unique (agent_id, dedupe_key)
);
create index on findings (agent_id, discovered_at desc);

-- ---------------------------------------------------------------------------
-- briefs: the publish_brief output (the gated, approval-required artifact)
-- status: draft | approved | published
-- ---------------------------------------------------------------------------
create table briefs (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references agents(id) on delete cascade,
  run_id      uuid references runs(id) on delete set null,
  title       text not null,
  content     text not null,
  status      text not null default 'draft'
              check (status in ('draft','approved','published')),
  created_at  timestamptz not null default now(),
  approved_at timestamptz
);
create index on briefs (agent_id, created_at desc);

-- ---------------------------------------------------------------------------
-- memory: agent key/value memory store (dedupe state, prior-brief pointers)
-- ---------------------------------------------------------------------------
create table memory (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references agents(id) on delete cascade,
  key         text not null,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (agent_id, key)
);
create trigger memory_set_updated_at before update on memory
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- eval suite: fixed tasks + rubric, scored runs, regression tracking
-- ---------------------------------------------------------------------------
create table eval_suites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table eval_cases (
  id          uuid primary key default gen_random_uuid(),
  suite_id    uuid not null references eval_suites(id) on delete cascade,
  task        text not null,
  rubric      jsonb not null default '{}'::jsonb,
  expected    jsonb,
  created_at  timestamptz not null default now()
);
create index on eval_cases (suite_id);

create table eval_runs (
  id              uuid primary key default gen_random_uuid(),
  suite_id        uuid not null references eval_suites(id) on delete cascade,
  agent_id        uuid not null references agents(id) on delete cascade,
  aggregate_score numeric,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz
);
create index on eval_runs (suite_id, started_at desc);

create table eval_results (
  id           uuid primary key default gen_random_uuid(),
  eval_run_id  uuid not null references eval_runs(id) on delete cascade,
  case_id      uuid not null references eval_cases(id) on delete cascade,
  run_id       uuid references runs(id) on delete set null,
  scores       jsonb not null default '{}'::jsonb,
  total_score  numeric,
  passed       boolean,
  created_at   timestamptz not null default now()
);
create index on eval_results (eval_run_id);
