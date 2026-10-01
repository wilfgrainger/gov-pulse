import { decodeHtml, parseAttributes } from "./live-feed-common.js";

const DEFAULT_LIMITS = Object.freeze({
  maxEntryBytes: 8 * 1024 * 1024,
  maxTotalBytes: 24 * 1024 * 1024,
  maxWorksheetRows: 25_000,
  maxWorkbookCells: 250_000,
});

function boundedLimits(overrides = {}) {
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  for (const [name, maximum] of Object.entries(DEFAULT_LIMITS)) {
    if (!Number.isSafeInteger(limits[name]) || limits[name] <= 0 || limits[name] > maximum) {
      throw new Error(`Workbook ${name} must be a positive integer no greater than ${maximum}`);
    }
  }
  if (limits.maxEntryBytes > limits.maxTotalBytes) {
    throw new Error("Workbook per-entry expansion limit cannot exceed total expansion limit");
  }
  return limits;
}

async function inflate(bytes, maxBytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`Workbook entry expanded past its ${maxBytes}-byte limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

function u16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

async function zipEntries(arrayBuffer, requestedLimits = {}) {
  const limits = boundedLimits(requestedLimits);
  const bytes = new Uint8Array(arrayBuffer);
  let eocd = -1;
  for (
    let index = bytes.length - 22;
    index >= Math.max(0, bytes.length - 65_557);
    index -= 1
  ) {
    if (u32(bytes, index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("Workbook was not a valid ZIP archive");

  const total = u16(bytes, eocd + 10);
  if (total <= 0 || total > 300) {
    throw new Error("Workbook central directory had an unsafe entry count");
  }

  let cursor = u32(bytes, eocd + 16);
  const entries = new Map();
  let expandedTotal = 0;
  for (let count = 0; count < total; count += 1) {
    if (u32(bytes, cursor) !== 0x02014b50) {
      throw new Error("Workbook central directory was invalid");
    }
    const method = u16(bytes, cursor + 10);
    const compressedSize = u32(bytes, cursor + 20);
    const fileNameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const localOffset = u32(bytes, cursor + 42);
    const name = new TextDecoder().decode(
      bytes.subarray(cursor + 46, cursor + 46 + fileNameLength)
    );

    if (u32(bytes, localOffset) !== 0x04034b50) {
      throw new Error("Workbook local entry was invalid");
    }
    const localNameLength = u16(bytes, localOffset + 26);
    const localExtraLength = u16(bytes, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(start, start + compressedSize);
    const requiredEntry =
      name === "xl/workbook.xml" ||
      name === "xl/_rels/workbook.xml.rels" ||
      name === "xl/sharedStrings.xml" ||
      /^xl\/worksheets\/[^/]+\.xml$/i.test(name);

    if (requiredEntry) {
      if (method === 0 && compressedSize > limits.maxEntryBytes) {
        throw new Error(`Workbook entry exceeded its ${limits.maxEntryBytes}-byte limit`);
      }
      const data =
        method === 0
          ? compressed
          : method === 8
            ? await inflate(compressed, limits.maxEntryBytes)
            : null;
      if (!data) throw new Error(`Workbook used unsupported ZIP method ${method}`);
      if (data.byteLength > limits.maxEntryBytes) {
        throw new Error(`Workbook entry exceeded its ${limits.maxEntryBytes}-byte limit`);
      }
      expandedTotal += data.byteLength;
      if (expandedTotal > limits.maxTotalBytes) {
        throw new Error(`Workbook expanded contents exceeded its ${limits.maxTotalBytes}-byte limit`);
      }
      entries.set(name, new TextDecoder().decode(data));
    }

    const nextCursor = cursor + 46 + fileNameLength + extraLength + commentLength;
    if (nextCursor <= cursor) {
      throw new Error("Workbook central directory did not advance");
    }
    cursor = nextCursor;
  }
  return entries;
}

function xmlText(value) {
  const raw = String(value).replace(/<[^>]+>/g, "");
  return decodeHtml(`x${raw}x`).slice(1, -1);
}

function sharedStrings(xml = "", requestedLimits = {}) {
  const limits = boundedLimits(requestedLimits);
  const result = [];
  for (const match of String(xml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) {
    if (result.length >= limits.maxWorkbookCells) {
      throw new Error(`Workbook shared strings exceeded the ${limits.maxWorkbookCells}-item limit`);
    }
    result.push(
      [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
        .map((part) => xmlText(part[1]))
        .join(""),
    );
  }
  return result;
}

function worksheetCells(xml, strings = [], requestedLimits = {}) {
  const limits = boundedLimits(requestedLimits);
  const input = String(xml);
  const rows = [...input.matchAll(/<row\b/gi)].length;
  if (rows > limits.maxWorksheetRows) {
    throw new Error(`Workbook worksheet exceeded the ${limits.maxWorksheetRows}-row limit`);
  }
  const declaredCells = [...input.matchAll(/<c\b/gi)].length;
  if (declaredCells > limits.maxWorkbookCells) {
    throw new Error(`Workbook exceeded the ${limits.maxWorkbookCells}-cell limit`);
  }
  const cells = new Map();
  for (const match of input.matchAll(
    /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi
  )) {
    const attributes = parseAttributes(match[1]);
    const reference = attributes.r;
    if (!reference) continue;
    const cellBody = match[2] ?? "";
    let value = cellBody.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "";
    if (attributes.t === "s") value = strings[Number(value)] ?? "";
    else if (attributes.t === "inlinestr") {
      value = [...cellBody.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
        .map((part) => xmlText(part[1]))
        .join("");
    } else value = xmlText(value);
    cells.set(reference.toUpperCase(), value);
  }
  return cells;
}

function worksheetPath(target) {
  const normalized = String(target ?? "").replace(/^\/+/, "");
  if (normalized.startsWith("xl/")) return normalized;
  return `xl/${normalized.replace(/^\.\//, "")}`;
}

async function workbookSheetCells(arrayBuffer, sheetNamePattern, requestedLimits = {}) {
  const limits = boundedLimits(requestedLimits);
  const archive = await zipEntries(arrayBuffer, limits);
  let workbookCells = 0;
  for (const [name, xml] of archive) {
    if (!/^xl\/worksheets\/[^/]+\.xml$/i.test(name)) continue;
    const rowCount = [...xml.matchAll(/<row\b/gi)].length;
    if (rowCount > limits.maxWorksheetRows) {
      throw new Error(`Workbook worksheet exceeded the ${limits.maxWorksheetRows}-row limit`);
    }
    workbookCells += [...xml.matchAll(/<c\b/gi)].length;
    if (workbookCells > limits.maxWorkbookCells) {
      throw new Error(`Workbook exceeded the ${limits.maxWorkbookCells}-cell limit`);
    }
  }
  const workbook = archive.get("xl/workbook.xml") ?? "";
  const relationships = archive.get("xl/_rels/workbook.xml.rels") ?? "";
  const pattern =
    sheetNamePattern instanceof RegExp
      ? sheetNamePattern
      : new RegExp(`^${String(sheetNamePattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  const sheet = [...workbook.matchAll(/<sheet\b([^>]*)\/?/gi)]
    .map((match) => parseAttributes(match[1]))
    .find((entry) => pattern.test(String(entry.name ?? "")));
  if (!sheet?.["r:id"]) {
    throw new Error(`Workbook did not expose worksheet matching ${pattern}`);
  }

  const relationship = [...relationships.matchAll(/<Relationship\b([^>]*)\/?/gi)]
    .map((match) => parseAttributes(match[1]))
    .find((entry) => entry.id === sheet["r:id"]);
  if (!relationship?.target) {
    throw new Error("Workbook worksheet relationship was unavailable");
  }

  const xml = archive.get(worksheetPath(relationship.target));
  if (!xml) throw new Error("Workbook worksheet XML was unavailable");
  const strings = sharedStrings(archive.get("xl/sharedStrings.xml") ?? "", limits);
  return worksheetCells(xml, strings, limits);
}

export {
  sharedStrings,
  workbookSheetCells,
  worksheetCells,
  zipEntries,
};
