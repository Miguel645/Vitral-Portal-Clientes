import { describe, expect, it } from "vitest";
import { consentedByFirstSend } from "./audience";

const firstSent = "2026-11-01T10:00:00Z";

describe("consentedByFirstSend", () => {
  it("includes clients who already received messages at the first send", () => {
    expect(consentedByFirstSend({ consent_at: "2026-10-01T09:00:00Z" }, firstSent)).toBe(true);
    // Consented before consent dates were recorded.
    expect(consentedByFirstSend({ consent_at: null }, firstSent)).toBe(true);
  });

  it("leaves out clients who switched messages on later", () => {
    expect(consentedByFirstSend({ consent_at: "2026-11-05T12:00:00Z" }, firstSent)).toBe(false);
  });
});
