import { describe, expect, it } from "vitest";
import { verifyWorkerDeployment } from "../../scripts/verify-worker-deployment.mjs";

const revision = "a".repeat(40);

describe("Worker deployment verifier", () => {
  it("accepts the deployed commit in version metadata", () => {
    expect(
      verifyWorkerDeployment(
        {
          versions: [
            {
              id: "version-1",
              annotations: {
                "workers/tag": revision,
                "workers/message": `release ${revision}`,
              },
            },
          ],
        },
        revision,
      ),
    ).toEqual([]);
  });

  it("rejects missing, malformed or different deployment revisions", () => {
    expect(verifyWorkerDeployment({ versions: [] }, revision)).toEqual([
      `Worker deployment metadata did not contain revision ${revision}`,
    ]);
    expect(
      verifyWorkerDeployment(
        { versions: [{ annotations: { "workers/tag": "not-a-sha" } }] },
        revision,
      ),
    ).toEqual([
      `Worker deployment metadata did not contain revision ${revision}`,
    ]);
    expect(verifyWorkerDeployment({ versions: [] }, "main")).toEqual([
      "expected Worker revision must be a full Git commit SHA",
    ]);
  });

  it("does not accept a matching SHA in an unrelated field or message", () => {
    expect(
      verifyWorkerDeployment(
        {
          message: `an unrelated deployment mentions ${revision}`,
          versions: [{ id: "different-version", annotations: {} }],
        },
        revision,
      ),
    ).toEqual([`Worker deployment metadata did not contain revision ${revision}`]);
  });
});
