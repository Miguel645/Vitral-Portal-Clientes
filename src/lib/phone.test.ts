import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("turns a 9-digit Portuguese mobile into +351", () => {
    expect(normalizePhone("912345678")).toEqual({ ok: true, value: "+351912345678" });
  });

  it("ignores spaces and other separators", () => {
    expect(normalizePhone(" 912 345 678 ")).toEqual({ ok: true, value: "+351912345678" });
    expect(normalizePhone("912-345-678")).toEqual({ ok: true, value: "+351912345678" });
  });

  it("keeps international numbers that start with +", () => {
    expect(normalizePhone("+351 912 345 678")).toEqual({ ok: true, value: "+351912345678" });
    expect(normalizePhone("+44 7700 900123")).toEqual({ ok: true, value: "+447700900123" });
  });

  it("rejects numbers SMS can't reach", () => {
    expect(normalizePhone("").ok).toBe(false);
    expect(normalizePhone("212345678").ok).toBe(false); // landline
    expect(normalizePhone("91234567").ok).toBe(false); // 8 digits
    expect(normalizePhone("9123456789").ok).toBe(false); // 10 digits
    expect(normalizePhone("+1234").ok).toBe(false); // too short
  });
});
