import type { SendResult } from "./types";

// How many SMS go out at the same time, and the pause between groups: gentle on the
// SMS provider, and still about 10 SMS a second.
export const GROUP_SIZE = 10;
const PAUSE_MS = 500;

export type GroupCounts = { ok: number; failed: number; skipped: number; reached: number; stopped: boolean };

// Sends to `items` in groups of 10. No new group starts after `deadline` (a time in ms),
// or once `shouldStop` says so (e.g. the campaign was stopped). `reached` = how many
// were attempted; the rest are for the next run.
export async function sendInGroups<T>(
  items: T[],
  deadline: number,
  send: (item: T) => Promise<SendResult>,
  shouldStop: () => Promise<boolean> = async () => false,
  pauseMs = PAUSE_MS
): Promise<GroupCounts> {
  const counts: GroupCounts = { ok: 0, failed: 0, skipped: 0, reached: 0, stopped: false };
  for (let i = 0; i < items.length; i += GROUP_SIZE) {
    if (Date.now() > deadline) break;
    if (await shouldStop()) {
      counts.stopped = true;
      break;
    }
    if (i > 0 && pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
    const group = items.slice(i, i + GROUP_SIZE);
    const results = await Promise.all(group.map(send));
    counts.reached += group.length;
    for (const r of results) {
      if (r.ok) counts.ok++;
      else if (r.status === "skipped") counts.skipped++;
      else counts.failed++;
    }
  }
  return counts;
}
