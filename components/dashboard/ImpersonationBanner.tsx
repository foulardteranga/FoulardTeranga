"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockImpersonationWrite, endImpersonation } from "@/lib/impersonation/actions";

export const BANNER_HEIGHT = 44;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ImpersonationBanner({
  tenantName,
  targetName,
  mode,
  expiresAt,
}: {
  tenantName: string;
  targetName: string;
  mode: "read" | "write";
  /** Timestamp ISO de l'expiration dure (startedAt + 60 minutes), calculé côté serveur. */
  expiresAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: BANNER_HEIGHT,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          fontSize: 13,
          color: "#fff",
          background: mode === "write" ? "#8a1c1c" : "#3a2f6e",
        }}
      >
        <span>
          {mode === "write" ? "Mode intervention actif — " : "Lecture seule — "}
          Vous êtes {targetName} ({tenantName}) · expire dans {formatRemaining(remaining)}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          {mode === "read" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await unlockImpersonationWrite();
                  router.refresh();
                })
              }
              style={{ padding: "4px 10px", fontSize: 12, background: "#fff", color: "#111", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              Activer le mode intervention
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await endImpersonation();
                router.push("/platform");
                router.refresh();
              })
            }
            style={{ padding: "4px 10px", fontSize: 12, background: "transparent", color: "#fff", border: "1px solid #fff", borderRadius: 4, cursor: "pointer" }}
          >
            Quitter
          </button>
        </span>
      </div>
      {/* Décale le contenu pour ne jamais recouvrir l'en-tête de la boutique (spec §6). */}
      <div style={{ height: BANNER_HEIGHT }} />
    </>
  );
}
