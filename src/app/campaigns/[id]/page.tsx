import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Notice from "@/app/_components/Notice";
import { formatDate, formatDateTime, lisbonToday } from "@/lib/date";
import { formatDiscount } from "@/lib/discount";
import { isSimulation } from "@/lib/messaging/mode";
import CampaignEditor from "../CampaignEditor";
import { loadEditorData } from "../editorData";
import { appUrlError } from "@/lib/optOut";
import { pendingRecipients, RESUME_AFTER_MS } from "../recipients";
import { deleteCampaign, resumeCampaign, stopCampaign } from "../actions";
import DeleteMenu from "@/app/_components/DeleteMenu";
import SubmitButton from "@/app/_components/SubmitButton";

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
    .select("id, name, sms_text, status, vale_percent, vale_amount_eur, vale_valid_from, vale_valid_to, sent_at, starts_on, live_until, stopped_at")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const header = (
    <header className="top">
      <div>
        <Link className="navlink" href="/campaigns">Voltar às campanhas</Link>
        <h1>{campaign.name}</h1>
      </div>
      <DeleteMenu
        menuLabel={`Mais ações para a campanha ${campaign.name}`}
        itemLabel="Eliminar campanha"
        title={`Eliminar a campanha ${campaign.name}?`}
        description={
          campaign.status === "draft"
            ? "Não é possível desfazer."
            : "Não é possível desfazer. Deixa de ser enviada; o histórico de envios e os vales já criados ficam, mas sem campanha."
        }
        action={deleteCampaign}
        fields={{ id: campaign.id, name: campaign.name }}
      />
    </header>
  );

  if (campaign.status === "draft" || campaign.status === "scheduled") {
    const editor = await loadEditorData();
    return (
      <main className="page-medium">
        {header}
        <Notice message={message} />
        {campaign.status === "scheduled" && campaign.live_until && campaign.live_until < lisbonToday() ? (
          <p className="err" role="alert">
            Esta campanha não foi enviada: o envio das 10h não aconteceu entre o início e o fim. Escolha novas datas e
            carregue em “Agendar campanha” ou “Enviar campanha”.
          </p>
        ) : campaign.status === "scheduled" && campaign.starts_on ? (
          <p className="notice" role="status">
            Agendada: vai ser enviada a {formatDate(campaign.starts_on)}, às 10h. “Guardar rascunho” cancela o agendamento.
          </p>
        ) : null}
        {appUrlError() ? <p className="err" role="alert">{appUrlError()}</p> : null}
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
  const [sent, simulated, failed, skipped, interrupted, { count: valeCount }, { data: firstLog }, pending] = await Promise.all([
    logCount("sent"),
    logCount("simulated"),
    logCount("failed"),
    logCount("skipped"),
    logCount("sending"),
    supabase.from("discount_codes").select("id", { count: "exact", head: true }).eq("campaign_id", id),
    // sent_at moves forward with each "Continuar envio"; the first SMS says when it really started.
    supabase.from("sms_log").select("created_at").eq("campaign_id", id).eq("is_test", false).order("created_at").limit(1),
    // Clients who receive messages and aren't in the log yet: the send stopped before them.
    pendingRecipients(supabase, id).then((r) => r.length),
  ]);
  const counts = { ok: sent + simulated, failed, skipped };
  const startedAt = firstLog?.[0]?.created_at ?? campaign.sent_at;
  // An earlier run may still be going for up to a minute; only offer to continue once it surely stopped.
  const canResume = pending > 0 && !!campaign.sent_at && Date.now() - new Date(campaign.sent_at).getTime() >= RESUME_AFTER_MS;
  const simulatedOnly = simulated > 0 && sent === 0;
  const hasVale = campaign.vale_valid_from && campaign.vale_valid_to;
  const isLive = !campaign.stopped_at && !!campaign.live_until && campaign.live_until >= lisbonToday();

  return (
    <main className="page-medium">
      {header}
      <Notice message={message} />

      <div className="card">
        <h2>Resumo</h2>
        <p className="meta" style={{ marginBottom: "var(--sp-16)" }}>
          {startedAt ? `Enviada em ${formatDateTime(startedAt)}.` : "Enviada."}
          {simulatedOnly && isSimulation() ? " Em modo simulação: nada foi enviado de verdade." : ""}
        </p>
        <ul className="summary">
          <li>{counts.ok} {simulatedOnly ? (counts.ok === 1 ? "simulado" : "simulados") : counts.ok === 1 ? "enviado" : "enviados"}</li>
          <li>{counts.failed} {counts.failed === 1 ? "falhou" : "falharam"}</li>
          <li>{counts.skipped} {counts.skipped === 1 ? "ignorado" : "ignorados"} (número inválido)</li>
          {interrupted > 0 ? (
            <li>
              {interrupted} {interrupted === 1 ? "interrompido" : "interrompidos"} (o envio parou a meio; veja no histórico)
            </li>
          ) : null}
          {pending > 0 ? (
            <li>
              {pending} {pending === 1 ? "cliente ainda não recebeu" : "clientes ainda não receberam"}
            </li>
          ) : null}
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
        {isLive ? (
          <p className="meta">
            Ativa até {formatDate(campaign.live_until!)}: se o envio parou a meio, os clientes que faltam recebem-na às
            10h. Clientes adicionados depois do envio não a recebem.
          </p>
        ) : campaign.stopped_at ? (
          <p className="meta">Parada em {formatDateTime(campaign.stopped_at)}: já não é enviada a mais ninguém.</p>
        ) : campaign.live_until ? (
          <p className="meta">Terminou a {formatDate(campaign.live_until)}.</p>
        ) : null}
        {pending > 0 && !canResume ? (
          <p className="meta">O envio pode ainda estar a decorrer. Atualize a página daqui a um minuto.</p>
        ) : null}
        <div className="actions">
          {canResume ? (
            <form action={resumeCampaign}>
              <input type="hidden" name="id" value={campaign.id} />
              <input type="hidden" name="sent_at" value={campaign.sent_at!} />
              <SubmitButton pendingText="A enviar…">Continuar envio</SubmitButton>
            </form>
          ) : null}
          <Link href={`/campaigns/log?campaign=${campaign.id}`} className="btn">Ver histórico de envios</Link>
          {isLive ? (
            <form action={stopCampaign}>
              <input type="hidden" name="id" value={campaign.id} />
              <SubmitButton className="btn" pendingText="A parar…">Parar campanha</SubmitButton>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
