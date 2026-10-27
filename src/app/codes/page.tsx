import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { codeStatus } from "./status";

type Code = {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  expires_at: string | null;
  max_uses: number | null;
  times_used: number;
  active: boolean;
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function CodesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("discount_codes")
    .select("id, code, type, value, expires_at, max_uses, times_used, active")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Code[];

  return (
    <main>
      <header className="top">
        <h1>Códigos de desconto</h1>
        <span className="count">
          {rows.length} {rows.length === 1 ? "código" : "códigos"} ·{" "}
          <Link className="navlink" href="/">
            Clientes
          </Link>
        </span>
      </header>

      <div className="bar">
        <Link className="btn primary" href="/codes/new">
          Adicionar código
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="empty">Ainda não há códigos. Selecione “Adicionar código” para criar o primeiro.</div>
      ) : (
        <ul className="list">
          {rows.map((c) => {
            const status = codeStatus(c);
            return (
              <li key={c.id}>
                <Link href={`/codes/${c.id}`}>
                  <div>
                    <div className="name">{c.code}</div>
                    <div className="meta">
                      {c.type === "percentage" ? `${c.value}%` : `${c.value} €`} ·{" "}
                      {c.expires_at ? `Válido até ${formatDate(c.expires_at)}` : "Sem validade"} ·{" "}
                      {c.max_uses ? `${c.times_used}/${c.max_uses} utilizações` : `${c.times_used} utilizações`}
                    </div>
                  </div>
                  <span className={`tag${status.key === "active" ? " on" : " warn"}`}>{status.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
