const MAX_DECOMPRESSED_ENTRY_BYTES = 16 * 1024 * 1024;
const MAX_DECOMPRESSED_ARCHIVE_BYTES = 48 * 1024 * 1024;
const MAX_DECOMPRESSED_PDF_BYTES = 32 * 1024 * 1024;

async function boundedDecompress(bytes, format, limit, label = "Binary") {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`${label} compressed input must be a byte array`);
  }
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error(`${label} decoded output limit is invalid`);
  }

  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream(format))
    .getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error(`${label} decoded output exceeded the ${limit}-byte limit`);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export {
  MAX_DECOMPRESSED_ARCHIVE_BYTES,
  MAX_DECOMPRESSED_ENTRY_BYTES,
  MAX_DECOMPRESSED_PDF_BYTES,
  boundedDecompress,
};
