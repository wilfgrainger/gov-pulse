/* eslint-disable @typescript-eslint/no-explicit-any -- fixture JSON and legacy JS modules are untyped */
// @vitest-environment node

import { describe, expect, it } from "vitest";
import fixture from "@/tests/fixtures/publication/current-snapshot.json";
import {
  MAX_CLOCK_SKEW_MS,
  decisionFor,
  evaluate,
  projectPublic,
} from "@/contracts/evidence-policy";

const snapshot = fixture as any;
const feed = {
  id: "electionPolling",
  requirement: "required" as const,
  validity: { retrievalMaxAgeMs: 36 * 60 * 60 * 1000, explicitExpiry: true },
};
const record = () => ({
  section: "electionPolling",
  data: structuredClone(snapshot.electionPolling),
  source: structuredClone(snapshot.meta.sources.electionPolling),
});
const fetchedAt = Date.parse(snapshot.meta.sources.electionPolling.fetchedAt);
const expiry = Date.parse(snapshot.electionPolling.expiresAt);

describe("evidence policy", () => {
  it("unknown feed id is held", () => {
    expect(decisionFor("no-such-feed")).toBe("held");
    expect(decisionFor("electionPolling", { version: 2, publications: { electionPolling: { state: "published" } } })).toBe("published");
    expect(decisionFor("x", { version: 2, publications: { x: { state: "retired" } } })).toBe("retired");
  });

  it("held wins over a current record", () => {
    const now = new Date(fetchedAt + 60 * 60 * 1000);
    expect(evaluate(feed, record(), "published", now).state).toBe("current");
    const verdict = evaluate(feed, record(), "held", now);
    expect(verdict.state).toBe("held");
    expect(verdict.reason).toBe("held");
  });

  it("now equal to validUntil is unavailable", () => {
    const before = evaluate(feed, record(), "published", new Date(expiry - 1));
    expect(before.state).toBe("current");
    expect(before.validUntil).toBe(new Date(expiry).toISOString());
    const at = evaluate(feed, record(), "published", new Date(expiry));
    expect(at.state).toBe("unavailable");
    expect(at.reason).toBe("observation-expired");
  });

  it("missing record is unavailable not zero", () => {
    const verdict = evaluate(feed, null, "published", new Date(fetchedAt));
    expect(verdict).toEqual({ state: "unavailable", reason: "no-record", validUntil: null });
    expect("value" in verdict).toBe(false);
  });

  it("older retrieval within its validity stays current", () => {
    // Retrieval is 5 days old, far beyond the 36 h operational clock, but the
    // source-owned explicit expiry has not passed.
    const now = new Date(fetchedAt + 5 * 24 * 60 * 60 * 1000);
    expect(now.getTime()).toBeLessThan(expiry);
    expect(evaluate(feed, record(), "published", now).state).toBe("current");
    const noExpiry = record();
    delete (noExpiry.data as any).expiresAt;
    const verdict = evaluate({ ...feed, validity: { retrievalMaxAgeMs: feed.validity.retrievalMaxAgeMs } }, noExpiry, "published", now);
    expect(verdict.state).toBe("unavailable");
    expect(verdict.reason).toBe("retrieval-expired");
  });

  it("clock skew beyond MAX_CLOCK_SKEW_MS is unavailable", () => {
    const edge = new Date(fetchedAt - MAX_CLOCK_SKEW_MS);
    expect(evaluate(feed, record(), "published", edge).state).toBe("current");
    const verdict = evaluate(feed, record(), "published", new Date(fetchedAt - MAX_CLOCK_SKEW_MS - 1));
    expect(verdict).toMatchObject({ state: "unavailable", reason: "clock-skew" });
  });

  it("projectPublic returns null snapshot when nothing is current", () => {
    const config = { version: 2, publications: Object.fromEntries(
      ["electionPolling", "nationalDebt", "gdpTracker"].map((id) => [id, { state: "published", reasonCode: "t", reason: "t" }]),
    ) };
    const live = projectPublic(snapshot, new Date(fetchedAt + 60 * 60 * 1000), config);
    expect(live.snapshot).not.toBeNull();
    expect(typeof live.validUntil).toBe("string");
    const dead = projectPublic(snapshot, new Date("2030-01-01T00:00:00.000Z"), config);
    expect(dead).toEqual({ snapshot: null, validUntil: null });
  });
});
