// GSM 03.38 7-bit alphabet (basic + extension table). Any character outside
// this set forces the whole SMS into UCS-2 encoding, which cuts the
// per-segment limit from 160 to 70 characters. Portuguese accents like
// ã, õ, á, â, ê, ô, ç are NOT in this set, so they trigger that switch.
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€";
const GSM7_SET = new Set([...GSM7_BASIC, ...GSM7_EXTENDED]);

export function isGsm7(text: string): boolean {
  return [...text].every((ch) => GSM7_SET.has(ch));
}

export function countSmsParts(text: string): { length: number; gsm7: boolean; segmentSize: number; parts: number } {
  const length = [...text].length;
  const gsm7 = isGsm7(text);
  const segmentSize = gsm7 ? 160 : 70;
  const parts = length === 0 ? 0 : Math.ceil(length / segmentSize);
  return { length, gsm7, segmentSize, parts };
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

export function unsubscribeFooter(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `\nPara deixar de receber mensagens: ${base}/u/${token}`;
}

export function composeMessage(template: string, firstName: string, appUrl: string, token: string): string {
  return renderTemplate(template, firstName) + unsubscribeFooter(appUrl, token);
}
