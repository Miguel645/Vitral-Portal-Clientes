"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// Only runs when the client taps the button, never on just opening the link
// (phone apps open links in the background to build previews).
export async function unsubscribe(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (token) {
    const supabase = createAdminClient();
    await supabase.from("clients").update({ consent: false }).eq("unsubscribe_token", token);
  }
  redirect(`/u/${encodeURIComponent(token)}`);
}
