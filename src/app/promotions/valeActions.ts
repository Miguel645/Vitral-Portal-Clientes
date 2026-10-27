"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateUniqueCode } from "@/lib/codes";

export async function criarVale(formData: FormData) {
  const promotionId = String(formData.get("promotion_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "").trim();
  const q = String(formData.get("q") ?? "");

  function back(extra: Record<string, string>) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    return `/promotions/${promotionId}/criar-vale?${params.toString()}`;
  }

  const supabase = await createClient();
  const { data: promotion } = await supabase
    .from("promotions")
    .select("id, discount_percent, reward_valid_from, reward_valid_to, active")
    .eq("id", promotionId)
    .maybeSingle();

  if (!promotion) {
    redirect(back({ error: "Promoção não encontrada." }));
  }
  if (!promotion.active) {
    redirect(back({ error: "Esta promoção está pausada. Não é possível criar vales novos." }));
  }

  const code = await generateUniqueCode(supabase);
  const { error } = await supabase.from("discount_codes").insert({
    code,
    kind: "promotion",
    percent: promotion.discount_percent,
    promotion_id: promotion.id,
    client_id: clientId || null,
    valid_from: promotion.reward_valid_from,
    valid_to: promotion.reward_valid_to,
  });

  if (error) {
    redirect(back({ error: "Não foi possível criar o vale. Tente novamente." }));
  }

  redirect(`/promotions/${promotionId}/criar-vale?created=${encodeURIComponent(code)}`);
}

export async function criarVariosVales(formData: FormData) {
  const promotionId = String(formData.get("promotion_id") ?? "");
  const countRaw = String(formData.get("count") ?? "").trim();
  const count = Number(countRaw);
  const back = `/promotions/${promotionId}/criar-varios`;

  if (!Number.isInteger(count) || count < 1 || count > 500) {
    redirect(`${back}?error=${encodeURIComponent("Indique um número entre 1 e 500.")}`);
  }

  const supabase = await createClient();
  const { data: promotion } = await supabase
    .from("promotions")
    .select("id, discount_percent, reward_valid_from, reward_valid_to, active")
    .eq("id", promotionId)
    .maybeSingle();

  if (!promotion) {
    redirect(`${back}?error=${encodeURIComponent("Promoção não encontrada.")}`);
  }
  if (!promotion.active) {
    redirect(`${back}?error=${encodeURIComponent("Esta promoção está pausada. Não é possível criar vales novos.")}`);
  }

  const since = new Date().toISOString();
  for (let i = 0; i < count; i++) {
    const code = await generateUniqueCode(supabase);
    await supabase.from("discount_codes").insert({
      code,
      kind: "promotion",
      percent: promotion.discount_percent,
      promotion_id: promotion.id,
      valid_from: promotion.reward_valid_from,
      valid_to: promotion.reward_valid_to,
    });
  }

  redirect(`${back}?since=${encodeURIComponent(since)}&count=${count}`);
}
