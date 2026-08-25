const DEFAULT_SEED_URL =
  "https://public-data-org.pages.dev/data/metrics-snapshot.json";

function approvedSeedUrl(value) {
  const candidate = String(value ?? DEFAULT_SEED_URL).trim();
  try {
    const parsed = new URL(candidate);
    const expected = new URL(DEFAULT_SEED_URL);
    if (
      parsed.protocol !== expected.protocol ||
      parsed.hostname.toLowerCase() !== expected.hostname.toLowerCase() ||
      parsed.port !== expected.port ||
      parsed.pathname !== expected.pathname ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export { DEFAULT_SEED_URL, approvedSeedUrl };
