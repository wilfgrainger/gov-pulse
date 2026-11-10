// Longest total time (seconds) any cache may serve an evidence-bearing or
// config-filtered public response: max(max-age, s-maxage) plus both stale windows.
export const MAX_PUBLIC_CACHE_LIFETIME_SECONDS = 300;

/**
 * Total cacheable lifetime of a Cache-Control value. 0 for no-store or a
 * missing header; Infinity when a lifetime directive cannot be parsed, so an
 * unreadable header fails closed.
 */
export function cacheLifetimeSeconds(cacheControl) {
  if (typeof cacheControl !== "string" || !cacheControl.trim()) return 0;
  const directives = new Map(
    cacheControl.split(",").map((part) => {
      const [name, value] = part.trim().toLowerCase().split("=");
      return [name, value];
    }),
  );
  if (directives.has("no-store")) return 0;
  const seconds = (name) => {
    if (!directives.has(name)) return 0;
    const value = Number(directives.get(name));
    return Number.isInteger(value) && value >= 0 ? value : Infinity;
  };
  return (
    Math.max(seconds("max-age"), seconds("s-maxage")) +
    seconds("stale-while-revalidate") +
    seconds("stale-if-error")
  );
}
