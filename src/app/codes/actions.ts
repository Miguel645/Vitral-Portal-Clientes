"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function markCodeUsed(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("discount_codes").update({ used_at: new Date().toISOString() }).eq("id", id).is("used_at", null);
  }
  redirect(`/codes?message=${encodeURIComponent("Vale marcado como usado.")}`);
}

export async function deleteCode(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("discount_codes").delete().eq("id", id);
  }
  redirect(`/codes?message=${encodeURIComponent(`Vale ${code} eliminado.`)}`);
}
