"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { campaignAction, type CampaignField, type CampaignState } from "./actions";
import { composeCampaignMessage, countSmsParts, nonGsm7Chars, PREVIEW_TOKEN, removeAccents } from "@/lib/smsText";
import { formatDiscount } from "@/lib/discount";
import { formatDate, parseDisplayDate } from "@/lib/date";
import DateInput from "@/app/_components/DateInput";
import SmsCostWarning from "@/app/_components/SmsCostWarning";

export type EditableCampaign = {
  id: string;
  name: string;
  sms_text: string;
  vale_percent: number | null;
  vale_amount_eur: number | null;
  vale_valid_from: string | null;
  vale_valid_to: string | null;
  starts_on: string | null;
  live_until: string | null;
};

type Intent = "save" | "test" | "send";

// No accents that cost extra (see SmsCostWarning).
const DEFAULT_MESSAGE = "Bom dia {nome}! Temos novidades na Vitral esta semana. Venha ver!";
// Same length as a real vale code, so the SMS counts in the summary are right.
const PREVIEW_VALE = "ABCD2345";

export default function CampaignEditor({
  campaign,
  recipients,
  previewClient,
  appUrl,
  testPhone,
  today,
  defaultValidTo,
}: {
  campaign?: EditableCampaign;
  // Clients who want to receive messages: first name, and whether their number can get an SMS.
  recipients: { firstName: string; valid: boolean }[];
  // The first of those clients, for the preview (null when there's none yet).
  previewClient: { name: string; firstName: string; token: string } | null;
  // Null when the unsubscribe link is switched off.
  appUrl: string | null;
  testPhone: string;
  today: string;
  defaultValidTo: string;
}) {
  const [state, dispatch, pending] = useActionState<CampaignState, FormData>(campaignAction, {});
  const [pendingIntent, setPendingIntent] = useState<Intent | null>(null);

  const [name, setName] = useState(campaign?.name ?? "");
  const [message, setMessage] = useState(campaign?.sms_text ?? DEFAULT_MESSAGE);
  const [withVale, setWithVale] = useState(!!campaign?.vale_valid_from);
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    campaign?.vale_amount_eur != null ? "amount" : "percent"
  );
  const [percentValue, setPercentValue] = useState(String(campaign?.vale_percent ?? 10));
  const [amountValue, setAmountValue] = useState(campaign?.vale_amount_eur != null ? String(campaign.vale_amount_eur).replace(".", ",") : "");
  const value = discountType === "percent" ? percentValue : amountValue;
  const setValue = discountType === "percent" ? setPercentValue : setAmountValue;
  // What's typed in the two date boxes (dd/mm/aaaa).
  const [validFrom, setValidFrom] = useState(formatDate(campaign?.vale_valid_from ?? today));
  const [validTo, setValidTo] = useState(formatDate(campaign?.vale_valid_to ?? defaultValidTo));
  // "Início": sent that day (at 10:00 when it's later than today). "Fim": until then,
  // clients added later also get it, every day at 10:00.
  const [startsOn, setStartsOn] = useState(formatDate(campaign?.starts_on && campaign.starts_on >= today ? campaign.starts_on : today));
  const [liveUntil, setLiveUntil] = useState(campaign?.live_until ? formatDate(campaign.live_until) : "");
  // Until it's typed in, the date follows the vale's "Válido até" (or today + 30 days).
  // The box is remounted with each new suggestion; once typed in, its key stays put.
  const [liveTyped, setLiveTyped] = useState(!!campaign?.live_until);
  const suggestedLiveUntil = withVale ? validTo : formatDate(defaultValidTo);
  const [liveKey, setLiveKey] = useState("typed");
  const liveUntilText = liveTyped ? liveUntil : suggestedLiveUntil;
  const [phone, setPhone] = useState(testPhone);
  // "Enviar campanha" first shows a summary; only "Confirmar envio" sends.
  const [confirming, setConfirming] = useState(false);

  const messageRef = useRef<HTMLTextAreaElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const confirmTitleRef = useRef<HTMLParagraphElement>(null);

  // After an error, take the person to the field it's about, and close the summary.
  useEffect(() => {
    setConfirming(false);
    if (state.field) pageRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  useEffect(() => {
    if (confirming) confirmTitleRef.current?.focus();
  }, [confirming]);

  function run(intent: Intent) {
    const data = new FormData();
    data.set("intent", intent);
    const id = campaign?.id ?? state.savedId;
    if (id) data.set("id", id);
    data.set("name", name);
    data.set("sms_text", message);
    if (withVale) {
      data.set("with_vale", "on");
      data.set("discount_type", discountType);
      data.set("value", value);
      data.set("valid_from", validFrom);
      data.set("valid_to", validTo);
    }
    data.set("starts_on", startsOn);
    data.set("live_until", liveUntilText);
    if (intent === "test") data.set("phone", phone);
    setPendingIntent(intent);
    // Sent by hand rather than with action={...}: React resets a form after an action,
    // which would put the tick box and radio buttons back to how the page started.
    startTransition(() => dispatch(data));
  }

  function insert(token: string) {
    const el = messageRef.current;
    const start = el?.selectionStart ?? message.length;
    const end = el?.selectionEnd ?? start;
    setMessage(message.slice(0, start) + token + message.slice(end));
    setConfirming(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const busy = (intent: Intent) => pending && pendingIntent === intent;

  const numericValue = Number(value.replace(",", "."));
  const discountText =
    Number.isFinite(numericValue) && numericValue > 0
      ? formatDiscount(discountType === "percent" ? { percent: numericValue, amount_eur: null } : { percent: null, amount_eur: numericValue })
      : "[desconto]";
  const validFromIso = parseDisplayDate(validFrom);
  const validToIso = parseDisplayDate(validTo);
  // Checked as soon as both dates are complete, not only when saving.
  const orderError =
    validFromIso && validToIso && validToIso < validFromIso
      ? "A data “Válido até” tem de ser igual ou depois de “Válido a partir de”."
      : undefined;

  const startsOnIso = parseDisplayDate(startsOn);
  const liveUntilIso = parseDisplayDate(liveUntilText);
  // Checked as soon as the dates are complete, not only when saving.
  const startError = startsOnIso && startsOnIso < today ? "O início tem de ser hoje ou depois." : undefined;
  const liveError =
    startsOnIso && liveUntilIso && liveUntilIso < startsOnIso
      ? "O fim tem de ser igual ou depois do início."
      : withVale && liveUntilIso && validToIso && liveUntilIso > validToIso
        ? "O fim não pode ser depois de “Válido até” do vale: quem a recebesse no fim receberia um vale já expirado."
        : undefined;
  // Starting later: "Agendar campanha" instead of sending now.
  const later = !!startsOnIso && startsOnIso > today;

  const preview = composeCampaignMessage(
    message,
    { firstName: previewClient?.firstName ?? "Maria", vale: PREVIEW_VALE },
    appUrl,
    previewClient?.token ?? PREVIEW_TOKEN
  );

  const sendable = recipients.filter((r) => r.valid);
  const invalidCount = recipients.length - sendable.length;
  // Each client's first name changes the length, so count every message.
  const partsEach = sendable.map(
    (r) => countSmsParts(composeCampaignMessage(message, { firstName: r.firstName, vale: PREVIEW_VALE }, appUrl, PREVIEW_TOKEN)).parts
  );
  const totalParts = partsEach.reduce((a, b) => a + b, 0);
  const minParts = Math.min(...partsEach);
  const maxParts = Math.max(...partsEach);
  const partsPerMessage = minParts === maxParts ? `${minParts}` : `${minParts} a ${maxParts}`;

  // Mark the field an error is about and tie its hint and error text to it for screen readers.
  const described = (f: CampaignField, hintId?: string) => {
    const ids = [hintId, state.field === f ? `${f}-err` : ""].filter(Boolean).join(" ");
    return { "aria-invalid": state.field === f, "aria-describedby": ids || undefined };
  };
  const fieldError = (f: CampaignField) =>
    state.field === f ? <span className="err" id={`${f}-err`} role="alert">{state.error}</span> : null;
  // An error that isn't about one field, shown next to the button that was pressed.
  const generalError = (intents: Intent[]) =>
    state.error && !state.field && state.intent && intents.includes(state.intent) ? (
      <p className="err" role="alert">{state.error}</p>
    ) : null;

  return (
    <div className="form-stack" ref={pageRef}>
      <form
        className="card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run("save");
        }}
      >
        <h2>Mensagem</h2>
        <label htmlFor="name">
          Nome da campanha
          <input
            id="name"
            type="text"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            required
            {...described("name", "name-hint")}
          />
          <span className="hint" id="name-hint">Só para si. Os clientes não o veem.</span>
          {fieldError("name")}
        </label>
        <label htmlFor="sms_text">
          Texto do SMS
          <textarea
            id="sms_text"
            ref={messageRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setConfirming(false);
            }}
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

        <div className="preview" style={{ marginBottom: 0 }}>
          <p className="preview-title">
            {previewClient ? `Pré-visualização para ${previewClient.name}` : "Pré-visualização"}
          </p>
          <p className="meta" style={{ whiteSpace: "pre-wrap" }}>{preview}</p>
        </div>
      </form>

      <div className="card">
        <h2>Vale</h2>
        <label className="check" htmlFor="with_vale">
          <input
            id="with_vale"
            type="checkbox"
            checked={withVale}
            onChange={(e) => {
              setWithVale(e.target.checked);
              setConfirming(false);
            }}
            aria-describedby="with_vale-hint"
          />
          <span>Incluir um vale para cada cliente</span>
        </label>
        <p className="hint" id="with_vale-hint" style={{ marginTop: "calc(var(--sp-8) * -1)", marginBottom: withVale ? "var(--sp-24)" : 0 }}>
          Cada cliente recebe um vale novo; {"{vale}"} passa a ser o código dele.
        </p>

        {withVale ? (
          <>
            <div role="radiogroup" aria-label="Tipo de desconto">
              <label className="check" htmlFor="type-percent">
                <input id="type-percent" type="radio" checked={discountType === "percent"} onChange={() => setDiscountType("percent")} />
                <span>Percentagem (%)</span>
              </label>
              <label className="check" htmlFor="type-amount">
                <input id="type-amount" type="radio" checked={discountType === "amount"} onChange={() => setDiscountType("amount")} />
                <span>Valor em euros (€)</span>
              </label>
            </div>
            <label htmlFor="value">
              {discountType === "percent" ? "Percentagem de desconto" : "Valor do desconto em euros"}
              <input
                id="value"
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                {...described("value", "value-hint")}
              />
              <span className="hint" id="value-hint">{discountType === "percent" ? "Um número de 1 a 100." : "Maior que zero; pode ter cêntimos."}</span>
              {fieldError("value")}
            </label>
            <label htmlFor="valid-from">
              Válido a partir de
              <DateInput
                id="valid-from"
                name="valid_from"
                defaultValue={validFrom}
                hint="Primeiro dia em que o vale pode ser usado."
                error={state.field === "valid_from" ? state.error : undefined}
                onChange={setValidFrom}
                required
              />
            </label>
            <label htmlFor="valid-to" style={{ marginBottom: 0 }}>
              Válido até
              <DateInput
                id="valid-to"
                name="valid_to"
                defaultValue={validTo}
                hint="Último dia em que o vale pode ser usado."
                error={orderError ?? (state.field === "valid_to" ? state.error : undefined)}
                onChange={setValidTo}
                required
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="card">
        <h2>Datas</h2>
        <label htmlFor="starts-on">
          Início
          <DateInput
            id="starts-on"
            name="starts_on"
            defaultValue={startsOn}
            hint="Dia em que é enviada a todos os clientes. Se for depois de hoje, é enviada nesse dia às 10h."
            error={startError ?? (state.field === "starts_on" ? state.error : undefined)}
            onChange={(text) => {
              setStartsOn(text);
              setConfirming(false);
            }}
            required
          />
        </label>
        <label htmlFor="live-until" style={{ marginBottom: 0 }}>
          Fim
          <DateInput
            key={liveTyped ? liveKey : `suggested-${suggestedLiveUntil}`}
            id="live-until"
            name="live_until"
            defaultValue={liveUntilText}
            hint="Último dia da campanha. Se o envio parar a meio, os clientes que faltam recebem-na às 10h até este dia."
            error={liveError ?? (state.field === "live_until" ? state.error : undefined)}
            onChange={(text) => {
              if (!liveTyped) {
                setLiveKey(`suggested-${suggestedLiveUntil}`);
                setLiveTyped(true);
              }
              setLiveUntil(text);
              setConfirming(false);
            }}
            required
          />
        </label>
      </div>

      <form
        className="card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run("test");
        }}
      >
        <h2>Enviar teste</h2>
        <label htmlFor="phone">
          Número para o teste
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="off"
            required
            {...described("phone", "phone-hint")}
          />
          <span className="hint" id="phone-hint">Número de 9 dígitos. Só este número recebe o teste.</span>
          {fieldError("phone")}
        </label>
        {generalError(["test"])}
        {state.ok && state.intent === "test" ? <p className="notice" role="status">{state.ok}</p> : null}
        <div className="actions">
          <button type="submit" className="btn" disabled={pending}>
            {busy("test") ? "A enviar…" : "Enviar teste"}
          </button>
        </div>
      </form>

      <div className="card">
        <h2>Enviar campanha</h2>
        <p className="name">
          {sendable.length} {sendable.length === 1 ? "cliente vai receber" : "clientes vão receber"} esta mensagem.
        </p>
        <p className="meta" style={{ marginBottom: "var(--sp-16)" }}>
          Só os clientes que recebem mensagens e já existem: quem for adicionado depois de a campanha ser criada não a
          recebe.
          {invalidCount > 0
            ? ` ${invalidCount} ${invalidCount === 1 ? "tem" : "têm"} um número inválido e ${invalidCount === 1 ? "fica" : "ficam"} de fora.`
            : ""}
          {later ? " Contados hoje." : ""}
        </p>
        {generalError(["save", "send"])}

        {confirming ? (
          <div className="preview" role="region" aria-labelledby="confirm-send-title">
            <p className="preview-title" id="confirm-send-title" ref={confirmTitleRef} tabIndex={-1}>
              Tem a certeza?
            </p>
            <ul className="summary">
              <li>
                {sendable.length} {sendable.length === 1 ? "cliente vai receber" : "clientes vão receber"} esta mensagem
              </li>
              <li>
                {partsPerMessage} SMS por mensagem, cerca de {totalParts} SMS no total
              </li>
              {withVale ? (
                <li>
                  Cada um recebe um vale de {discountText}
                  {validFromIso && validToIso ? `, válido de ${formatDate(validFromIso)} a ${formatDate(validToIso)}` : ""}
                </li>
              ) : null}
              {later && startsOnIso ? <li>Vai ser enviada a {formatDate(startsOnIso)}, às 10h</li> : null}
              <li>Clientes adicionados depois de a campanha ser criada não a recebem</li>
              <li>Não é possível desfazer.</li>
            </ul>
          </div>
        ) : null}

        <div className="actions">
          {confirming ? (
            <>
              <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={pending}>
                Cancelar
              </button>
              <button type="button" className="btn primary" onClick={() => run("send")} disabled={pending}>
                {busy("send") ? (later ? "A agendar…" : "A enviar…") : later ? "Confirmar agendamento" : "Confirmar envio"}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={() => run("save")} disabled={pending}>
                {busy("save") ? "A guardar…" : "Guardar rascunho"}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={pending || sendable.length === 0}
                onClick={() => setConfirming(true)}
              >
                {later ? "Agendar campanha" : "Enviar campanha"}
              </button>
            </>
          )}
        </div>
        {busy("send") && !later ? (
          <p className="meta" role="status" style={{ marginTop: "var(--sp-16)" }}>
            A enviar em grupos de 10. Não feche esta página.
          </p>
        ) : null}
      </div>

      <p className="meta">
        <Link className="navlink" href="/campaigns/log">Ver histórico de envios</Link>
      </p>
    </div>
  );
}
