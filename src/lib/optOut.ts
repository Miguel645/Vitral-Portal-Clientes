// The base of the unsubscribe link added at the end of every SMS, or null when
// SMS_UNSUBSCRIBE_LINK=off removes the link (to save SMS credits while testing;
// marketing SMS to real clients need a way to opt out).
export function unsubscribeBaseUrl(): string | null {
  return process.env.SMS_UNSUBSCRIBE_LINK === "off" ? null : (process.env.APP_URL ?? "");
}
