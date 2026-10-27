import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("clients")
    .select("id, name, phone, email, consent")
    .order("name");

  const all = (data ?? []) as Client[];
  const term = q.trim().toLowerCase();
  const rows = term
    ? all.filter((c) =>
        [c.name, c.phone, c.email ?? ""].some((v) => v.toLowerCase().includes(term))
      )
    : all;

  return (
    <main>
      <header className="top">
        <h1>Vitral clients</h1>
        <span className="count">
          {all.length} {all.length === 1 ? "client" : "clients"} ·{" "}
          <form action={logout} style={{ display: "inline" }}>
            <button className="signout" type="submit">Sign out</button>
          </form>
        </span>
      </header>

      <div className="bar">
        <form method="get">
          <input type="search" name="q" defaultValue={q} placeholder="Search by name, phone or email" aria-label="Search clients" />
          <button className="btn" type="submit">Search</button>
        </form>
        <Link className="btn primary" href="/clients/new">Add client</Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          {all.length === 0
            ? "No clients yet. Select “Add client” to create the first one."
            : "No clients match your search."}
        </div>
      ) : (
        <ul className="list">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`}>
                <div>
                  <div className="name">{c.name}</div>
                  <div className="meta">{[c.phone, c.email].filter(Boolean).join("  ·  ")}</div>
                </div>
                <span className={`tag${c.consent ? " on" : ""}`}>
                  {c.consent ? "Promotions OK" : "No consent"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
