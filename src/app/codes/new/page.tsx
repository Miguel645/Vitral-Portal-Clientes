import { createClient } from "@/lib/supabase/server";
import { addDays, lisbonToday } from "@/lib/date";
import { appUrlError, previewBaseUrl } from "@/lib/optOut";
import NewValesForm from "../NewValesForm";

// Creating vales for every client and sending one SMS each can take a while.
export const maxDuration = 60;

export default async function NewValesPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const supabase = await createClient();
  const today = lisbonToday();

  // Only counts here; the client search box asks the database as you type.
  const [{ count: total }, { count: consenting }, { data: first }, { data: preselected }] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("consent", true),
    supabase.from("clients").select("name").order("name").limit(1),
    client && /^[0-9a-f-]{36}$/i.test(client)
      ? supabase.from("clients").select("id, name, phone, consent").eq("id", client).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Criar vales</h1>
      </header>

      {appUrlError() ? <p className="err" role="alert">{appUrlError()}</p> : null}

      <NewValesForm
        totalClients={total ?? 0}
        consentingClients={consenting ?? 0}
        firstClientName={first?.[0]?.name ?? null}
        preselected={preselected ?? undefined}
        today={today}
        defaultValidTo={addDays(today, 30)}
        appUrl={previewBaseUrl()}
      />
    </main>
  );
}
