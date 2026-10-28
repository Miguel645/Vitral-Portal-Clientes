import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Notice from "@/app/_components/Notice";
import { formatDate, formatDateTime } from "@/lib/date";
import { formatDiscount } from "@/lib/discount";
import { isSimulation } from "@/lib/messaging/mode";
import CampaignEditor from "../CampaignEditor";
import { loadEditorData } from "../editorData";

// "Enviar campanha" sends one SMS per client in small groups, which can take a while.
export const maxDuration = 60;

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { message } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, sms_text, status, vale_percent, vale_amount_eur, vale_valid_from, vale_valid_to, sent_at")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const header = (
    <header className="top">
      <div>
        <Link className="navlink" href="/campaigns">Voltar às campanhas</Link>
        <h1>{campaign.name}</h1>
      </div>
    </header>
  );

  if (campaign.status === "draft") {
    const editor = await loadEditorData();
    return (
      <main className="page-medium">
        {header}
        <Notice message={message} />
        <CampaignEditor {...editor} campaign={campaign} />
      </main>
    );
  }

  // Sent: a summary of what happened, from the log (tests not counted).
  // Counted in the database: a big campaign has more log rows than one request returns.
  const logCount = (status: string) =>
    supabase
      .from("sms_log")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("is_test", false)
      .eq("status", status)
      .then((r) => r.count ?? 0);
  const [sent, simulated, failed, skipped, { count: valeCount }] = await Promise.all([
    logCount("sent"),
    logCount("simulated"),
    logCount("failed"),
    logCount("skipped"),
    supabase.from("discount_codes").select("id", { count: "exact", head: true }).eq("campaign_id", id),
  ]);
  const counts = { ok: sent + simulated, failed, skipped };
  const simulatedOnly = simulated > 0 && sent === 0;
  const hasVale = campaign.vale_valid_from && campaign.vale_valid_to;

  return (
    <main className="page-medium">
      {header}
      <Notice message={message} />

      <div className="card">
        <h2>Resumo</h2>
        <p className="meta" style={{ marginBottom: "var(--sp-16)" }}>
          {campaign.sent_at ? `Enviada em ${formatDateTime(campaign.sent_at)}.` : "Enviada."}
          {simulatedOnly && isSimulation() ? " Em modo simulação: nada foi enviado de verdade." : ""}
        </p>
        <ul className="summary">
          <li>{counts.ok} {simulatedOnly ? (counts.ok === 1 ? "simulado" : "simulados") : counts.ok === 1 ? "enviado" : "enviados"}</li>
          <li>{counts.failed} {counts.failed === 1 ? "falhou" : "falharam"}</li>
          <li>{counts.skipped} {counts.skipped === 1 ? "ignorado" : "ignorados"} (número inválido)</li>
          {hasVale ? (
            <li>
              {valeCount ?? 0} {valeCount === 1 ? "vale criado" : "vales criados"} de{" "}
              {formatDiscount({ percent: campaign.vale_percent, amount_eur: campaign.vale_amount_eur })}, válidos de{" "}
              {formatDate(campaign.vale_valid_from!)} a {formatDate(campaign.vale_valid_to!)}
            </li>
          ) : null}
        </ul>
        <div className="preview">
          <p className="preview-title">Texto do SMS</p>
          <p className="meta" style={{ whiteSpace: "pre-wrap" }}>{campaign.sms_text}</p>
        </div>
        <div className="actions">
          <Link href={`/campaigns/log?campaign=${campaign.id}`} className="btn">Ver histórico de envios</Link>
        </div>
      </div>
    </main>
  );
}
