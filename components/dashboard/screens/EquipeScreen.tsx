"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { MODULE_IDS, NAV, type ModuleId } from "@/lib/nav";
import {
  createEmployeeRole,
  updateEmployeeRole,
  deleteEmployeeRole,
  createEmployee,
  setEmployeeActive,
  setEmployeeRole,
} from "@/lib/team/actions";
import type { EmployeeRoleView, EmployeeView } from "@/lib/data/team.server";

const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_IDS.map((id) => [id, NAV.find((n) => n.id === id)?.label ?? id])
);

const EMPTY_ROLE_FORM = { id: null as string | null, name: "", permissions: [] as string[] };
const EMPTY_EMPLOYEE_FORM = { name: "", email: "", password: "", employeeRoleId: "" };

export function EquipeScreen({
  roles,
  employees,
  enabledModules,
}: {
  roles: EmployeeRoleView[];
  employees: EmployeeView[];
  /** Modules activés pour la boutique : seuls ceux-ci sont configurables. */
  enabledModules: string[];
}) {
  const showToast = useBackoffice((s) => s.showToast);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [roleSaving, setRoleSaving] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [employeeSaving, setEmployeeSaving] = useState(false);

  function toggleModule(id: string) {
    setRoleForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id) ? f.permissions.filter((m) => m !== id) : [...f.permissions, id],
    }));
  }

  async function handleSaveRole() {
    setRoleSaving(true);
    const input = { name: roleForm.name, permissions: roleForm.permissions as ModuleId[] };
    const r = roleForm.id ? await updateEmployeeRole(roleForm.id, input) : await createEmployeeRole(input);
    setRoleSaving(false);
    if (!r.ok) {
      showToast(r.error, "error");
      return;
    }
    showToast(roleForm.id ? "Profil mis à jour." : "Profil créé.", "success");
    setRoleForm(EMPTY_ROLE_FORM);
  }

  async function handleDeleteRole(id: string) {
    const r = await deleteEmployeeRole(id);
    if (!r.ok) {
      showToast(r.error, "error");
      return;
    }
    showToast("Profil supprimé.", "success");
    if (roleForm.id === id) setRoleForm(EMPTY_ROLE_FORM);
  }

  async function handleCreateEmployee() {
    setEmployeeSaving(true);
    const r = await createEmployee(employeeForm);
    setEmployeeSaving(false);
    if (!r.ok) {
      showToast(r.error, "error");
      return;
    }
    showToast("Employé·e créé·e.", "success");
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
  }

  async function handleToggleActive(employee: EmployeeView) {
    const r = await setEmployeeActive(employee.id, !employee.active);
    if (!r.ok) showToast(r.error, "error");
  }

  async function handleReassign(employee: EmployeeView, employeeRoleId: string) {
    const r = await setEmployeeRole(employee.id, employeeRoleId);
    if (!r.ok) showToast(r.error, "error");
  }

  return (
    <div className="ft-pad" style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 22 }}>
      <section>
        <h2 style={sectionTitle}>Profils d&apos;accès</h2>
        <div className="ft-grid-2">
          <div style={{ ...card, padding: "18px 20px" }}>
            {roles.length === 0 && (
              <p style={{ fontSize: 13, color: colors.muted }}>
                Aucun profil pour l&apos;instant — créez le premier ci-contre.
              </p>
            )}
            {roles.map((role) => (
              <div key={role.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{role.name}</div>
                  <div style={{ fontSize: 12, color: colors.muted }}>
                    {role.permissions.map((id) => MODULE_LABELS[id]).join(" · ")} · {role.employeeCount} employé
                    {role.employeeCount > 1 ? "s" : ""}
                  </div>
                </div>
                <button onClick={() => setRoleForm({ id: role.id, name: role.name, permissions: role.permissions })} style={ghostBtn}>
                  Modifier
                </button>
                <button onClick={() => handleDeleteRole(role.id)} style={ghostBtn}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: "18px 20px" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              {roleForm.id ? "Modifier le profil" : "Créer un profil d'accès"}
            </div>
            <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>
              Nom et modules accessibles du back-office.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={fieldLabel}>Nom du profil</label>
                <input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Caissier"
                  style={textField}
                />
              </div>
              <div>
                <label style={fieldLabel}>Modules accessibles</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {MODULE_IDS.filter((id) => enabledModules.includes(id)).map((id) => (
                    <label key={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                      <input type="checkbox" checked={roleForm.permissions.includes(id)} onChange={() => toggleModule(id)} />
                      {MODULE_LABELS[id]}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="ft-primary-btn"
                  onClick={handleSaveRole}
                  disabled={roleSaving || !roleForm.name || roleForm.permissions.length === 0}
                  style={primaryBtn(roleSaving || !roleForm.name || roleForm.permissions.length === 0)}
                >
                  {roleSaving ? "Enregistrement…" : roleForm.id ? "Enregistrer" : "Créer le profil"}
                </button>
                {roleForm.id && (
                  <button onClick={() => setRoleForm(EMPTY_ROLE_FORM)} style={ghostBtn}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={sectionTitle}>Employés</h2>
        <div className="ft-grid-2">
          <div style={{ ...card, padding: "18px 20px" }}>
            {employees.length === 0 && <p style={{ fontSize: 13, color: colors.muted }}>Aucun employé pour l&apos;instant.</p>}
            {employees.map((employee) => (
              <div key={employee.id} style={{ ...row, opacity: employee.active ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{employee.name}</div>
                  <div style={{ fontSize: 12, color: colors.muted }}>{employee.email}</div>
                </div>
                <SelectField value={employee.employeeRoleId ?? ""} onChange={(v) => handleReassign(employee, v)}>
                  <option value="" disabled>
                    Profil…
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </SelectField>
                <button onClick={() => handleToggleActive(employee)} style={ghostBtn}>
                  {employee.active ? "Désactiver" : "Activer"}
                </button>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: "18px 20px" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Ajouter un employé</div>
            <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>
              Nom, email, mot de passe temporaire et profil d&apos;accès.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={fieldLabel}>Nom</label>
                <input
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Awa Traoré"
                  style={textField}
                />
              </div>
              <div>
                <label style={fieldLabel}>Email</label>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="awa@example.com"
                  style={textField}
                />
              </div>
              <div>
                <label style={fieldLabel}>Mot de passe temporaire</label>
                <input
                  type="text"
                  value={employeeForm.password}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="8 caractères minimum"
                  style={textField}
                />
              </div>
              <div>
                <label style={fieldLabel}>Profil d&apos;accès</label>
                <SelectField
                  value={employeeForm.employeeRoleId}
                  onChange={(v) => setEmployeeForm((f) => ({ ...f, employeeRoleId: v }))}
                >
                  <option value="" disabled>
                    {roles.length === 0 ? "Créez d'abord un profil ci-dessus" : "Choisir un profil"}
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <button
                className="ft-primary-btn"
                onClick={handleCreateEmployee}
                disabled={employeeSaving || !employeeForm.name || !employeeForm.email || !employeeForm.employeeRoleId}
                style={primaryBtn(employeeSaving || !employeeForm.name || !employeeForm.email || !employeeForm.employeeRoleId)}
              >
                {employeeSaving ? "Création…" : "Créer l'employé"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", flex: "none", width: 160 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 36,
          padding: "0 30px 0 10px",
          border: `1.5px solid ${colors.borderField}`,
          borderRadius: 8,
          font: `400 12.5px ${fonts.ui}`,
          appearance: "none",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        {children}
      </select>
      <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <Icon path={ICONS.chevronDown} size={14} stroke={colors.muted} strokeWidth={2} />
      </span>
    </div>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 48,
    border: "none",
    borderRadius: 10,
    background: colors.accent,
    color: "#fff",
    font: `700 15px ${fonts.ui}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    flex: 1,
  };
}

const sectionTitle: React.CSSProperties = { font: `700 17px ${fonts.display}`, marginBottom: 12 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: `1px solid ${colors.faintLine}` };
const fieldLabel: React.CSSProperties = { display: "block", font: `600 12.5px ${fonts.ui}`, marginBottom: 6 };
const textField: React.CSSProperties = { width: "100%", height: 44, padding: "0 13px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, font: `400 14px ${fonts.ui}` };
const ghostBtn: React.CSSProperties = {
  height: 30,
  padding: "0 11px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 8,
  background: "#fff",
  font: `600 12px ${fonts.ui}`,
  color: colors.muted,
  cursor: "pointer",
  flex: "none",
};
