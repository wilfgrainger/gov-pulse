import process from "node:process";

function collectStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, output);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectStrings(entry, output);
  }
  return output;
}

export function verifyWorkerDeployment(payload, expectedRevision) {
  const revision = String(expectedRevision ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(revision)) {
    return ["expected Worker revision must be a full Git commit SHA"];
  }

  const strings = collectStrings(payload).map((value) => value.toLowerCase());
  return strings.some((value) => value === revision || value.includes(revision))
    ? []
    : [`Worker deployment metadata did not contain revision ${revision}`];
}

async function main() {
  const expectedRevision = process.argv[2];
  const input = await new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      value += chunk;
    });
    process.stdin.on("end", () => resolve(value));
    process.stdin.on("error", reject);
  });

  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Wrangler Worker deployment status was not valid JSON");
  }

  const failures = verifyWorkerDeployment(payload, expectedRevision);
  if (failures.length > 0) throw new Error(failures.join("; "));
  console.log(`Verified Worker deployment metadata contains ${expectedRevision}.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
