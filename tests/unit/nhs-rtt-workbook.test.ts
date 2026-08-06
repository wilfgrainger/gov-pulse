import { spawnSync } from "node:child_process";
import process from "node:process";
import { describe, expect, it } from "vitest";

const pythonCommand = process.platform === "win32" ? "python" : "python3";

// The Python suite generates both shared-string and inline-string XLSX packages.
describe("NHS RTT workbook structural contract", () => {
  it(
    "accepts the publisher structure and rejects structural decoys",
    () => {
      const result = spawnSync(
        pythonCommand,
        ["-m", "unittest", "tests/python/test_nhs_rtt_timeseries.py"],
        { encoding: "utf8" }
      );

      expect(
        result.status,
        [result.stdout, result.stderr].filter(Boolean).join("\n")
      ).toBe(0);
    },
    20_000
  );
});
