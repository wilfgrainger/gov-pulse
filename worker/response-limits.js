const MAX_RESPONSE_BYTES = Object.freeze({
  text: 4 * 1024 * 1024,
  json: 16 * 1024 * 1024,
  pdf: 16 * 1024 * 1024,
  workbook: 32 * 1024 * 1024,
});

function headerContentLength(response) {
  const raw = response?.headers?.get?.("content-length");
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function assertResponseSize(response, limit, label) {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error(`${label} response limit is invalid`);
  }
  const contentLength = headerContentLength(response);
  if (contentLength !== null && contentLength > limit) {
    throw new Error(`${label} response exceeded the ${limit}-byte limit`);
  }
}

function assertSameHttpsHost(response, requestedUrl, label = "Upstream") {
  const requested = new URL(requestedUrl);
  const resolved = new URL(response?.url || requestedUrl);
  if (
    requested.protocol !== "https:" ||
    resolved.protocol !== "https:" ||
    requested.hostname.toLowerCase() !== resolved.hostname.toLowerCase()
  ) {
    throw new Error(`${label} redirected away from its approved HTTPS host`);
  }
  return resolved.toString();
}

async function readResponseBytes(response, { limit, label = "Upstream" } = {}) {
  assertResponseSize(response, limit, label);

  if (response?.body?.getReader) {
    const reader = response.body.getReader();
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
          throw new Error(`${label} response exceeded the ${limit}-byte limit`);
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  if (typeof response?.arrayBuffer !== "function" && typeof response?.text === "function") {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    if (bytes.byteLength > limit) {
      throw new Error(`${label} response exceeded the ${limit}-byte limit`);
    }
    return bytes;
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > limit) {
    throw new Error(`${label} response exceeded the ${limit}-byte limit`);
  }
  return new Uint8Array(buffer);
}

async function readResponseText(response, options = {}) {
  const bytes = await readResponseBytes(response, {
    limit: options.limit ?? MAX_RESPONSE_BYTES.text,
    label: options.label ?? "Upstream text",
  });
  return new TextDecoder().decode(bytes);
}

async function readResponseJson(response, options = {}) {
  const text = await readResponseText(response, {
    limit: options.limit ?? MAX_RESPONSE_BYTES.json,
    label: options.label ?? "Upstream JSON",
  });
  return JSON.parse(text);
}

async function readResponseArrayBuffer(response, options = {}) {
  const bytes = await readResponseBytes(response, {
    limit: options.limit ?? MAX_RESPONSE_BYTES.workbook,
    label: options.label ?? "Upstream binary",
  });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export {
  MAX_RESPONSE_BYTES,
  assertResponseSize,
  assertSameHttpsHost,
  headerContentLength,
  readResponseArrayBuffer,
  readResponseBytes,
  readResponseJson,
  readResponseText,
};
