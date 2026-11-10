import { moneyDossierStaticParams, redirectToDossier } from "@/app/lib/publicMoneyRoute";

export const generateStaticParams = moneyDossierStaticParams;

export default async function BuyerDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return redirectToDossier("buyer", id);
}
