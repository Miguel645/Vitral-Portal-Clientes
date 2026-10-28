"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, samePhone } from "@/lib/phone";

export type ClientFields = { name: string; phone: string; email: string; birth_date: string; consent: boolean };

export type ClientFormState = {
  error?: string;
  field?: "name" | "phone" | "email";
  // Name of another client who already has this phone number (asks to confirm once).
  duplicateOf?: string;
  values?: ClientFields;
};

function parse(formData: FormData) {
  const values: ClientFields = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    birth_date: String(formData.get("birth_date") ?? ""),
    consent: formData.get("consent") === "on",
  };

  let error = "";
  let field: ClientFormState["field"];
  if (!values.name) {
    error = "Indique o nome do cliente.";
    field = "name";
  } else if (!normalizePhone(values.phone).ok) {
    error = "Indique um telemóvel de 9 dígitos começado por 9, ou um número estrangeiro começado por +.";
    field = "phone";
  } else if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
    error = "Esse endereço de email não parece correto. Verifique e tente novamente.";
    field = "email";
  }

  return {
    error,
    field,
    values,
    row: {
      name: values.name,
      phone: values.phone,
      email: values.email || null,
      birth_date: values.birth_date || null,
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
    const { data: others } = await supabase.from("clients").select("id, name, phone");
    const dup = (others ?? []).find((c) => c.id !== id && samePhone(c.phone, row.phone));
    if (dup) return { duplicateOf: dup.name, values };
  }

  const { error: dbError } = id
    ? await supabase.from("clients").update(row).eq("id", id)
    : await supabase.from("clients").insert(row);

  if (dbError) {
    return { error: "Não foi possível guardar. Verifique os dados e tente novamente.", values };
  }
  const message = id ? "Cliente atualizado." : "Cliente guardado.";
  redirect(`/?message=${encodeURIComponent(message)}`);
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
