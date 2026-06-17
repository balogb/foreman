import { lookup } from "node:dns/promises";

/**
 * SSRF protection for fetch_url. An agent chooses the URLs it fetches, so a
 * model (or a poisoned web page steering it) could point the tool at internal
 * services or the cloud metadata endpoint. We resolve the host and refuse any
 * address in a private / loopback / link-local / unique-local range.
 *
 * Note: there is a small TOCTOU window between this DNS check and the actual
 * fetch (DNS rebinding). Full protection pins the resolved IP into the socket;
 * this check raises the bar substantially and is sufficient for v1.
 */

export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

/** Throw if the URL resolves to a non-public address or a blocked host. */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  const u = new URL(rawUrl);
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) {
    throw new Error(`Blocked host: ${host}`);
  }

  let addresses: string[];
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    addresses = [host]; // IP literal
  } else {
    const resolved = await lookup(host, { all: true });
    addresses = resolved.map((r) => r.address);
    if (addresses.length === 0) throw new Error(`Could not resolve host: ${host}`);
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new Error(`Blocked non-public address for ${host}: ${addr}`);
    }
  }
}
