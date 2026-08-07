import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const routePattern = /^route\.(?:js|jsx|mjs|ts|tsx)$/i;
const EXPECTED_DATA_ROUTES = Object.freeze([
  Object.freeze({
    pattern: "public-data.org/data/health.json",
    zone_name: "public-data.org",
  }),
  Object.freeze({
    pattern: "public-data.org/data/metrics-snapshot.json",
    zone_name: "public-data.org",
  }),
]);
const EXPECTED_WEB_ROUTE = Object.freeze({
  pattern: "public-data.org/*",
  zone_name: "public-data.org",
});

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(location) : [location];
  });
}

export function unsupportedAppRoutes(projectRoot = process.cwd()) {
  const apiRoot = path.join(projectRoot, "app", "api");
  return filesUnder(apiRoot)
    .filter((file) => routePattern.test(path.basename(file)))
    .map((file) => path.relative(projectRoot, file));
}

function workerRouteTables(config) {
  const routes = [];
  let current = null;

  for (const line of config.split(/\r?\n/)) {
    if (/^\s*\[\[routes\]\]\s*$/.test(line)) {
      current = {};
      routes.push(current);
      continue;
    }
    if (/^\s*\[/.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;

    const value = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"([^"]*)"\s*$/);
    if (value) current[value[1]] = value[2];
    else if (line.trim() && !line.trim().startsWith("#")) {
      current.__invalid = line.trim();
    }
  }
  return routes;
}

function routeSignature(route) {
  return `${route.pattern ?? ""}|${route.zone_name ?? ""}`;
}

function commonIngressFindings(config) {
  const findings = [];
  if (/^\s*workers_dev\s*=\s*true\s*$/mi.test(config)) {
    findings.push("workers.dev must remain disabled");
  }
  if (/^\s*preview_urls\s*=\s*true\s*$/mi.test(config)) {
    findings.push("preview URLs must remain disabled");
  }
  if (/^\s*(?:route|routes|custom_domains?)\s*=/mi.test(config)) {
    findings.push("top-level or array route declarations are not supported");
  }
  return findings;
}

export function unsupportedWorkerIngress(config) {
  const findings = commonIngressFindings(config);
  const routes = workerRouteTables(config);
  if (routes.length !== EXPECTED_DATA_ROUTES.length) {
    findings.push(
      `expected exactly ${EXPECTED_DATA_ROUTES.length} [[routes]] tables; found ${routes.length}`
    );
    return findings;
  }

  const expectedKeys = ["pattern", "zone_name"];
  for (const route of routes) {
    const keys = Object.keys(route).sort();
    if (keys.join(",") !== expectedKeys.join(",")) {
      findings.push(
        `public data Worker routes must contain only ${expectedKeys.join(" and ")}`
      );
    }
  }

  const actualSignatures = routes.map(routeSignature).sort();
  const expectedSignatures = EXPECTED_DATA_ROUTES.map(routeSignature).sort();
  if (actualSignatures.join("\n") !== expectedSignatures.join("\n")) {
    findings.push(
      "public data Worker routes must be the exact snapshot and health paths"
    );
  }
  return findings;
}

export function unsupportedWebWorkerIngress(config) {
  const findings = commonIngressFindings(config);
  const routes = workerRouteTables(config);
  if (routes.length !== 1) {
    findings.push(`expected exactly one web [[routes]] table; found ${routes.length}`);
    return findings;
  }
  const route = routes[0];
  const keys = Object.keys(route).sort();
  if (keys.join(",") !== "pattern,zone_name") {
    findings.push("public web Worker route must contain only pattern and zone_name");
  }
  if (routeSignature(route) !== routeSignature(EXPECTED_WEB_ROUTE)) {
    findings.push("public web Worker must use only the public-data.org/* catch-all route");
  }
  if (!/nodejs_compat/.test(config)) {
    findings.push("public web Worker must enable nodejs_compat for OpenNext");
  }
  if (!/global_fetch_strictly_public/.test(config)) {
    findings.push("public web Worker must enable global_fetch_strictly_public");
  }
  return findings;
}

export function main(projectRoot = process.cwd()) {
  const findings = [];
  const appRoutes = unsupportedAppRoutes(projectRoot);
  if (appRoutes.length > 0) {
    findings.push(
      "The public application must not add competing App Router API ingress:",
      ...appRoutes.map((route) => `- ${route}`)
    );
  }

  const dataWranglerPath = path.join(projectRoot, "worker", "wrangler.toml");
  if (!fs.existsSync(dataWranglerPath)) {
    findings.push("worker/wrangler.toml is required");
  } else {
    const workerIngress = unsupportedWorkerIngress(
      fs.readFileSync(dataWranglerPath, "utf8")
    );
    if (workerIngress.length > 0) {
      findings.push(
        "The Cloudflare data Worker may expose only snapshot and health routes:",
        ...workerIngress.map((entry) => `- ${entry}`)
      );
    }
  }

  const webWranglerPath = path.join(projectRoot, "worker", "web-wrangler.toml");
  if (!fs.existsSync(webWranglerPath)) {
    findings.push("worker/web-wrangler.toml is required");
  } else {
    const webIngress = unsupportedWebWorkerIngress(
      fs.readFileSync(webWranglerPath, "utf8")
    );
    if (webIngress.length > 0) {
      findings.push(
        "The Cloudflare web Worker must own only the catch-all application route:",
        ...webIngress.map((entry) => `- ${entry}`)
      );
    }
  }

  if (findings.length > 0) {
    console.error(`${findings.join("\n")}\n`);
    console.error(
      "Keep the two exact data routes on the data Worker and the less-specific application catch-all on the OpenNext web Worker."
    );
    process.exitCode = 1;
    return false;
  }

  console.log(
    "Architecture check passed: exact data Worker routes take precedence over the request-time OpenNext web Worker catch-all."
  );
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
