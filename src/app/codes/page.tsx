import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { codeStatus, tagClass } from "./status";
import Notice from "@/app/_components/Notice";
import JustSavedLabel from "@/app/_components/JustSaved";
import Pager, { PAGE_SIZE, pageFromParam } from "@/app/_components/Pager";
import DeleteMenu from "@/app/_components/DeleteMenu";
import { deleteCode, deleteExpiredCodes } from "./actions";
import { formatDate, lisbonToday } from "@/lib/date";
import { formatDiscount, KIND_LABEL } from "@/lib/discount";
import { isSending, startJob } from "@/lib/jobs";
import AutoRefresh from "@/app/_components/AutoRefresh";

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
  { key: "expired", label: "Expirados", empty: "Não há vales expirados." },
];

export default async function CodesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; message?: string; saved?: string; error?: string }>;
}) {
  const { filter = "all", page: pageParam, message, saved, error: errorMessage } = await searchParams;
  // The codes of the vales just created, highlighted in the list.
  const justSaved = new Set((saved ?? "").split(","));
  const page = pageFromParam(pageParam);
  const supabase = await createClient();
  const today = lisbonToday();
  const activeFilter = FILTERS.some((f) => f.key === filter) ? filter : "all";

  // The status filter runs in the database (same rules as codeStatus), 100 vales per page.
  let query = supabase
    .from("discount_codes")
    .select("id, code, kind, percent, amount_eur, note, valid_from, valid_to, used_at, client_id, clients(name)", {
      count: "exact",
    });
  if (activeFilter === "active") query = query.is("used_at", null).lte("valid_from", today).gte("valid_to", today);
  if (activeFilter === "expired") query = query.is("used_at", null).lt("valid_to", today);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // A page number past the end (e.g. after deleting vales): back to the first page.
  if (error && page > 1) redirect(`/codes?filter=${activeFilter}`);

  const filtered = ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, status: codeStatus(r, today) }));

  // "Criar vales" runs whose SMS are still going out in the background (src/lib/jobs).
  type Batch = { id: string; recipients: number; sending_until: string | null; send_error: string | null };
  const { data: batchRows } = await supabase
    .from("vale_batches")
    .select("id, recipients, sending_until, send_error")
    .is("finished_at", null)
    .order("created_at");
  const batches = await Promise.all(
    ((batchRows ?? []) as Batch[]).map(async (b) => {
      const { count } = await supabase.from("sms_log").select("id", { count: "exact", head: true }).eq("batch_id", b.id);
      return { ...b, sent: count ?? 0 };
    })
  );
  // No step sending right now (a hand-off was lost): opening this page starts one again.
  for (const b of batches) if (!isSending(b.sending_until)) after(() => startJob({ kind: "vales", id: b.id }));

  return (
    <main className="page-wide">
      <header className="top">
        <h1>Vales</h1>
        <Link href="/codes/new" className="btn primary">Criar vales</Link>
      </header>

      <Notice message={message} clear={["saved"]} autoHide />

      <Notice message={errorMessage} param="error" error />

      {batches.length > 0 ? (
        <div className="notice" role="status">
          {batches.map((b) => (
            <p key={b.id}>
              A enviar automaticamente os SMS dos vales: {Math.min(b.sent, b.recipients)} de {b.recipients}. Pode fechar
              esta página.
              {b.send_error ? <span className="err-text"> Último problema: {b.send_error} Volta a tentar sozinho.</span> : null}
            </p>
          ))}
          <AutoRefresh />
        </div>
      ) : null}

      {/* Tabs, not buttons: the page's one primary button is "Criar vales". */}
      <nav className="tabs" aria-label="Mostrar vales">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/codes?filter=${f.key}`}
            className="tab"
            aria-current={activeFilter === f.key ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {/* All expired vales can go at once (asks first, like every "Eliminar"). */}
      {activeFilter === "expired" && (count ?? 0) > 0 ? (
        <div className="list-tools">
          <span className="count">
            {count} {count === 1 ? "vale expirado" : "vales expirados"}
          </span>
          <DeleteMenu
            menuLabel="Mais ações para os vales expirados"
            itemLabel="Eliminar vales expirados"
            title={count === 1 ? "Eliminar o vale expirado?" : `Eliminar os ${count} vales expirados?`}
            description="Não é possível desfazer. Já não podiam ser usados; deixam de aparecer na lista e na ficha de cada cliente."
            action={deleteExpiredCodes}
            fields={{}}
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="empty">
          <p style={{ margin: "0 0 var(--sp-16)" }}>{FILTERS.find((f) => f.key === activeFilter)?.empty}</p>
          <Link href="/codes/new" className="btn">Criar vales</Link>
        </div>
      ) : (
        <ul className="list">
          {filtered.map((c) => (
            <li key={c.id} className={`list-row stack${justSaved.has(c.code) ? " just-saved" : ""}`}>
              <div>
                <div className="name">{c.code}</div>
                <div className="meta">
                  {justSaved.has(c.code) ? <JustSavedLabel text="Acabado de criar" /> : null}
                  {KIND_LABEL[c.kind] ?? c.kind}{c.note ? ` · ${c.note}` : ""} · {formatDiscount(c)} · {c.clients?.name ?? "Sem cliente"} · {formatDate(c.valid_from)} a{" "}
                  {formatDate(c.valid_to)}
                </div>
              </div>
              <div className="row-end">
                <span className={tagClass(c.status.key)}>{c.status.label}</span>
                {c.status.key === "active" ? (
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

      <Pager page={page} total={count ?? filtered.length} href={(p) => `/codes?filter=${activeFilter}${p > 1 ? `&page=${p}` : ""}`} />
    </main>
  );
}
