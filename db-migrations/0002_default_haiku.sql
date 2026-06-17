-- Cost: default agents to the inexpensive tier (Haiku 4.5) and migrate any
-- existing agent still on the previous Sonnet default. Model stays per-agent
-- configurable; bump an individual agent to Sonnet/Opus only if quality needs it.

alter table agents alter column model set default 'claude-haiku-4-5-20251001';

update agents
set model = 'claude-haiku-4-5-20251001'
where model = 'claude-sonnet-4-6';
