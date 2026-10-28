// Brevo error codes (the `code` in the error reply) turned into short Portuguese
// messages that say what to do next. They're saved in the log.
const MESSAGES: Record<string, string> = {
  not_enough_credits: "A conta Brevo não tem créditos de SMS. Compre créditos no Brevo e tente novamente.",
  account_under_validation:
    "A conta Brevo ainda está a ser validada pelo Brevo. Espere pela confirmação deles e tente novamente.",
  unauthorized: "O Brevo recusou a chave. Verifique o BREVO_API_KEY nas definições do Vercel.",
  permission_denied:
    "A conta Brevo não tem permissão para enviar SMS. Verifique no Brevo se o envio de SMS está ativo para a conta.",
  invalid_parameter:
    "O Brevo recusou o pedido: verifique o número do cliente e o BREVO_SMS_SENDER (até 11 letras ou números, sem espaços).",
  missing_parameter: "Falta informação no pedido ao Brevo. Verifique o BREVO_SMS_SENDER nas definições do Vercel.",
};

export function brevoErrorMessage(status: number, code: string | undefined): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (status === 401) return MESSAGES.unauthorized;
  if (status === 402) return MESSAGES.not_enough_credits;
  if (status === 429) return "Demasiadas mensagens ao mesmo tempo. Espere um minuto e tente novamente.";
  return `O Brevo não enviou o SMS (erro ${code ?? status}). Tente novamente mais tarde.`;
}
