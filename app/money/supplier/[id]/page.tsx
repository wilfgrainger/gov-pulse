import { redirect } from "next/navigation";
import { dossierHref } from "@/app/lib/publicMoney";

export default async function SupplierDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId).slice(0, 240);
  if (!id || /[\u0000-\u001f\u007f]/.test(id)) {
    redirect("/money");
  }
  redirect(dossierHref({ kind: "supplier", basis: "publisher-id", identity: id }));
}
