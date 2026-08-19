import { decodeHtml, parseAttributes } from "./live-feed-common.js";

async function inflate(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
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

async function zipEntries(arrayBuffer) {
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
      const data =
        method === 0
          ? compressed
          : method === 8
            ? await inflate(compressed)
            : null;
      if (!data) throw new Error(`Workbook used unsupported ZIP method ${method}`);
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

function sharedStrings(xml = "") {
  return [...String(xml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(
    (match) =>
      [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
        .map((part) => xmlText(part[1]))
        .join("")
  );
}

function worksheetCells(xml, strings = []) {
  const cells = new Map();
  for (const match of String(xml).matchAll(
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

async function workbookSheetCells(arrayBuffer, sheetNamePattern) {
  const archive = await zipEntries(arrayBuffer);
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
  const strings = sharedStrings(archive.get("xl/sharedStrings.xml") ?? "");
  return worksheetCells(xml, strings);
}

export {
  sharedStrings,
  workbookSheetCells,
  worksheetCells,
  zipEntries,
};
