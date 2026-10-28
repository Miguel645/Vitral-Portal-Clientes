// GSM 03.38 7-bit alphabet (basic + extension table). Any character outside
// this set forces the whole SMS into UCS-2 encoding, which cuts the
// per-segment limit from 160 to 70 characters. In Portuguese, é, è, à, ù, ì, ò
// and Ç ARE in this set (no extra cost); á, ã, õ, ó, í, ú, â, ê, ô and ç are
// NOT, so they trigger that switch.
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€";
const GSM7_EXTENDED_SET = new Set([...GSM7_EXTENDED]);
const GSM7_SET = new Set([...GSM7_BASIC, ...GSM7_EXTENDED]);

export function isGsm7(text: string): boolean {
  return [...text].every((ch) => GSM7_SET.has(ch));
}

// The characters that force the expensive encoding, each listed once (e.g. ["ã", "ç"]).
export function nonGsm7Chars(text: string): string[] {
  return [...new Set([...text].filter((ch) => !GSM7_SET.has(ch)))];
}

// `length` is what the operator counts: in GSM-7, extension characters like € take
// two places; in UCS-2, emoji take two. One SMS holds 160 (GSM-7) or 70 (UCS-2);
// longer messages are split into parts of 153 or 67, because each part carries
// a small header to join them back together.
export function countSmsParts(text: string): { length: number; gsm7: boolean; segmentSize: number; parts: number } {
  const gsm7 = isGsm7(text);
  const length = gsm7 ? [...text].reduce((n, ch) => n + (GSM7_EXTENDED_SET.has(ch) ? 2 : 1), 0) : text.length;
  const single = gsm7 ? 160 : 70;
  const multi = gsm7 ? 153 : 67;
  const parts = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi);
  return { length, gsm7, segmentSize: parts > 1 ? multi : single, parts };
}

export function clientFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first || fullName;
}

export function renderTemplate(template: string, firstName: string): string {
  return template.split("{{name}}").join(firstName);
}

// Vale SMS: {{name}}, {{codigo}} (several codes are joined with commas),
// {{desconto}} ("10%" / "5,00 €") and {{validade}} (dd/mm/aaaa).
export function renderValeTemplate(
  template: string,
  v: { firstName: string; codes: string[]; discount: string; validTo: string }
): string {
  return renderTemplate(template, v.firstName)
    .split("{{codigo}}").join(v.codes.join(", "))
    .split("{{desconto}}").join(v.discount)
    .split("{{validade}}").join(v.validTo);
}

// Placeholder token for on-screen previews (the real one is per client).
export const PREVIEW_TOKEN = "00000000-0000-0000-0000-000000000000";

export function unsubscribeFooter(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `\nPara deixar de receber mensagens: ${base}/u/${token}`;
}

export function composeMessage(template: string, firstName: string, appUrl: string, token: string): string {
  return renderTemplate(template, firstName) + unsubscribeFooter(appUrl, token);
}

// Vale SMS get the same opt-out line as campaigns.
export function composeValeMessage(
  template: string,
  v: { firstName: string; codes: string[]; discount: string; validTo: string },
  appUrl: string,
  token: string
): string {
  return renderValeTemplate(template, v) + unsubscribeFooter(appUrl, token);
}
