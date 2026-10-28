import { describe, expect, it } from "vitest";
import { isBirthdayOn, lisbonDate, parseDisplayDate } from "./date";

describe("parseDisplayDate", () => {
  it("turns dd/mm/aaaa into an ISO date", () => {
    expect(parseDisplayDate("25/12/2026")).toBe("2026-12-25");
    expect(parseDisplayDate(" 1/5/2026 ")).toBe("2026-05-01");
  });

  it("also accepts ISO dates", () => {
    expect(parseDisplayDate("2026-12-25")).toBe("2026-12-25");
  });

  it("rejects dates that don't exist", () => {
    expect(parseDisplayDate("31/02/2026")).toBeNull();
    expect(parseDisplayDate("29/02/2026")).toBeNull();
    expect(parseDisplayDate("00/01/2026")).toBeNull();
    expect(parseDisplayDate("01/13/2026")).toBeNull();
  });

  it("accepts 29 February in a leap year", () => {
    expect(parseDisplayDate("29/02/2028")).toBe("2028-02-29");
  });

  it("rejects other formats and years outside 1900-2100", () => {
    expect(parseDisplayDate("")).toBeNull();
    expect(parseDisplayDate("12-25-2026")).toBeNull();
    expect(parseDisplayDate("25/12/26")).toBeNull();
    expect(parseDisplayDate("01/01/1899")).toBeNull();
    expect(parseDisplayDate("01/01/2101")).toBeNull();
  });
});

describe("isBirthdayOn", () => {
  it("matches the same day and month, any year", () => {
    expect(isBirthdayOn("1990-06-15", "2026-06-15")).toBe(true);
    expect(isBirthdayOn("1990-06-15", "2026-06-16")).toBe(false);
    expect(isBirthdayOn("1990-06-15", "2026-07-15")).toBe(false);
  });

  it("counts 29 February as 28 February in years that aren't leap years", () => {
    expect(isBirthdayOn("2000-02-29", "2026-02-28")).toBe(true);
    expect(isBirthdayOn("2000-02-29", "2026-03-01")).toBe(false);
  });

  it("keeps 29 February in leap years", () => {
    expect(isBirthdayOn("2000-02-29", "2028-02-29")).toBe(true);
    expect(isBirthdayOn("2000-02-29", "2028-02-28")).toBe(false);
  });

  it("doesn't move someone born on 28 February", () => {
    expect(isBirthdayOn("2001-02-28", "2028-02-28")).toBe(true);
    expect(isBirthdayOn("2001-02-28", "2028-02-29")).toBe(false);
  });
});

describe("lisbonDate", () => {
  it("gives the Lisbon day of a database timestamp", () => {
    expect(lisbonDate("2026-10-28T10:00:00Z")).toBe("2026-10-28");
    // 23:30 UTC on 30 June is already 1 July in Lisbon (summer time, UTC+1).
    expect(lisbonDate("2026-06-30T23:30:00Z")).toBe("2026-07-01");
  });
});
