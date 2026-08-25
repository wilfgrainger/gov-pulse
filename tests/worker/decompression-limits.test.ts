// @vitest-environment node

import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { boundedDecompress } from "@/worker/decompression-limits";

describe("bounded binary decompression", () => {
  it("rejects output larger than the decoded byte limit", async () => {
    const compressed = deflateRawSync(Buffer.alloc(1024 * 1024, 65));

    await expect(
      boundedDecompress(
        compressed,
        "deflate-raw",
        64 * 1024,
        "fixture archive entry",
      ),
    ).rejects.toThrow(/decoded output exceeded/i);
  });
});
