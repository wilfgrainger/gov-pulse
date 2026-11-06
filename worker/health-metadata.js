import { UNAVAILABLE_REASONS } from "./publication-availability.js";

// Compact codes for the unavailable reasons. Mirrors UNAVAILABLE_REASONS; an
// unknown reason is never encoded, so health fails closed rather than guessing.
const REASON_CODES = Object.freeze({
  "no-current-observation": "n",
  "collector-failed": "c",
  "not-scheduled": "s",
});

const REASON_BY_CODE = Object.freeze(
  Object.fromEntries(Object.entries(REASON_CODES).map(([reason, code]) => [code, reason])),
);

const METADATA_MAX_BYTES = 1000;
const FEED_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

for (const reason of UNAVAILABLE_REASONS) {
  if (!REASON_CODES[reason]) throw new Error(`Health metadata has no code for reason '${reason}'`);
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function assertId(id) {
  if (typeof id !== "string" || !FEED_ID_PATTERN.test(id)) {
    throw new Error(`Health metadata cannot encode feed id '${String(id)}'`);
  }
  return id;
}

function packIds(ids) {
  return ids.map(assertId).join(",");
}

function unpackIds(value) {
  return typeof value === "string" && value ? value.split(",") : [];
}

function packUnavailable(entries) {
  return entries
    .map(({ id, reason }) => {
      const code = REASON_CODES[reason];
      if (!code) throw new Error(`Health metadata cannot encode reason '${String(reason)}'`);
      return `${assertId(id)}:${code}`;
    })
    .join(",");
}

function unpackUnavailable(value) {
  if (typeof value !== "string" || !value) return [];
  return value.split(",").map((pair) => {
    const [id, code] = pair.split(":");
    const reason = REASON_BY_CODE[code];
    if (!id || !reason) throw new Error("Health metadata has an unreadable unavailable entry");
    return { id, reason };
  });
}

/**
 * Small, bounded health record for an edition. Packs missing, held and
 * unavailable feeds into KV metadata; when that exceeds the byte budget it
 * stores a marker (`t: 1`) and returns the full detail as `overflow`.
 */
function buildHealthMetadata(edition, _now = new Date()) {
  const missing = edition.missingRequired ?? [];
  const held = edition.held ?? [];
  const unavailable = edition.unavailableSections ?? [];
  const base = {
    v: 1,
    e: edition.editionId,
    g: edition.generatedAt,
    u: edition.validUntil,
    s: missing.length > 0 ? "degraded" : "ready",
  };
  const packed = {
    ...base,
    ...(missing.length > 0 ? { m: packIds(missing) } : {}),
    ...(held.length > 0 ? { h: packIds(held) } : {}),
    ...(unavailable.length > 0 ? { x: packUnavailable(unavailable) } : {}),
  };
  if (byteLength(packed) <= METADATA_MAX_BYTES) return { metadata: packed, overflow: null };
  return {
    metadata: { ...base, t: 1 },
    overflow: {
      editionId: edition.editionId,
      missingRequired: [...missing],
      held: [...held],
      unavailableSections: unavailable.map(({ id, reason }) => ({ id, reason })),
    },
  };
}

function bodyFrom(missing, held, unavailable) {
  const heldPart = held.length > 0 ? { held } : {};
  const unavailablePart = unavailable.length > 0 ? { unavailableSections: unavailable } : {};
  if (missing.length > 0) {
    return {
      status: "degraded",
      ready: false,
      degraded: true,
      missingRequiredSections: missing,
      ...heldPart,
      ...unavailablePart,
    };
  }
  return { status: "ready", ready: true, ...heldPart, ...unavailablePart };
}

/** The public health body, in exactly the legacy shape and key order. */
function healthBodyFromMetadata(metadata, overflow) {
  const closed = { status: "degraded", ready: false, degraded: true };
  if (!metadata || metadata.v !== 1) return closed;
  try {
    if (metadata.t === 1) {
      if (!overflow || overflow.editionId !== metadata.e) return closed;
      return bodyFrom(
        overflow.missingRequired ?? [],
        overflow.held ?? [],
        overflow.unavailableSections ?? [],
      );
    }
    return bodyFrom(unpackIds(metadata.m), unpackIds(metadata.h), unpackUnavailable(metadata.x));
  } catch {
    return closed;
  }
}

export { REASON_CODES, buildHealthMetadata, healthBodyFromMetadata };
