import { describe, expect, it } from "vitest";
import { GROUP_SIZE, sendInGroups } from "./groups";
import type { SendResult } from "./types";

const ok: SendResult = { ok: true, status: "sent", providerId: "1", error: null };
const failed: SendResult = { ok: false, status: "failed", providerId: null, error: "x" };
const skipped: SendResult = { ok: false, status: "skipped", providerId: null, error: "x" };
const far = () => Date.now() + 60_000;

describe("sendInGroups", () => {
  it("sends to everyone and counts each result", async () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const sent: number[] = [];
    const counts = await sendInGroups(items, far(), async (i) => {
      sent.push(i);
      return i === 3 ? failed : i === 4 ? skipped : ok;
    }, undefined, 0);
    expect(sent.sort((a, b) => a - b)).toEqual(items);
    expect(counts).toEqual({ ok: 23, failed: 1, skipped: 1, reached: 25, stopped: false });
  });

  it("starts no new group after the deadline, and never sends anyone twice", async () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const sent: number[] = [];
    // Each SMS takes 60 ms and the deadline is 30 ms away: time runs out during the first group.
    const counts = await sendInGroups(items, Date.now() + 30, async (i) => {
      sent.push(i);
      await new Promise((r) => setTimeout(r, 60));
      return ok;
    }, undefined, 0);
    // Only the group already started went out.
    expect(counts.reached).toBe(GROUP_SIZE);
    expect(new Set(sent).size).toBe(sent.length);
  });

  it("sends nothing when the deadline has already passed", async () => {
    const counts = await sendInGroups([1, 2, 3], Date.now() - 1, async () => ok, undefined, 0);
    expect(counts).toEqual({ ok: 0, failed: 0, skipped: 0, reached: 0, stopped: false });
  });

  it("stops between groups when asked (e.g. the campaign was stopped)", async () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    let groups = 0;
    const counts = await sendInGroups(items, far(), async () => ok, async () => groups++ >= 1, 0);
    expect(counts.reached).toBe(GROUP_SIZE);
    expect(counts.stopped).toBe(true);
  });
});
