import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/app/_components/TopNav";
import { codeStatus, type StatusKey } from "./status";
import { formatDate, lisbonToday } from "@/lib/date";
import { markCodeUsed } from "./actions";

type Row = {
  id: string;
  code: string;
  kind: "birthday" | "spend";
  percent: number;
  valid_from: string;
  valid_to: string;
  used_at: string | null;
  client_id: string | null;
  clients: { name: string } | null;
};

const KIND_LABEL: Record<string, string> = { birthday: "Aniversário", spend: "Compra" };

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "used", label: "Usados" },
  { key: "expired", label: "Expirados" },
];

export default async function CodesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; check?: string }>;
}) {
  const { filter = "all", check = "" } = await searchParams;
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

  let checkResult:
    | { found: false }
    | { found: true; valid: boolean; percent: number; clientName: string; statusLabel: string }
    | null = null;

  const checkTerm = check.trim();
  if (checkTerm) {
    const codeUpper = checkTerm.toUpperCase();
    const { data } = await supabase
      .from("discount_codes")
      .select("percent, valid_from, valid_to, used_at, clients(name)")
      .eq("code", codeUpper)
      .maybeSingle();
    const found = data as unknown as {
      percent: number;
      valid_from: string;
      valid_to: string;
      used_at: string | null;
      clients: { name: string } | null;
    } | null;

    if (!found) {
      checkResult = { found: false };
    } else {
      const status = codeStatus(found, today);
      checkResult = {
        found: true,
        valid: status.key === "active",
        percent: found.percent,
        clientName: found.clients?.name ?? "Sem cliente associado",
        statusLabel: status.label,
      };
    }
  }

  return (
    <main>
      <header className="top">
        <h1>Códigos de desconto</h1>
      </header>

      <TopNav current="codes" />

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Verificar código</h2>
        <form method="get" style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            name="check"
            defaultValue={check}
            placeholder="Introduza o código"
            style={{ textTransform: "uppercase" }}
          />
          <button className="btn" type="submit">Verificar</button>
        </form>
        {checkResult ? (
          checkResult.found ? (
            <p className="notice">
              {checkResult.valid ? "Válido hoje" : `Não válido (${checkResult.statusLabel})`} · {checkResult.percent}% ·{" "}
              {checkResult.clientName}
            </p>
          ) : (
            <p className="err">Código não encontrado.</p>
          )
        ) : null}
      </div>

      <div className="bar">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/codes?filter=${f.key}`} className={`btn${activeFilter === f.key ? " primary" : ""}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">Não há códigos para mostrar.</div>
      ) : (
        <ul className="list">
          {filtered.map((c) => (
            <li key={c.id} className="list-row">
              <div>
                <div className="name">{c.code}</div>
                <div className="meta">
                  {KIND_LABEL[c.kind]} · {c.percent}% · {c.clients?.name ?? "Sem cliente"} · {formatDate(c.valid_from)} a{" "}
                  {formatDate(c.valid_to)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={`tag${c.status.key === "active" ? " on" : " warn"}`}>{c.status.label}</span>
                {!c.used_at ? (
                  <form action={markCodeUsed}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="btn">Marcar como usado</button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
