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

  return [...findings, ...surfacesForWorkerIngress(routes, surfaces)];
}

export function main(projectRoot = process.cwd()) {
  const findings = [];
  const wranglerPath = path.join(projectRoot, "worker", "wrangler.toml");
  const hasCloudflareRuntime = fs.existsSync(wranglerPath);
  if (hasCloudflareRuntime) {
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
  const runtimeNote = hasCloudflareRuntime
    ? `Cloudflare ingress checked across ${surfaces.workerRoutes.length} reviewed public routes.`
    : "No Cloudflare config found; provider-neutral public route contracts remain checked.";
  console.log(`Architecture check passed: ${runtimeNote}`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
