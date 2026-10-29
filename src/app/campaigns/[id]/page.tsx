import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Notice from "@/app/_components/Notice";
import { formatDate, formatDateTime, lisbonToday } from "@/lib/date";
import { formatDiscount } from "@/lib/discount";
import { isSimulation } from "@/lib/messaging/mode";
import CampaignEditor from "../CampaignEditor";
import { loadEditorData } from "../editorData";
import { appUrlError } from "@/lib/optOut";
import { pendingRecipients } from "../recipients";
import { deleteCampaign, stopCampaign } from "../actions";
import { isSending, startJob } from "@/lib/jobs";
import AutoRefresh from "@/app/_components/AutoRefresh";
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
    .select("id, name, sms_text, status, vale_percent, vale_amount_eur, vale_valid_from, vale_valid_to, sent_at, starts_on, live_until, stopped_at, sending_until, send_error")
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
    // When the first SMS really went out.
    supabase.from("sms_log").select("created_at").eq("campaign_id", id).eq("is_test", false).order("created_at").limit(1),
    // Clients who still have to get it (sent in the background, see src/lib/jobs).
    pendingRecipients(supabase, id).then((r) => r.length),
  ]);
  const counts = { ok: sent + simulated, failed, skipped };
  const startedAt = firstLog?.[0]?.created_at ?? campaign.sent_at;
  const simulatedOnly = simulated > 0 && sent === 0;
  const hasVale = campaign.vale_valid_from && campaign.vale_valid_to;
  const isLive = !campaign.stopped_at && !!campaign.live_until && campaign.live_until >= lisbonToday();
  // Still going out in the background. If no step is sending right now (a hand-off was
  // lost), opening this page starts one again; nobody has to press anything.
  const sending = isLive && pending > 0;
  if (sending && !isSending(campaign.sending_until)) after(() => startJob({ kind: "campaign", id }));
  const attempted = counts.ok + counts.failed + counts.skipped + interrupted;

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
          {pending > 0 && !sending ? (
            <li>
              {pending} {pending === 1 ? "cliente não a recebeu" : "clientes não a receberam"}
              {campaign.stopped_at ? " (a campanha foi parada)" : " (a campanha terminou)"}
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
        {sending ? (
          <p className="notice" role="status">
            A enviar automaticamente: {attempted} de {attempted + pending} SMS. Pode fechar esta página.
            <AutoRefresh />
          </p>
        ) : null}
        {sending && campaign.send_error ? (
          <p className="err" role="alert">
            Último problema no envio: {campaign.send_error} Volta a tentar sozinha.
          </p>
        ) : null}
        <div className="preview">
          <p className="preview-title">Texto do SMS</p>
          <p className="meta" style={{ whiteSpace: "pre-wrap" }}>{campaign.sms_text}</p>
        </div>
        {isLive ? (
          <p className="meta">
            Ativa até {formatDate(campaign.live_until!)}. Clientes adicionados depois do envio não a recebem.
          </p>
        ) : campaign.stopped_at ? (
          <p className="meta">Parada em {formatDateTime(campaign.stopped_at)}: já não é enviada a mais ninguém.</p>
        ) : campaign.live_until ? (
          <p className="meta">Terminou a {formatDate(campaign.live_until)}.</p>
        ) : null}
        <div className="actions">
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
