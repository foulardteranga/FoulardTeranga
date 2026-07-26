/**
 * Crée le premier compte plateforme (super_admin). À exécuter une seule fois :
 *   SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… SUPER_ADMIN_NAME=… \
 *     npx tsx scripts/seed-super-admin.ts
 *
 * Idempotent : si un super_admin existe déjà, le script s'arrête sans rien faire.
 */
import { prisma } from "@/lib/db/client";
import { createAdminClient } from "@/lib/supabase/admin";

async function main(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME;

  if (!email || !password || !name) {
    throw new Error(
      "SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD et SUPER_ADMIN_NAME sont requis."
    );
  }

  const existing = await prisma.profile.findFirst({ where: { role: "super_admin" } });
  if (existing) {
    console.log(`Un compte plateforme existe déjà (${existing.name}). Rien à faire.`);
    return;
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    throw new Error(`Création du compte Auth impossible : ${error?.message ?? "inconnue"}`);
  }

  try {
    await prisma.profile.create({
      data: { id: created.user.id, tenantId: null, role: "super_admin", name, email },
    });
  } catch (cause) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {
      // Rattrapage au mieux : l'utilisateur Auth orphelin ne peut pas être
      // signalé utilement ici, mais le Profile n'existe pas donc il ne peut
      // pas se connecter à une zone privilégiée.
    });
    throw cause;
  }

  console.log(`Compte plateforme créé pour ${email}. Changez ce mot de passe à la première connexion.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
