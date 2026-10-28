export const APP_URL_MISSING =
  "Falta o APP_URL nas definições do Vercel (o endereço do site, para o link de cancelamento no fim de cada SMS). Nenhuma SMS foi enviada. Adicione-o e tente novamente.";

// The base of the unsubscribe link added at the end of every SMS, or null when
// SMS_UNSUBSCRIBE_LINK=off removes the link (to save SMS credits while testing;
// marketing SMS to real clients need a way to opt out).
// Throws when the link is on but APP_URL is empty: every SMS would carry a broken link.
// Check appUrlError() first wherever SMS are sent.
export function unsubscribeBaseUrl(): string | null {
  if (process.env.SMS_UNSUBSCRIBE_LINK === "off") return null;
  const url = (process.env.APP_URL ?? "").trim();
  if (!url) throw new Error(APP_URL_MISSING);
  return url;
}

// The Portuguese message to show when the unsubscribe link can't be built, null when all is well.
export function appUrlError(): string | null {
  return process.env.SMS_UNSUBSCRIBE_LINK !== "off" && !(process.env.APP_URL ?? "").trim() ? APP_URL_MISSING : null;
}

// For previews only: never throws (the page shows appUrlError() instead).
export function previewBaseUrl(): string | null {
  return appUrlError() ? "" : unsubscribeBaseUrl();
}
