import { describe, expect, it } from "vitest";
import { sourceLabel, statusTagClass } from "./labels";

describe("sourceLabel", () => {
  it("names where an SMS came from", () => {
    expect(sourceLabel({ is_test: true, kind: null, campaigns: { name: "Natal" } })).toBe("Teste");
    expect(sourceLabel({ is_test: false, kind: null, campaigns: { name: "Natal" } })).toBe("Natal");
    expect(sourceLabel({ is_test: false, kind: "welcome", campaigns: null })).toBe("Boas-vindas");
    expect(sourceLabel({ is_test: false, kind: null, campaigns: null })).toBe("Vale");
  });
});

describe("statusTagClass", () => {
  it("is green only for a sent SMS, red when it didn't (or may not have) gone out", () => {
    expect(statusTagClass("sent")).toBe("tag on");
    expect(statusTagClass("simulated")).toBe("tag");
    for (const s of ["failed", "skipped", "sending"]) expect(statusTagClass(s)).toBe("tag warn");
  });
});
