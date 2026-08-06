const API_ROOT = "https://api.cloudflare.com/client/v4";
const PROJECT_NAME = process.env.CLOUDFLARE_PAGES_PROJECT ?? "public-data-org";
const DOMAIN_NAME = process.env.CLOUDFLARE_PAGES_DOMAIN ?? "public-data.org";
const PUBLIC_URL = process.env.PUBLICATION_URL ?? `https://${DOMAIN_NAME}/`;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ATTEMPTS = Number(process.env.DOMAIN_HEALTH_ATTEMPTS ?? 12);
const DELAY_MS = Number(process.env.DOMAIN_HEALTH_DELAY_MS ?? 10_000);

if (!TOKEN || !ACCOUNT_ID) {
  throw new Error("Cloudflare Pages domain check requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID");
}

const projectApi = `${API_ROOT}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}`;
const domainApi = `${projectApi}/domains/${DOMAIN_NAME}`;
const headers = {
  authorization: `Bearer ${TOKEN}`,
  "content-type": "application/json",
};

async function cloudflare(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...headers, ...options.headers },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function domainStatus(payload) {
  return payload?.result?.status ?? "unknown";
}

function domainMessage(payload) {
  return (
    payload?.result?.validation_data?.error_message ||
    payload?.result?.verification_data?.error_message ||
    payload?.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
    null
  );
}

async function ensureBinding() {
  const project = await cloudflare(projectApi);
  if (!project.response.ok || !project.payload?.success || !project.payload?.result?.name) {
    throw new Error(`Cloudflare Pages project '${PROJECT_NAME}' could not be read`);
  }
  console.log(`Pages project found: ${project.payload.result.name}`);

  let domain = await cloudflare(domainApi);
  if (domain.response.status === 404) {
    console.log(`Custom domain ${DOMAIN_NAME} is absent; attaching it to ${PROJECT_NAME}.`);
    domain = await cloudflare(`${projectApi}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: DOMAIN_NAME }),
    });
  } else if (!domain.response.ok || !domain.payload?.success) {
    throw new Error(
      `Cloudflare domain lookup failed with HTTP ${domain.response.status}${
        domainMessage(domain.payload) ? `: ${domainMessage(domain.payload)}` : ""
      }`
    );
  }

  const initialStatus = domainStatus(domain.payload);
  console.log(`Pages domain status: ${initialStatus}`);
  if (initialStatus !== "active") {
    console.log("Retrying Pages custom-domain validation.");
    domain = await cloudflare(domainApi, { method: "PATCH" });
    if (!domain.response.ok || !domain.payload?.success) {
      throw new Error(
        `Cloudflare domain validation retry failed with HTTP ${domain.response.status}${
          domainMessage(domain.payload) ? `: ${domainMessage(domain.payload)}` : ""
        }`
      );
    }
  }
}

async function publicRouteHealthy() {
  try {
    const response = await fetch(PUBLIC_URL, {
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "public-data-domain-health/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    return response.ok && !/error\s*1001|dns resolution error/i.test(body);
  } catch {
    return false;
  }
}

await ensureBinding();

let retriedActiveBinding = false;
for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  const domain = await cloudflare(domainApi);
  if (!domain.response.ok || !domain.payload?.success) {
    throw new Error(`Cloudflare domain status check failed with HTTP ${domain.response.status}`);
  }

  const status = domainStatus(domain.payload);
  const healthy = status === "active" ? await publicRouteHealthy() : false;
  console.log(`Attempt ${attempt}/${ATTEMPTS}: status=${status}; public=${healthy ? "healthy" : "unhealthy"}`);

  if (status === "active" && healthy) {
    console.log(`${DOMAIN_NAME} is active and serves application content.`);
    process.exit(0);
  }

  if (status === "active" && !healthy && !retriedActiveBinding) {
    retriedActiveBinding = true;
    console.log("Active binding is not serving correctly; retrying domain validation once.");
    const retry = await cloudflare(domainApi, { method: "PATCH" });
    if (!retry.response.ok || !retry.payload?.success) {
      console.log(`Domain validation retry returned HTTP ${retry.response.status}; continuing bounded checks.`);
    }
  }

  if (attempt < ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
}

throw new Error(`${DOMAIN_NAME} did not become healthy within the bounded domain-repair window`);
