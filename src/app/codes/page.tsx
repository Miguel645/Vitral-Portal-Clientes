import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { codeStatus, type StatusKey } from "./status";
import { formatDate, lisbonToday } from "@/lib/date";
import { markCodeUsed } from "./actions";

type Row = {
  id: string;
  code: string;
  kind: "birthday" | "promotion";
  percent: number;
  valid_from: string;
  valid_to: string;
  used_at: string | null;
  client_id: string | null;
  clients: { name: string } | null;
};

const KIND_LABEL: Record<string, string> = { birthday: "Aniversário", promotion: "Promoção" };

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "used", label: "Usados" },
  { key: "expired", label: "Expirados" },
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
    .select("id, code, kind, percent, valid_from, valid_to, used_at, client_id, clients(name)")
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, status: codeStatus(r, today) }));

  const activeFilter = FILTERS.some((f) => f.key === filter) ? filter : "all";
  const filtered =
    activeFilter === "all" ? rows : rows.filter((r) => r.status.key === (activeFilter as StatusKey));

  return (
    <main className="page-wide">
      <header className="top">
        <h1>Vales</h1>
      </header>

      {message ? <p className="notice">{message}</p> : null}

      <div className="bar filters">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/codes?filter=${f.key}`} className={`btn${activeFilter === f.key ? " primary" : ""}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Não há vales para mostrar.</div>
      ) : (
        <ul className="list">
          {filtered.map((c) => (
            <li key={c.id} className="list-row stack">
              <div>
                <div className="name">{c.code}</div>
                <div className="meta">
                  {KIND_LABEL[c.kind]} · {c.percent}% · {c.clients?.name ?? "Sem cliente"} · {formatDate(c.valid_from)} a{" "}
                  {formatDate(c.valid_to)}
                </div>
              </div>
              <div className="row-end">
                <span className={`tag${c.status.key === "active" ? " on" : " warn"}`}>{c.status.label}</span>
                {!c.used_at ? (
                  <form action={markCodeUsed}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="btn">Marcar como usado</button>
                  </form>
                ) : null}
                <Link href={`/codes/${c.id}/delete`} className="btn danger">Eliminar vale</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
