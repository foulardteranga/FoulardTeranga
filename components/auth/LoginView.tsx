"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { colors, fonts } from "@/lib/theme/tokens";

export function LoginView() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/pos";
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, null);

  return (
    <div style={{ maxWidth: 380, margin: "96px auto", padding: "0 16px" }}>
      <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, marginBottom: 24 }}>
        Connexion
      </h1>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <input type="hidden" name="next" value={next} />
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 500 }}>
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${colors.borderField}` }}
          />
          {state && !state.ok && state.errors.email && (
            <span style={{ color: colors.danger, fontSize: 12 }}>{state.errors.email}</span>
          )}
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 500 }}>
          Mot de passe
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${colors.borderField}` }}
          />
          {state && !state.ok && state.errors.password && (
            <span style={{ color: colors.danger, fontSize: 12 }}>{state.errors.password}</span>
          )}
        </label>
        {state && !state.ok && state.formError && (
          <p style={{ color: colors.danger, fontSize: 13 }}>{state.formError}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "11px 16px",
            borderRadius: 8,
            border: "none",
            background: colors.primary,
            color: "#fff",
            fontWeight: 600,
            cursor: pending ? "default" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
