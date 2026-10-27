import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/app/_components/TopNav";
import { formatDate } from "@/lib/date";

type Promotion = {
  id: string;
  name: string;
  earn_from: string;
  earn_to: string;
  min_spend: number;
  discount_percent: number;
  reward_valid_from: string;
  reward_valid_to: string;
  active: boolean;
};

export default async function PromotionsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promotions")
    .select("id, name, earn_from, earn_to, min_spend, discount_percent, reward_valid_from, reward_valid_to, active")
    .order("earn_from", { ascending: false });

  const rows = (data ?? []) as Promotion[];

  return (
    <main>
      <header className="top">
        <h1>Promoções</h1>
      </header>

      <TopNav current="promotions" />

      <div className="bar">
        <Link className="btn primary" href="/promotions/new">Adicionar promoção</Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty">Ainda não há promoções. Selecione “Adicionar promoção” para criar a primeira.</div>
      ) : (
        <ul className="list">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/promotions/${p.id}`}>
                <div>
                  <div className="name">{p.name}</div>
                  <div className="meta">
                    Compras de {formatDate(p.earn_from)} a {formatDate(p.earn_to)} · mínimo {p.min_spend.toFixed(2)} € ·{" "}
                    {p.discount_percent}% · prémio válido de {formatDate(p.reward_valid_from)} a {formatDate(p.reward_valid_to)}
                  </div>
                </div>
                <span className={`tag${p.active ? " on" : ""}`}>{p.active ? "Ativa" : "Inativa"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
