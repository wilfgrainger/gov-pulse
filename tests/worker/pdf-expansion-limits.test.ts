// @vitest-environment node

import { describe, expect, it } from "vitest";
import { extractPdfText, MAX_PDF_STREAM_EXPANSION_BYTES, MAX_PDF_TOTAL_EXPANSION_BYTES } from "@/worker/live-polling-collector";

async function deflate(bytes: Uint8Array) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function pdfWithStreams(streams: Uint8Array[]) {
  const encoder = new TextEncoder();
  const parts = streams.flatMap((stream) => [
    encoder.encode("<< /Filter /FlateDecode >>\nstream\n"),
    stream,
    encoder.encode("\nendstream\n"),
  ]);
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

describe("bounded PDF decompression", () => {
  it("rejects a single compressed PDF stream that expands beyond its limit", async () => {
    const expanded = new Uint8Array(MAX_PDF_STREAM_EXPANSION_BYTES + 1).fill(65);
    const pdf = pdfWithStreams([await deflate(expanded)]);

    await expect(extractPdfText(pdf.buffer)).rejects.toThrow(/expanded PDF stream exceeded/i);
  });

  it("limits total expansion across many individually small PDF streams", async () => {
    const perStream = Math.floor(MAX_PDF_TOTAL_EXPANSION_BYTES / 5) + 1;
    const expanded = new Uint8Array(perStream).fill(65);
    const streams = await Promise.all(Array.from({ length: 5 }, () => deflate(expanded)));
    const pdf = pdfWithStreams(streams);

    await expect(extractPdfText(pdf.buffer)).rejects.toThrow(/total PDF expansion exceeded/i);
  });
});
