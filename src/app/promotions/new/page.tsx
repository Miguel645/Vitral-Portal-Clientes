import PromotionForm from "../PromotionForm";

export default async function NewPromotionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <PromotionForm title="Nova promoção" error={error} />;
}
