import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/date";
import { formatPhone } from "@/lib/phone";

type LogRow = {
  id: string;
  to_phone: string;
  body: string;
  status: string;
  error: string | null;
  is_test: boolean;
  created_at: string;
  // Null when the SMS was a test or the client has since been deleted.
  clients: { name: string } | null;
  campaigns: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  simulated: "Simulado",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
};

const LIMIT = 100;

export default async function SendHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; status?: string }>;
}) {
  const params = await searchParams;
  // "" = all, "test" = only test SMS, "other" = vale and birthday SMS, or a campaign id.
  const campaign =
    params.campaign === "test" || params.campaign === "other" || /^[0-9a-f-]{36}$/i.test(params.campaign ?? "")
      ? params.campaign!
      : "";
  const status = params.status && STATUS_LABEL[params.status] ? params.status : "";

  const supabase = await createClient();
  let query = supabase
    .from("sms_log")
    .select("id, to_phone, body, status, error, is_test, created_at, clients(name), campaigns(name)")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (campaign === "test") query = query.eq("is_test", true);
  else if (campaign === "other") query = query.is("campaign_id", null).eq("is_test", false);
  else if (campaign) query = query.eq("campaign_id", campaign).eq("is_test", false);
  if (status) query = query.eq("status", status);

  const [{ data }, { data: campaigns }] = await Promise.all([
    query,
    supabase.from("campaigns").select("id, name").eq("status", "sent").order("sent_at", { ascending: false }),
  ]);
  const rows = (data ?? []) as unknown as LogRow[];
  const filtered = campaign !== "" || status !== "";

  return (
    <main className="page-wide">
      <header className="top">
        <div>
          <Link className="navlink" href="/campaigns">Voltar às campanhas</Link>
          <h1>Histórico de envios</h1>
        </div>
      </header>

      <form method="get" className="card filters">
        <label htmlFor="filter-campaign">
          Campanha
          <select id="filter-campaign" name="campaign" defaultValue={campaign} aria-describedby="filter-campaign-hint">
            <option value="">Todas</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="other">Vales e aniversários</option>
            <option value="test">SMS de teste</option>
          </select>
          <span className="hint" id="filter-campaign-hint">De onde veio o SMS.</span>
        </label>
        <label htmlFor="filter-status">
          Estado
          <select id="filter-status" name="status" defaultValue={status} aria-describedby="filter-status-hint">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span className="hint" id="filter-status-hint">O que aconteceu ao SMS.</span>
        </label>
        <div className="actions">
          {filtered ? <Link href="/campaigns/log" className="btn">Limpar filtros</Link> : null}
          <button type="submit" className="btn">Filtrar</button>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="empty">{filtered ? "Nenhum envio com estes filtros." : "Ainda não foi enviada nenhuma mensagem."}</div>
      ) : (
        <>
          <ul className="list">
            {rows.map((r) => (
              <li key={r.id} className="list-row">
                <div>
                  <div className="name">
                    {r.clients?.name ? `${r.clients.name} · ${formatPhone(r.to_phone)}` : formatPhone(r.to_phone)}
                  </div>
                  <div className="meta">
                    {formatDateTime(r.created_at)} · {r.is_test ? "Teste" : r.campaigns?.name ?? "Vale"}
                  </div>
                  <div className="meta">{r.body}</div>
                  {r.error ? <div className="meta err-text">Motivo: {r.error}</div> : null}
                </div>
                <span className={`tag${r.status === "sent" ? " on" : r.status === "failed" || r.status === "skipped" ? " warn" : ""}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
          {rows.length === LIMIT ? <p className="meta">Só aparecem os {LIMIT} envios mais recentes.</p> : null}
        </>
      )}
    </main>
  );
}
