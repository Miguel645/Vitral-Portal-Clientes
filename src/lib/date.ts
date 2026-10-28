export function lisbonToday(): string {
  return lisbonDate(new Date());
}

// The day (ISO date) a moment falls on in Lisbon, e.g. a timestamp from the database.
export function lisbonDate(moment: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(moment));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// The hour (0-23) a moment falls on in Lisbon, summer time included.
export function lisbonHour(moment: Date | string = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(moment))
    .find((p) => p.type === "hour")!.value;
  return Number(hour);
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Is `today` the birthday of someone born on `birthDate` (both ISO dates)?
// Born on 29 February: 28 February in years that aren't leap years.
export function isBirthdayOn(birthDate: string, today: string): boolean {
  const [, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const day = bm === 2 && bd === 29 && !isLeapYear(ty) ? 28 : bd;
  return bm === tm && day === td;
}

export const INVALID_DATE = "Escreva uma data válida, no formato dd/mm/aaaa.";

// "25/12/2026" (or "2026-12-25") -> "2026-12-25". Null when it isn't a real date
// (e.g. 31/02/2026) or the year is outside 1900-2100.
export function parseDisplayDate(text: string): string | null {
  const t = text.trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ?? t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [d, mo, y] = t.includes("/") ? [m[1], m[2], m[3]].map(Number) : [m[3], m[2], m[1]].map(Number);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > daysInMonth) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// While typing a date: keep only digits and put the slashes in ("25122026" -> "25/12/2026").
// A slash typed after a single digit pads it ("1/5/" -> "01/05/").
export function formatDateTyping(raw: string): string {
  const groups = raw.split(/\D+/);
  const fromDigits = (digits: string) => {
    const d = digits.slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };
  if (groups.length === 1 || groups[0] === "" || groups[0].length > 2 || (groups[1] ?? "").length > 2) {
    return fromDigits(raw.replace(/\D/g, ""));
  }
  const day = groups[0].padStart(2, "0");
  if (groups.length === 2) return `${day}/${groups[1]}`;
  const month = groups[1].padStart(2, "0");
  return `${day}/${month}/${groups.slice(2).join("").slice(0, 4)}`;
}
