"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { sendCampaign, sendTestSms, type SendAllState, type TestSmsState } from "./actions";
import { countSmsParts, composeMessage, PREVIEW_TOKEN } from "@/lib/smsText";
import SmsCostWarning from "@/app/_components/SmsCostWarning";

const EXAMPLE_TEMPLATE = "Olá {{name}}, tem 10% de desconto em todos os artigos até domingo! Vitral";
const PREVIEW_NAME = "Maria";

export default function CampaignComposer({
  recipientNames,
  appUrl,
  simulated,
}: {
  // First names of the clients who want to receive messages, to count the real SMS parts.
  recipientNames: string[];
  appUrl: string;
  simulated: boolean;
}) {
  const [message, setMessage] = useState(EXAMPLE_TEMPLATE);
  const [testState, testAction, testPending] = useActionState<TestSmsState, FormData>(sendTestSms, {});
  const [sendState, sendAction, sendPending] = useActionState<SendAllState, FormData>(sendCampaign, {});
  // "Enviar a todos" first shows a summary; only "Confirmar envio" sends.
  const [confirming, setConfirming] = useState(false);
  const confirmTitleRef = useRef<HTMLParagraphElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  // Set when sending is tried with an empty message; shown under the message box.
  const [messageEmpty, setMessageEmpty] = useState(false);
  const messageError = messageEmpty && !message.trim() ? "Escreva a mensagem." : undefined;

  function requireMessage(): boolean {
    if (message.trim()) return true;
    setMessageEmpty(true);
    messageRef.current?.focus();
    return false;
  }

  useEffect(() => {
    if (confirming) confirmTitleRef.current?.focus();
  }, [confirming]);
  // Close the summary once the send has finished.
  useEffect(() => {
    setConfirming(false);
  }, [sendState]);

  const fullPreview = composeMessage(message, PREVIEW_NAME, appUrl, PREVIEW_TOKEN);
  const recipientCount = recipientNames.length;

  // Each client's first name changes the length, so count every message.
  const partsEach = recipientNames.map((n) => countSmsParts(composeMessage(message, n, appUrl, PREVIEW_TOKEN)).parts);
  const totalParts = partsEach.reduce((a, b) => a + b, 0);
  const minParts = Math.min(...partsEach);
  const maxParts = Math.max(...partsEach);
  const partsPerMessage = minParts === maxParts ? `${minParts}` : `${minParts} a ${maxParts}`;

  return (
    <>
      <div className="card">
        <h2>Nova campanha</h2>
        <label htmlFor="campaign-message">
          Mensagem
          <textarea
            id="campaign-message"
            ref={messageRef}
            name="message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setConfirming(false);
            }}
            rows={4}
            required
            aria-invalid={!!messageError}
            aria-describedby={messageError ? "campaign-message-err" : undefined}
          />
          {messageError ? <span className="err" id="campaign-message-err" role="alert">{messageError}</span> : null}
        </label>

        <SmsCostWarning text={fullPreview} />

        <div className="preview">
          <p className="preview-title">Pré-visualização</p>
          <p className="meta" style={{ whiteSpace: "pre-wrap" }}>
            {fullPreview}
          </p>
        </div>
      </div>

      <form
        action={testAction}
        className="card"
        noValidate
        onSubmit={(e) => {
          if (!requireMessage()) e.preventDefault();
        }}
      >
        <h2>Enviar SMS de teste</h2>
        <input type="hidden" name="message" value={message} />
        <label htmlFor="test-phone">
          Número de telefone para teste
          <input
            id="test-phone"
            type="tel"
            name="phone"
            autoComplete="off"
            required
            aria-invalid={testState.field === "phone"}
            aria-describedby={testState.field === "phone" ? "test-phone-hint test-phone-err" : "test-phone-hint"}
          />
          <span className="hint" id="test-phone-hint">Número de 9 dígitos.</span>
          {testState.field === "phone" ? <span className="err" id="test-phone-err" role="alert">{testState.error}</span> : null}
        </label>

        {testState.error && testState.field !== "phone" ? <p className="err" role="alert">{testState.error}</p> : null}
        {testState.ok ? <p className="notice" role="status">{testState.ok}</p> : null}

        <div className="actions">
          <button type="submit" className="btn" disabled={testPending}>
            {testPending ? "A enviar…" : "Enviar SMS de teste"}
          </button>
        </div>
      </form>

      <form action={sendAction} className="card">
        <h2>Enviar a todos</h2>
        <input type="hidden" name="message" value={message} />
        <p className="name">
          {recipientCount} {recipientCount === 1 ? "cliente vai receber" : "clientes vão receber"} esta mensagem.
        </p>
        <p className="meta" style={{ marginBottom: "var(--sp-16)" }}>
          Envia esta mensagem a todos os clientes que querem receber mensagens.
          {simulated ? " Modo de teste: nada é enviado de verdade, as mensagens só ficam no registo." : ""}
        </p>

        {sendState.error ? <p className="err" role="alert">{sendState.error}</p> : null}
        {sendState.result && !confirming ? (
          <div className="notice" role="status" style={{ marginBottom: "var(--sp-16)" }}>
            {sendState.result}{" "}
            <Link className="navlink" href="/campaigns/log">Ver registo de SMS</Link>
          </div>
        ) : null}

        {confirming ? (
          <div className="preview" role="region" aria-labelledby="confirm-send-title">
            <p className="preview-title" id="confirm-send-title" ref={confirmTitleRef} tabIndex={-1}>
              Confirmar envio
            </p>
            <ul className="summary">
              <li>
                {recipientCount} {recipientCount === 1 ? "cliente vai receber" : "clientes vão receber"} (só quem
                quer receber mensagens)
              </li>
              <li>
                {partsPerMessage} {maxParts === 1 ? "parte" : "partes"} de SMS por mensagem
              </li>
              <li>
                {totalParts} {totalParts === 1 ? "parte" : "partes"} de SMS no total
              </li>
            </ul>
            <p className="preview-title">Mensagem</p>
            <p className="meta" style={{ whiteSpace: "pre-wrap" }}>
              {fullPreview}
            </p>
          </div>
        ) : null}

        <div className="actions">
          {confirming ? (
            <>
              <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={sendPending}>
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={sendPending} aria-disabled={sendPending}>
                {sendPending ? "A enviar…" : "Confirmar envio"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={recipientCount === 0}
              onClick={() => {
                if (requireMessage()) setConfirming(true);
              }}
            >
              Enviar a todos
            </button>
          )}
        </div>
      </form>
    </>
  );
}
