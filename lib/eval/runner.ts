import { getSql } from "../db";
import { startRun, resumeRun } from "../agent/loop";
import { citationValidity, citedUrlsFrom } from "./score";
import { llmJudge } from "./judge";

const PASS_TOTAL = 0.6;
const PASS_CITATION = 0.8;

/**
 * In eval mode, approvals are granted automatically so a run can complete
 * unattended. Recorded in the audit trail as decided_by 'eval-harness' (honest
 * about who approved).
 */
async function autoApproveToCompletion(runId: string, maxRounds = 4): Promise<void> {
  const sql = getSql();
  for (let round = 0; round < maxRounds; round++) {
    const rows = await sql`select status from runs where id = ${runId} limit 1`;
    if (rows[0]?.status !== "awaiting_approval") return;
    const pending = await sql`select id, args from tool_calls where run_id = ${runId} and status = 'pending'`;
    for (const tc of pending) {
      await sql`update tool_calls set status = 'approved' where id = ${tc.id}`;
      await sql`
        insert into approvals (run_id, tool_call_id, decision, decided_by, proposed_action)
        values (${runId}, ${tc.id}, 'approved', 'eval-harness', ${JSON.stringify(tc.args)}::jsonb)
      `;
    }
    await resumeRun(runId);
  }
}

interface Scored {
  scores: Record<string, unknown>;
  total: number;
  passed: boolean;
}

async function scoreRun(runId: string, task: string): Promise<Scored> {
  const sql = getSql();
  const [briefs, findings, fetches] = await Promise.all([
    sql`select content from briefs where run_id = ${runId} order by created_at asc`,
    sql`select source_url from findings where run_id = ${runId}`,
    sql`select args from tool_calls where run_id = ${runId} and tool_name = 'fetch_url'`,
  ]);

  const briefContent = briefs.map((b) => String(b.content)).join("\n\n");
  const fetchedUrls = fetches
    .map((f) => String((f.args as { url?: string })?.url ?? ""))
    .filter(Boolean);
  const findingUrls = findings.map((f) => String(f.source_url));

  const cited = citedUrlsFrom(briefContent, findingUrls);
  const cv = citationValidity(cited, fetchedUrls);

  const judge = briefContent.trim()
    ? await llmJudge(task, briefContent)
    : { relevance: 0, specificity: 0, grounding: 0, rationale: "No brief was produced." };

  const total = (cv.score + judge.relevance + judge.specificity + judge.grounding) / 4;
  const passed = total >= PASS_TOTAL && cv.score >= PASS_CITATION;

  return {
    scores: {
      citation_validity: round2(cv.score),
      relevance: round2(judge.relevance),
      specificity: round2(judge.specificity),
      grounding: round2(judge.grounding),
      rationale: judge.rationale,
      cited_count: cv.citedCount,
      grounded_count: cv.groundedCount,
      ungrounded: cv.ungrounded,
      has_brief: briefContent.trim().length > 0,
    },
    total: round2(total),
    passed,
  };
}

/** Create the eval_run row (no cases run yet) and return its id. */
export async function createEvalRun(suiteId: string, agentId: string): Promise<string> {
  const sql = getSql();
  const cnt = await sql`select count(*)::int as n from eval_cases where suite_id = ${suiteId}`;
  if (Number(cnt[0]?.n ?? 0) === 0) throw new Error("Suite has no cases.");
  const erRows = await sql`
    insert into eval_runs (suite_id, agent_id) values (${suiteId}, ${agentId}) returning id
  `;
  return String(erRows[0].id);
}

/** Run and score every case for an existing eval_run, then set the aggregate. */
export async function runEvalCases(
  evalRunId: string,
  suiteId: string,
  agentId: string
): Promise<void> {
  const sql = getSql();
  const cases = await sql`select id, task from eval_cases where suite_id = ${suiteId} order by created_at asc`;

  const totals: number[] = [];
  for (const c of cases) {
    let scored: Scored;
    let runId: string | null = null;
    try {
      runId = await startRun(agentId, String(c.task));
      await autoApproveToCompletion(runId);
      scored = await scoreRun(runId, String(c.task));
    } catch (err) {
      scored = {
        scores: { error: err instanceof Error ? err.message : String(err) },
        total: 0,
        passed: false,
      };
    }
    totals.push(scored.total);
    await sql`
      insert into eval_results (eval_run_id, case_id, run_id, scores, total_score, passed)
      values (${evalRunId}, ${c.id}, ${runId}, ${JSON.stringify(scored.scores)}::jsonb, ${scored.total}, ${scored.passed})
    `;
  }

  const aggregate = totals.length ? round2(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  await sql`update eval_runs set aggregate_score = ${aggregate}, ended_at = now() where id = ${evalRunId}`;
}

/** Convenience: create the eval run and run all cases synchronously. */
export async function runEvalSuite(suiteId: string, agentId: string): Promise<string> {
  const evalRunId = await createEvalRun(suiteId, agentId);
  await runEvalCases(evalRunId, suiteId, agentId);
  return evalRunId;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
