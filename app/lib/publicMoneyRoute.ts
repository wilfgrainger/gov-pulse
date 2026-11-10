import { notFound, redirect } from "next/navigation";
import { isCurrentGovernmentContractsPayload } from "@/contracts/government-contracts";
import { routeEvidenceHeld } from "@/app/lib/gateRoute";
import { readServerMetricsSnapshot } from "@/app/lib/serverMetricsSnapshot";
import { buildDossier, dossierHref, type PublicAward } from "@/app/lib/publicMoney";

/** Redirect to the dossier; 404 only when current evidence is available and lacks the id. */
export async function redirectToDossier(kind: "buyer" | "supplier", rawId: string): Promise<never> {
  const id = decodeURIComponent(rawId).slice(0, 240);
  if (!id || /[\u0000-\u001f\u007f]/.test(id)) redirect("/money");
  if (!routeEvidenceHeld("/money/")) {
    const candidate = (await readServerMetricsSnapshot())?.governmentContracts;
    if (isCurrentGovernmentContractsPayload(candidate, new Date()) &&
        !buildDossier((candidate as { awards: PublicAward[] }).awards, id, kind, "publisher-id")) {
      notFound();
    }
  }
  redirect(dossierHref({ kind, basis: "publisher-id", identity: id }));
}
