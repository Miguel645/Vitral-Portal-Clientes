"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveClient, type ClientFormState } from "../actions";

export type ClientValues = {
  id?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  birth_date?: string | null;
  consent?: boolean;
};

export default function ClientForm({ client }: { client?: ClientValues }) {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(saveClient, {});

  // After an error, keep what was typed instead of emptying the form.
  const v = state.values;
  const name = v?.name ?? client?.name ?? "";
  const phone = v?.phone ?? client?.phone ?? "";
  const email = v?.email ?? client?.email ?? "";
  const birth = v?.birth_date ?? client?.birth_date ?? "";
  const consent = v?.consent ?? client?.consent ?? false;

  const fieldError = (f: ClientFormState["field"]) => (state.field === f ? state.error : undefined);
  const describe = (f: NonNullable<ClientFormState["field"]>, extra?: boolean) =>
    [`${f}-hint`, fieldError(f) || extra ? `${f}-err` : ""].filter(Boolean).join(" ");

  return (
    <form action={formAction} className="card" key={JSON.stringify(v ?? null)}>
      <h2>Dados do cliente</h2>
      {client?.id ? <input type="hidden" name="id" value={client.id} /> : null}
      {state.duplicateOf ? <input type="hidden" name="allow_duplicate" value={phone} /> : null}
      <label>
        Nome
        <input
          type="text"
          name="name"
          defaultValue={name}
          autoComplete="off"
          required
          autoFocus={state.field === "name"}
          aria-invalid={!!fieldError("name")}
          aria-describedby={describe("name")}
        />
        <span className="hint" id="name-hint">Nome e apelido.</span>
        {fieldError("name") ? <span className="err" id="name-err" role="alert">{state.error}</span> : null}
      </label>
      <label>
        Telemóvel
        <input
          type="tel"
          name="phone"
          defaultValue={phone}
          autoComplete="off"
          required
          autoFocus={state.field === "phone" || !!state.duplicateOf}
          aria-invalid={!!fieldError("phone")}
          aria-describedby={describe("phone", !!state.duplicateOf)}
        />
        <span className="hint" id="phone-hint">9 dígitos, começado por 9.</span>
        {fieldError("phone") ? <span className="err" id="phone-err" role="alert">{state.error}</span> : null}
        {state.duplicateOf ? (
          <span className="err" id="phone-err" role="alert">
            Já existe um cliente com este telemóvel: {state.duplicateOf}. Se for outra pessoa, carregue em “Guardar
            cliente” outra vez.
          </span>
        ) : null}
      </label>
      <label>
        Email (opcional)
        <input
          type="email"
          name="email"
          defaultValue={email}
          autoComplete="off"
          autoFocus={state.field === "email"}
          aria-invalid={!!fieldError("email")}
          aria-describedby={describe("email")}
        />
        <span className="hint" id="email-hint">Para mensagens por email.</span>
        {fieldError("email") ? <span className="err" id="email-err" role="alert">{state.error}</span> : null}
      </label>
      <label>
        Data de nascimento (opcional)
        <input type="date" name="birth_date" defaultValue={birth} aria-describedby="birth-hint" />
        <span className="hint" id="birth-hint">Para o vale de aniversário.</span>
      </label>
      <label className="check">
        <input type="checkbox" name="consent" defaultChecked={consent} aria-describedby="consent-hint" />
        <span>Este cliente quer receber mensagens da Vitral (promoções, saldos e novidades)</span>
      </label>
      <p className="hint" id="consent-hint" style={{ marginTop: "calc(var(--sp-8) * -1)", marginBottom: "var(--sp-24)" }}>
        Só os clientes marcados aqui recebem SMS e vales de aniversário.
      </p>
      {state.error && !state.field ? <p className="err" role="alert">{state.error}</p> : null}
      <div className="actions">
        <Link className="btn" href="/">Cancelar</Link>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "A guardar…" : "Guardar cliente"}
        </button>
      </div>
    </form>
  );
}
