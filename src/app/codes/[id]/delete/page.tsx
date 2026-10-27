import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/app/_components/TopNav";
import { deleteCode } from "../../actions";

export default async function DeleteCodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: code } = await supabase
    .from("discount_codes")
    .select("id, code")
    .eq("id", id)
    .maybeSingle();

  if (!code) notFound();

  return (
    <main className="narrow">
      <header className="top">
        <h1>Eliminar vale</h1>
      </header>

      <TopNav current="codes" />

      <div className="card">
        <h2>Tem a certeza?</h2>
        <p>
          Tem a certeza que quer eliminar o vale <strong>{code.code}</strong>? Não é possível desfazer.
        </p>
        <div className="confirm-actions">
          <Link href="/codes" className="btn primary">Não, voltar</Link>
          <form action={deleteCode}>
            <input type="hidden" name="id" value={code.id} />
            <input type="hidden" name="code" value={code.code} />
            <button type="submit" className="btn danger">Sim, eliminar</button>
          </form>
        </div>
      </div>
    </main>
  );
}
