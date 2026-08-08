"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import type { OrderAuditLogEntry } from "@/lib/data/orderAudit.server";

const ACTION_META: Record<OrderAuditLogEntry["action"], { label: string; bg: string; color: string }> = {
  archived: { label: "Archivée", bg: colors.bgInfo, color: colors.fgInfo },
  restored: { label: "Restaurée", bg: colors.bgSuccess, color: colors.fgSuccess },
  deleted: { label: "Supprimée définitivement", bg: colors.bgDanger, color: colors.fgDanger },
};

const ACTION_FILTERS: Array<[string, string, OrderAuditLogEntry["action"] | null]> = [
  ["all", "Toutes", null],
  ["archived", "Archivées", "archived"],
  ["restored", "Restaurées", "restored"],
  ["deleted", "Supprimées", "deleted"],
];

export function OrderAuditLogScreen({ entries }: { entries: OrderAuditLogEntry[] }) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = entries.filter((e) => {
    const matchesAction = actionFilter === "all" || e.action === actionFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query === "" || e.orderRef.toLowerCase().includes(query) || e.actorName.toLowerCase().includes(query);
    return matchesAction && matchesSearch;
  });

  return (
    <div className="ft-pad">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {ACTION_FILTERS.map(([id, label, action]) => {
          const on = actionFilter === id;
          const c = action === null ? entries.length : entries.filter((e) => e.action === action).length;
          return (
            <button
              key={id}
              onClick={() => setActionFilter(id)}
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: 999,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
                border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                background: on ? colors.primary : "#fff",
                color: on ? "#fff" : colors.muted,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {label}
              <span
                style={{
                  fontSize: 11,
                  background: on ? "rgba(255,255,255,.22)" : "#F1ECE2",
                  color: on ? "#fff" : colors.muted,
                  padding: "1px 7px",
                  borderRadius: 999,
                }}
              >
                {c}
              </span>
            </button>
          );
        })}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par référence ou par vendeur…"
        style={{
          width: "100%",
          height: 42,
          padding: "0 13px",
          border: `1.5px solid ${colors.borderField}`,
          borderRadius: 10,
          font: `400 14px ${fonts.ui}`,
          marginBottom: 16,
        }}
      />

      {filtered.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, textAlign: "center", padding: "50px 24px", color: colors.muted }}>
          Aucune entrée pour ce filtre.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
          {filtered.map((e) => {
            const meta = ACTION_META[e.action];
            return (
              <div
                key={e.id}
                style={{ padding: "14px 18px", borderBottom: `1px solid ${colors.faintLine}` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{e.orderRef}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      font: `600 11px ${fonts.ui}`,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: meta.bg,
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: colors.muted }}>
                  {e.date} · par {e.actorName}
                </div>
                {e.reason && (
                  <div style={{ fontSize: 12.5, color: colors.ink, marginTop: 4 }}>« {e.reason} »</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
