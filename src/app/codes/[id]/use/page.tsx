import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDiscount } from "@/lib/discount";
import SubmitButton from "@/app/_components/SubmitButton";
import { markCodeUsed } from "../../actions";
import { safeBack } from "../../status";

export default async function UseCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const back = safeBack((await searchParams).back);
  const supabase = await createClient();

  const { data: code } = await supabase
    .from("discount_codes")
    .select("id, code, percent, amount_eur, used_at, clients(name)")
    .eq("id", id)
    .maybeSingle();

  if (!code) notFound();
  const clientName = (code.clients as unknown as { name: string } | null)?.name;

  return (
    <main className="page-narrow">
      <header className="top">
        <h1>Marcar como usado</h1>
      </header>

      <div className="card">
        {code.used_at ? (
          <>
            <h2>Este vale já foi usado</h2>
            <p>O vale <strong>{code.code}</strong> já está marcado como usado.</p>
            <div className="confirm-actions">
              <Link href={back} className="btn primary">Voltar</Link>
            </div>
          </>
        ) : (
          <>
            <h2>Tem a certeza?</h2>
            <p>
              Marcar o vale <strong>{code.code}</strong> ({formatDiscount(code)}
              {clientName ? `, ${clientName}` : ""}) como usado? Depois deixa de poder ser usado.
            </p>
            <div className="confirm-actions">
              <Link href={back} className="btn">Não, voltar</Link>
              <form action={markCodeUsed}>
                <input type="hidden" name="id" value={code.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton pendingText="A marcar…">Sim, marcar como usado</SubmitButton>
              </form>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
