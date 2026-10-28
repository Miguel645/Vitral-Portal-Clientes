"use client";

import { useActionState, useMemo, useState } from "react";
import { createVales, type CreateValesState } from "./actions";
import { formatDiscount } from "@/lib/discount";
import { formatDate } from "@/lib/date";
import { clientFirstName, countSmsParts, renderValeTemplate, unsubscribeFooter } from "@/lib/smsText";

type Client = { id: string; name: string; phone: string; consent: boolean };

const DEFAULT_SMS =
  "Olá {{name}}! Tem um vale de {{desconto}} de desconto na Vitral. Código do vale: {{codigo}}. Válido até {{validade}}.";
const PREVIEW_CODES = ["ABCD2345", "EFGH6789", "JKLM2345", "NPQR6789", "STUV2345"];
const PREVIEW_TOKEN = "00000000-0000-0000-0000-000000000000";
const MAX_RESULTS = 50;

export default function NewValesForm({
  clients,
  preselectedId,
  today,
  defaultValidTo,
  appUrl,
}: {
  clients: Client[];
  preselectedId?: string;
  today: string;
  defaultValidTo: string;
  appUrl: string;
}) {
  const [state, formAction, pending] = useActionState<CreateValesState, FormData>(createVales, {});

  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [validFrom, setValidFrom] = useState(today);
  const [validTo, setValidTo] = useState(defaultValidTo);
  const [note, setNote] = useState("");
  const [perClient, setPerClient] = useState("1");
  const [target, setTarget] = useState<"pick" | "all">("pick");
  const [selected, setSelected] = useState<string[]>(
    preselectedId && clients.some((c) => c.id === preselectedId) ? [preselectedId] : []
  );
  const [search, setSearch] = useState("");
  const [withSms, setWithSms] = useState(true);
  const [smsText, setSmsText] = useState(DEFAULT_SMS);

  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const selectedClients = selected.map((id) => byId.get(id)).filter((c): c is Client => !!c);

  const term = search.trim().toLowerCase();
  const matches = term
    ? clients.filter((c) => c.name.toLowerCase().includes(term) || c.phone.replace(/\s/g, "").includes(term.replace(/\s/g, "")))
    : [];

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const targets = target === "all" ? clients : selectedClients;
  const perClientNum = Math.min(Math.max(Number(perClient) || 1, 1), 10);
  const valeCount = targets.length * perClientNum;
  const smsCount = withSms ? targets.filter((c) => c.consent).length : 0;
  const noConsentCount = withSms ? targets.length - smsCount : 0;

  const numericValue = Number(value.replace(",", "."));
  const discountText =
    Number.isFinite(numericValue) && numericValue > 0
      ? formatDiscount(discountType === "percent" ? { percent: numericValue, amount_eur: null } : { percent: null, amount_eur: numericValue })
      : discountType === "percent" ? "10%" : "5,00 €";

  const previewName = clientFirstName(targets[0]?.name ?? "Maria");
  const preview =
    renderValeTemplate(smsText, {
      firstName: previewName,
      codes: PREVIEW_CODES.slice(0, perClientNum),
      discount: discountText,
      validTo: validTo ? formatDate(validTo) : "",
    }) + unsubscribeFooter(appUrl, PREVIEW_TOKEN);
  const counter = countSmsParts(preview);

  return (
    <form action={formAction} className="form-stack">
      <div className="card">
        <h2>Desconto</h2>
        <label className="check">
          <input type="radio" name="discount_type" value="percent" checked={discountType === "percent"} onChange={() => setDiscountType("percent")} />
          <span>Percentagem (%)</span>
        </label>
        <label className="check">
          <input type="radio" name="discount_type" value="amount" checked={discountType === "amount"} onChange={() => setDiscountType("amount")} />
          <span>Valor em euros (€)</span>
        </label>
        <label>
          {discountType === "percent" ? "Percentagem de desconto" : "Valor do desconto em euros"}
          <input
            type="text"
            name="value"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={discountType === "percent" ? "Ex.: 10" : "Ex.: 5 ou 7,50"}
            required
          />
          <span className="hint">
            {discountType === "percent"
              ? "Um número entre 1 e 100. Exemplo: 10 dá 10% de desconto."
              : "Exemplo: 5 dá 5,00 € de desconto; 7,50 dá 7,50 €."}
          </span>
        </label>
        <label>
          Descrição (opcional)
          <input type="text" name="note" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Saldos de Natal" />
          <span className="hint">Só para si, aparece na lista de vales. Exemplo: “Cliente habitual” ou “Saldos de Natal”.</span>
        </label>
      </div>

      <div className="card">
        <h2>Validade</h2>
        <label>
          Válido a partir de
          <input type="date" name="valid_from" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
          <span className="hint">Normalmente hoje. Exemplo: {formatDate(today)}.</span>
        </label>
        <label>
          Válido até
          <input type="date" name="valid_to" value={validTo} onChange={(e) => setValidTo(e.target.value)} required />
          <span className="hint">Último dia em que o vale pode ser usado. Exemplo: {formatDate(defaultValidTo)}.</span>
        </label>
      </div>

      <div className="card">
        <h2>Para quem</h2>
        <label className="check">
          <input type="radio" name="target" value="pick" checked={target === "pick"} onChange={() => setTarget("pick")} />
          <span>Escolher clientes (um ou vários)</span>
        </label>
        <label className="check">
          <input type="radio" name="target" value="all" checked={target === "all"} onChange={() => setTarget("all")} />
          <span>Todos os clientes ({clients.length})</span>
        </label>

        {target === "pick" ? (
          <>
            {selectedClients.map((c) => (
              <input key={c.id} type="hidden" name="client_ids" value={c.id} />
            ))}

            {selectedClients.length > 0 ? (
              <>
                <p className="meta">Escolhidos ({selectedClients.length}):</p>
                <ul className="list" style={{ marginBottom: "var(--sp-24)" }}>
                  {selectedClients.map((c) => (
                    <li key={c.id} className="list-row">
                      <div>
                        <div className="name">{c.name}</div>
                        <div className="meta">{c.phone}</div>
                      </div>
                      <button type="button" className="btn" onClick={() => toggle(c.id)}>Tirar</button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <label>
              Procurar cliente
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex.: Maria ou 912345678"
                autoComplete="off"
              />
              <span className="hint">Procure pelo nome ou pelo telemóvel e marque os clientes que quer.</span>
            </label>

            {term && matches.length === 0 ? <p className="meta">Nenhum cliente encontrado para “{search.trim()}”.</p> : null}
            {matches.slice(0, MAX_RESULTS).map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span>
                  {c.name} — {c.phone}
                  {!c.consent ? <span className="meta"> · Não recebe mensagens</span> : null}
                </span>
              </label>
            ))}
            {matches.length > MAX_RESULTS ? (
              <p className="meta">Mostrando {MAX_RESULTS} de {matches.length}. Escreva mais para encontrar o cliente.</p>
            ) : null}
          </>
        ) : null}

        <label>
          Quantos vales para cada cliente?
          <input
            type="number"
            name="per_client"
            min="1"
            max="10"
            inputMode="numeric"
            value={perClient}
            onChange={(e) => setPerClient(e.target.value)}
            required
          />
          <span className="hint">Normalmente 1. Exemplo: 2 dá dois vales diferentes a cada cliente.</span>
        </label>
      </div>

      <div className="card">
        <h2>SMS</h2>
        <label className="check">
          <input type="checkbox" name="send_sms" checked={withSms} onChange={(e) => setWithSms(e.target.checked)} />
          <span>Enviar SMS com o código do vale</span>
        </label>
        {withSms ? (
          <>
            <label>
              Mensagem
              <textarea name="sms_text" value={smsText} onChange={(e) => setSmsText(e.target.value)} rows={4} required />
              <span className="hint">
                {"{{name}}"} = primeiro nome, {"{{codigo}}"} = código do vale (obrigatório), {"{{desconto}}"} = ex.
                “10%”, {"{{validade}}"} = ex. “{formatDate(defaultValidTo)}”. O link para deixar de receber mensagens é
                adicionado no fim.
              </span>
            </label>
            <p className="meta">
              {counter.length} carateres · {counter.parts} SMS {counter.parts === 1 ? "parte" : "partes"} por cliente
            </p>
            <div className="card">
              <h2>Pré-visualização</h2>
              <p className="meta" style={{ whiteSpace: "pre-wrap" }}>{preview}</p>
            </div>
          </>
        ) : (
          <p className="meta">Os vales ficam na ficha de cada cliente. Pode dar o código ao cliente pessoalmente.</p>
        )}
      </div>

      <div className="card">
        <p className="name">
          {valeCount === 0
            ? "Ainda não escolheu nenhum cliente."
            : `Vai criar ${valeCount} ${valeCount === 1 ? "vale" : "vales"} para ${targets.length} ${targets.length === 1 ? "cliente" : "clientes"}.`}
        </p>
        {withSms && targets.length > 0 ? (
          <p className="meta">
            {smsCount} {smsCount === 1 ? "cliente vai receber" : "clientes vão receber"} SMS.
            {noConsentCount > 0
              ? ` ${noConsentCount} ${noConsentCount === 1 ? "não recebe" : "não recebem"} mensagens e não ${noConsentCount === 1 ? "vai receber" : "vão receber"} SMS.`
              : ""}
          </p>
        ) : null}
        {state.error ? <p className="err" role="alert">{state.error}</p> : null}
        <div className="actions">
          <button type="submit" className="btn primary" disabled={pending || valeCount === 0}>
            {pending ? "A criar…" : withSms ? "Criar e enviar vales" : "Criar vales"}
          </button>
        </div>
      </div>
    </form>
  );
}
