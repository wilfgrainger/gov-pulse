// Deployed entry of the public-data-web Worker: the OpenNext handler behind a
// short-lived page cache (worker/web-page-cache.js).
import handler from "../.open-next/worker.js";
import { withPageCache } from "./web-page-cache.js";

export * from "../.open-next/worker.js";
export default withPageCache(handler);
