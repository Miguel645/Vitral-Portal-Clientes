import { formatDate, lisbonToday } from "@/lib/date";
import { addPurchase } from "./purchaseActions";
import { codeStatus } from "../codes/status";

type Purchase = { id: string; amount: number; purchased_at: string; note: string | null };
type Code = {
  id: string;
  code: string;
  kind: "birthday" | "spend";
  percent: number;
  valid_from: string;
  valid_to: string;
  used_at: string | null;
};

const KIND_LABEL: Record<string, string> = { birthday: "Aniversário", spend: "Compra" };

export default function PurchasesSection({
  clientId,
  purchases,
  codes,
  error,
  message,
}: {
  clientId: string;
  purchases: Purchase[];
  codes: Code[];
  error?: string;
  message?: string;
}) {
  const today = lisbonToday();

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Compras</h2>
        <form action={addPurchase}>
          <input type="hidden" name="client_id" value={clientId} />
          <label>
            Valor (€)
            <input type="number" name="amount" inputMode="decimal" step="0.01" min="0.01" required />
          </label>
          <label>
            Data
            <input type="date" name="purchased_at" defaultValue={today} required />
          </label>
          <label>
            Nota (opcional)
            <input type="text" name="note" autoComplete="off" />
          </label>
          {error ? <p className="err" role="alert">{error}</p> : null}
          {message ? <p className="notice">{message}</p> : null}
          <div className="actions">
            <button type="submit" className="btn primary">Registar compra</button>
          </div>
        </form>

        {purchases.length === 0 ? (
          <p className="meta" style={{ marginTop: 12 }}>Ainda não há compras registadas.</p>
        ) : (
          <ul className="list" style={{ marginTop: 12 }}>
            {purchases.map((p) => (
              <li key={p.id} className="list-row">
                <div>
                  <div className="name">{p.amount.toFixed(2)} €</div>
                  <div className="meta">
                    {formatDate(p.purchased_at)}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Códigos deste cliente</h2>
        {codes.length === 0 ? (
          <p className="meta">Ainda não há códigos para este cliente.</p>
        ) : (
          <ul className="list">
            {codes.map((c) => {
              const status = codeStatus(c, today);
              return (
                <li key={c.id} className="list-row">
                  <div>
                    <div className="name">{c.code}</div>
                    <div className="meta">
                      {KIND_LABEL[c.kind]} · {c.percent}% · {formatDate(c.valid_from)} a {formatDate(c.valid_to)}
                    </div>
                  </div>
                  <span className={`tag${status.key === "active" ? " on" : " warn"}`}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
