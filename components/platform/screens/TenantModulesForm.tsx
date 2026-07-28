"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, adminBorder } from "@/lib/theme/tokens";
import { updateTenantModules } from "@/lib/platform/actions";
import { modulesForPlan, PLAN_LABELS } from "@/lib/platform/plans";
import { MODULE_IDS, NAV, type ModuleId } from "@/lib/nav";
import type { TenantDetail } from "@/lib/platform/queries";
import type { TenantPlan } from "@/lib/generated/prisma/enums";

const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_IDS.map((id) => [id, NAV.find((n) => n.id === id)?.label ?? id])
);

export function TenantModulesForm({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [plan, setPlan] = useState<TenantPlan>(tenant.plan);
  const [modules, setModules] = useState<string[]>(tenant.enabledModules);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function applyPlan(next: TenantPlan) {
    setPlan(next);
    setModules(modulesForPlan(next));
  }

  function toggle(id: string) {
    // `dash` est le socle : la contrainte base tenant_min_modules l'exige, la
    // case est désactivée, et ce garde ferme le dernier chemin.
    if (id === "dash") return;
    setModules((current) =>
      current.includes(id) ? current.filter((m) => m !== id) : [...current, id]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    const result = await updateTenantModules(tenant.id, { plan, modules: modules as ModuleId[] });
    setSaving(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "Périmètre enregistré." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, maxWidth: 760 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Palier</h2>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 8 }}>
        {(["essentiel", "pro"] as const).map((id) => (
          <label key={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="radio" name="plan" checked={plan === id} onChange={() => applyPlan(id)} />
            {PLAN_LABELS[id]}
          </label>
        ))}
      </div>
      <p style={{ color: colors.muted, fontSize: 13, marginTop: 0 }}>
        Choisir un palier pré-remplit les cases ci-dessous ; elles restent librement ajustables.
      </p>

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "20px 0 12px" }}>Modules activés</h2>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {MODULE_IDS.map((id) => (
          <label
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              color: id === "dash" ? colors.muted : colors.ink,
            }}
          >
            <input
              type="checkbox"
              checked={modules.includes(id)}
              disabled={id === "dash"}
              onChange={() => toggle(id)}
            />
            {MODULE_LABELS[id]}
            {id === "dash" && <span style={{ fontSize: 12 }}>(socle)</span>}
          </label>
        ))}
      </div>

      {message && (
        <p
          style={{
            background: message.kind === "ok" ? colors.bgSuccess : colors.bgDanger,
            color: message.kind === "ok" ? colors.fgSuccess : colors.fgDanger,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
          }}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          marginTop: 16,
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "11px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
