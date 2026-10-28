"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenColumn } from "./tokenColumn";

// Only runs when the client taps the button, never on just opening the link
// (phone apps open links in the background to build previews).
export async function unsubscribe(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const column = tokenColumn(token);
  if (column) {
    const supabase = createAdminClient();
    await supabase.from("clients").update({ consent: false }).eq(column, token);
  }
  redirect(`/u/${encodeURIComponent(token)}`);
}
