import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const manifestPath = path.join(process.cwd(), "contracts", "public-surfaces.json");

export function readPublicSurfaces(projectRoot = process.cwd()) {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, "contracts", "public-surfaces.json"), "utf8"),
  );
}

function parsePublicUrl(input) {
  if (typeof input !== "string" || !input.trim()) return null;
  try {
    const url = input.startsWith("/")
      ? new URL(input, "https://public-data.org")
      : new URL(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(input) ? input : `https://${input}`);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "public-data.org" ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      /%2f|%5c/i.test(url.pathname) ||
      url.pathname.includes("\\")
    ) return null;
    return url;
  } catch {
    return null;
  }
}

/** Returns whether a request matches an explicitly reviewed public Worker surface. */
export function publicRouteAllowed(input, surfaces = JSON.parse(fs.readFileSync(manifestPath, "utf8"))) {
  const url = parsePublicUrl(input);
  if (!url || !Array.isArray(surfaces.workerRoutes)) return false;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }
  if (pathname !== url.pathname || (surfaces.privatePathPrefixes ?? []).some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  const query = [...url.searchParams.entries()];
  const route = surfaces.workerRoutes.find((entry) => {
    const hostPrefix = `${url.hostname}/`;
    if (entry.zone_name !== url.hostname || !entry.pattern.startsWith(hostPrefix)) return false;
    const configuredPath = entry.pattern.slice(url.hostname.length);
    const matchesQuery = configuredPath.endsWith("*");
    const exactPath = matchesQuery ? configuredPath.slice(0, -1) : configuredPath;
    return exactPath === pathname && (query.length === 0 || matchesQuery);
  });
  if (!route) return false;

  const allowed = route.queryParams ?? {};
  if (query.some(([name]) => !Object.hasOwn(allowed, name))) return false;
  for (const [name, expression] of Object.entries(allowed)) {
    const values = url.searchParams.getAll(name);
    if (values.length > 1) return false;
    if (values.length === 1 && !new RegExp(expression).test(values[0])) return false;
  }
  return true;
}

export function surfacesForWorkerIngress(config, surfaces = readPublicSurfaces()) {
  const allowed = new Map(
    surfaces.workerRoutes.map((route) => [
      `${route.pattern}|${route.zone_name}`,
      route,
    ]),
  );
  const configured = new Set();
  const errors = [];

  for (const route of config) {
    const signature = `${route.pattern ?? ""}|${route.zone_name ?? ""}`;
    if (configured.has(signature)) errors.push(`duplicate Worker route '${route.pattern}'`);
    configured.add(signature);
    const requestPattern = route.pattern.endsWith("*") ? route.pattern.slice(0, -1) : route.pattern;
    if (!allowed.has(signature) || publicRouteAllowed(requestPattern, surfaces) !== true) {
      errors.push(`Worker route '${route.pattern ?? ""}' is not in the approved public-surface manifest`);
    }
  }

  for (const [signature, route] of allowed) {
    if (route.required === true && !configured.has(signature)) {
      errors.push(`required public evidence route '${route.pattern}' is not configured`);
    }
  }
  return errors;
}
