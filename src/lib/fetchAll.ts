import type { PostgrestError } from "@supabase/supabase-js";

// Supabase returns at most 1,000 rows per request. This asks for one page of 1,000
// at a time until a page comes back empty. `page` must build a fresh query each time,
// ordered by a unique column (e.g. id) so no row is skipped or read twice.
const PAGE = 1000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return all;
    all.push(...data);
  }
}
