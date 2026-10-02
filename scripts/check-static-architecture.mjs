import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { readPublicSurfaces, surfacesForWorkerIngress } from "./lib/public-surfaces.mjs";

const routePattern = /^route\.(?:js|jsx|mjs|ts|tsx)$/i;

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

export function unsupportedWorkerIngress(config, surfaces = readPublicSurfaces()) {
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

  const routes = workerRouteTables(config);
  if (routes.length < 3) {
    findings.push(`the three required evidence routes must remain configured; found ${routes.length}`);
    return findings;
  }

  const expectedKeys = ["pattern", "zone_name"];
  for (const route of routes) {
    const keys = Object.keys(route).sort();
    if (keys.join(",") !== expectedKeys.join(",")) {
      findings.push(
        `public Worker routes must contain only ${expectedKeys.join(" and ")}`,
      );
    }
  }

  return [...findings, ...surfacesForWorkerIngress(routes, surfaces)];
}

export function main(projectRoot = process.cwd()) {
  const findings = [];
  const appRoutes = unsupportedAppRoutes(projectRoot);
  if (appRoutes.length > 0) {
    findings.push(
      "Worker data routes must remain within the approved evidence surface:",
      ...appRoutes.map((route) => `- ${route}`)
    );
  }

  const wranglerPath = path.join(projectRoot, "worker", "wrangler.toml");
  if (!fs.existsSync(wranglerPath)) {
    findings.push("worker/wrangler.toml is required");
  } else {
    const workerIngress = unsupportedWorkerIngress(
      fs.readFileSync(wranglerPath, "utf8"),
      readPublicSurfaces(projectRoot),
    );
    if (workerIngress.length > 0) {
      findings.push(
        "The Cloudflare data Worker may expose only the approved evidence contracts:",
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
  console.log(`Architecture check passed: application routes plus ${surfaces.workerRoutes.length} reviewed public data routes.`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
