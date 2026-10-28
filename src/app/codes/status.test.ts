import { describe, expect, it } from "vitest";
import { codeStatus } from "./status";

const vale = { valid_from: "2026-10-01", valid_to: "2026-10-31", used_at: null };

describe("codeStatus", () => {
  it("is Ativo between the two dates, both days included", () => {
    expect(codeStatus(vale, "2026-10-01")).toEqual({ key: "active", label: "Ativo" });
    expect(codeStatus(vale, "2026-10-15").key).toBe("active");
    expect(codeStatus(vale, "2026-10-31").key).toBe("active");
  });

  it("is Por começar before the first day", () => {
    expect(codeStatus(vale, "2026-09-30")).toEqual({ key: "not_started", label: "Por começar" });
  });

  it("is Expirado after the last day", () => {
    expect(codeStatus(vale, "2026-11-01")).toEqual({ key: "expired", label: "Expirado" });
  });

  it("is Já usado once used, whatever the dates", () => {
    const used = { ...vale, used_at: "2026-10-10T10:00:00Z" };
    expect(codeStatus(used, "2026-10-15")).toEqual({ key: "used", label: "Já usado" });
    expect(codeStatus(used, "2026-12-01").key).toBe("used");
  });
});
