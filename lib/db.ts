import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon (serverless Postgres) query function for server-side use.
 *
 * All DB access is server-side via DATABASE_URL. Use the tagged-template form
 * for safe parameterization:
 *   const rows = await sql`select * from agents where id = ${id}`;
 */
let cached: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL. See .env.local.example.");
  }
  cached = neon(url);
  return cached;
}
