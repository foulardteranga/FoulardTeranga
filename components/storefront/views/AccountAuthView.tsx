"use client";

import { useActionState, useState } from "react";
import { fonts, colors } from "@/lib/theme/tokens";
import { signInCustomer, signUpCustomer, type CustomerSignInState, type CustomerSignUpState } from "@/lib/customers/actions";
import { NumericField } from "@/components/ui/NumericField";

export function AccountAuthView() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="ft-store-page" style={{ maxWidth: 460, margin: "0 auto" }}>
      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "28px 26px" }}>
        <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-.01em" }}>
          Mon compte
        </h1>
        <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 22px" }}>
          {mode === "login"
            ? "Connectez-vous pour retrouver vos commandes et vos points."
            : "Créez un compte pour suivre vos commandes et cumuler des points de fidélité."}
        </p>

        {mode === "login" ? <LoginForm /> : <SignupForm />}

        <p style={{ textAlign: "center", fontSize: 13.5, color: colors.muted, marginTop: 18 }}>
          {mode === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <button onClick={() => setMode("signup")} style={linkBtn}>
                Créer un compte
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{" "}
              <button onClick={() => setMode("login")} style={linkBtn}>
                Se connecter
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const [state, formAction, pending] = useActionState<CustomerSignInState, FormData>(signInCustomer, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Email" error={state && !state.ok ? state.errors.email : undefined}>
        <input type="email" name="email" required autoComplete="email" style={inputStyle} />
      </Field>
      <Field label="Mot de passe" error={state && !state.ok ? state.errors.password : undefined}>
        <input type="password" name="password" required autoComplete="current-password" style={inputStyle} />
      </Field>
      {state && !state.ok && state.formError && <p style={{ color: "#9c352d", fontSize: 13 }}>{state.formError}</p>}
      <SubmitBtn pending={pending} label="Se connecter" pendingLabel="Connexion…" />
    </form>
  );
}

function SignupForm() {
  const [state, formAction, pending] = useActionState<CustomerSignUpState, FormData>(signUpCustomer, null);
  const [phone, setPhone] = useState("");

  if (state && state.ok && state.needsEmailConfirmation) {
    return (
      <div style={{ background: colors.bgInfo, borderRadius: 12, padding: "14px 16px", fontSize: 13.5, color: colors.primary, lineHeight: 1.5 }}>
        Compte créé — vérifiez votre email pour confirmer votre adresse, puis connectez-vous.
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Nom complet" error={state && !state.ok ? state.errors.name : undefined}>
        <input type="text" name="name" required style={inputStyle} />
      </Field>
      <Field label="Téléphone" error={state && !state.ok ? state.errors.phone : undefined}>
        <NumericField
          mode="phone"
          value={phone}
          onChange={setPhone}
          placeholder="Ex. +225 07 12 45 67 89"
          invalid={!!(state && !state.ok && state.errors.phone)}
        />
        <input type="hidden" name="phone" value={phone} required />
      </Field>
      <Field label="Lieu de livraison habituel" error={state && !state.ok ? state.errors.place : undefined}>
        <input type="text" name="place" required style={inputStyle} />
      </Field>
      <Field label="Email" error={state && !state.ok ? state.errors.email : undefined}>
        <input type="email" name="email" required autoComplete="email" style={inputStyle} />
      </Field>
      <Field label="Mot de passe" error={state && !state.ok ? state.errors.password : undefined}>
        <input type="password" name="password" required autoComplete="new-password" style={inputStyle} />
      </Field>
      {state && !state.ok && state.formError && <p style={{ color: "#9c352d", fontSize: 13 }}>{state.formError}</p>}
      <SubmitBtn pending={pending} label="Créer mon compte" pendingLabel="Création…" />
    </form>
  );
}

function SubmitBtn({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        height: 48,
        border: "none",
        borderRadius: 10,
        background: colors.accent,
        color: "#fff",
        font: `700 15px ${fonts.ui}`,
        cursor: pending ? "default" : "pointer",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
      {label}
      {children}
      {error && <span style={{ color: "#9c352d", fontSize: 12, fontWeight: 500 }}>{error}</span>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  height: 46,
  padding: "0 14px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  font: `400 14.5px ${fonts.ui}`,
  color: colors.ink,
};

const linkBtn: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  font: `600 13.5px ${fonts.ui}`,
  color: colors.primary,
  cursor: "pointer",
  textDecoration: "underline",
};
