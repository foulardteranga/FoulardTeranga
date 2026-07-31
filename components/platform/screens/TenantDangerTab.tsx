"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, adminBorder } from "@/lib/theme/tokens";
import { suspendTenant, reactivateTenant, archiveTenant } from "@/lib/platform/lifecycle";
import { exportTenantData } from "@/lib/platform/export";
import { canTransition } from "@/lib/platform/transitions";
import { FormMessage, type FormMessageState } from "@/components/platform/FormMessage";
import type { TenantDetail } from "@/lib/platform/queries";

function Card({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 14px" }}>{body}</p>
      {children}
    </section>
  );
}

function actionButton(danger: boolean, busy: boolean): React.CSSProperties {
  return {
    background: danger ? colors.danger : colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.7 : 1,
  };
}

/**
 * Onglet « Zone de danger » (spec §6, onglet 6). Chaque action n'est RENDUE que
 * si `canTransition` l'autorise, plutôt que rendue puis désactivée : la table du
 * spec §9 devient la seule source de vérité de ce qui est proposé, et l'écran ne
 * peut pas offrir une action que l'action serveur refusera.
 */
export function TenantDangerTab({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<FormMessageState>(null);
  const [busy, setBusy] = useState(false);

  async function run(label: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (!window.confirm(`${label} « ${tenant.name} » ?`)) return;
    setMessage(null);
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "Modification enregistrée." });
    router.refresh();
  }

  async function handleExport() {
    setMessage(null);
    setBusy(true);
    const result = await exportTenantData(tenant.id);
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: "ok", text: `Export téléchargé (${result.filename}).` });
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
      {canTransition(tenant.status, "suspended") && (
        <Card
          title="Suspendre la boutique"
          body="La vitrine devient indisponible et le back-office est bloqué. Les données restent intactes et la suspension est réversible à tout moment."
        >
          <label style={{ display: "block", fontSize: 13, color: colors.muted, marginBottom: 6 }}>
            Motif (facultatif, interne — jamais affiché aux clientes)
          </label>
          <input
            type="text"
            value={reason}
            maxLength={280}
            onChange={(event) => setReason(event.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: adminBorder,
              fontSize: 14,
              marginBottom: 12,
            }}
          />
          <button
            type="button"
            disabled={busy}
            style={actionButton(true, busy)}
            onClick={() => run("Suspendre", () => suspendTenant(tenant.id, { reason }))}
          >
            Suspendre
          </button>
        </Card>
      )}

      {canTransition(tenant.status, "active") && (
        <Card
          title="Réactiver la boutique"
          body="La vitrine et le back-office redeviennent accessibles immédiatement."
        >
          <button
            type="button"
            disabled={busy}
            style={actionButton(false, busy)}
            onClick={() => run("Réactiver", () => reactivateTenant(tenant.id))}
          >
            Réactiver
          </button>
        </Card>
      )}

      {canTransition(tenant.status, "archived") && (
        <Card
          title="Archiver la boutique"
          body="La boutique sort du parc : elle disparaît de la liste par défaut et n'est plus accessible ni en vitrine ni en back-office. Réversible, et préalable obligatoire à la suppression définitive."
        >
          <button
            type="button"
            disabled={busy}
            style={actionButton(true, busy)}
            onClick={() => run("Archiver", () => archiveTenant(tenant.id))}
          >
            Archiver
          </button>
        </Card>
      )}

      <Card
        title="Exporter les données"
        body="Télécharge un fichier JSON contenant produits, clientes, commandes, pages vitrine, codes promo et mouvements de stock. À faire avant toute suppression."
      >
        <button type="button" disabled={busy} style={actionButton(false, busy)} onClick={handleExport}>
          Exporter les données (JSON)
        </button>
      </Card>

      <FormMessage message={message} />
    </div>
  );
}
