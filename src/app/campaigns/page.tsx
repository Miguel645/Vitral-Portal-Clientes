import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Notice from "@/app/_components/Notice";
import { formatDateTime } from "@/lib/date";
import { formatDiscount } from "@/lib/discount";

type Row = {
  id: string;
  name: string;
  status: "draft" | "sent";
  vale_percent: number | null;
  vale_amount_eur: number | null;
  created_at: string;
  sent_at: string | null;
};

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, status, vale_percent, vale_amount_eur, created_at, sent_at")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  return (
    <main className="page-wide">
      <header className="top">
        <h1>Campanhas</h1>
        <Link href="/campaigns/new" className="btn primary">Nova campanha</Link>
      </header>

      <Notice message={message} />

      {rows.length === 0 ? (
        <div className="empty">Ainda não há campanhas. Carregue em “Nova campanha” para começar.</div>
      ) : (
        <ul className="list">
          {rows.map((c) => {
            const hasVale = c.vale_percent != null || c.vale_amount_eur != null;
            return (
              <li key={c.id}>
                <Link href={`/campaigns/${c.id}`} className="list-link">
                  <div>
                    <div className="name">{c.name}</div>
                    <div className="meta">
                      {c.status === "sent" && c.sent_at
                        ? `Enviada em ${formatDateTime(c.sent_at)}`
                        : `Criada em ${formatDateTime(c.created_at)}`}
                      {hasVale ? ` · Com vale de ${formatDiscount({ percent: c.vale_percent, amount_eur: c.vale_amount_eur })}` : ""}
                    </div>
                  </div>
                  <span className={c.status === "sent" ? "tag on" : "tag"}>{c.status === "sent" ? "Enviada" : "Rascunho"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <Link href="/campaigns/log" className="btn">Histórico de envios</Link>
      </div>
    </main>
  );
}
