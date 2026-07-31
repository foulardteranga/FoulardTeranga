"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, adminBorder } from "@/lib/theme/tokens";
import { resetOwnerPassword, createTenantOwner } from "@/lib/platform/team";
import { FormMessage, type FormMessageState } from "@/components/platform/FormMessage";
import type { TenantDetail, TenantTeamProfile, TenantTeamEmployeeRole } from "@/lib/platform/queries";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Prestataire",
  owner: "Gérante",
  staff: "Employé·e",
  customer: "Cliente",
};

function ResetOwnerPasswordForm({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<FormMessageState>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!tenant.owner) return;
    setMessage(null);
    setSaving(true);
    const result = await resetOwnerPassword(tenant.id, tenant.owner.id, { password });
    setSaving(false);
    // Le mot de passe saisi n'est jamais réaffiché, succès ou échec — il est
    // effacé du champ dans les deux cas.
    setPassword("");
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "Mot de passe réinitialisé. Communiquez-le à la gérante par un canal sûr." });
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, maxWidth: 480 }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Réinitialiser le mot de passe</h2>
      <label style={{ display: "block", fontSize: 13, color: colors.muted, marginBottom: 6 }}>
        Nouveau mot de passe
        <input
          type="password"
          className="ft-platform-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
          style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: adminBorder }}
        />
      </label>

      <FormMessage message={message} />

      <button
        type="submit"
        disabled={saving}
        className="ft-platform-btn ft-platform-btn-primary"
        style={{
          marginTop: 16,
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "11px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
      </button>
    </form>
  );
}

function CreateTenantOwnerForm({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<FormMessageState>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    const result = await createTenantOwner(tenant.id, { name, email, password });
    setSaving(false);
    setPassword("");
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "Gérante rattachée à la boutique." });
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, maxWidth: 480 }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Rattacher une gérante</h2>
      <p style={{ color: colors.muted, fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        Cette boutique n&apos;a pas encore de gérante : « Entrer dans la boutique » reste inerte tant qu&apos;aucun
        compte n&apos;est créé ici.
      </p>

      <label style={{ display: "block", fontSize: 13, color: colors.muted, marginBottom: 10 }}>
        Nom
        <input
          type="text"
          className="ft-platform-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: adminBorder }}
        />
      </label>

      <label style={{ display: "block", fontSize: 13, color: colors.muted, marginBottom: 10 }}>
        Email
        <input
          type="email"
          className="ft-platform-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: adminBorder }}
        />
      </label>

      <label style={{ display: "block", fontSize: 13, color: colors.muted, marginBottom: 6 }}>
        Mot de passe initial
        <input
          type="password"
          className="ft-platform-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
          style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: adminBorder }}
        />
      </label>

      <FormMessage message={message} />

      <button
        type="submit"
        disabled={saving}
        className="ft-platform-btn ft-platform-btn-primary"
        style={{
          marginTop: 16,
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "11px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Création…" : "Créer la gérante"}
      </button>
    </form>
  );
}

function ProfilesTable({ profiles }: { profiles: TenantTeamProfile[] }) {
  return (
    <div style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Profils</h2>
      {profiles.length === 0 ? (
        <p style={{ color: colors.muted, fontSize: 13 }}>Aucun profil pour cette boutique.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: colors.muted, fontSize: 12 }}>
              <th style={{ padding: "6px 8px" }}>Nom</th>
              <th style={{ padding: "6px 8px" }}>Email</th>
              <th style={{ padding: "6px 8px" }}>Rôle</th>
              <th style={{ padding: "6px 8px" }}>Profil d&apos;accès</th>
              <th style={{ padding: "6px 8px" }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} style={{ borderTop: adminBorder }}>
                <td style={{ padding: "8px" }}>{profile.name}</td>
                <td style={{ padding: "8px" }}>{profile.email}</td>
                <td style={{ padding: "8px" }}>{ROLE_LABELS[profile.role] ?? profile.role}</td>
                <td style={{ padding: "8px" }}>{profile.employeeRoleName ?? "—"}</td>
                <td style={{ padding: "8px" }}>{profile.active ? "Actif" : "Inactif"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EmployeeRolesTable({ employeeRoles }: { employeeRoles: TenantTeamEmployeeRole[] }) {
  return (
    <div style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Profils d&apos;accès</h2>
      {employeeRoles.length === 0 ? (
        <p style={{ color: colors.muted, fontSize: 13 }}>Aucun profil d&apos;accès défini.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: colors.muted, fontSize: 12 }}>
              <th style={{ padding: "6px 8px" }}>Nom</th>
              <th style={{ padding: "6px 8px" }}>Permissions</th>
            </tr>
          </thead>
          <tbody>
            {employeeRoles.map((role) => (
              <tr key={role.id} style={{ borderTop: adminBorder }}>
                <td style={{ padding: "8px" }}>{role.name}</td>
                <td style={{ padding: "8px" }}>{role.permissions.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function TenantTeamTab({
  tenant,
  team,
}: {
  tenant: TenantDetail;
  team: { profiles: TenantTeamProfile[]; employeeRoles: TenantTeamEmployeeRole[] };
}) {
  return (
    <div>
      <ProfilesTable profiles={team.profiles} />
      <EmployeeRolesTable employeeRoles={team.employeeRoles} />
      {tenant.owner ? <ResetOwnerPasswordForm tenant={tenant} /> : <CreateTenantOwnerForm tenant={tenant} />}
    </div>
  );
}
