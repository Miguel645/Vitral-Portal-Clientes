"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const earnFrom = String(formData.get("earn_from") ?? "").trim();
  const earnTo = String(formData.get("earn_to") ?? "").trim();
  const minSpendRaw = String(formData.get("min_spend") ?? "").trim().replace(",", ".");
  const discountRaw = String(formData.get("discount_percent") ?? "").trim().replace(",", ".");
  const rewardFrom = String(formData.get("reward_valid_from") ?? "").trim();
  const rewardTo = String(formData.get("reward_valid_to") ?? "").trim();
  const active = formData.get("active") === "on";

  const minSpend = Number(minSpendRaw);
  const discountPercent = Number(discountRaw);

  let error = "";
  if (!name) error = "Indique o nome da promoção.";
  else if (!earnFrom || !earnTo) error = "Indique as datas de início e fim das compras.";
  else if (earnFrom > earnTo) error = "A data de início das compras tem de ser antes da data de fim.";
  else if (!Number.isFinite(minSpend) || minSpend <= 0) error = "Indique uma compra mínima superior a 0.";
  else if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100)
    error = "Indique uma percentagem entre 1 e 100.";
  else if (!rewardFrom || !rewardTo) error = "Indique as datas de validade do prémio.";
  else if (rewardFrom > rewardTo) error = "A data de início do prémio tem de ser antes da data de fim.";

  return {
    error,
    row: {
      name,
      earn_from: earnFrom,
      earn_to: earnTo,
      min_spend: minSpend,
      discount_percent: discountPercent,
      reward_valid_from: rewardFrom,
      reward_valid_to: rewardTo,
      active,
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

  if (dbError) redirect(`${back}?error=${encodeURIComponent("Não foi possível guardar. Tente novamente.")}`);
  redirect("/promotions");
}

export async function deletePromotion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("promotions").delete().eq("id", id);
  }
  redirect("/promotions");
}
