import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../ClientForm";
import { codeStatus } from "../../codes/status";
import { formatDate } from "@/lib/date";

const KIND_LABEL: Record<string, string> = { birthday: "Aniversário", promotion: "Promoção" };

type Vale = {
  id: string;
  code: string;
  kind: "birthday" | "promotion";
  percent: number;
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
      .select("id, code, kind, percent, valid_from, valid_to, used_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();
  const vales = (codes ?? []) as Vale[];

  return (
    <main className="narrow">
      <ClientForm title="Editar cliente" client={client} error={error} />

      <div className="card" style={{ marginTop: 20 }}>
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
                      {KIND_LABEL[v.kind]} · {v.percent}% · {formatDate(v.valid_from)} a {formatDate(v.valid_to)}
                    </div>
                  </div>
                  <span className={`tag${status.key === "active" ? " on" : " warn"}`}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
