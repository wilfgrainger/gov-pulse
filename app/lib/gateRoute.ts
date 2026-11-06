import { gateRouteWith, routeEvidenceHeld as evidenceHeld } from "@/contracts/route-manifest";

export type RouteGate = {
  access: "serve" | "unavailable" | "not-found";
  /** Feeds on this route whose publication is not published. May be non-empty while serving (any-published). */
  heldFeeds: string[];
};

/** The one page gate: every route is looked up in the derived manifest. */
export function gateRoute(path: string, now: Date = new Date()): RouteGate {
  return gateRouteWith(path, now);
}

/** True when the route exists and is currently served. For navigation and sitemap filtering. */
export function routeServes(path: string): boolean {
  return gateRoute(path).access === "serve";
}

/**
 * True when the route exists but its feeds are not published, regardless of
 * product capabilities. Pages that render an in-page hold notice use this.
 */
export function routeEvidenceHeld(path: string, now: Date = new Date()): boolean {
  return evidenceHeld(path, now);
}
