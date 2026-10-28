import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/app/_components/SubmitButton";
import { deleteClient } from "../../../actions";

export default async function DeleteClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("id, name").eq("id", id).maybeSingle();
  if (!client) notFound();

  return (
    <main className="page-narrow">
      <header className="top">
        <h1>Eliminar cliente</h1>
      </header>

      <div className="card">
        <h2>Tem a certeza?</h2>
        <p>
          Tem a certeza que quer eliminar o cliente <strong>{client.name}</strong>? Não é possível desfazer. Os vales
          deste cliente continuam na lista de vales, mas sem cliente.
        </p>
        <div className="confirm-actions">
          <Link href={`/clients/${client.id}`} className="btn primary">Não, voltar</Link>
          <form action={deleteClient}>
            <input type="hidden" name="id" value={client.id} />
            <input type="hidden" name="name" value={client.name} />
            <SubmitButton className="btn danger" pendingText="A eliminar…">Sim, eliminar</SubmitButton>
          </form>
        </div>
      </div>
    </main>
  );
}
