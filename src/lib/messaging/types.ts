// What ends up in sms_log.status. Shown in Portuguese as Simulado / Enviado / Falhou / Ignorado.
export type SendStatus = "simulated" | "sent" | "failed" | "skipped";

// `providerId` is the provider's own id for the message (Twilio's "SM…"), null when
// nothing was sent. `error` is a short Portuguese explanation, null when it worked.
export type SendResult = { ok: boolean; status: SendStatus; providerId: string | null; error: string | null };

// One way of delivering an SMS. Pages never use a provider directly, only sendSms().
export interface SmsProvider {
  // The status logged when `send` works ("simulated" for the simulation, "sent" for a real provider).
  okStatus: SendStatus;
  send(to: string, text: string): Promise<{ ok: true; providerId: string | null } | { ok: false; error: string }>;
}
