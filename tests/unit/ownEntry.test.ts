// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ownEntry } from "@/app/lib/ownEntry";

describe("ownEntry", () => {
  it("returns only the table's own keys, never inherited ones", () => {
    const table = { reading: { title: "Reading" } };
    expect(ownEntry(table, "reading")).toEqual({ title: "Reading" });
    expect(ownEntry(table, "constructor")).toBeUndefined();
    expect(ownEntry(table, "__proto__")).toBeUndefined();
  });
});
