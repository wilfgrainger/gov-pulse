export type ChangeDescription = "rose" | "fell" | "was unchanged" | "unavailable";

export function describeChange(value: number | null): ChangeDescription {
  if (value === null || !Number.isFinite(value)) return "unavailable";
  if (value === 0) return "was unchanged";
  return value > 0 ? "rose" : "fell";
}

export function describePercentageChange(value: number | null): string {
  const direction = describeChange(value);
  if (direction === "unavailable") return "change was unavailable";
  if (direction === "was unchanged") return "was unchanged (0.0% growth)";
  return `${direction} by ${Math.abs(value as number).toFixed(1)}%`;
}
