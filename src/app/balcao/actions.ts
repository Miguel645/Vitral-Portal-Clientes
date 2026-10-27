"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function markUsedAtCounter(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("discount_codes").update({ used_at: new Date().toISOString() }).eq("id", id).is("used_at", null);
  }
  redirect(`/balcao/verificar?code=${encodeURIComponent(code)}`);
}
