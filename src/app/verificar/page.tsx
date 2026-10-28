import { createClient } from "@/lib/supabase/server";
import { codeStatus } from "@/app/codes/status";
import { formatDate } from "@/lib/date";
import { formatDiscount } from "@/lib/discount";
import SubmitButton from "@/app/_components/SubmitButton";
import CodeInput from "./CodeInput";
import { markUsedAtCounter, undoUsedAtCounter } from "./actions";

// After "Marcar como usado" / "Desfazer" changed nothing or failed. The vale's real state shows below it.
const ERRORS: Record<string, string> = {
  mark_not_valid: "O vale não foi marcado como usado: já não é válido (pode ter sido usado agora noutro sítio). Veja o estado abaixo.",
  mark_failed: "Não foi possível marcar o vale como usado. Verifique a ligação à internet e tente novamente.",
  undo_not_changed: "Nada mudou: o vale não estava marcado como usado. Veja o estado abaixo.",
  undo_failed: "Não foi possível desfazer. Verifique a ligação à internet e tente novamente.",
};

type Found = {
  id: string;
  code: string;
  percent: number | null;
  amount_eur: number | null;
  note: string | null;
  valid_from: string;
  valid_to: string;
  used_at: string | null;
  clients: { name: string } | null;
};

export default async function VerificarValePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; done?: string; undone?: string; error?: string }>;
}) {
  const { code, done, undone, error } = await searchParams;
  const errorText = error && Object.hasOwn(ERRORS, error) ? ERRORS[error] : undefined;
  // Ignore spaces and dashes that sometimes get typed or pasted in.
  const term = (code ?? "").replace(/[\s-]/g, "").toUpperCase();
  // "Verificar" pressed with the box empty.
  const missing = code !== undefined && term === "";
  const supabase = await createClient();

  let found: Found | null = null;
  if (term) {
    const { data } = await supabase
      .from("discount_codes")
      .select("id, code, percent, amount_eur, note, valid_from, valid_to, used_at, clients(name)")
      .eq("code", term)
      .maybeSingle();
    found = data as unknown as Found | null;
  }

  const status = found ? codeStatus(found) : null;
  const details = found
    ? `${formatDiscount(found)} de desconto${found.note ? ` (${found.note})` : ""}.${found.clients?.name ? ` Cliente: ${found.clients.name}.` : ""}`
    : "";

  return (
    <main className="page-medium">
      <header className="top">
        <h1>Verificar vale</h1>
      </header>

      <form method="get" className="card" noValidate>
        <label htmlFor="code">
          Código do vale
          <CodeInput defaultValue={term} invalid={missing} />
          <span className="hint" id="code-hint">As 8 letras e números do vale.</span>
          {missing ? <span className="err" id="code-err" role="alert">Escreva o código do vale.</span> : null}
        </label>
        <div className="actions">
          <button type="submit" className="btn primary">Verificar</button>
        </div>
      </form>

      <div className="stack" aria-live="polite">
        {errorText ? <p className="err" role="alert">{errorText}</p> : null}
        {term && !found ? (
          <div className="result-box bad">Não válido: vale não encontrado. Verifique o código e tente novamente.</div>
        ) : null}

        {found && status ? (
          status.key === "used" && done ? (
            <>
              <div className="result-box ok">Vale marcado como usado. {details}</div>
              <form action={undoUsedAtCounter}>
                <input type="hidden" name="id" value={found.id} />
                <input type="hidden" name="code" value={found.code} />
                <div className="actions" style={{ justifyContent: "center" }}>
                  <SubmitButton className="btn" pendingText="A desfazer…">Desfazer</SubmitButton>
                </div>
              </form>
            </>
          ) : status.key === "active" ? (
            <>
              {undone ? <p className="notice">O vale voltou a ficar ativo.</p> : null}
              <div className="result-box ok">
                Válido: {formatDiscount(found)} de desconto{found.note ? ` (${found.note})` : ""}, até {formatDate(found.valid_to)}.
                {found.clients?.name ? ` Cliente: ${found.clients.name}.` : ""}
              </div>
              <form action={markUsedAtCounter}>
                <input type="hidden" name="id" value={found.id} />
                <input type="hidden" name="code" value={found.code} />
                <div className="actions" style={{ justifyContent: "center" }}>
                  <SubmitButton className="btn primary big-btn" pendingText="A marcar…">Marcar como usado</SubmitButton>
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
      </div>
    </main>
  );
}
