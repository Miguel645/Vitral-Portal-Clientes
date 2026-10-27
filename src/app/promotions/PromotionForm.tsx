import Link from "next/link";
import { savePromotion, deletePromotion } from "./actions";

export type PromotionValues = {
  id?: string;
  name?: string;
  earn_from?: string;
  earn_to?: string;
  min_spend?: number;
  discount_percent?: number;
  reward_valid_from?: string;
  reward_valid_to?: string;
  active?: boolean;
};

export default function PromotionForm({
  title,
  promotion,
  error,
}: {
  title: string;
  promotion?: PromotionValues;
  error?: string;
}) {
  return (
    <main className="narrow">
      <form action={savePromotion} className="card">
        <h2>{title}</h2>
        {promotion?.id ? <input type="hidden" name="id" value={promotion.id} /> : null}
        <label>
          Nome
          <input type="text" name="name" defaultValue={promotion?.name ?? ""} autoComplete="off" required />
        </label>
        <label>
          Compras a partir de
          <input type="date" name="earn_from" defaultValue={promotion?.earn_from ?? ""} required />
        </label>
        <label>
          Compras até
          <input type="date" name="earn_to" defaultValue={promotion?.earn_to ?? ""} required />
        </label>
        <label>
          Compra mínima (€)
          <input type="number" name="min_spend" inputMode="decimal" step="0.01" min="0.01" defaultValue={promotion?.min_spend ?? ""} required />
        </label>
        <label>
          Percentagem de desconto
          <input
            type="number"
            name="discount_percent"
            inputMode="decimal"
            min="1"
            max="100"
            step="0.01"
            defaultValue={promotion?.discount_percent ?? ""}
            required
          />
        </label>
        <label>
          Prémio válido a partir de
          <input type="date" name="reward_valid_from" defaultValue={promotion?.reward_valid_from ?? ""} required />
        </label>
        <label>
          Prémio válido até
          <input type="date" name="reward_valid_to" defaultValue={promotion?.reward_valid_to ?? ""} required />
        </label>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={promotion?.active ?? true} />
          <span>Promoção ativa</span>
        </label>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="actions">
          {promotion?.id ? (
            <button type="submit" formAction={deletePromotion} formNoValidate className="btn danger spacer">
              Eliminar promoção
            </button>
          ) : null}
          <Link className="btn" href="/promotions">Cancelar</Link>
          <button type="submit" className="btn primary">Guardar promoção</button>
        </div>
      </form>
    </main>
  );
}
