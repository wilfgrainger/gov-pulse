import { redirectToDossier } from "@/app/lib/publicMoneyRoute";

export default async function BuyerDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return redirectToDossier("buyer", id);
}
