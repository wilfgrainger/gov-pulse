import type { NextConfig } from "next";

const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "")
  .trim()
  .replace(/\/+$/, "");
const basePath = configuredBasePath && !configuredBasePath.startsWith("/")
  ? `/${configuredBasePath}`
  : configuredBasePath;

const nextConfig: NextConfig = {
  // Server mode is used for local development.
  // Set STATIC_EXPORT=true to build the Cloudflare Pages frontend. Verified
  // data is published as a same-origin snapshot; no public API is required.
  ...(process.env.STATIC_EXPORT === "true" ? { output: "export" as const } : {}),
  basePath,
  assetPrefix: basePath,
  // Keep local and production route semantics aligned for static hosting.
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
