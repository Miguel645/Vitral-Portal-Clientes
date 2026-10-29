"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { saveWelcomeSettings, type WelcomeField, type WelcomeState } from "./actions";
import { composeCampaignMessage, nonGsm7Chars, PREVIEW_TOKEN, removeAccents } from "@/lib/smsText";
import type { WelcomeSettings } from "@/lib/welcome";
import SmsCostWarning from "@/app/_components/SmsCostWarning";

// Same length as a real vale code.
const PREVIEW_VALE = "ABCD2345";
const SAMPLE_NAME = "Maria";

export default function WelcomeForm({
  settings,
  appUrl,
}: {
  settings: WelcomeSettings;
  // Null when the unsubscribe link is switched off.
  appUrl: string | null;
}) {
  const [state, dispatch, pending] = useActionState<WelcomeState, FormData>(saveWelcomeSettings, {});

  const [active, setActive] = useState(settings.active);
  const [message, setMessage] = useState(settings.sms_text);
  const [withVale, setWithVale] = useState(settings.vale_valid_days != null);
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    settings.vale_amount_eur != null ? "amount" : "percent"
  );
  const [percentValue, setPercentValue] = useState(String(settings.vale_percent ?? 10));
  const [amountValue, setAmountValue] = useState(
    settings.vale_amount_eur != null ? String(settings.vale_amount_eur).replace(".", ",") : ""
  );
  const value = discountType === "percent" ? percentValue : amountValue;
  const setValue = discountType === "percent" ? setPercentValue : setAmountValue;
  const [validDays, setValidDays] = useState(String(settings.vale_valid_days ?? 30));

  const messageRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // After an error, take the person to the field it's about.
  useEffect(() => {
    if (state.field) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  function save() {
    const data = new FormData();
    if (active) data.set("active", "on");
    data.set("sms_text", message);
    if (withVale) {
      data.set("with_vale", "on");
      data.set("discount_type", discountType);
      data.set("value", value);
      data.set("valid_days", validDays);
    }
    // Sent by hand rather than with action={...}: React resets a form after an action,
    // which would put the tick boxes and radio buttons back to how the page started.
    startTransition(() => dispatch(data));
  }

  function insert(token: string) {
    const el = messageRef.current;
    const start = el?.selectionStart ?? message.length;
    const end = el?.selectionEnd ?? start;
    setMessage(message.slice(0, start) + token + message.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const preview = composeCampaignMessage(message, { firstName: SAMPLE_NAME, vale: PREVIEW_VALE }, appUrl, PREVIEW_TOKEN);

  const described = (f: WelcomeField, hintId?: string) => {
    const ids = [hintId, state.field === f ? `welcome-${f}-err` : ""].filter(Boolean).join(" ");
    return { "aria-invalid": state.field === f, "aria-describedby": ids || undefined };
  };
  const fieldError = (f: WelcomeField) =>
    state.field === f ? <span className="err" id={`welcome-${f}-err`} role="alert">{state.error}</span> : null;

  return (
    <form
      ref={formRef}
      className="card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h2>Mensagem de boas-vindas</h2>
      <label className="check" htmlFor="welcome-active">
        <input
          id="welcome-active"
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          aria-describedby="welcome-active-hint"
        />
        <span>Enviar mensagem de boas-vindas a novos clientes</span>
      </label>
      <p className="hint" id="welcome-active-hint" style={{ marginTop: "calc(var(--sp-8) * -1)", marginBottom: "var(--sp-24)" }}>
        Um SMS, uma única vez, a quem fica a receber mensagens.
      </p>

      <label htmlFor="welcome-sms_text">
        Texto do SMS
        <textarea
          id="welcome-sms_text"
          ref={messageRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          required
          {...described("sms_text")}
        />
        {fieldError("sms_text")}
      </label>
      <div className="actions" style={{ justifyContent: "flex-start", marginTop: 0, marginBottom: "var(--sp-24)" }}>
        <button type="button" className="btn" onClick={() => insert("{nome}")}>Inserir {"{nome}"}</button>
        {withVale ? (
          <button type="button" className="btn" onClick={() => insert("{vale}")}>Inserir {"{vale}"}</button>
        ) : null}
      </div>

      <SmsCostWarning text={preview} />
      {nonGsm7Chars(preview).length > 0 && removeAccents(message) !== message ? (
        <div className="actions" style={{ justifyContent: "flex-start", marginTop: 0, marginBottom: "var(--sp-16)" }}>
          <button type="button" className="btn" onClick={() => setMessage(removeAccents(message))}>Remover acentos</button>
        </div>
      ) : null}

      <label className="check" htmlFor="welcome-with_vale">
        <input
          id="welcome-with_vale"
          type="checkbox"
          checked={withVale}
          onChange={(e) => setWithVale(e.target.checked)}
          aria-describedby="welcome-with_vale-hint"
        />
        <span>Incluir um vale</span>
      </label>
      <p className="hint" id="welcome-with_vale-hint" style={{ marginTop: "calc(var(--sp-8) * -1)", marginBottom: "var(--sp-24)" }}>
        Cada novo cliente recebe um vale
      </p>

      {withVale ? (
        <>
          <div role="radiogroup" aria-label="Tipo de desconto do vale de boas-vindas">
            <label className="check" htmlFor="welcome-type-percent">
              <input
                id="welcome-type-percent"
                type="radio"
                name="welcome_discount_type"
                checked={discountType === "percent"}
                onChange={() => setDiscountType("percent")}
              />
              <span>Percentagem (%)</span>
            </label>
            <label className="check" htmlFor="welcome-type-amount">
              <input
                id="welcome-type-amount"
                type="radio"
                name="welcome_discount_type"
                checked={discountType === "amount"}
                onChange={() => setDiscountType("amount")}
              />
              <span>Valor em euros (€)</span>
            </label>
          </div>
          <label htmlFor="welcome-value">
            {discountType === "percent" ? "Percentagem de desconto" : "Valor do desconto em euros"}
            <input
              id="welcome-value"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              {...described("value", "welcome-value-hint")}
            />
            <span className="hint" id="welcome-value-hint">
              {discountType === "percent" ? "Um número de 1 a 100." : "Maior que zero; pode ter cêntimos."}
            </span>
            {fieldError("value")}
          </label>
          <label htmlFor="welcome-valid_days">
            Validade em dias
            <input
              id="welcome-valid_days"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={validDays}
              onChange={(e) => setValidDays(e.target.value)}
              required
              {...described("valid_days", "welcome-valid_days-hint")}
            />
            <span className="hint" id="welcome-valid_days-hint">O vale dura o dia do registo e mais estes dias.</span>
            {fieldError("valid_days")}
          </label>
        </>
      ) : null}

      <div className="preview">
        <p className="preview-title">Pré-visualização para {SAMPLE_NAME}</p>
        <p className="meta" style={{ whiteSpace: "pre-wrap" }}>{preview}</p>
      </div>

      {state.error && !state.field ? <p className="err" role="alert">{state.error}</p> : null}
      <div className="actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "A guardar…" : "Guardar mensagem de boas-vindas"}
        </button>
      </div>
    </form>
  );
}
