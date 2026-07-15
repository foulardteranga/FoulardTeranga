"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { productSchema, type ProductInput } from "@/lib/validators/product";

export async function createProduct(
  input: ProductInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  const lengths = parsed.data.lengths
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const tenant = await getCurrentTenant();
  await prisma.product.create({
    data: {
      tenantId: tenant.id,
      category: parsed.data.category,
      name: parsed.data.name,
      variant: parsed.data.variant,
      motif: parsed.data.motif,
      price: parsed.data.price,
      stock: parsed.data.stock,
      swatch: parsed.data.swatch,
      colors: [parsed.data.swatch],
      lengths: lengths.length ? lengths : ["Taille unique"],
      description: parsed.data.description,
    },
  });

  revalidatePath("/admin/inventaire");
  revalidatePath("/");
  revalidatePath("/catalogue");
  return { ok: true };
}
