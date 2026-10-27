import type { SupabaseClient } from "@supabase/supabase-js";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length = 8) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return out;
}

export async function generateUniqueCode(supabase: SupabaseClient, attempts = 5): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const candidate = randomCode();
    const { data } = await supabase.from("discount_codes").select("id").eq("code", candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Could not generate a unique discount code after several attempts.");
}
