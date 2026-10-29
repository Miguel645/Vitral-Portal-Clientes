import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Notice from "@/app/_components/Notice";
import JustSavedLabel from "@/app/_components/JustSaved";
import { formatDate, formatDateTime, lisbonToday } from "@/lib/date";
import { formatDiscount } from "@/lib/discount";

type Row = {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sent";
  vale_percent: number | null;
  vale_amount_eur: number | null;
  created_at: string;
  sent_at: string | null;
  first_sent_at: string | null;
  starts_on: string | null;
  live_until: string | null;
  stopped_at: string | null;
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; saved?: string; error?: string }>;
}) {
  // `saved`: the campaign just saved, shown first and highlighted.
  const { message, saved, error: errorMessage } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, status, vale_percent, vale_amount_eur, created_at, sent_at, first_sent_at, starts_on, live_until, stopped_at")
    .order("created_at", { ascending: false });
  const all = (data ?? []) as Row[];
  const rows = [...all.filter((c) => c.id === saved), ...all.filter((c) => c.id !== saved)];
  // Sent, and the daily job can still finish its send.
  const today = lisbonToday();
  const isLive = (c: Row) => c.status === "sent" && !c.stopped_at && !!c.live_until && c.live_until >= today;

  return (
    <main className="page-wide">
      <header className="top">
        <h1>Campanhas</h1>
        <Link href="/campaigns/new" className="btn primary">Nova campanha</Link>
      </header>

      <Notice message={message} clear={["saved"]} autoHide />

      <Notice message={errorMessage} param="error" error />

      {rows.length === 0 ? (
        <div className="empty">Ainda não há campanhas. Carregue em “Nova campanha” para começar.</div>
      ) : (
        <ul className="list">
          {rows.map((c) => {
            const hasVale = c.vale_percent != null || c.vale_amount_eur != null;
            return (
              <li key={c.id} className={c.id === saved ? "just-saved" : undefined}>
                <Link href={`/campaigns/${c.id}`} className="list-link">
                  <div>
                    <div className="name">{c.name}</div>
                    <div className="meta">
                      {c.id === saved ? <JustSavedLabel text="Acabada de guardar" /> : null}
                      {c.status === "sent" && (c.first_sent_at ?? c.sent_at)
                        ? `Enviada em ${formatDateTime((c.first_sent_at ?? c.sent_at)!)}`
                        : c.status === "scheduled" && c.starts_on
                          ? `Agendada para ${formatDate(c.starts_on)}, às 10h`
                          : `Criada em ${formatDateTime(c.created_at)}`}
                      {isLive(c) ? ` · Até ${formatDate(c.live_until!)}` : ""}
                      {hasVale ? ` · Com vale de ${formatDiscount({ percent: c.vale_percent, amount_eur: c.vale_amount_eur })}` : ""}
                    </div>
                  </div>
                  {/* "Não enviada" needs the owner to pick new dates, so it's red. */}
                  <span
                    className={
                      c.status === "sent"
                        ? "tag on"
                        : c.status === "scheduled" && c.live_until && c.live_until < today
                          ? "tag warn"
                          : "tag"
                    }
                  >
                    {isLive(c)
                      ? "Ativa"
                      : c.status === "sent"
                        ? "Enviada"
                        : c.status === "scheduled"
                          ? c.live_until && c.live_until < today
                            ? "Não enviada"
                            : "Agendada"
                          : "Rascunho"}
                  </span>
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
