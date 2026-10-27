"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parse(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const birth = String(formData.get("birth_date") ?? "");
  const consent = formData.get("consent") === "on";

  let error = "";
  const digits = phone.replace(/\D/g, "");
  if (!name) error = "Indique o nome do cliente.";
  else if (digits.length < 9 || digits.length > 15)
    error = "Indique um número de telefone válido, com 9 a 15 dígitos.";
  else if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    error = "Esse endereço de email não parece correto.";

  return {
    error,
    row: { name, phone, email: email || null, birth_date: birth || null, consent },
  };
}

export async function saveClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { error, row } = parse(formData);
  const back = id ? `/clients/${id}` : "/clients/new";
  if (error) redirect(`${back}?error=${encodeURIComponent(error)}`);

  const supabase = await createClient();
  const { error: dbError } = id
    ? await supabase.from("clients").update(row).eq("id", id)
    : await supabase.from("clients").insert(row);

  if (dbError) redirect(`${back}?error=${encodeURIComponent("Não foi possível guardar. Tente novamente.")}`);
  redirect("/");
}

export async function deleteClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("clients").delete().eq("id", id);
  }
  redirect("/");
}
