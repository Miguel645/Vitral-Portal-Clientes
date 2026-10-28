import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import Notice from "@/app/_components/Notice";

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
  searchParams: Promise<{ q?: string; message?: string }>;
}) {
  const { q = "", message } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("id, name, phone, email, consent")
    .order("name");

  const all = (data ?? []) as Client[];
  const term = q.trim().toLowerCase();
  // Phone search ignores spaces and other separators ("912 345" finds "912345678").
  const termDigits = /^[\d\s+().-]+$/.test(term) ? term.replace(/\D/g, "") : "";
  const rows = term
    ? all.filter(
        (c) =>
          [c.name, c.email ?? ""].some((v) => v.toLowerCase().includes(term)) ||
          (termDigits !== "" && c.phone.replace(/\D/g, "").includes(termDigits))
      )
    : all;
  const plural = (n: number) => (n === 1 ? "cliente" : "clientes");

  return (
    <main className="page-wide">
      <header className="top">
        <div>
          <h1>Clientes Vitral</h1>
          <span className="count">
            {term ? `${rows.length} de ${all.length} ${plural(all.length)}` : `${all.length} ${plural(all.length)}`}
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
          {all.length === 0
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
    </main>
  );
}
