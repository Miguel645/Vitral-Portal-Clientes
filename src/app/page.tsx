import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { clientSearchFilter } from "@/lib/clientSearch";
import Notice from "@/app/_components/Notice";
import Pager, { PAGE_SIZE, pageFromParam } from "@/app/_components/Pager";

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  consent: boolean;
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; message?: string }>;
}) {
  const { q = "", page: pageParam, message } = await searchParams;
  const page = pageFromParam(pageParam);
  const supabase = await createClient();

  // The search runs in the database, 100 clients per page.
  const filter = clientSearchFilter(q);
  let query = supabase.from("clients").select("id, name, phone, email, consent", { count: "exact" });
  if (filter) query = query.or(filter);
  const [{ data, count, error }, { count: totalCount }] = await Promise.all([
    query
      .order("name")
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    filter
      ? supabase.from("clients").select("id", { count: "exact", head: true })
      : Promise.resolve({ count: null }),
  ]);
  // A page number past the end (e.g. after deleting clients): back to the first page.
  if (error && page > 1) redirect(filter ? `/?q=${encodeURIComponent(q)}` : "/");

  const rows = (data ?? []) as Client[];
  const found = count ?? rows.length;
  const total = filter ? totalCount ?? 0 : found;
  const plural = (n: number) => (n === 1 ? "cliente" : "clientes");
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <main className="page-wide">
      <header className="top">
        <div>
          <h1>Clientes Vitral</h1>
          <span className="count">
            {filter ? `${found} de ${total} ${plural(total)}` : `${total} ${plural(total)}`}
          </span>
        </div>
        <Link className="btn primary" href="/clients/new">Adicionar cliente</Link>
      </header>

      <Notice message={message} />

      <div className="bar">
        <form method="get">
          <input type="search" name="q" defaultValue={q} placeholder="Procurar por nome, telefone ou email" aria-label="Procurar clientes" />
          <button className="btn" type="submit">Procurar</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          {total === 0
            ? "Ainda não há clientes. Selecione “Adicionar cliente” para criar o primeiro."
            : "Nenhum cliente corresponde à pesquisa."}
        </div>
      ) : (
        <ul className="list">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="list-link">
                <div>
                  <div className="name">{c.name}</div>
                  <div className="meta">{[formatPhone(c.phone), c.email].filter(Boolean).join("  ·  ")}</div>
                </div>
                <span className={`tag${c.consent ? " on" : ""}`}>
                  {c.consent ? "Recebe mensagens" : "Não recebe mensagens"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pager page={page} total={found} href={pageHref} />
    </main>
  );
}
