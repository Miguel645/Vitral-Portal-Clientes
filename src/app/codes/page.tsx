import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { codeStatus, tagClass, type StatusKey } from "./status";
import Notice from "@/app/_components/Notice";
import DeleteMenu from "@/app/_components/DeleteMenu";
import { deleteCode } from "./actions";
import { formatDate, lisbonToday } from "@/lib/date";
import { formatDiscount, KIND_LABEL } from "@/lib/discount";

type Row = {
  id: string;
  code: string;
  kind: "birthday" | "manual";
  percent: number | null;
  amount_eur: number | null;
  note: string | null;
  valid_from: string;
  valid_to: string;
  used_at: string | null;
  client_id: string | null;
  clients: { name: string } | null;
};


const FILTERS: { key: string; label: string; empty: string }[] = [
  { key: "all", label: "Todos", empty: "Ainda não há vales." },
  { key: "active", label: "Ativos", empty: "Não há vales ativos." },
  { key: "used", label: "Usados", empty: "Não há vales usados." },
  { key: "expired", label: "Expirados", empty: "Não há vales expirados." },
];

export default async function CodesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; message?: string }>;
}) {
  const { filter = "all", message } = await searchParams;
  const supabase = await createClient();
  const today = lisbonToday();

  const { data } = await supabase
    .from("discount_codes")
    .select("id, code, kind, percent, amount_eur, note, valid_from, valid_to, used_at, client_id, clients(name)")
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, status: codeStatus(r, today) }));

  const activeFilter = FILTERS.some((f) => f.key === filter) ? filter : "all";
  const filtered =
    activeFilter === "all" ? rows : rows.filter((r) => r.status.key === (activeFilter as StatusKey));

  return (
    <main className="page-wide">
      <header className="top">
        <h1>Vales</h1>
        <Link href="/codes/new" className="btn primary">Criar vales</Link>
      </header>

      <Notice message={message} />

      <div className="bar filters">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/codes?filter=${f.key}`} className={`btn${activeFilter === f.key ? " primary" : ""}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p style={{ margin: "0 0 var(--sp-16)" }}>{FILTERS.find((f) => f.key === activeFilter)?.empty}</p>
          <Link href="/codes/new" className="btn">Criar vales</Link>
        </div>
      ) : (
        <ul className="list">
          {filtered.map((c) => (
            <li key={c.id} className="list-row stack">
              <div>
                <div className="name">{c.code}</div>
                <div className="meta">
                  {KIND_LABEL[c.kind] ?? c.kind}{c.note ? ` · ${c.note}` : ""} · {formatDiscount(c)} · {c.clients?.name ?? "Sem cliente"} · {formatDate(c.valid_from)} a{" "}
                  {formatDate(c.valid_to)}
                </div>
              </div>
              <div className="row-end">
                <span className={tagClass(c.status.key)}>{c.status.label}</span>
                {!c.used_at ? (
                  <Link href={`/codes/${c.id}/use`} className="btn">Marcar como usado</Link>
                ) : null}
                <DeleteMenu
                  menuLabel={`Mais ações para o vale ${c.code}`}
                  itemLabel="Eliminar vale"
                  title={`Eliminar o vale ${c.code}?`}
                  description="Não é possível desfazer."
                  action={deleteCode}
                  fields={{ id: c.id, code: c.code }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
