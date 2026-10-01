/** Midpoint timestamp (ms since epoch, UTC) between two ISO date-only strings. */
export function fieldworkMidpointMs(fieldworkStart: string, fieldworkEnd: string): number {
  const start = Date.parse(`${fieldworkStart}T00:00:00.000Z`);
  const end = Date.parse(`${fieldworkEnd}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("Fieldwork dates must be valid ISO date-only strings");
  }
  return start + (end - start) / 2;
}
