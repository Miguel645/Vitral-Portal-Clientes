import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../ClientForm";
import CopyButton from "@/app/_components/CopyButton";
import Notice from "@/app/_components/Notice";
import DeleteMenu from "@/app/_components/DeleteMenu";
import { deleteClient } from "../../actions";
import { formatDate, formatDateTime } from "@/lib/date";
import { formatDiscount, KIND_LABEL } from "@/lib/discount";
import { codeStatus, tagClass } from "../../codes/status";
import { sourceLabel, STATUS_LABEL, statusTagClass } from "@/app/campaigns/log/labels";

// How many of the client's latest SMS show on their page; the rest are in the history.
const MESSAGES_SHOWN = 5;

type Message = {
  id: string;
  body: string;
  status: string;
  error: string | null;
  is_test: boolean;
  kind: string | null;
  created_at: string;
  campaigns: { name: string } | null;
};

type Vale = {
  id: string;
  code: string;
  kind: "birthday" | "manual";
  percent: number | null;
  amount_eur: number | null;
  note: string | null;
  valid_from: string;
  valid_to: string;
  used_at: string | null;
};

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { id } = await params;
  const { message, error: errorMessage } = await searchParams;
  const supabase = await createClient();

  const [{ data: client }, { data: codes }, { data: welcomeLog }, { data: messageRows }] = await Promise.all([
    supabase.from("clients").select("id, name, phone, email, birth_date, consent, consent_at").eq("id", id).maybeSingle(),
    supabase
      .from("discount_codes")
      .select("id, code, kind, percent, amount_eur, note, valid_from, valid_to, used_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    // The welcome SMS that went out (clients who existed before it was added have none).
    supabase
      .from("sms_log")
      .select("created_at")
      .eq("client_id", id)
      .eq("kind", "welcome")
      .in("status", ["sent", "simulated"])
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("sms_log")
      .select("id, body, status, error, is_test, kind, created_at, campaigns(name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_SHOWN),
  ]);

  if (!client) notFound();
  const vales = (codes ?? []) as Vale[];
  const messages = (messageRows ?? []) as unknown as Message[];

  return (
    <main className="page-wide">
      <header className="top">
        <div>
          <Link className="navlink" href="/">Voltar aos clientes</Link>
          <h1>{client.name}</h1>
        </div>
        <DeleteMenu
          menuLabel={`Mais ações para o cliente ${client.name}`}
          itemLabel="Eliminar cliente"
          title={`Eliminar o cliente ${client.name}?`}
          description="Não é possível desfazer. Os vales deste cliente continuam na lista de vales, mas sem cliente."
          action={deleteClient}
          fields={{ id: client.id, name: client.name }}
        />
      </header>

      <Notice message={message} />

      <Notice message={errorMessage} param="error" error />

      <div className="client-layout">
        <ClientForm client={{ ...client, welcome_at: welcomeLog?.[0]?.created_at ?? null }} />

        {/* Right column: the vales, then the latest SMS. */}
        <div className="form-stack">
          <div className="card">
            <h2>Vales deste cliente</h2>
            {vales.length === 0 ? (
              <p className="meta">Ainda não há vales para este cliente.</p>
            ) : (
              <ul className="list">
                {vales.map((v) => {
                  const status = codeStatus(v);
                  return (
                    <li key={v.id} className="list-row stack">
                      <div>
                        <div className="name">{v.code}</div>
                        <div className="meta">
                          {KIND_LABEL[v.kind] ?? v.kind}{v.note ? ` · ${v.note}` : ""} · {formatDiscount(v)} · {formatDate(v.valid_from)} a {formatDate(v.valid_to)}
                        </div>
                      </div>
                      <div className="row-end">
                        <span className={tagClass(status.key)}>{status.label}</span>
                        {status.key === "active" ? <CopyButton text={v.code} /> : null}
                        {status.key === "active" ? (
                          <Link href={`/codes/${v.id}/use?back=${encodeURIComponent(`/clients/${client.id}`)}`} className="btn">
                            Marcar como usado
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="actions" style={{ justifyContent: "flex-start" }}>
              <Link href={`/codes/new?client=${client.id}`} className="btn">Criar vale para este cliente</Link>
            </div>
          </div>

          <div className="card">
            <h2>Mensagens enviadas</h2>
            {messages.length === 0 ? (
              <p className="meta">Ainda não foi enviada nenhuma mensagem a este cliente.</p>
            ) : (
              <>
                <ul className="list">
                  {messages.map((m) => (
                    <li key={m.id} className="list-row stack">
                      <div>
                        <div className="name">{formatDateTime(m.created_at)} · {sourceLabel(m)}</div>
                        <div className="meta">{m.body}</div>
                        {m.error ? <div className="meta err-text">Motivo: {m.error}</div> : null}
                      </div>
                      <div className="row-end">
                        <span className={statusTagClass(m.status)}>{STATUS_LABEL[m.status] ?? m.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="actions" style={{ justifyContent: "flex-start" }}>
                  <Link href={`/campaigns/log?client=${client.id}`} className="btn">Ver todas as mensagens</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
