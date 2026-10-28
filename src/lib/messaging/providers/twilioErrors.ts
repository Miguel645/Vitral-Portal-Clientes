// Twilio error codes (https://www.twilio.com/docs/api/errors) turned into short
// Portuguese messages that say what to do next. They're saved in the log.
const MESSAGES: Record<number, string> = {
  21608:
    "Conta Twilio de teste: este número ainda não foi verificado. Adicione-o no Twilio (Verified Caller IDs) ou passe a conta a paga.",
  21211: "Número de telemóvel inválido. Verifique o número na ficha do cliente.",
  21614: "Este número não é de telemóvel, por isso não recebe SMS.",
  21408: "O Twilio ainda não pode enviar SMS para este país. Ative o país no Twilio (Messaging > Geo permissions).",
  21612: "O Twilio não consegue entregar SMS a este número.",
  21610: "Este número pediu ao Twilio para não receber SMS.",
  21606: "O remetente (TWILIO_SMS_SENDER) não pode enviar SMS. Verifique-o nas definições do Vercel.",
  21212: "O remetente (TWILIO_SMS_SENDER) não é válido. Verifique-o nas definições do Vercel.",
  21659: "O remetente (TWILIO_SMS_SENDER) não pertence a esta conta Twilio. Verifique-o nas definições do Vercel.",
  21660: "O remetente (TWILIO_SMS_SENDER) não pertence a esta conta Twilio. Verifique-o nas definições do Vercel.",
  21617: "A mensagem é demasiado longa. Encurte o texto.",
  20003:
    "O Twilio recusou o acesso. Verifique o TWILIO_ACCOUNT_SID e o TWILIO_AUTH_TOKEN, e se a conta ainda tem saldo.",
  20005: "A conta Twilio está suspensa ou sem saldo. Carregue saldo no Twilio e tente novamente.",
  10001: "A conta Twilio está suspensa ou sem saldo. Carregue saldo no Twilio e tente novamente.",
  30002: "A conta Twilio está suspensa ou sem saldo. Carregue saldo no Twilio e tente novamente.",
  20429: "Demasiadas mensagens ao mesmo tempo. Espere um minuto e tente novamente.",
};

export function twilioErrorMessage(err: unknown): string {
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  if (typeof code === "number") {
    return MESSAGES[code] ?? `O Twilio não enviou o SMS (erro ${code}). Tente novamente mais tarde.`;
  }
  return "Não foi possível falar com o Twilio. Tente novamente daqui a alguns minutos.";
}
