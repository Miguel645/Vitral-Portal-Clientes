"use client";

import { useRef } from "react";
import Link from "next/link";
import { saveCode, deleteCode } from "./actions";

export type CodeValues = {
  id?: string;
  code?: string;
  type?: "percentage" | "fixed";
  value?: number | null;
  expires_at?: string | null;
  max_uses?: number | null;
  client_id?: string | null;
  active?: boolean;
  times_used?: number;
};

type ClientOption = { id: string; name: string };

function randomCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function CodeForm({
  title,
  code,
  clients,
  error,
}: {
  title: string;
  code?: CodeValues;
  clients: ClientOption[];
  error?: string;
}) {
  const codeInputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="narrow">
      <form action={saveCode} className="card">
        <h2>{title}</h2>
        {code?.id ? <input type="hidden" name="id" value={code.id} /> : null}
        <label>
          Código
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={codeInputRef}
              type="text"
              name="code"
              defaultValue={code?.code ?? ""}
              placeholder="VERAO2026"
              maxLength={20}
              autoComplete="off"
              style={{ textTransform: "uppercase" }}
              required
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (codeInputRef.current) codeInputRef.current.value = randomCode();
              }}
            >
              Gerar
            </button>
          </div>
        </label>
        <label>
          Tipo de desconto
          <select name="type" defaultValue={code?.type ?? "percentage"}>
            <option value="percentage">Percentagem (%)</option>
            <option value="fixed">Valor fixo (€)</option>
          </select>
        </label>
        <label>
          Valor
          <input
            type="number"
            name="value"
            step="0.01"
            defaultValue={code?.value ?? ""}
            placeholder="Percentagem: 1 a 100. Valor fixo: em euros."
            required
          />
        </label>
        <label>
          Data de validade (opcional)
          <input type="date" name="expires_at" defaultValue={code?.expires_at ?? ""} />
        </label>
        <label>
          Número máximo de utilizações (opcional)
          <input type="number" name="max_uses" min="1" step="1" defaultValue={code?.max_uses ?? ""} />
        </label>
        <label>
          Cliente (opcional)
          <select name="client_id" defaultValue={code?.client_id ?? ""}>
            <option value="">— Nenhum —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={code?.active ?? true} />
          <span>Código ativo</span>
        </label>
        {code?.id ? (
          <div className="meta" style={{ marginBottom: 12 }}>
            Utilizado {code.times_used ?? 0} vez(es).
          </div>
        ) : null}
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <div className="actions">
          {code?.id ? (
            <button type="submit" formAction={deleteCode} formNoValidate className="btn danger spacer">
              Eliminar código
            </button>
          ) : null}
          <Link className="btn" href="/codes">
            Cancelar
          </Link>
          <button type="submit" className="btn primary">
            Guardar código
          </button>
        </div>
      </form>
    </main>
  );
}
