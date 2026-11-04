import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Next-rendered response security headers", () => {
  it("applies CSP, framing, sniffing, referrer and transport protections to every path", async () => {
    const rules = await nextConfig.headers?.();
    const all = rules?.find((rule) => rule.source === "/:path*" && !("has" in rule && rule.has));
    const names = all?.headers.map((header) => header.key);
    expect(names).toEqual(expect.arrayContaining([
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]));
    const csp = all?.headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("stops advertising the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
