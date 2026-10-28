"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateUniqueCodes } from "@/lib/codes";
import { formatDiscount } from "@/lib/discount";
import { formatDate, INVALID_DATE, parseDisplayDate } from "@/lib/date";
import { isSimulation, sendSms } from "@/lib/messaging";
import { unsubscribeBaseUrl } from "@/lib/optOut";
import { safeBack } from "./status";
import { clientFirstName, composeValeMessage } from "@/lib/smsText";

// `field` names the form field the error is about, so it can be marked and read out with it.
export type CreateValesState = { error?: string; field?: "value" | "valid_from" | "valid_to" | "per_client" | "clients" | "sms_text" };

export async function createVales(_prev: CreateValesState, formData: FormData): Promise<CreateValesState> {
  const discountType = String(formData.get("discount_type") ?? "");
  const valueRaw = String(formData.get("value") ?? "").trim();
  const value = Number(valueRaw.replace(",", "."));
  // Typed as dd/mm/aaaa, stored as ISO dates.
  const validFrom = parseDisplayDate(String(formData.get("valid_from") ?? ""));
  const validTo = parseDisplayDate(String(formData.get("valid_to") ?? ""));
  const note = String(formData.get("note") ?? "").trim();
  const perClient = Number(String(formData.get("per_client") ?? "1"));
  const target = String(formData.get("target") ?? "");
  const pickedIds = new Set(formData.getAll("client_ids").map(String));
  const withSms = formData.get("send_sms") === "on";
  const smsText = String(formData.get("sms_text") ?? "").trim();

  if (discountType !== "percent" && discountType !== "amount") {
    return { error: "Escolha se o vale é uma percentagem ou um valor em euros." };
  }
  if (discountType === "percent" && (!valueRaw || !Number.isFinite(value) || value < 1 || value > 100)) {
    return {
      error: valueRaw ? "A percentagem tem de ser um número de 1 a 100." : "Escreva a percentagem de desconto.",
      field: "value",
    };
  }
  if (discountType === "amount" && (!valueRaw || !Number.isFinite(value) || value <= 0 || value > 10000)) {
    return {
      error: valueRaw ? "O valor tem de ser um número maior que zero." : "Escreva o valor do desconto em euros.",
      field: "value",
    };
  }
  if (!validFrom) return { error: INVALID_DATE, field: "valid_from" };
  if (!validTo) return { error: INVALID_DATE, field: "valid_to" };
  if (validFrom > validTo) {
    return { error: "A data “Válido até” tem de ser igual ou depois de “Válido a partir de”.", field: "valid_to" };
  }
  if (!Number.isInteger(perClient) || perClient < 1 || perClient > 10) {
    return { error: "Escreva quantos vales para cada cliente, de 1 a 10.", field: "per_client" };
  }
  if (target !== "pick" && target !== "all") {
    return { error: "Escolha para quem são os vales." };
  }
  if (target === "pick" && pickedIds.size === 0) {
    return { error: "Escolha pelo menos um cliente, ou escolha “Todos os clientes”.", field: "clients" };
  }
  if (withSms && !smsText) {
    return { error: "Escreva a mensagem do SMS.", field: "sms_text" };
  }
  if (withSms && !smsText.includes("{{codigo}}")) {
    return { error: "A mensagem tem de incluir {{codigo}}, para o cliente receber o código do vale.", field: "sms_text" };
  }

  const supabase = await createClient();
  const { data: allClients } = await supabase
    .from("clients")
    .select("id, name, phone, consent, short_token");
  const clients = (allClients ?? []).filter((c) => target === "all" || pickedIds.has(c.id));

  if (clients.length === 0) {
    return { error: "Não foi encontrado nenhum cliente. Atualize a página e tente novamente." };
  }

  const discount =
    discountType === "percent" ? { percent: value, amount_eur: null } : { percent: null, amount_eur: Math.round(value * 100) / 100 };

  const codes = await generateUniqueCodes(supabase, clients.length * perClient);
  const codesByClient = new Map<string, string[]>();
  const rows = clients.flatMap((c, i) => {
    const mine = codes.slice(i * perClient, (i + 1) * perClient);
    codesByClient.set(c.id, mine);
    return mine.map((code) => ({
      code,
      kind: "manual",
      ...discount,
      note: note || null,
      client_id: c.id,
      valid_from: validFrom,
      valid_to: validTo,
    }));
  });

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("discount_codes").insert(rows.slice(i, i + 500));
    if (error) {
      return {
        error:
          i === 0
            ? "Não foi possível criar os vales. Tente novamente."
            : `Só foram criados ${i} de ${rows.length} vales. Veja a lista de vales antes de tentar novamente.`,
      };
    }
  }

  let sent = 0;
  let failed = 0;
  let noConsent = 0;
  if (withSms) {
    const discountText = formatDiscount(discount);
    const appUrl = unsubscribeBaseUrl();
    for (const c of clients) {
      if (!c.consent) {
        noConsent++;
        continue;
      }
      const text = composeValeMessage(
        smsText,
        {
          firstName: clientFirstName(c.name),
          codes: codesByClient.get(c.id) ?? [],
          discount: discountText,
          validTo: formatDate(validTo),
        },
        appUrl,
        c.short_token
      );
      const result = await sendSms(c.phone, text, { clientId: c.id });
      if (result.ok) sent++;
      else failed++;
    }
  }

  const parts: string[] = [];
  if (rows.length === 1) {
    parts.push(`Vale ${rows[0].code} criado para ${clients[0].name}.`);
  } else {
    parts.push(
      `${rows.length} vales criados para ${clients.length} ${clients.length === 1 ? "cliente" : "clientes"}.`
    );
  }
  if (withSms) {
    const simulated = isSimulation();
    parts.push(
      `${sent} SMS ${simulated ? "simulados (modo de teste, nada foi enviado de verdade)" : "enviados"}.`
    );
    if (failed > 0) parts.push(`${failed} SMS falharam — veja o Histórico de envios, em Campanhas.`);
    if (noConsent > 0) {
      parts.push(
        `${noConsent} ${noConsent === 1 ? "cliente não recebe" : "clientes não recebem"} mensagens, por isso não ${noConsent === 1 ? "recebeu" : "receberam"} SMS (o vale fica na ficha do cliente).`
      );
    }
  }

  redirect(`/codes?message=${encodeURIComponent(parts.join(" "))}`);
}

export async function markCodeUsed(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = safeBack(String(formData.get("back") ?? ""));
  if (id) {
    const supabase = await createClient();
    await supabase.from("discount_codes").update({ used_at: new Date().toISOString() }).eq("id", id).is("used_at", null);
  }
  redirect(`${back}?message=${encodeURIComponent("Vale marcado como usado.")}`);
}

export async function deleteCode(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "");
  if (id) {
    const supabase = await createClient();
    await supabase.from("discount_codes").delete().eq("id", id);
  }
  redirect(`/codes?message=${encodeURIComponent(`Vale ${code} eliminado.`)}`);
}
