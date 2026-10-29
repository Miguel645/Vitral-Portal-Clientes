import { describe, expect, it } from "vitest";
import { birthdayToGive } from "./birthday";

const old = { created_at: "2020-01-01T10:00:00Z", consent_at: null };

describe("birthdayToGive", () => {
  it("gives today's birthday", () => {
    expect(birthdayToGive({ ...old, birth_date: "1990-06-15" }, "2026-06-15")).toBe("2026-06-15");
  });

  it("catches up a birthday from the last 7 days", () => {
    expect(birthdayToGive({ ...old, birth_date: "1990-06-15" }, "2026-06-18")).toBe("2026-06-15");
    expect(birthdayToGive({ ...old, birth_date: "1990-06-15" }, "2026-06-21")).toBe("2026-06-15");
  });

  it("gives nothing for a birthday more than 7 days ago, or still to come", () => {
    expect(birthdayToGive({ ...old, birth_date: "1990-06-15" }, "2026-06-22")).toBeNull();
    expect(birthdayToGive({ ...old, birth_date: "1990-06-15" }, "2026-06-14")).toBeNull();
  });

  it("keeps the year of the birthday across New Year", () => {
    expect(birthdayToGive({ ...old, birth_date: "1990-12-31" }, "2027-01-02")).toBe("2026-12-31");
  });

  it("follows the 29 February rule", () => {
    expect(birthdayToGive({ ...old, birth_date: "2000-02-29" }, "2026-03-02")).toBe("2026-02-28");
    expect(birthdayToGive({ ...old, birth_date: "2000-02-29" }, "2028-03-02")).toBe("2028-02-29");
  });

  it("leaves out clients added after their birthday", () => {
    const added = { birth_date: "1990-06-15", created_at: "2026-06-17T09:00:00Z", consent_at: null };
    expect(birthdayToGive(added, "2026-06-18")).toBeNull();
  });

  it("counts a client added on the birthday itself", () => {
    const added = { birth_date: "1990-06-15", created_at: "2026-06-15T15:00:00Z", consent_at: null };
    expect(birthdayToGive(added, "2026-06-18")).toBe("2026-06-15");
  });

  it("leaves out clients who only switched messages on after their birthday", () => {
    const later = { birth_date: "1990-06-15", created_at: "2020-01-01T10:00:00Z", consent_at: "2026-06-16T09:00:00Z" };
    expect(birthdayToGive(later, "2026-06-18")).toBeNull();
  });

  it("gives nothing without a birth date", () => {
    expect(birthdayToGive({ ...old, birth_date: null }, "2026-06-15")).toBeNull();
  });
});
