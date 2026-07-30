import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const ctxState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./context", () => ({ resolveActorContext: async () => ctxState.value }));

import { requireWritableSession, READ_ONLY_ERROR } from "./guards";

describe("requireWritableSession", () => {
  it("refuse quand aucune session n'est résolue", async () => {
    ctxState.value = null;
    expect(await requireWritableSession()).toBe(false);
  });

  it("refuse en mode lecture seule", async () => {
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "read", startedAt: new Date().toISOString() },
    };
    expect(await requireWritableSession()).toBe(false);
  });

  it("autorise en mode intervention (write)", async () => {
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "write", startedAt: new Date().toISOString() },
    };
    expect(await requireWritableSession()).toBe(true);
  });

  it("autorise hors impersonation (usage normal owner/staff/super_admin)", async () => {
    ctxState.value = {
      actor: { userId: "o1", name: "Awa", role: "owner" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: null,
    };
    expect(await requireWritableSession()).toBe(true);
  });

  it("expose un message d'erreur explicite invitant à activer le mode intervention", () => {
    expect(READ_ONLY_ERROR).toMatch(/mode intervention/i);
  });
});
