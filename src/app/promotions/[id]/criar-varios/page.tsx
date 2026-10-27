import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/app/_components/TopNav";
import { formatDate } from "@/lib/date";
import { criarVariosVales } from "../../valeActions";

export default async function CriarVariosValesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ since?: string; count?: string; error?: string }>;
}) {
  const { id } = await params;
  const { since, count, error } = await searchParams;
  const supabase = await createClient();

  const { data: promotion } = await supabase
    .from("promotions")
    .select("id, name, discount_percent, reward_valid_from, reward_valid_to")
    .eq("id", id)
    .maybeSingle();

  if (!promotion) notFound();

  let createdCodes: { code: string }[] = [];
  if (since) {
    const { data } = await supabase
      .from("discount_codes")
      .select("code")
      .eq("promotion_id", id)
      .eq("kind", "promotion")
      .gte("created_at", since)
      .order("created_at");
    createdCodes = data ?? [];
  }

  return (
    <main className="narrow">
      <header className="top">
        <h1>Criar vários vales</h1>
      </header>

      <TopNav current="promotions" />

      <p className="meta" style={{ marginBottom: 16 }}>
        Promoção: <strong>{promotion.name}</strong> — {promotion.discount_percent}% de desconto, válido de{" "}
        {formatDate(promotion.reward_valid_from)} a {formatDate(promotion.reward_valid_to)}.
      </p>

      {since && createdCodes.length > 0 ? (
        <div className="card">
          <h2>{createdCodes.length} vales criados</h2>
          <p className="meta" style={{ marginBottom: 12 }}>
            Nenhum destes vales tem cliente associado. Pode descarregar a lista ou imprimir esta página.
          </p>
          <ul className="list" style={{ marginBottom: 16 }}>
            {createdCodes.map((c) => (
              <li key={c.code} className="list-row">
                <div className="name">{c.code}</div>
                <div className="meta">
                  {promotion.discount_percent}% · {formatDate(promotion.reward_valid_from)} a{" "}
                  {formatDate(promotion.reward_valid_to)}
                </div>
              </li>
            ))}
          </ul>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <a className="btn" href={`/api/vales/csv?promotion_id=${id}&since=${encodeURIComponent(since)}`}>
              Descarregar CSV
            </a>
            <Link href={`/promotions/${id}/criar-varios`} className="btn primary">Criar outros vales</Link>
          </div>
        </div>
      ) : (
        <form action={criarVariosVales} className="card">
          <input type="hidden" name="promotion_id" value={id} />
          <label>
            Quantos vales quer criar?
            <input type="number" name="count" min="1" max="500" inputMode="numeric" placeholder="Ex.: 50" required />
            <span className="hint">Um número entre 1 e 500. Todos ficam sem cliente associado.</span>
          </label>
          {error ? <p className="err" role="alert">{error}</p> : null}
          <div className="actions">
            <button type="submit" className="btn primary">Criar vales</button>
          </div>
        </form>
      )}

      <p className="meta" style={{ textAlign: "center", marginTop: 16 }}>
        <Link className="navlink" href={`/promotions/${id}/criar-vale`}>Criar só um vale, com cliente</Link>
      </p>
    </main>
  );
}
