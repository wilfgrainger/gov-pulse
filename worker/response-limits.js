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

const MAX_APPROVED_REDIRECTS = 3;

// Raised when a request or redirect hop falls outside the approved origin
// policy. Callers must treat it as final: retrying cannot make it succeed.
class ApprovedOriginError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApprovedOriginError";
  }
}

function hostnameOf(url) {
  return url.hostname.toLowerCase().replace(/\.$/, "");
}

// Validate a URL *before* any request is sent. Collectors build some URLs
// from downloaded (untrusted) publisher content, so the requested URL itself
// must be proven to be on an approved HTTPS origin: comparing a response with
// a hostile requested URL proves nothing.
function assertApprovedSourceUrl(url, approvedHosts, label = "Upstream") {
  if (!approvedHosts || typeof approvedHosts.has !== "function") {
    throw new ApprovedOriginError(`${label} requires an approved host set`);
  }
  let parsed;
  try {
    parsed = url instanceof URL ? new URL(url.toString()) : new URL(String(url));
  } catch {
    throw new ApprovedOriginError(`${label} URL is not a valid approved HTTPS source URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new ApprovedOriginError(`${label} URL must use HTTPS on an approved host`);
  }
  if (parsed.username || parsed.password) {
    throw new ApprovedOriginError(`${label} URL must not carry credentials for an approved host`);
  }
  if (parsed.port) {
    throw new ApprovedOriginError(`${label} URL must use the default HTTPS port of an approved host`);
  }
  if (!approvedHosts.has(hostnameOf(parsed))) {
    throw new ApprovedOriginError(`${label} URL host '${hostnameOf(parsed)}' is not an approved source host`);
  }
  return parsed;
}

async function cancelResponseBody(response) {
  try {
    await response?.body?.cancel?.();
  } catch {
    // Releasing a rejected response body is best effort only.
  }
}

function isRedirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function redirectedAway(label) {
  return new ApprovedOriginError(`${label} redirected away from its approved HTTPS host`);
}

// Fetch with manual redirects so every hop, including the first, is checked
// against the approved host set before the request leaves the Worker. At most
// MAX_APPROVED_REDIRECTS hops are followed; rejected responses are cancelled.
async function fetchWithApprovedRedirects(
  url,
  init = {},
  approvedHosts,
  fetchImpl = fetch,
  label = "Upstream"
) {
  let current = assertApprovedSourceUrl(url, approvedHosts, label);
  for (let hop = 0; ; hop += 1) {
    const response = await fetchImpl(current.toString(), { ...init, redirect: "manual" });
    const status = Number(response?.status);

    if (isRedirectStatus(status)) {
      const location = response.headers?.get?.("location");
      await cancelResponseBody(response);
      if (!location) {
        throw new ApprovedOriginError(`${label} returned a ${status} redirect without a Location header`);
      }
      if (hop >= MAX_APPROVED_REDIRECTS) {
        throw new ApprovedOriginError(`${label} followed more than ${MAX_APPROVED_REDIRECTS} redirects`);
      }
      let next;
      try {
        next = assertApprovedSourceUrl(new URL(location, current), approvedHosts, label);
      } catch {
        throw redirectedAway(label);
      }
      current = next;
      continue;
    }

    // Defence in depth: a runtime that ignored redirect: "manual" reports the
    // final URL; it must still be on an approved HTTPS host.
    if (response?.url) {
      try {
        assertApprovedSourceUrl(response.url, approvedHosts, label);
      } catch {
        await cancelResponseBody(response);
        throw redirectedAway(label);
      }
    }
    return response;
  }
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
  ApprovedOriginError,
  MAX_APPROVED_REDIRECTS,
  MAX_RESPONSE_BYTES,
  assertApprovedSourceUrl,
  assertResponseSize,
  assertSameHttpsHost,
  cancelResponseBody,
  fetchWithApprovedRedirects,
  headerContentLength,
  readResponseArrayBuffer,
  readResponseBytes,
  readResponseJson,
  readResponseText,
};
