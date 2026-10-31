import { describe, expect, it } from "vitest";
import { verifyWorkerDeployment } from "../../scripts/verify-worker-deployment.mjs";

const revision = "a".repeat(40);

describe("Worker deployment verifier", () => {
  it("accepts the deployed commit in the latest deployment message", () => {
    expect(
      verifyWorkerDeployment(
        { annotations: { "workers/message": `public-data.org Worker ${revision}` } },
        revision,
      ),
    ).toEqual([]);
  });

  it("rejects missing, malformed or different deployment revisions", () => {
    expect(verifyWorkerDeployment({ deployments: [] }, revision)).toEqual([
      `Latest Worker deployment metadata did not contain revision ${revision}`,
    ]);
    expect(
      verifyWorkerDeployment(
        { annotations: { "workers/message": `old release ${"b".repeat(40)}` } },
        revision,
      ),
    ).toEqual([
      `Latest Worker deployment metadata did not contain revision ${revision}`,
    ]);
    expect(
      verifyWorkerDeployment({ annotations: { "workers/message": `release ${revision}` } }, "main"),
    ).toEqual([
      "expected Worker revision must be a full Git commit SHA",
    ]);
  });
});
