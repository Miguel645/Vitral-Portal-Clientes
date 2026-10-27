import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/app/_components/TopNav";
import { formatDate } from "@/lib/date";
import { promotionStatus } from "@/app/promotions/status";

type Promotion = {
  id: string;
  name: string;
  discount_percent: number;
  reward_valid_from: string;
  reward_valid_to: string;
  active: boolean;
};

export default async function BalcaoCriarValePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("promotions")
    .select("id, name, discount_percent, reward_valid_from, reward_valid_to, active")
    .order("reward_valid_from", { ascending: false });

  const running = ((data ?? []) as Promotion[]).filter((p) => promotionStatus(p).key === "running");

  return (
    <main className="narrow">
      <header className="top">
        <h1>Criar vale</h1>
      </header>

      <TopNav current="balcao" />

      <p className="meta" style={{ marginBottom: 16 }}>Escolha a promoção do vale que quer criar.</p>

      {running.length === 0 ? (
        <div className="empty">
          Não há promoções a decorrer neste momento. <Link className="navlink" href="/promotions">Ver promoções</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {running.map((p) => (
            <Link key={p.id} href={`/promotions/${p.id}/criar-vale`} className="btn primary balcao-btn">
              {p.name} — {p.discount_percent}% até {formatDate(p.reward_valid_to)}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
