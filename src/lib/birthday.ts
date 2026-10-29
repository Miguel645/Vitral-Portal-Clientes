import { addDays, isBirthdayOn, lisbonDate } from "./date";

// How many days back the daily birthday job looks, so a day it didn't run (Vercel down,
// APP_URL missing…) is caught up on the next run instead of the birthday being lost.
export const BIRTHDAY_CATCH_UP_DAYS = 7;

// The birthday (ISO date) the job should give a vale for today: today, or the most
// recent birthday in the last 7 days. Only when the client already existed and already
// received messages on that day — what the job would have done had it run then.
// Null when there's none. (Whether they already got that year's vale is checked apart.)
export function birthdayToGive(
  client: { birth_date: string | null; created_at: string; consent_at: string | null },
  today: string
): string | null {
  if (!client.birth_date) return null;
  for (let i = 0; i < BIRTHDAY_CATCH_UP_DAYS; i++) {
    const day = addDays(today, -i);
    if (!isBirthdayOn(client.birth_date, day)) continue;
    if (lisbonDate(client.created_at) > day) return null;
    if (client.consent_at && lisbonDate(client.consent_at) > day) return null;
    return day;
  }
  return null;
}
