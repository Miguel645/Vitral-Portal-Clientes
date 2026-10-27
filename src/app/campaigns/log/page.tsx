import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/app/_components/TopNav";
import { formatDateTime } from "@/lib/date";

type LogRow = {
  id: string;
  to_phone: string;
  body: string;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  simulated: "Simulado",
  sent: "Enviado",
  failed: "Falhou",
};

export default async function CampaignsLogPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sms_log")
    .select("id, to_phone, body, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as LogRow[];

  return (
    <main>
      <header className="top">
        <h1>Registo de SMS</h1>
      </header>

      <TopNav current="campaigns" />

      <p className="meta" style={{ marginBottom: 14 }}>
        <Link className="navlink" href="/campaigns/new">Nova campanha</Link>
      </p>

      {rows.length === 0 ? (
        <div className="empty">Ainda não foi enviada nenhuma mensagem.</div>
      ) : (
        <ul className="list">
          {rows.map((r) => (
            <li key={r.id} className="list-row">
              <div>
                <div className="name">{r.to_phone}</div>
                <div className="meta">
                  {formatDateTime(r.created_at)} · {r.body}
                </div>
              </div>
              <span className={`tag${r.status === "sent" ? " on" : r.status === "failed" ? " warn" : ""}`}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
