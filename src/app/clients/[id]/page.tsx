import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../ClientForm";
import CopyButton from "@/app/_components/CopyButton";
import Notice from "@/app/_components/Notice";
import DeleteMenu from "@/app/_components/DeleteMenu";
import { deleteClient } from "../../actions";
import { formatDate } from "@/lib/date";
import { formatDiscount, KIND_LABEL } from "@/lib/discount";
import { codeStatus, tagClass } from "../../codes/status";

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
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { message } = await searchParams;
  const supabase = await createClient();

  const [{ data: client }, { data: codes }, { data: welcomeLog }] = await Promise.all([
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
  ]);

  if (!client) notFound();
  const vales = (codes ?? []) as Vale[];

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

      <div className="client-layout">
        <ClientForm client={{ ...client, welcome_at: welcomeLog?.[0]?.created_at ?? null }} />

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
                      {!v.used_at ? (
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
      </div>
    </main>
  );
}
