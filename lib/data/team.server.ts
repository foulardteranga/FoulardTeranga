import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";

export interface EmployeeRoleView {
  id: string;
  name: string;
  permissions: string[];
  employeeCount: number;
}

export interface EmployeeView {
  id: string;
  name: string;
  email: string;
  active: boolean;
  employeeRoleId: string | null;
}

/** Profils d'accès du tenant courant, plus anciens d'abord (écran Équipe). */
export async function getEmployeeRoles(): Promise<EmployeeRoleView[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.employeeRole.findMany({
    where: { tenantId: tenant.id },
    include: { _count: { select: { profiles: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions,
    employeeCount: r._count.profiles,
  }));
}

/** Comptes employés (role = staff) du tenant courant, plus anciens d'abord (écran Équipe). */
export async function getEmployees(): Promise<EmployeeView[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.profile.findMany({
    where: { tenantId: tenant.id, role: "staff" },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email ?? "",
    active: r.active,
    employeeRoleId: r.employeeRoleId,
  }));
}
