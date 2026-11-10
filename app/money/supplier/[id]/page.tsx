import { redirectToDossier } from "@/app/lib/publicMoneyRoute";

export default async function SupplierDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return redirectToDossier("supplier", id);
}
