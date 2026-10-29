import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only. Uses the service role key, which bypasses row level security.
// Never import this file from a "use client" component or send this key to the browser.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
