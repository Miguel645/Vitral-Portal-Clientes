import { createClient } from "@/lib/supabase/server";
import { codeStatus } from "@/app/codes/status";
import { formatDate } from "@/lib/date";
import { markUsedAtCounter } from "../actions";

type Found = {
  id: string;
  code: string;
  percent: number;
  valid_from: string;
  valid_to: string;
  used_at: string | null;
  clients: { name: string } | null;
};

export default async function VerificarValePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code = "" } = await searchParams;
  const term = code.trim();
  const supabase = await createClient();

  let found: Found | null = null;
  if (term) {
    const { data } = await supabase
      .from("discount_codes")
      .select("id, code, percent, valid_from, valid_to, used_at, clients(name)")
      .eq("code", term.toUpperCase())
      .maybeSingle();
    found = data as unknown as Found | null;
  }

  const status = found ? codeStatus(found) : null;

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Verificar vale</h1>
      </header>

      <form method="get" className="card">
        <label>
          Código do vale
          <input
            type="text"
            name="code"
            defaultValue={code}
            placeholder="Ex.: ABCD1234"
            style={{ textTransform: "uppercase" }}
            autoFocus
            required
          />
          <span className="hint">Escreva o código tal como aparece no vale.</span>
        </label>
        <div className="actions">
          <button type="submit" className="btn primary">Verificar</button>
        </div>
      </form>

      {term && !found ? (
        <div className="result-box bad">Não válido: vale não encontrado. Verifique o código e tente novamente.</div>
      ) : null}

      {found && status ? (
        status.key === "active" ? (
          <>
            <div className="result-box ok">
              Válido: {found.percent}% de desconto, até {formatDate(found.valid_to)}.
              {found.clients?.name ? ` Cliente: ${found.clients.name}.` : ""}
            </div>
            <form action={markUsedAtCounter}>
              <input type="hidden" name="id" value={found.id} />
              <input type="hidden" name="code" value={found.code} />
              <div className="actions" style={{ justifyContent: "center" }}>
                <button type="submit" className="btn primary balcao-btn">Marcar como usado</button>
              </div>
            </form>
          </>
        ) : (
          <div className="result-box bad">
            Não válido:{" "}
            {status.key === "used"
              ? `já foi usado${found.used_at ? ` em ${formatDate(found.used_at.slice(0, 10))}` : ""}.`
              : status.key === "not_started"
                ? `só é válido a partir de ${formatDate(found.valid_from)}.`
                : `expirou a ${formatDate(found.valid_to)}.`}
          </div>
        )
      ) : null}
    </main>
  );
}
