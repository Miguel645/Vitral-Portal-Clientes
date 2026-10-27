"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parse(formData: FormData, isCreate: boolean) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "percentage") === "fixed" ? "fixed" : "percentage";
  const valueRaw = String(formData.get("value") ?? "").trim().replace(",", ".");
  const expiresAt = String(formData.get("expires_at") ?? "").trim();
  const maxUsesRaw = String(formData.get("max_uses") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const active = formData.get("active") === "on";

  const value = Number(valueRaw);
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;

  let error = "";
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    error = "Indique um código com 3 a 20 letras ou números.";
  } else if (type === "percentage" && (!Number.isFinite(value) || value < 1 || value > 100)) {
    error = "Para percentagem, indique um valor entre 1 e 100.";
  } else if (type === "fixed" && (!Number.isFinite(value) || value <= 0)) {
    error = "Para valor fixo, indique um valor superior a 0.";
  } else if (isCreate && expiresAt && expiresAt < todayISO()) {
    error = "A data de validade não pode ser no passado.";
  } else if (maxUsesRaw && (!Number.isInteger(maxUses) || (maxUses as number) < 1)) {
    error = "Se definir um número máximo de utilizações, tem de ser 1 ou mais.";
  }

  return {
    error,
    row: {
      code,
      type,
      value,
      expires_at: expiresAt || null,
      max_uses: maxUses,
      client_id: clientId || null,
      active,
    },
  };
}

export async function saveCode(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { error, row } = parse(formData, !id);
  const back = id ? `/codes/${id}` : "/codes/new";
  if (error) redirect(`${back}?error=${encodeURIComponent(error)}`);

  const supabase = await createClient();
  const { error: dbError } = id
    ? await supabase.from("discount_codes").update(row).eq("id", id)
    : await supabase.from("discount_codes").insert(row);

  if (dbError) {
    const message =
      dbError.code === "23505"
        ? "Esse código já existe. Escolha outro."
        : "Não foi possível guardar. Tente novamente.";
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }
  redirect("/codes");
}

export async function deleteCode(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("discount_codes").delete().eq("id", id);
  }
  redirect("/codes");
}
