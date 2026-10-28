"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markValeUsed } from "@/app/codes/markUsed";

// The page shows the message for `error` (see ERRORS in page.tsx) above the vale's current state.
export async function markUsedAtCounter(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "");
  const result = id ? await markValeUsed(await createClient(), id) : "not_valid";
  const query = result === "ok" ? "done=1" : `error=${result === "failed" ? "mark_failed" : "mark_not_valid"}`;
  redirect(`/verificar?code=${encodeURIComponent(code)}&${query}`);
}
