import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/date";
import { formatPhone } from "@/lib/phone";
import { sourceLabel, STATUS_LABEL, statusTagClass } from "./labels";
import { SMS_LOG_KEEP_MONTHS } from "@/lib/messaging/retention";

type LogRow = {
  id: string;
  to_phone: string;
  body: string;
  status: string;
  error: string | null;
  is_test: boolean;
  // "welcome" for the welcome SMS, null for everything else.
  kind: string | null;
  created_at: string;
  // Null when the SMS was a test or the client has since been deleted.
  clients: { name: string } | null;
  campaigns: { name: string } | null;
};

const LIMIT = 100;

export default async function SendHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; status?: string; client?: string }>;
}) {
  const params = await searchParams;
  // "" = all, "test" = only test SMS, "welcome" = welcome SMS, "other" = vale and birthday SMS, or a campaign id.
  const campaign =
    ["test", "welcome", "other"].includes(params.campaign ?? "") || /^[0-9a-f-]{36}$/i.test(params.campaign ?? "")
      ? params.campaign!
      : "";
  const status = params.status && STATUS_LABEL[params.status] ? params.status : "";
  // One client's messages ("Ver todas as mensagens" on their page).
  const clientId = /^[0-9a-f-]{36}$/i.test(params.client ?? "") ? params.client! : "";

  const supabase = await createClient();
  let query = supabase
    .from("sms_log")
    .select("id, to_phone, body, status, error, is_test, kind, created_at, clients(name), campaigns(name)")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (campaign === "test") query = query.eq("is_test", true);
  else if (campaign === "welcome") query = query.eq("kind", "welcome");
  else if (campaign === "other") query = query.is("campaign_id", null).eq("is_test", false).is("kind", null);
  else if (campaign) query = query.eq("campaign_id", campaign).eq("is_test", false);
  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  const [{ data }, { data: campaigns }, { data: client }] = await Promise.all([
    query,
    supabase.from("campaigns").select("id, name").eq("status", "sent").order("sent_at", { ascending: false }),
    clientId
      ? supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle<{ id: string; name: string }>()
      : Promise.resolve({ data: null }),
  ]);
  const rows = (data ?? []) as unknown as LogRow[];
  const filtered = campaign !== "" || status !== "" || clientId !== "";

  return (
    <main className="page-wide">
      <header className="top">
        <div>
          {client ? (
            <Link className="navlink" href={`/clients/${client.id}`}>Voltar a {client.name}</Link>
          ) : (
            <Link className="navlink" href="/campaigns">Voltar às campanhas</Link>
          )}
          <h1>Histórico de envios</h1>
          {client ? <span className="count">Só as mensagens de {client.name}</span> : null}
        </div>
      </header>

      <form method="get" className="card filters">
        {/* Filtering by campaign or status keeps the client filter. */}
        {clientId ? <input type="hidden" name="client" value={clientId} /> : null}
        <label htmlFor="filter-campaign">
          Campanha
          <select id="filter-campaign" name="campaign" defaultValue={campaign} aria-describedby="filter-campaign-hint">
            <option value="">Todas</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="welcome">Boas-vindas</option>
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
                    {formatDateTime(r.created_at)} · {sourceLabel(r)}
                  </div>
                  <div className="meta">{r.body}</div>
                  {r.error ? <div className="meta err-text">Motivo: {r.error}</div> : null}
                </div>
                <span className={statusTagClass(r.status)}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
          {rows.length === LIMIT ? <p className="meta">Só aparecem os {LIMIT} envios mais recentes.</p> : null}
        </>
      )}

      <p className="meta">
        As mensagens ficam aqui {SMS_LOG_KEEP_MONTHS} meses e depois são apagadas automaticamente. Cada campanha
        guarda os totais (enviados, falharam, ignorados).
      </p>
    </main>
  );
}
