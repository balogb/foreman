"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the current server component on an interval while `active`.
 * Used to surface background progress (e.g. eval cases landing) on pages that
 * are otherwise static server renders.
 *
 * Each refresh re-runs the server component and re-queries the DB, so the
 * interval directly drives network egress. Default 8s keeps progress visible
 * while keeping transfer modest; callers can override for faster pages.
 */
export function AutoRefresh({ active, intervalMs = 8000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, router]);
  return null;
}
