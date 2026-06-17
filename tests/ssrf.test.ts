import { describe, it, expect } from "vitest";
import { isPrivateIp } from "@/lib/tools/ssrf";

describe("isPrivateIp", () => {
  it("flags private, loopback, and link-local IPv4", () => {
    for (const ip of [
      "10.0.0.1",
      "172.16.5.4",
      "172.31.255.255",
      "192.168.1.1",
      "127.0.0.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "151.101.1.69"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("flags loopback / link-local / unique-local IPv6 and mapped v4", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows public IPv6", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});
