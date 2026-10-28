import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lisbonToday } from "@/lib/date";

export type MarkResult = "ok" | "not_valid" | "failed";

// Using a vale deletes it from the database, but only if it's still valid today (checked
// by the database in the same step, so two tills at once can't both use it). Birthday
// vales stay counted in birthday_vales_given, so the client never gets a second one that year.
// "not_valid" = nothing changed: already used, expired, not started yet, or deleted.
export async function markValeUsed(supabase: SupabaseClient, id: string): Promise<MarkResult> {
  const today = lisbonToday();
  const { data, error } = await supabase
    .from("discount_codes")
    .delete()
    .eq("id", id)
    .is("used_at", null)
    .lte("valid_from", today)
    .gte("valid_to", today)
    .select("id");
  if (error) return "failed";
  return data.length > 0 ? "ok" : "not_valid";
}
