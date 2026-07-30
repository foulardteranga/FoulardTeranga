"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startImpersonation } from "@/lib/impersonation/actions";
import { colors } from "@/lib/theme/tokens";

export function EnterTenantButton({ ownerProfileId }: { ownerProfileId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!ownerProfileId) return null;

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startImpersonation(ownerProfileId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/admin");
            router.refresh();
          });
        }}
        style={{
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          color: "#fff",
          background: colors.primary,
          border: "none",
          borderRadius: 6,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? "Entrée en cours…" : "Entrer dans la boutique"}
      </button>
      {error && <p style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
