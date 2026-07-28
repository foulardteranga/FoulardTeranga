"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, adminBorder } from "@/lib/theme/tokens";
import { updateTenantIdentity } from "@/lib/platform/actions";
import { parseDomains } from "@/lib/platform/domains";
import { normalizeSlug } from "@/lib/validators/platform";
import type { TenantDetail } from "@/lib/platform/queries";

const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 13, fontWeight: 600 };
const inputStyle = {
  border: `1px solid ${colors.borderField}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: colors.ink,
  background: "#fff",
};

export function TenantIdentityForm({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: tenant.name,
    slug: tenant.slug,
    tagline: tenant.tagline,
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
    logoText: tenant.logoText,
    font: tenant.font === "Inter" ? "Inter" : "Playfair Display",
    whatsappPhone: tenant.whatsappPhone,
    domainsRaw: tenant.domains.join("\n"),
  });
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const domains = parseDomains(form.domainsRaw);
    if (!domains.ok) {
      setMessage({ kind: "error", text: domains.error });
      return;
    }

    setSaving(true);
    const result = await updateTenantIdentity(tenant.id, {
      name: form.name,
      slug: normalizeSlug(form.slug),
      tagline: form.tagline,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      logoText: form.logoText,
      font: form.font === "Inter" ? "Inter" : "Playfair Display",
      whatsappPhone: form.whatsappPhone,
      domains: domains.domains,
    });
    setSaving(false);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "Identité enregistrée." });
    // Le slug fait partie de l'URL : après un changement, rester sur l'ancienne
    // adresse afficherait un 404 au prochain rafraîchissement.
    const nextSlug = normalizeSlug(form.slug);
    if (nextSlug !== tenant.slug) router.replace(`/boutiques/${nextSlug}?onglet=identite`);
    else router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, maxWidth: 760 }}>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <label style={labelStyle}>
          Nom de la boutique
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Slug (sous-domaine)
          <input required value={form.slug} onChange={(e) => set("slug", e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Logo texte
          <input required value={form.logoText} onChange={(e) => set("logoText", e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Police
          <select value={form.font} onChange={(e) => set("font", e.target.value)} style={inputStyle}>
            <option value="Playfair Display">Playfair Display</option>
            <option value="Inter">Inter</option>
          </select>
        </label>
        <label style={labelStyle}>
          Couleur principale
          <input type="color" value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
        </label>
        <label style={labelStyle}>
          Couleur d'accent
          <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
        </label>
        <label style={labelStyle}>
          Numéro WhatsApp
          <input value={form.whatsappPhone} onChange={(e) => set("whatsappPhone", e.target.value)} style={inputStyle} />
        </label>
      </div>

      <label style={{ ...labelStyle, marginTop: 14 }}>
        Accroche
        <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} style={inputStyle} />
      </label>

      <label style={{ ...labelStyle, marginTop: 14 }}>
        Domaines (un par ligne)
        <textarea value={form.domainsRaw} onChange={(e) => set("domainsRaw", e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        <span style={{ fontWeight: 400, color: colors.muted, fontSize: 12 }}>
          Le domaine nu suffit : les sous-domaines admin. et platform. sont résolus automatiquement.
        </span>
      </label>

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
