"use client";

import { useActionState } from "react";
import { saveBirthdaySettings, type SettingsState } from "./actions";

export default function SettingsForm({
  settings,
}: {
  settings: { active: boolean; percent: number; valid_days: number };
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveBirthdaySettings, {});
  const v = state.values;
  const err = (f: SettingsState["field"]) => (state.field === f ? state.error : undefined);

  return (
    <form action={formAction} className="card" key={JSON.stringify(v ?? null)}>
      <h2>Vale de aniversário</h2>
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={v?.active ?? settings.active} aria-describedby="active-hint" />
        <span>Criar vales de aniversário automaticamente</span>
      </label>
      <p className="hint" id="active-hint" style={{ marginTop: "calc(var(--sp-8) * -1)", marginBottom: "var(--sp-24)" }}>
        Só para clientes que querem receber mensagens. Cada um recebe um SMS com o código.
      </p>
      <label>
        Percentagem de desconto
        <input
          type="number"
          name="percent"
          inputMode="decimal"
          min="1"
          max="100"
          step="0.01"
          defaultValue={v?.percent ?? settings.percent}
          required
          autoFocus={state.field === "percent"}
          aria-invalid={!!err("percent")}
          aria-describedby={err("percent") ? "percent-hint percent-err" : "percent-hint"}
        />
        <span className="hint" id="percent-hint">Um número de 1 a 100.</span>
        {err("percent") ? <span className="err" id="percent-err" role="alert">{state.error}</span> : null}
      </label>
      <label>
        Validade em dias a partir do aniversário
        <input
          type="number"
          name="valid_days"
          inputMode="numeric"
          min="1"
          step="1"
          defaultValue={v?.valid_days ?? settings.valid_days}
          required
          autoFocus={state.field === "valid_days"}
          aria-invalid={!!err("valid_days")}
          aria-describedby={err("valid_days") ? "days-hint days-err" : "days-hint"}
        />
        <span className="hint" id="days-hint">O vale dura o dia de anos e mais estes dias.</span>
        {err("valid_days") ? <span className="err" id="days-err" role="alert">{state.error}</span> : null}
      </label>
      {state.error && !state.field ? <p className="err" role="alert">{state.error}</p> : null}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "A guardar…" : "Guardar definições"}
        </button>
      </div>
    </form>
  );
}
