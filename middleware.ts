import { NextRequest, NextResponse } from "next/server";

/**
 * Access gate. Read-only browsing (pages, GET APIs) is public so the deployed
 * app works as a portfolio piece. The paid, mutating endpoints - which spend
 * the Anthropic budget - require an operator key when FOREMAN_OPERATOR_KEY is
 * set (production). With no key configured (local dev), everything is open.
 */
const PROTECTED = ["/api/runs", "/api/approvals", "/api/evals"];

export const config = {
  matcher: ["/api/runs", "/api/approvals", "/api/evals"],
};

export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();
  if (!PROTECTED.includes(req.nextUrl.pathname)) return NextResponse.next();

  const expected = process.env.FOREMAN_OPERATOR_KEY;
  if (!expected) return NextResponse.next(); // open in local/dev

  const provided = req.headers.get("x-foreman-key") ?? "";
  if (constantTimeEqual(provided, expected)) return NextResponse.next();

  return NextResponse.json(
    { error: "Operator key required or invalid (x-foreman-key)." },
    { status: 401 }
  );
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
