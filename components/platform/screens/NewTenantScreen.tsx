"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { createTenant } from "@/lib/platform/actions";
import { parseDomains } from "@/lib/platform/domains";
import { normalizeSlug } from "@/lib/validators/platform";
import { modulesForPlan, PLAN_LABELS } from "@/lib/platform/plans";
import { NAV } from "@/lib/nav";
import { Icon, ICONS } from "@/components/ui/Icon";
import { FormMessage } from "@/components/platform/FormMessage";
import type { TenantPlan } from "@/lib/generated/prisma/enums";

const EMPTY = {
  name: "",
  slug: "",
  plan: "essentiel" as TenantPlan,
  primaryColor: "#26326B",
  accentColor: "#D07A34",
  logoText: "",
  domainsRaw: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};

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

export function NewTenantScreen({ basePath = "" }: { basePath?: string }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const domains = parseDomains(form.domainsRaw);
    if (!domains.ok) {
      setError(domains.error);
      return;
    }

    setSaving(true);
    const result = await createTenant({
      slug: normalizeSlug(form.slug),
      name: form.name,
      plan: form.plan,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      logoText: form.logoText,
      domains: domains.domains,
      ownerName: form.ownerName,
      ownerEmail: form.ownerEmail,
      ownerPassword: form.ownerPassword,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`${basePath}/boutiques/${result.slug}`);
  }

  const previewModules = modulesForPlan(form.plan);

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 760 }}>
      <Link href={`${basePath}/boutiques`} className="ft-platform-link" style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>
        ← Retour au parc
      </Link>
      <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, margin: "10px 0 24px" }}>
        Nouvelle boutique
      </h1>

      <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Identité</h2>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <label style={labelStyle}>
            Nom de la boutique
            <input
              required
              className="ft-platform-input"
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!form.slug) set("slug", normalizeSlug(e.target.value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Slug (sous-domaine)
            <input
              required
              className="ft-platform-input"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="boutique-du-plateau"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Logo texte
            <input required className="ft-platform-input" value={form.logoText} onChange={(e) => set("logoText", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Couleur principale
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                className="ft-platform-input"
                value={form.primaryColor}
                onChange={(e) => set("primaryColor", e.target.value)}
                style={{ ...inputStyle, padding: 4, height: 42, width: 56, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: colors.muted, fontFamily: "monospace" }}>{form.primaryColor}</span>
            </div>
          </label>
          <label style={labelStyle}>
            Couleur d'accent
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                className="ft-platform-input"
                value={form.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                style={{ ...inputStyle, padding: 4, height: 42, width: 56, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: colors.muted, fontFamily: "monospace" }}>{form.accentColor}</span>
            </div>
          </label>
        </div>
        <label style={{ ...labelStyle, marginTop: 14 }}>
          Domaines personnalisés (un par ligne, optionnel)
          <textarea
            className="ft-platform-textarea"
            value={form.domainsRaw}
            onChange={(e) => set("domainsRaw", e.target.value)}
            rows={3}
            placeholder="boutique-du-plateau.ci"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
      </section>

      <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Palier</h2>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {(["essentiel", "pro"] as const).map((plan) => (
            <label key={plan} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="radio" className="ft-platform-radio" name="plan" checked={form.plan === plan} onChange={() => set("plan", plan)} />
              {PLAN_LABELS[plan]}
            </label>
          ))}
        </div>
        <p style={{ color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 0 }}>
          Modules activés à la création : {previewModules.map((id) => NAV.find((n) => n.id === id)?.label ?? id).join(", ")}.
          Ajustables ensuite dans l'onglet Modules.
        </p>
      </section>

      <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Compte de la gérante</h2>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <label style={labelStyle}>
            Nom
            <input required className="ft-platform-input" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Email
            <input required type="email" className="ft-platform-input" autoComplete="off" value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Mot de passe initial
            <div style={{ position: "relative" }}>
              <input
                required
                type={showPassword ? "text" : "password"}
                className="ft-platform-input"
                autoComplete="off"
                minLength={8}
                value={form.ownerPassword}
                onChange={(e) => set("ownerPassword", e.target.value)}
                style={{ ...inputStyle, width: "100%", paddingRight: 40 }}
              />
              <button
                type="button"
                className="ft-platform-btn"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  color: colors.muted,
                  cursor: "pointer",
                  padding: 8,
                  borderRadius: 8,
                  display: "flex",
                }}
              >
                <Icon path={showPassword ? ICONS.eyeOff : ICONS.eye} size={17} />
              </button>
            </div>
          </label>
        </div>
        <p style={{ color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 0 }}>
          À communiquer à la gérante, qui le changera à sa première connexion.
        </p>
      </section>

      <FormMessage message={error ? { kind: "error", text: error } : null} />

      <button
        type="submit"
        disabled={saving}
        className="ft-platform-btn ft-platform-btn-primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          marginTop: 16,
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "12px 22px",
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving && (
          <span
            className="ft-spin"
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              border: "2px solid rgba(255,255,255,.4)",
              borderTopColor: "#fff",
              display: "inline-block",
            }}
          />
        )}
        {saving ? "Création…" : "Créer la boutique"}
      </button>
    </form>
  );
}
