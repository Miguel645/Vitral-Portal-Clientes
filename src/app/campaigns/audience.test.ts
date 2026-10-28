import { describe, expect, it } from "vitest";
import { inLiveAudience } from "./audience";

const firstSent = "2026-11-01T10:00:00Z";

describe("inLiveAudience", () => {
  it("includes clients added after the first send", () => {
    expect(inLiveAudience({ created_at: "2026-11-02T09:00:00Z", consent_at: "2026-11-02T09:00:00Z" }, firstSent)).toBe(true);
  });

  it("includes older clients the first send didn't reach", () => {
    expect(inLiveAudience({ created_at: "2026-10-01T09:00:00Z", consent_at: "2026-10-01T09:00:00Z" }, firstSent)).toBe(true);
    // Consented before consent dates were recorded.
    expect(inLiveAudience({ created_at: "2026-09-01T09:00:00Z", consent_at: null }, firstSent)).toBe(true);
  });

  it("leaves out older clients who switched messages on later", () => {
    expect(inLiveAudience({ created_at: "2026-10-01T09:00:00Z", consent_at: "2026-11-05T12:00:00Z" }, firstSent)).toBe(false);
  });
});
