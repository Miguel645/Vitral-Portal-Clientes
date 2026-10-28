import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../ClientForm";
import { codeStatus } from "../../codes/status";
import { formatDate } from "@/lib/date";
import { formatDiscount, KIND_LABEL } from "@/lib/discount";


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
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: client }, { data: codes }] = await Promise.all([
    supabase.from("clients").select("id, name, phone, email, birth_date, consent").eq("id", id).maybeSingle(),
    supabase
      .from("discount_codes")
      .select("id, code, kind, percent, amount_eur, note, valid_from, valid_to, used_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();
  const vales = (codes ?? []) as Vale[];

  return (
    <main className="page-wide">
      <div className="client-layout">
        <ClientForm title="Editar cliente" client={client} error={error} />

        <div className="card">
          <h2>Vales deste cliente</h2>
          {vales.length === 0 ? (
            <p className="meta">Ainda não há vales para este cliente.</p>
          ) : (
            <ul className="list">
              {vales.map((v) => {
                const status = codeStatus(v);
                return (
                  <li key={v.id} className="list-row">
                    <div>
                      <div className="name">{v.code}</div>
                      <div className="meta">
                        {KIND_LABEL[v.kind] ?? v.kind}{v.note ? ` · ${v.note}` : ""} · {formatDiscount(v)} · {formatDate(v.valid_from)} a {formatDate(v.valid_to)}
                      </div>
                    </div>
                    <span className={`tag${status.key === "active" ? " on" : " warn"}`}>{status.label}</span>
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
