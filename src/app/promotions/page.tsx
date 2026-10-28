import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date";
import { promotionStatus } from "./status";

type Promotion = {
  id: string;
  name: string;
  condition: string | null;
  discount_percent: number;
  reward_valid_from: string;
  reward_valid_to: string;
  active: boolean;
};

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();

  const [{ data: promotions }, { data: codeRows }] = await Promise.all([
    supabase
      .from("promotions")
      .select("id, name, condition, discount_percent, reward_valid_from, reward_valid_to, active")
      .order("reward_valid_from", { ascending: false }),
    supabase.from("discount_codes").select("promotion_id").not("promotion_id", "is", null),
  ]);

  const rows = (promotions ?? []) as Promotion[];
  const counts = new Map<string, number>();
  for (const r of codeRows ?? []) {
    if (r.promotion_id) counts.set(r.promotion_id, (counts.get(r.promotion_id) ?? 0) + 1);
  }

  return (
    <main className="page-wide">
      <header className="top">
        <h1>Promoções de vales</h1>
        <Link className="btn primary" href="/promotions/new">Adicionar promoção</Link>
      </header>

      {message ? <p className="notice">{message}</p> : null}

      {rows.length === 0 ? (
        <div className="empty">Ainda não há promoções. Selecione “Adicionar promoção” para criar a primeira.</div>
      ) : (
        <ul className="list">
          {rows.map((p) => {
            const status = promotionStatus(p);
            const count = counts.get(p.id) ?? 0;
            return (
              <li key={p.id} style={{ padding: "var(--sp-16)" }}>
                <p style={{ margin: "0 0 var(--sp-8)", fontWeight: 600 }}>{p.name}</p>
                <p className="meta" style={{ margin: "0 0 var(--sp-12)" }}>
                  Vale de {p.discount_percent}% de desconto, válido de {formatDate(p.reward_valid_from)} a{" "}
                  {formatDate(p.reward_valid_to)}.{p.condition ? ` Condição: ${p.condition}.` : ""}
                </p>
                <div className="row-end" style={{ justifyContent: "space-between", padding: 0 }}>
                  <span>
                    <span className={`tag${status.key === "running" ? " on" : status.key === "ended" || status.key === "paused" ? " warn" : ""}`}>
                      {status.label}
                    </span>{" "}
                    <span className="meta">{count} {count === 1 ? "vale criado" : "vales criados"}</span>
                  </span>
                  <span className="row-end" style={{ padding: 0 }}>
                    <Link href={`/promotions/${p.id}`} className="btn">Editar</Link>
                    <Link href={`/promotions/${p.id}/delete`} className="btn danger">Eliminar promoção</Link>
                    <Link href={`/promotions/${p.id}/criar-vale`} className="btn primary">Criar vale</Link>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
