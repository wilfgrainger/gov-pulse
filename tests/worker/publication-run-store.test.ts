// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  RUN_PREFIX,
  RUN_TTL_SECONDS,
  bootstrapRunId,
  kvGet,
  kvPut,
  kvPutText,
  runIdFor,
  runKey,
  terminalKey,
} from "@/worker/publication-run-store";

describe("publication run store", () => {
  it("generates stable run and terminal keys", () => {
    const runId = runIdFor(new Date("2026-10-06T10:00:00.000Z"));

    expect(runId).toBe("2026-10-06T10-00-00.000Z");
    expect(runKey(runId)).toBe(`${RUN_PREFIX}${runId}`);
    expect(terminalKey(runId, "gdpTracker")).toBe(
      `${RUN_PREFIX}${runId}:terminal:gdpTracker`
    );
    expect(RUN_TTL_SECONDS).toBe(14 * 24 * 60 * 60);
  });

  it("derives bootstrap ids only from full Git commit SHAs", () => {
    const sha = "A".repeat(40);
    expect(bootstrapRunId(sha)).toBe(`bootstrap-${"a".repeat(40)}`);
    expect(() => bootstrapRunId("abc123")).toThrow(/full Git commit SHA/);
  });

  it("rejects invalid run timestamps before generating keys", () => {
    expect(() => runIdFor(new Date("invalid"))).toThrow(/valid Date/);
  });

  it("reads and writes JSON through the METRICS_CACHE binding", async () => {
    const get = vi.fn(async () => ({ status: "running" }));
    const put = vi.fn(async () => undefined);
    const env = { METRICS_CACHE: { get, put } };

    await expect(kvGet(env, "run")).resolves.toEqual({ status: "running" });
    expect(get).toHaveBeenCalledWith("run", "json");

    await kvPut(env, "run", { status: "complete" }, { expirationTtl: 30 });
    expect(put).toHaveBeenCalledWith(
      "run",
      JSON.stringify({ status: "complete" }),
      { expirationTtl: 30 },
    );

    await kvPutText(env, "raw", "value", { expirationTtl: 60 });
    expect(put).toHaveBeenCalledWith("raw", "value", { expirationTtl: 60 });
  });

  it("fails closed when the KV write binding is missing", async () => {
    await expect(kvPut({}, "run", { status: "complete" })).rejects.toThrow(
      /METRICS_CACHE KV binding is required/
    );
    await expect(kvPutText({}, "raw", "value")).rejects.toThrow(
      /METRICS_CACHE KV binding is required/
    );
  });
});
