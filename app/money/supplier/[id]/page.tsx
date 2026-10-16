import { redirect } from "next/navigation";
import { dossierHref } from "@/app/lib/publicMoney";
import PublicationOffline from "@/app/components/PublicationOffline";

const STATIC_FALLBACK_ID = "__unavailable__";

export function generateStaticParams() {
  return [{ id: STATIC_FALLBACK_ID }];
}

export default async function SupplierDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  if (process.env.STATIC_EXPORT === "true" && rawId === STATIC_FALLBACK_ID) {
    return <PublicationOffline title="Public-money dossiers are temporarily unavailable" />;
  }
  const id = decodeURIComponent(rawId).slice(0, 240);
  if (!id || /[\u0000-\u001f\u007f]/.test(id)) {
    redirect("/money");
  }
  redirect(dossierHref({ kind: "supplier", basis: "publisher-id", identity: id }));
}
