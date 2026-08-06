import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const expectedNode = fs.readFileSync(".nvmrc", "utf8").trim().replace(/^v/, "");
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const expectedNpm = String(manifest.packageManager ?? "").replace(/^npm@/, "");
const actualNode = process.versions.node;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let actualNpm;
try {
  actualNpm = execFileSync(npmCommand, ["--version"], { encoding: "utf8" }).trim();
} catch (error) {
  if (process.platform !== "win32" || error?.code !== "EINVAL") throw error;
  actualNpm = execSync("npm --version", { encoding: "utf8", shell: true }).trim();
}

const failures = [];
if (actualNode !== expectedNode) {
  failures.push(`Node ${actualNode} is active; expected ${expectedNode} from .nvmrc`);
}
if (!expectedNpm) {
  failures.push("package.json must declare an exact npm packageManager version");
} else if (actualNpm !== expectedNpm) {
  failures.push(`npm ${actualNpm} is active; expected ${expectedNpm} from package.json`);
}
if (manifest.engines?.node !== expectedNode) {
  failures.push(`package.json engines.node must equal ${expectedNode}`);
}
if (manifest.engines?.npm !== expectedNpm) {
  failures.push(`package.json engines.npm must equal ${expectedNpm}`);
}

if (failures.length > 0) {
  console.error("Toolchain mismatch:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Toolchain verified: Node ${actualNode}, npm ${actualNpm}.`);
