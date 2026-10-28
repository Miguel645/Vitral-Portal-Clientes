"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createVales, type CreateValesState } from "./actions";
import { formatDiscount } from "@/lib/discount";
import { formatDate } from "@/lib/date";
import { clientFirstName, countSmsParts, renderValeTemplate } from "@/lib/smsText";

type Client = { id: string; name: string; phone: string; consent: boolean };

// The default message follows "Quantos vales para cada cliente?" (singular/plural),
// as long as the owner hasn't edited it by hand.
function defaultSms(count: number): string {
  return count > 1
    ? `Olá {{name}}! Tem ${count} vales de {{desconto}} de desconto na Vitral. Códigos dos vales: {{codigo}}. Válidos até {{validade}}.`
    : "Olá {{name}}! Tem um vale de {{desconto}} de desconto na Vitral. Código do vale: {{codigo}}. Válido até {{validade}}.";
}
const PREVIEW_CODES = ["ABCD2345", "EFGH6789", "JKLM2345", "NPQR6789", "STUV2345", "WXYZ6789", "ABCD6789", "EFGH2345", "JKLM6789", "NPQR2345"];
const MAX_RESULTS = 20;

function clampPerClient(v: string): number {
  return Math.min(Math.max(Number(v) || 1, 1), 10);
}

export default function NewValesForm({
  clients,
  preselectedId,
  today,
  defaultValidTo,
}: {
  clients: Client[];
  preselectedId?: string;
  today: string;
  defaultValidTo: string;
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
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const comboRef = useRef<HTMLDivElement>(null);
  const [withSms, setWithSms] = useState(true);
  const [smsText, setSmsText] = useState(defaultSms(1));

  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const selectedClients = selected.map((id) => byId.get(id)).filter((c): c is Client => !!c);

  const term = search.trim().toLowerCase();
  const matches = term
    ? clients.filter(
        (c) =>
          !selected.includes(c.id) &&
          (c.name.toLowerCase().includes(term) || c.phone.replace(/\s/g, "").includes(term.replace(/\s/g, "")))
      )
    : [];
  const shown = matches.slice(0, MAX_RESULTS);
  const showDropdown = open && term !== "";

  // Close the dropdown when tapping/clicking anywhere outside it.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function remove(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function pick(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSearch("");
    setOpen(false);
    setHighlight(0);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      // Never submit the whole form from the search box.
      e.preventDefault();
      if (showDropdown && shown[highlight]) pick(shown[highlight].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function onPerClientChange(v: string) {
    if (smsText === defaultSms(clampPerClient(perClient))) setSmsText(defaultSms(clampPerClient(v)));
    setPerClient(v);
  }

  const targets = target === "all" ? clients : selectedClients;
  const perClientNum = clampPerClient(perClient);
  const valeCount = targets.length * perClientNum;
  const smsCount = withSms ? targets.filter((c) => c.consent).length : 0;
  const noConsentCount = withSms ? targets.length - smsCount : 0;

  const numericValue = Number(value.replace(",", "."));
  const discountText =
    Number.isFinite(numericValue) && numericValue > 0
      ? formatDiscount(discountType === "percent" ? { percent: numericValue, amount_eur: null } : { percent: null, amount_eur: numericValue })
      : discountType === "percent" ? "10%" : "5,00 €";

  const previewName = clientFirstName(targets[0]?.name ?? "Maria");
  const preview = renderValeTemplate(smsText, {
    firstName: previewName,
    codes: PREVIEW_CODES.slice(0, perClientNum),
    discount: discountText,
    validTo: validTo ? formatDate(validTo) : "",
  });
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
            required
          />
          <span className="hint">{discountType === "percent" ? "Um número de 1 a 100." : "O valor em euros."}</span>
        </label>
        <label>
          Descrição (opcional)
          <input type="text" name="note" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
          <span className="hint">Só para si. Não aparece na SMS.</span>
        </label>
      </div>

      <div className="card">
        <h2>Validade</h2>
        <label>
          Válido a partir de
          <input type="date" name="valid_from" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
          <span className="hint">Primeiro dia em que o vale pode ser usado.</span>
        </label>
        <label>
          Válido até
          <input type="date" name="valid_to" value={validTo} onChange={(e) => setValidTo(e.target.value)} required />
          <span className="hint">Último dia em que o vale pode ser usado.</span>
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
                      <button type="button" className="btn" onClick={() => remove(c.id)}>Tirar</button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="combo" ref={comboRef}>
              <label htmlFor="client-search">Procurar cliente</label>
              <div className="combo-box">
                <input
                  id="client-search"
                  type="search"
                  role="combobox"
                  aria-expanded={showDropdown}
                  aria-controls="client-options"
                  aria-autocomplete="list"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOpen(true);
                    setHighlight(0);
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Nome ou telemóvel"
                  autoComplete="off"
                />
                {showDropdown ? (
                  <ul id="client-options" role="listbox" className="combo-list">
                    {shown.length === 0 ? (
                      <li className="combo-empty">Nenhum cliente encontrado.</li>
                    ) : (
                      shown.map((c, i) => (
                        <li key={c.id} role="option" aria-selected={i === highlight}>
                          <button
                            type="button"
                            className={i === highlight ? "combo-option active" : "combo-option"}
                            onMouseEnter={() => setHighlight(i)}
                            onClick={() => pick(c.id)}
                          >
                            <span className="name">{c.name}</span>
                            <span className="meta">
                              {c.phone}
                              {!c.consent ? " · Não recebe mensagens" : ""}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                    {matches.length > MAX_RESULTS ? (
                      <li className="combo-empty">Escreva mais para ver os outros {matches.length - MAX_RESULTS}.</li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
              <span className="hint">Escreva o nome ou o telemóvel e toque no cliente.</span>
            </div>
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
            onChange={(e) => onPerClientChange(e.target.value)}
            required
          />
          <span className="hint">De 1 a 10.</span>
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
                {"{{name}}"} = primeiro nome, {"{{codigo}}"} = código do vale (obrigatório), {"{{desconto}}"} = desconto,
                {"{{validade}}"} = data final.
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
