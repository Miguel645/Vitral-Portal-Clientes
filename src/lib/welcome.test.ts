import { readFileSync } from "fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWelcome, welcomeAction, type WelcomeClient, type WelcomeSettings } from "./welcome";
import type { SendResult } from "./messaging/types";

// Just enough of the Supabase client for sendWelcome: update/insert with
// eq/is filters, applied to rows kept in memory.
function fakeDb(tables: Record<string, Record<string, unknown>[]>, opts: { failInsert?: boolean } = {}) {
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let op: { kind: "update"; values: Record<string, unknown> } | { kind: "insert"; row: Record<string, unknown> };
    const run = () => {
      if (op.kind === "insert") {
        if (opts.failInsert) return { data: null, error: { message: "insert failed" } };
        rows.push(op.row);
        return { data: null, error: null };
      }
      const matched = rows.filter((r) => filters.every((f) => f(r)));
      for (const r of matched) Object.assign(r, op.kind === "update" ? op.values : {});
      return { data: matched.map((r) => ({ id: r.id })), error: null };
    };
    const builder = {
      update(values: Record<string, unknown>) {
        op = { kind: "update", values };
        return builder;
      },
      insert(row: Record<string, unknown>) {
        op = { kind: "insert", row };
        return builder;
      },
      eq(col: string, v: unknown) {
        filters.push((r) => r[col] === v);
        return builder;
      },
      is(col: string, v: unknown) {
        filters.push((r) => (r[col] ?? null) === v);
        return builder;
      },
      select() {
        return builder;
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

const settings: WelcomeSettings = {
  active: true,
  sms_text: "Ola {nome}!",
  vale_percent: null,
  vale_amount_eur: null,
  vale_valid_days: null,
};
const withVale: WelcomeSettings = { ...settings, sms_text: "Ola {nome}! Vale: {vale}", vale_percent: 10, vale_valid_days: 30 };

function newClient(over: Partial<WelcomeClient> = {}): WelcomeClient {
  return { id: "c1", name: "Ana Silva", phone: "912345678", consent: true, short_token: "abcd1234", welcome_sent_at: null, ...over };
}

const ok: SendResult = { ok: true, status: "simulated", providerId: null, error: null };

function deps(send = vi.fn(async () => ok)) {
  return { send, newCode: async () => "ABCD2345", today: "2026-10-28", appUrl: null };
}

describe("welcomeAction", () => {
  it("sends to a client who receives messages and was never welcomed", () => {
    expect(welcomeAction({ consent: true, welcome_sent_at: null }, { active: true })).toBe("send");
  });

  it("never sends again once welcome_sent_at is set", () => {
    expect(welcomeAction({ consent: true, welcome_sent_at: "2026-10-28T10:00:00Z" }, { active: true })).toBe("skip");
  });

  it("skips clients who don't receive messages", () => {
    expect(welcomeAction({ consent: false, welcome_sent_at: null }, { active: true })).toBe("skip");
  });

  it("only marks the client when welcome SMS are switched off", () => {
    expect(welcomeAction({ consent: true, welcome_sent_at: null }, { active: false })).toBe("mark");
    expect(welcomeAction({ consent: true, welcome_sent_at: null }, null)).toBe("mark");
  });
});

describe("sendWelcome: never twice", () => {
  it("sends once, even when two saves run at the same time", async () => {
    const client = newClient();
    const db = fakeDb({ clients: [{ ...client }] });
    const d = deps();
    const results = await Promise.all([sendWelcome(db, client, settings, d), sendWelcome(db, client, settings, d)]);
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.status).sort()).toEqual(["already", "sent"]);
  });

  it("does not send again on a later save", async () => {
    const client = newClient();
    const db = fakeDb({ clients: [{ ...client }] });
    const d = deps();
    await sendWelcome(db, client, settings, d);
    await sendWelcome(db, client, settings, d);
    expect(d.send).toHaveBeenCalledTimes(1);
  });

  it("keeps the claim when the SMS fails, so it's never retried", async () => {
    const client = newClient();
    const clients = [{ ...client }];
    const db = fakeDb({ clients });
    const send = vi.fn(async (): Promise<SendResult> => ({ ok: false, status: "failed", providerId: null, error: "Sem saldo." }));
    const result = await sendWelcome(db, client, settings, deps(send));
    expect(result).toEqual({ status: "failed", error: "Sem saldo." });
    expect(clients[0].welcome_sent_at).not.toBeNull();
    expect((await sendWelcome(db, client, settings, deps(send))).status).toBe("already");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not send to a client who no longer receives messages", async () => {
    const client = newClient({ consent: false });
    const db = fakeDb({ clients: [{ ...client }] });
    const d = deps();
    expect((await sendWelcome(db, client, settings, d)).status).toBe("already");
    expect(d.send).not.toHaveBeenCalled();
  });
});

describe("sendWelcome: not for existing clients", () => {
  it("sends nothing to a client the migration marked as welcomed", async () => {
    const client = newClient({ welcome_sent_at: "2026-10-28T09:00:00Z" });
    const db = fakeDb({ clients: [{ ...client }] });
    const d = deps();
    expect((await sendWelcome(db, client, settings, d)).status).toBe("already");
    expect(d.send).not.toHaveBeenCalled();
  });

  it("the migration marks every client that exists when it runs, only when it adds the column", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/20261028_welcome_sms.sql", import.meta.url), "utf8");
    const block = sql.slice(sql.indexOf("if not exists"), sql.indexOf("end if;"));
    expect(block).toContain("alter table public.clients add column welcome_sent_at timestamptz;");
    expect(block).toMatch(/update public\.clients set welcome_sent_at = now\(\);/);
  });
});

describe("sendWelcome: vale", () => {
  it("creates the vale first and puts its code in the SMS", async () => {
    const client = newClient();
    const tables = { clients: [{ ...client }] as Record<string, unknown>[], discount_codes: [] as Record<string, unknown>[] };
    const d = deps();
    await sendWelcome(fakeDb(tables), client, withVale, d);
    expect(tables.discount_codes).toEqual([
      expect.objectContaining({
        code: "ABCD2345",
        kind: "manual",
        note: "Boas-vindas",
        percent: 10,
        client_id: "c1",
        valid_from: "2026-10-28",
        valid_to: "2026-11-27",
      }),
    ]);
    expect(d.send).toHaveBeenCalledWith("912345678", "Ola Ana! Vale: ABCD2345");
  });

  it("gives the claim back and sends nothing when the vale can't be created", async () => {
    const client = newClient();
    const clients = [{ ...client }];
    const d = deps();
    const result = await sendWelcome(fakeDb({ clients }, { failInsert: true }), client, withVale, d);
    expect(result.status).toBe("failed");
    expect(d.send).not.toHaveBeenCalled();
    expect(clients[0].welcome_sent_at).toBeNull();
  });
});
