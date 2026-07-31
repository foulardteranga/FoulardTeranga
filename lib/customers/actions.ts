"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { validateLogin, type LoginFieldErrors } from "@/lib/validators/auth";
import { validateCustomerSignup, type CustomerSignupFieldErrors } from "@/lib/validators/customerAuth";
import { normalizePhone } from "@/lib/customers/normalizePhone";
import { initials } from "@/lib/format";

export type CustomerSignInState = { ok: false; errors: LoginFieldErrors; formError?: string } | null;

export async function signInCustomer(
  _prevState: CustomerSignInState,
  formData: FormData
): Promise<CustomerSignInState> {
  const result = validateLogin({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { ok: false, errors: result.errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) return { ok: false, errors: {}, formError: "Email ou mot de passe incorrect." };

  redirect("/compte");
}

export type CustomerSignUpState =
  | { ok: false; errors: CustomerSignupFieldErrors; formError?: string }
  | { ok: true; needsEmailConfirmation: true }
  | null;

export async function signUpCustomer(
  _prevState: CustomerSignUpState,
  formData: FormData
): Promise<CustomerSignUpState> {
  const result = validateCustomerSignup({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    place: String(formData.get("place") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { ok: false, errors: result.errors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
  });
  if (error) {
    const formError = error.message.includes("already registered")
      ? "Un compte existe déjà avec cet email."
      : "Une erreur est survenue, réessayez.";
    return { ok: false, errors: {}, formError };
  }
  if (!data.user) return { ok: false, errors: {}, formError: "Une erreur est survenue, réessayez." };

  const tenant = await getCurrentTenant();
  if (tenant.status !== "active") {
    return {
      ok: false,
      errors: {},
      formError: "Cette boutique n'accepte plus de nouvelles inscriptions pour le moment.",
    };
  }

  await prisma.profile.create({
    data: { id: data.user.id, tenantId: tenant.id, role: "customer", name: result.data.name },
  });

  // Rattache une fiche cliente existante (créée par une commande passée sans compte,
  // matchée par téléphone normalisé) ou en crée une nouvelle — même logique que
  // confirmOrder côté commande.
  const normalizedPhone = normalizePhone(result.data.phone);
  const candidates = await prisma.customer.findMany({ where: { tenantId: tenant.id } });
  const existing = candidates.find((c) => normalizePhone(c.phone) === normalizedPhone);

  if (existing) {
    await prisma.customer.update({
      where: { id: existing.id },
      data: { profileId: data.user.id, name: result.data.name, place: result.data.place },
    });
  } else {
    await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        profileId: data.user.id,
        name: result.data.name,
        initials: initials(result.data.name),
        phone: result.data.phone,
        place: result.data.place,
        segment: "Nouvelle",
      },
    });
  }

  revalidatePath("/compte");

  if (!data.session) {
    return { ok: true, needsEmailConfirmation: true };
  }
  redirect("/compte");
}

export async function signOutCustomer(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
