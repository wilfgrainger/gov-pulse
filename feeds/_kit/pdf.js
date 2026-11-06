// Bounded PDF text extraction shared by the polling and NHS feeds. Moved
// verbatim from worker/live-polling-collector.js; untrusted PDFs are never
// expanded beyond the stream and total limits below.
const MAX_PDF_STREAM_EXPANSION_BYTES = 2 * 1024 * 1024;
const MAX_PDF_TOTAL_EXPANSION_BYTES = 8 * 1024 * 1024;

function latin1(bytes) {
  let result = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return result;
}

class PdfExpansionLimitError extends Error {}

async function inflate(bytes, limit = MAX_PDF_STREAM_EXPANSION_BYTES) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        try { await reader.cancel(); } catch {}
        throw new PdfExpansionLimitError(
          `YouGov/NHS expanded PDF stream exceeded its ${limit}-byte limit`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const expanded = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    expanded.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return expanded;
}

function decodePdfLiteral(value) {
  return String(value)
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, octal) =>
      String.fromCharCode(Number.parseInt(octal, 8))
    );
}

function pdfStrings(content) {
  const source = String(content);
  const output = [];

  const readLiteral = (start) => {
    let index = start + 1;
    let escaped = false;
    while (index < source.length) {
      const character = source[index];
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === ")") {
        return { end: index + 1, value: source.slice(start + 1, index) };
      }
      index += 1;
    }
    return null;
  };

  const skipWhitespace = (start) => {
    let index = start;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    return index;
  };

  let index = 0;
  while (index < source.length) {
    if (source[index] === "[") {
      const literals = [];
      let cursor = index + 1;
      while (cursor < source.length && source[cursor] !== "]") {
        if (source[cursor] === "(") {
          const literal = readLiteral(cursor);
          if (!literal) break;
          literals.push(literal.value);
          cursor = literal.end;
        } else {
          cursor += 1;
        }
      }
      if (source[cursor] === "]" && /^\s*TJ\b/.test(source.slice(cursor + 1))) {
        const text = literals.map(decodePdfLiteral).join("");
        if (text) output.push(text);
        index = cursor + 3;
        continue;
      }
    }

    if (source[index] === "(") {
      const literal = readLiteral(index);
      if (literal) {
        const operatorStart = skipWhitespace(literal.end);
        if (/^(?:Tj|['"])/.test(source.slice(operatorStart))) {
          output.push(decodePdfLiteral(literal.value));
          index = literal.end;
          continue;
        }
      }
    }
    index += 1;
  }

  return output.join(" ").replace(/\s+/g, " ");
}

async function extractPdfText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const raw = latin1(bytes);
  const parts = [];
  let expandedBytes = 0;
  const streamPattern = /<<(.*?)>>\s*stream\r?\n/gs;
  let match;
  while ((match = streamPattern.exec(raw))) {
    if (/\/Subtype\s*\/Image\b/i.test(match[1])) {
      const imageEnd = raw.indexOf("endstream", match.index + match[0].length);
      if (imageEnd < 0) break;
      streamPattern.lastIndex = imageEnd + 9;
      continue;
    }
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    let chunkEnd = end;
    while (
      chunkEnd > start &&
      (bytes[chunkEnd - 1] === 10 || bytes[chunkEnd - 1] === 13)
    ) {
      chunkEnd -= 1;
    }
    const chunk = bytes.subarray(start, chunkEnd);
    let decoded;
    try {
      decoded = /\/FlateDecode/.test(match[1]) ? await inflate(chunk) : chunk;
    } catch (error) {
      if (error instanceof PdfExpansionLimitError) throw error;
      // Required metadata below still fails closed.
      streamPattern.lastIndex = end + 9;
      continue;
    }
    if (decoded.byteLength > MAX_PDF_STREAM_EXPANSION_BYTES) {
      throw new PdfExpansionLimitError(
        `YouGov/NHS expanded PDF stream exceeded its ${MAX_PDF_STREAM_EXPANSION_BYTES}-byte limit`,
      );
    }
    expandedBytes += decoded.byteLength;
    if (expandedBytes > MAX_PDF_TOTAL_EXPANSION_BYTES) {
      throw new PdfExpansionLimitError(
        `YouGov/NHS total PDF expansion exceeded its ${MAX_PDF_TOTAL_EXPANSION_BYTES}-byte limit`,
      );
    }
    const text = latin1(decoded);
    parts.push(pdfStrings(text));
    streamPattern.lastIndex = end + 9;
  }
  return parts.join(" ").replace(/\s+/g, " ");
}

export {
  MAX_PDF_STREAM_EXPANSION_BYTES,
  MAX_PDF_TOTAL_EXPANSION_BYTES,
  extractPdfText,
  pdfStrings,
};
