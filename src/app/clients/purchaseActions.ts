"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateUniqueCode } from "@/lib/codes";
import { formatDate } from "@/lib/date";

function parsePurchase(formData: FormData) {
  const amountRaw = String(formData.get("amount") ?? "").trim().replace(",", ".");
  const purchasedAt = String(formData.get("purchased_at") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const amount = Number(amountRaw);

  let error = "";
  if (!purchasedAt) error = "Indique a data da compra.";
  else if (!Number.isFinite(amount) || amount <= 0) error = "Indique um valor de compra superior a 0.";

  return { error, row: { amount, purchased_at: purchasedAt, note: note || null } };
}

export async function addPurchase(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const back = `/clients/${clientId}`;
  const { error, row } = parsePurchase(formData);
  if (error) redirect(`${back}?perror=${encodeURIComponent(error)}`);

  const supabase = await createClient();
  const { data: purchase, error: dbError } = await supabase
    .from("purchases")
    .insert({ ...row, client_id: clientId })
    .select("id, amount, purchased_at")
    .single();

  if (dbError || !purchase) {
    redirect(`${back}?perror=${encodeURIComponent("Não foi possível guardar a compra. Verifique os dados e tente novamente.")}`);
  }

  const { data: promotions } = await supabase
    .from("promotions")
    .select("id, name, min_spend, discount_percent, reward_valid_from, reward_valid_to")
    .eq("active", true)
    .lte("earn_from", purchase.purchased_at)
    .gte("earn_to", purchase.purchased_at);

  const newCodes: string[] = [];

  for (const promo of promotions ?? []) {
    if (purchase.amount < promo.min_spend) continue;

    const { data: existing } = await supabase
      .from("discount_codes")
      .select("id")
      .eq("purchase_id", purchase.id)
      .eq("promotion_id", promo.id)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const code = await generateUniqueCode(supabase);
    const { error: insertError } = await supabase.from("discount_codes").insert({
      code,
      kind: "spend",
      percent: promo.discount_percent,
      client_id: clientId,
      promotion_id: promo.id,
      purchase_id: purchase.id,
      valid_from: promo.reward_valid_from,
      valid_to: promo.reward_valid_to,
    });

    if (!insertError) {
      newCodes.push(
        `${code} (${promo.discount_percent}%, ${promo.name}, válido de ${formatDate(promo.reward_valid_from)} a ${formatDate(promo.reward_valid_to)})`
      );
    }
  }

  const message =
    newCodes.length > 0
      ? `Compra guardada. Novo(s) código(s) para ler ao cliente: ${newCodes.join(" · ")}`
      : "Compra guardada.";
  redirect(`${back}?pmessage=${encodeURIComponent(message)}`);
}
