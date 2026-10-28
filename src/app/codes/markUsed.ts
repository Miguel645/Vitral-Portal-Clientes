import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lisbonToday } from "@/lib/date";

export type MarkResult = "ok" | "not_valid" | "failed";

// Marks a vale as used only if it's still valid today and not used yet (checked by the
// database in the same step, so two tills at once can't both use it).
// "not_valid" = nothing changed: already used, expired, not started yet, or deleted.
export async function markValeUsed(supabase: SupabaseClient, id: string): Promise<MarkResult> {
  const today = lisbonToday();
  const { data, error } = await supabase
    .from("discount_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null)
    .lte("valid_from", today)
    .gte("valid_to", today)
    .select("id");
  if (error) return "failed";
  return data.length > 0 ? "ok" : "not_valid";
}

// "Desfazer": "not_valid" = nothing changed (it wasn't marked as used, or was deleted).
export async function undoValeUsed(supabase: SupabaseClient, id: string): Promise<MarkResult> {
  const { data, error } = await supabase
    .from("discount_codes")
    .update({ used_at: null })
    .eq("id", id)
    .not("used_at", "is", null)
    .select("id");
  if (error) return "failed";
  return data.length > 0 ? "ok" : "not_valid";
}
