import type { Role } from "@/lib/auth";

export type ImpersonationMode = "read" | "write";

export interface ImpersonationState {
  targetProfileId: string;
  tenantId: string;
  mode: ImpersonationMode;
  startedAt: string;
}

/** Spec §3. `actor` est toujours le vrai super_admin ; `effective` est ce que le reste de l'application doit voir. */
export interface ActorContext {
  actor: { userId: string; name: string; role: Role };
  effective: { tenantId: string | null; role: Role; permissions: string[] };
  impersonation: ImpersonationState | null;
}
