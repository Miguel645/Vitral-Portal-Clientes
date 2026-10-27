import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PromotionForm from "../PromotionForm";

export default async function EditPromotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: promotion } = await supabase
    .from("promotions")
    .select("id, name, earn_from, earn_to, min_spend, discount_percent, reward_valid_from, reward_valid_to, active")
    .eq("id", id)
    .maybeSingle();

  if (!promotion) notFound();
  return <PromotionForm title="Editar promoção" promotion={promotion} error={error} />;
}
