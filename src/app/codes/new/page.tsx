import { createClient } from "@/lib/supabase/server";
import { addDays, lisbonToday } from "@/lib/date";
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

  const { data } = await supabase.from("clients").select("id, name, phone, consent").order("name");

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Criar vales</h1>
      </header>

      <NewValesForm
        clients={data ?? []}
        preselectedId={client}
        today={today}
        defaultValidTo={addDays(today, 30)}
      />
    </main>
  );
}
