"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const condition = String(formData.get("condition") ?? "").trim();
  const discountRaw = String(formData.get("discount_percent") ?? "").trim().replace(",", ".");
  const validFrom = String(formData.get("reward_valid_from") ?? "").trim();
  const validTo = String(formData.get("reward_valid_to") ?? "").trim();
  const paused = formData.get("paused") === "on";

  const discountPercent = Number(discountRaw);

  let error = "";
  if (!name) error = "Indique o nome da promoção. Exemplo: \"Natal 2026\".";
  else if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100)
    error = "Indique uma percentagem entre 1 e 100. Exemplo: 10.";
  else if (!validFrom || !validTo) error = "Indique as duas datas de validade do vale.";
  else if (validFrom > validTo) error = "A primeira data tem de ser antes da segunda. Verifique e tente novamente.";

  return {
    error,
    row: {
      name,
      condition: condition || null,
      discount_percent: discountPercent,
      reward_valid_from: validFrom,
      reward_valid_to: validTo,
      active: id ? !paused : true,
    },
  };
}

export async function savePromotion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { error, row } = parse(formData);
  const back = id ? `/promotions/${id}` : "/promotions/new";
  if (error) redirect(`${back}?error=${encodeURIComponent(error)}`);

  const supabase = await createClient();
  const { error: dbError } = id
    ? await supabase.from("promotions").update(row).eq("id", id)
    : await supabase.from("promotions").insert(row);

  if (dbError) {
    redirect(`${back}?error=${encodeURIComponent("Não foi possível guardar. Verifique os dados e tente novamente.")}`);
  }
  const message = id ? "Promoção atualizada." : "Promoção guardada.";
  redirect(`/promotions?message=${encodeURIComponent(message)}`);
}

export async function deletePromotion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("promotions").delete().eq("id", id);
  }
  redirect(`/promotions?message=${encodeURIComponent(`Promoção "${name}" eliminada.`)}`);
}
