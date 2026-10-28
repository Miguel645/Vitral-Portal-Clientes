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

// Many codes at once with a few lookups per round, instead of one query per code.
export async function generateUniqueCodes(supabase: SupabaseClient, count: number): Promise<string[]> {
  const result = new Set<string>();
  for (let round = 0; round < 5 && result.size < count; round++) {
    const candidates = new Set<string>();
    while (candidates.size < count - result.size) {
      const c = randomCode();
      if (!result.has(c)) candidates.add(c);
    }
    // Checked 200 at a time, so the request never gets too long.
    const list = [...candidates];
    const taken = new Set<string>();
    for (let i = 0; i < list.length; i += 200) {
      const { data, error } = await supabase.from("discount_codes").select("code").in("code", list.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const r of data ?? []) taken.add(r.code);
    }
    for (const c of candidates) if (!taken.has(c)) result.add(c);
  }
  if (result.size < count) throw new Error("Could not generate enough unique discount codes.");
  return [...result];
}
