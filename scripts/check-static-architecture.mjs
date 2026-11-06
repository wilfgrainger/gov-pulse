import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { readPublicSurfaces, surfacesForWorkerIngress } from "./lib/public-surfaces.mjs";

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

export function unsupportedWorkerIngress(config, surfaces = readPublicSurfaces()) {
  const findings = [];
  if (/^\s*workers_dev\s*=\s*true\s*$/mi.test(config)) {
    findings.push("workers.dev must remain disabled");
  }
  if (/^\s*preview_urls\s*=\s*true\s*$/mi.test(config)) {
    findings.push("preview URLs must remain disabled");
  }
  const routes = workerRouteTables(config);

  if (surfaces.workerRouteManagement === "cloudflare-dashboard") {
    if (routes.length > 0) {
      findings.push("Worker routes must remain dashboard-managed and omitted from Wrangler config");
    }
    return findings;
  }
  if (surfaces.workerRouteManagement !== undefined && surfaces.workerRouteManagement !== "wrangler") {
    findings.push(`unsupported Worker route management mode '${surfaces.workerRouteManagement}'`);
    return findings;
  }

  return [...findings, ...surfacesForWorkerIngress(routes, surfaces)];
}

export function main(projectRoot = process.cwd()) {
  const findings = [];
  const workerConfigPaths = [
    path.join(projectRoot, "worker", "wrangler.toml"),
    path.join(projectRoot, "worker", "web-wrangler.toml"),
  ];
  const workerConfigs = workerConfigPaths.filter((configPath) =>
    fs.existsSync(configPath)
  );
  for (const configPath of workerConfigs) {
    const workerIngress = unsupportedWorkerIngress(
      fs.readFileSync(configPath, "utf8"),
      readPublicSurfaces(projectRoot),
    );
    if (workerIngress.length > 0) {
      findings.push(
        `The Cloudflare Worker config ${path.relative(projectRoot, configPath)} violates the ingress contract:`,
        ...workerIngress.map((entry) => `- ${entry}`)
      );
    }
  }

  if (findings.length > 0) {
    console.error(`${findings.join("\n")}\n`);
    console.error(
      "Keep collector, queue and cache internals private; add public data routes only through contracts/public-surfaces.json."
    );
    process.exitCode = 1;
    return false;
  }

  const surfaces = readPublicSurfaces(projectRoot);
  const runtimeNote = workerConfigs.length > 0
    ? `Cloudflare Worker configs (${workerConfigs.length}) checked for dashboard-managed ingress; the ${surfaces.workerRoutes.length} reviewed public routes are verified live after deploy, not here.`
    : "No Cloudflare config found; provider-neutral public route contracts remain checked.";
  console.log(`Architecture check passed: ${runtimeNote}`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
