import { describe, expect, it } from "vitest";
import { verifyWorkerDeployment } from "../../scripts/verify-worker-deployment.mjs";

const revision = "a".repeat(40);

describe("Worker deployment verifier", () => {
  it("accepts the deployed commit in version metadata", () => {
    expect(
      verifyWorkerDeployment(
        { deployments: [{ versionId: "version-1", tag: revision, message: `release ${revision}` }] },
        revision,
      ),
    ).toEqual([]);
  });

  it("rejects missing, malformed or different deployment revisions", () => {
    expect(verifyWorkerDeployment({ deployments: [] }, revision)).toEqual([
      `Worker deployment metadata did not contain revision ${revision}`,
    ]);
    expect(verifyWorkerDeployment({ tag: "not-a-sha" }, revision)).toEqual([
      `Worker deployment metadata did not contain revision ${revision}`,
    ]);
    expect(verifyWorkerDeployment({ tag: revision }, "main")).toEqual([
      "expected Worker revision must be a full Git commit SHA",
    ]);
  });
});
