"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, samePhone } from "@/lib/phone";
import { digitsPattern } from "@/lib/clientSearch";
import { INVALID_DATE, lisbonToday, parseDisplayDate } from "@/lib/date";
import { welcomeAfterSave } from "@/lib/welcomeSms";

export type ClientFields = { name: string; phone: string; email: string; birth_date: string; consent: boolean };

export type ClientFormState = {
  error?: string;
  field?: "name" | "phone" | "email" | "birth_date";
  // Name of another client who already has this phone number (asks to confirm once).
  duplicateOf?: string;
  values?: ClientFields;
};

function parse(formData: FormData) {
  const values: ClientFields = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    birth_date: String(formData.get("birth_date") ?? "").trim(),
    consent: formData.get("consent") === "on",
  };

  // Typed as dd/mm/aaaa, stored as an ISO date.
  const birthIso = values.birth_date ? parseDisplayDate(values.birth_date) : null;

  let error = "";
  let field: ClientFormState["field"];
  if (!values.name) {
    error = "Escreva o nome do cliente.";
    field = "name";
  } else if (!values.phone) {
    error = "Escreva o telemóvel do cliente.";
    field = "phone";
  } else if (!normalizePhone(values.phone).ok) {
    error = "O telemóvel tem de ter 9 dígitos e começar por 9 (ou começar por +, se for estrangeiro).";
    field = "phone";
  } else if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
    error = "Esse endereço de email não parece correto. Verifique e tente novamente.";
    field = "email";
  } else if (values.birth_date && !birthIso) {
    error = INVALID_DATE;
    field = "birth_date";
  } else if (birthIso && birthIso > lisbonToday()) {
    error = "A data de nascimento não pode ser depois de hoje.";
    field = "birth_date";
  }

  return {
    error,
    field,
    values,
    row: {
      name: values.name,
      phone: values.phone,
      email: values.email || null,
      birth_date: birthIso,
      consent: values.consent,
    },
  };
}

export async function saveClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const id = String(formData.get("id") ?? "");
  const allowDuplicate = String(formData.get("allow_duplicate") ?? "");
  const { error, field, values, row } = parse(formData);
  if (error) return { error, field, values };

  const supabase = await createClient();

  // Warn once if another client already has this number; saving again confirms it.
  if (!allowDuplicate || !samePhone(allowDuplicate, row.phone)) {
    // Only the clients whose number ends in the same 9 digits, however it was typed.
    const digits = row.phone.replace(/\D/g, "").slice(-9);
    const { data: others } = await supabase
      .from("clients")
      .select("id, name, phone")
      .filter("phone", "imatch", `${digitsPattern(digits)}[^0-9]*$`);
    const dup = (others ?? []).find((c) => c.id !== id && samePhone(c.phone, row.phone));
    if (dup) return { duplicateOf: dup.name, values };
  }

  const { data: saved, error: dbError } = id
    ? await supabase.from("clients").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("clients").insert(row).select("id").single();

  if (dbError || !saved) {
    return { error: "Não foi possível guardar. Verifique os dados e tente novamente.", values };
  }
  const message = id ? "Cliente atualizado." : "Cliente guardado.";

  // A client who receives messages and was never welcomed gets the welcome SMS now.
  // If it fails, the client stays saved and their page says why.
  const welcome = await welcomeAfterSave(supabase, saved.id);
  if (welcome && "error" in welcome) {
    const failed = `${message.slice(0, -1)}, mas a mensagem de boas-vindas não foi enviada: ${welcome.error}`;
    redirect(`/clients/${saved.id}?message=${encodeURIComponent(failed)}`);
  }
  redirect(`/?message=${encodeURIComponent(welcome ? `${message} ${welcome.message}` : message)}`);
}

export async function deleteClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("clients").delete().eq("id", id);
  }
  redirect(`/?message=${encodeURIComponent(name ? `Cliente ${name} eliminado.` : "Cliente eliminado.")}`);
}
