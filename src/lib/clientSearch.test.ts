import { describe, expect, it } from "vitest";
import { clientSearchFilter, matchesClientSearch } from "./clientSearch";

const maria = { name: "Maria Silva", phone: "912 345 678", email: "maria@mail.pt" };

describe("clientSearchFilter", () => {
  it("is null for an empty search", () => {
    expect(clientSearchFilter("  ")).toBeNull();
  });

  it("searches from a single letter or digit", () => {
    expect(clientSearchFilter("m")).toBe(`name.ilike."%m%",email.ilike."%m%"`);
    expect(clientSearchFilter("9")).toContain("phone.imatch.9");
  });
});

describe("matchesClientSearch", () => {
  it("matches the name or email, ignoring capitals", () => {
    expect(matchesClientSearch(maria, "SIL")).toBe(true);
    expect(matchesClientSearch(maria, "mail.pt")).toBe(true);
    expect(matchesClientSearch(maria, "joana")).toBe(false);
  });

  it("matches phone digits, ignoring spaces", () => {
    expect(matchesClientSearch(maria, "2345")).toBe(true);
    expect(matchesClientSearch(maria, "912 34")).toBe(true);
    expect(matchesClientSearch(maria, "999")).toBe(false);
  });

  it("matches everything for an empty search", () => {
    expect(matchesClientSearch(maria, "")).toBe(true);
  });
});
