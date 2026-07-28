import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ prisma: { platformAuditLog: { create: vi.fn() } } }));

import { recordPlatformAction } from "./audit";

interface CapturedCreate {
  data: Record<string, unknown>;
}

function fakeDb() {
  const calls: CapturedCreate[] = [];
  const db = {
    platformAuditLog: {
      create: async (args: CapturedCreate) => {
        calls.push(args);
        return {};
      },
    },
  };
  return { db, calls };
}

describe("recordPlatformAction", () => {
  it("écrit l'action avec son acteur et sa boutique", async () => {
    const { db, calls } = fakeDb();
    await recordPlatformAction(
      { actorId: "a-1", action: "tenant_created", tenantId: "t-1" },
      db as never
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].data).toMatchObject({ actorId: "a-1", action: "tenant_created", tenantId: "t-1" });
  });

  it("remplit tenantId, targetId et metadata par des valeurs neutres quand ils sont absents", async () => {
    const { db, calls } = fakeDb();
    await recordPlatformAction({ actorId: "a-1", action: "announcement_sent" }, db as never);
    expect(calls[0].data).toEqual({
      actorId: "a-1",
      action: "announcement_sent",
      tenantId: null,
      targetId: null,
      metadata: {},
    });
  });

  it("transmet les métadonnées fournies", async () => {
    const { db, calls } = fakeDb();
    await recordPlatformAction(
      { actorId: "a-1", action: "modules_changed", tenantId: "t-1", metadata: { before: ["dash"], after: ["dash", "fin"] } },
      db as never
    );
    expect(calls[0].data.metadata).toEqual({ before: ["dash"], after: ["dash", "fin"] });
  });
});
