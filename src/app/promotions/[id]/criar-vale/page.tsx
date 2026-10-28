import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CopyButton from "@/app/_components/CopyButton";
import { formatDate } from "@/lib/date";
import { criarVale } from "../../valeActions";

export default async function CriarValePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; created?: string; error?: string }>;
}) {
  const { id } = await params;
  const { q = "", created, error } = await searchParams;
  const supabase = await createClient();

  const { data: promotion } = await supabase
    .from("promotions")
    .select("id, name, discount_percent, reward_valid_from, reward_valid_to")
    .eq("id", id)
    .maybeSingle();

  if (!promotion) notFound();

  let matches: { id: string; name: string; phone: string }[] = [];
  const term = q.trim();
  if (term) {
    const { data } = await supabase
      .from("clients")
      .select("id, name, phone")
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      .order("name")
      .limit(20);
    matches = data ?? [];
  }

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Criar vale</h1>
      </header>

      <p className="meta">
        Promoção: <strong>{promotion.name}</strong> — {promotion.discount_percent}% de desconto, válido de{" "}
        {formatDate(promotion.reward_valid_from)} a {formatDate(promotion.reward_valid_to)}.
      </p>

      {created ? (
        <div className="card">
          <h2>Vale criado</h2>
          <p style={{ fontSize: "1.3rem", fontWeight: 700 }}>
            Vale criado: {created}. {promotion.discount_percent}% de desconto, de {formatDate(promotion.reward_valid_from)}{" "}
            a {formatDate(promotion.reward_valid_to)}.
          </p>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <CopyButton text={created} />
            <Link href={`/promotions/${id}/criar-vale`} className="btn primary">Criar outro vale</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <h2>Cliente (opcional)</h2>
            <form method="get">
              <label>
                Procurar cliente
                <input type="text" name="q" defaultValue={q} placeholder="Ex.: Maria ou 912345678" autoComplete="off" />
                <span className="hint">Procure pelo nome ou pelo telemóvel. Pode deixar em branco e criar o vale sem cliente.</span>
              </label>
              <div className="actions">
                <button type="submit" className="btn">Procurar</button>
              </div>
            </form>
            {term && matches.length === 0 ? <p className="meta">Nenhum cliente encontrado para “{term}”.</p> : null}
          </div>

          <form action={criarVale} className="card">
            <input type="hidden" name="promotion_id" value={id} />
            <input type="hidden" name="q" value={q} />
            {term && matches.length > 0 ? (
              <>
                <h2>Escolha o cliente</h2>
                {matches.map((c) => (
                  <label key={c.id} className="check">
                    <input type="radio" name="client_id" value={c.id} />
                    <span>{c.name} — {c.phone}</span>
                  </label>
                ))}
                <label className="check">
                  <input type="radio" name="client_id" value="" defaultChecked />
                  <span>Sem cliente</span>
                </label>
              </>
            ) : null}
            {error ? <p className="err" role="alert">{error}</p> : null}
            <div className="actions">
              <button type="submit" className="btn primary">Criar vale</button>
            </div>
          </form>

          <p className="meta" style={{ textAlign: "center" }}>
            <Link className="navlink" href={`/promotions/${id}/criar-varios`}>Criar vários vales em vez de um</Link>
          </p>
        </>
      )}
    </main>
  );
}
