"use client";

import { useState } from "react";
import { sendTestSms } from "./actions";
import { countSmsParts, composeMessage } from "@/lib/smsText";

const EXAMPLE_TEMPLATE = "Olá {{name}}, tem 10% de desconto em todos os artigos até domingo! Vitral";
const PREVIEW_NAME = "Maria";
const PREVIEW_TOKEN = "00000000-0000-0000-0000-000000000000";

export default function CampaignComposer({
  initialMessage,
  recipientCount,
  appUrl,
  testOk,
  testError,
}: {
  initialMessage: string;
  recipientCount: number;
  appUrl: string;
  testOk?: string;
  testError?: string;
}) {
  const [message, setMessage] = useState(initialMessage || EXAMPLE_TEMPLATE);

  const fullPreview = composeMessage(message, PREVIEW_NAME, appUrl, PREVIEW_TOKEN);
  const counter = countSmsParts(fullPreview);

  return (
    <form action={sendTestSms} className="card">
      <h2>Nova campanha</h2>
      <label>
        Mensagem
        <textarea
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          required
        />
        <span className="hint">
          Use {"{{name}}"} para o primeiro nome do cliente. O link de cancelamento é adicionado automaticamente no fim.
        </span>
      </label>

      <p className="meta">
        {counter.length} carateres · {counter.parts} SMS {counter.parts === 1 ? "parte" : "partes"} (
        {counter.gsm7 ? "160" : "70"} por parte)
      </p>
      {!counter.gsm7 ? (
        <p className="err">
          Atenção: carateres como ã, õ ou á fazem o SMS custar mais (70 em vez de 160 carateres por parte).
        </p>
      ) : null}

      <p className="meta">
        {recipientCount} {recipientCount === 1 ? "cliente vai receber" : "clientes vão receber"} esta mensagem.
      </p>

      <div className="card" style={{ marginBottom: "var(--sp-16)" }}>
        <h2>Pré-visualização</h2>
        <p className="meta" style={{ whiteSpace: "pre-wrap" }}>
          {fullPreview}
        </p>
      </div>

      <label>
        Número de telefone para teste
        <input type="tel" name="phone" autoComplete="off" required />
        <span className="hint">Número de 9 dígitos.</span>
      </label>

      {testError ? <p className="err" role="alert">{testError}</p> : null}
      {testOk ? <p className="notice">{testOk}</p> : null}

      <div className="actions">
        <button type="submit" className="btn primary">Enviar SMS de teste</button>
      </div>
    </form>
  );
}
