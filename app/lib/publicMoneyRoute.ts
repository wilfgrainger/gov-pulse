import { notFound, redirect } from "next/navigation";
import { isCurrentGovernmentContractsPayload } from "@/contracts/government-contracts";
import { routeEvidenceHeld } from "@/app/lib/gateRoute";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { buildDossier, dossierHref, type PublicAward } from "@/app/lib/publicMoney";

/**
 * Redirect to the dossier; 404 only when current evidence is available and lacks the id.
 * A static export cannot decide per id (its redirects are contracts/edition-redirects.txt
 * rules), so the check is skipped there.
 */
export async function redirectToDossier(kind: "buyer" | "supplier", rawId: string): Promise<never> {
  const id = decodeURIComponent(rawId).slice(0, 240);
  if (!id || /[\u0000-\u001f\u007f]/.test(id)) redirect("/money");
  if (process.env.STATIC_EXPORT !== "true" && !routeEvidenceHeld("/money/")) {
    const candidate = (await readServerMetricsSnapshot())?.governmentContracts;
    if (isCurrentGovernmentContractsPayload(candidate, new Date()) &&
        !buildDossier((candidate as { awards: PublicAward[] }).awards, id, kind, "publisher-id")) {
      notFound();
    }
  }
  redirect(dossierHref({ kind, basis: "publisher-id", identity: id }));
}

// `output: "export"` needs a param list: one placeholder page, real ids go through the redirect rules.
// Outside the export it must be absent: with it, Next treats the route as static and the
// request-time evidence read fails every id with DYNAMIC_SERVER_USAGE (HTTP 500).
export const moneyDossierStaticParams: (() => { id: string }[]) | undefined =
  process.env.STATIC_EXPORT === "true" ? () => [{ id: "_" }] : undefined;
