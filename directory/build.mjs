#!/usr/bin/env node
// Builds the static directory site into directory/dist. Requires Node 24+
// (imports the TypeScript directory data directly).
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GOV_DATA_DIRECTORY } from "../app/lib/govDataDirectory.ts";
import { renderSite } from "./render.mjs";

const out = join(dirname(fileURLToPath(import.meta.url)), "dist");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const files = renderSite(GOV_DATA_DIRECTORY);
for (const [name, content] of Object.entries(files)) await writeFile(join(out, name), content);
console.log(`Directory site: ${Object.keys(files).length} files written to ${out}`);
