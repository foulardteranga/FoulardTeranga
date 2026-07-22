"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { getSession, type Session } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  employeeRoleSchema,
  createEmployeeSchema,
  type EmployeeRoleInput,
  type CreateEmployeeInput,
} from "@/lib/validators/team";

async function requireOwnerSession(): Promise<Session | null> {
  const session = await getSession();
  return session?.role === "owner" ? session : null;
}

export async function createEmployeeRole(
  input: EmployeeRoleInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = employeeRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  try {
    const tenant = await getCurrentTenant();
    const existing = await prisma.employeeRole.findFirst({
      where: { tenantId: tenant.id, name: parsed.data.name },
    });
    if (existing) return { ok: false, error: "Un profil porte déjà ce nom." };

    await prisma.employeeRole.create({
      data: { tenantId: tenant.id, name: parsed.data.name, permissions: parsed.data.permissions },
    });
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function updateEmployeeRole(
  id: string,
  input: EmployeeRoleInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = employeeRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  try {
    const tenant = await getCurrentTenant();
    const role = await prisma.employeeRole.findFirst({ where: { id, tenantId: tenant.id } });
    if (!role) return { ok: false, error: "Profil introuvable." };

    const duplicate = await prisma.employeeRole.findFirst({
      where: { tenantId: tenant.id, name: parsed.data.name, NOT: { id } },
    });
    if (duplicate) return { ok: false, error: "Un profil porte déjà ce nom." };

    await prisma.employeeRole.update({
      where: { id: role.id },
      data: { name: parsed.data.name, permissions: parsed.data.permissions },
    });
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function deleteEmployeeRole(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const role = await prisma.employeeRole.findFirst({ where: { id, tenantId: tenant.id } });
    if (!role) return { ok: false, error: "Profil introuvable." };

    const employeeCount = await prisma.profile.count({ where: { employeeRoleId: id } });
    if (employeeCount > 0) {
      return {
        ok: false,
        error: `Réassignez d'abord les ${employeeCount} employé${employeeCount > 1 ? "s" : ""} utilisant ce profil.`,
      };
    }

    await prisma.employeeRole.delete({ where: { id: role.id } });
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function createEmployee(
  input: CreateEmployeeInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = createEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  const tenant = await getCurrentTenant();
  const role = await prisma.employeeRole.findFirst({
    where: { id: parsed.data.employeeRoleId, tenantId: tenant.id },
  });
  if (!role) return { ok: false, error: "Profil d'accès introuvable." };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    if (createError?.code === "email_exists") return { ok: false, error: "Cet email est déjà utilisé." };
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }

  try {
    await prisma.profile.create({
      data: {
        id: created.user.id,
        tenantId: tenant.id,
        role: "staff",
        name: parsed.data.name,
        email: parsed.data.email,
        employeeRoleId: role.id,
      },
    });
  } catch {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }

  revalidatePath("/equipe");
  return { ok: true };
}

export async function setEmployeeActive(
  profileId: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const { count } = await prisma.profile.updateMany({
      where: { id: profileId, tenantId: tenant.id, role: "staff" },
      data: { active },
    });
    if (count === 0) return { ok: false, error: "Employé introuvable." };
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function setEmployeeRole(
  profileId: string,
  employeeRoleId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const role = await prisma.employeeRole.findFirst({ where: { id: employeeRoleId, tenantId: tenant.id } });
    if (!role) return { ok: false, error: "Profil d'accès introuvable." };

    const { count } = await prisma.profile.updateMany({
      where: { id: profileId, tenantId: tenant.id, role: "staff" },
      data: { employeeRoleId: role.id },
    });
    if (count === 0) return { ok: false, error: "Employé introuvable." };
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
