"use client";

import { useState } from "react";
import Link from "next/link";
import { savePromotion } from "./actions";
import { formatDate } from "@/lib/date";

export type PromotionValues = {
  id?: string;
  name?: string;
  condition?: string | null;
  discount_percent?: number;
  reward_valid_from?: string;
  reward_valid_to?: string;
  active?: boolean;
};

function buildSummary(discount: string, validFrom: string, validTo: string, condition: string) {
  const pct = discount ? `${discount}%` : "__%";
  const from = validFrom ? formatDate(validFrom) : "__/__/____";
  const to = validTo ? formatDate(validTo) : "__/__/____";
  let text = `Vale de ${pct} de desconto, válido de ${from} a ${to}.`;
  if (condition.trim()) text += ` Condição: ${condition.trim()}.`;
  return text;
}

export default function PromotionForm({
  title,
  promotion,
  error,
}: {
  title: string;
  promotion?: PromotionValues;
  error?: string;
}) {
  const [name, setName] = useState(promotion?.name ?? "");
  const [condition, setCondition] = useState(promotion?.condition ?? "");
  const [discount, setDiscount] = useState(promotion?.discount_percent != null ? String(promotion.discount_percent) : "");
  const [validFrom, setValidFrom] = useState(promotion?.reward_valid_from ?? "");
  const [validTo, setValidTo] = useState(promotion?.reward_valid_to ?? "");
  const [paused, setPaused] = useState(promotion?.active === false);

  function fillExample() {
    const year = new Date().getFullYear();
    setName(`Natal ${year}`);
    setCondition("Compras de 100 € ou mais entre 01/12 e 24/12");
    setDiscount("10");
    setValidFrom(`${year}-12-26`);
    setValidTo(`${year + 1}-01-31`);
  }

  return (
    <main className="narrow">
      {!promotion?.id ? (
        <div className="bar">
          <button type="button" className="btn" onClick={fillExample}>Começar com um exemplo (Natal)</button>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="notice" style={{ margin: 0 }}>{buildSummary(discount, validFrom, validTo, condition)}</p>
      </div>

      <form action={savePromotion} className="card">
        <h2>{title}</h2>
        {promotion?.id ? <input type="hidden" name="id" value={promotion.id} /> : null}
        <label>
          Nome
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Natal 2026"
            autoComplete="off"
            required
          />
          <span className="hint">O nome usado para identificar esta promoção. Exemplo: &ldquo;Natal 2026&rdquo;.</span>
        </label>
        <label>
          Condição (opcional)
          <input
            type="text"
            name="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Ex.: Compras de 100 € ou mais entre 01/12 e 24/12"
            autoComplete="off"
          />
          <span className="hint">
            Texto só para a equipa ler — a aplicação não verifica isto automaticamente, é a equipa que decide no
            balcão.
          </span>
        </label>
        <label>
          Desconto em %
          <input
            type="number"
            name="discount_percent"
            inputMode="decimal"
            min="1"
            max="100"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="Ex.: 10"
            required
          />
          <span className="hint">Percentagem de desconto do vale. Exemplo: 10 (para 10%).</span>
        </label>
        <label>
          Vale válido de
          <input type="date" name="reward_valid_from" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
          <span className="hint">Primeiro dia em que os vales criados por esta promoção podem ser usados.</span>
        </label>
        <label>
          Vale válido até
          <input type="date" name="reward_valid_to" value={validTo} onChange={(e) => setValidTo(e.target.value)} required />
          <span className="hint">Último dia em que os vales ainda são válidos. Exemplo: 31/01 do ano seguinte.</span>
        </label>
        {promotion?.id ? (
          <label className="check">
            <input type="checkbox" name="paused" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
            <span>Pausar esta promoção (não cria vales novos; os vales já criados continuam a funcionar)</span>
          </label>
        ) : null}
        {error ? <p className="err" role="alert">{error}</p> : null}
        <div className="actions">
          <Link className="btn" href="/promotions">Cancelar</Link>
          <button type="submit" className="btn primary">Guardar promoção</button>
        </div>
      </form>
      {promotion?.id ? (
        <div className="danger-zone">
          <Link className="btn danger" href={`/promotions/${promotion.id}/delete`}>Eliminar promoção</Link>
        </div>
      ) : null}
    </main>
  );
}
