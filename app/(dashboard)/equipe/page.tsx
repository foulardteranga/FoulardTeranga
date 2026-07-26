import { getEmployeeRoles, getEmployees } from "@/lib/data/team.server";
import { getSession } from "@/lib/auth";
import { EquipeScreen } from "@/components/dashboard/screens/EquipeScreen";

export default async function EquipePage() {
  const [roles, employees, session] = await Promise.all([
    getEmployeeRoles(),
    getEmployees(),
    getSession(),
  ]);
  return (
    <EquipeScreen
      roles={roles}
      employees={employees}
      enabledModules={session?.enabledModules ?? []}
    />
  );
}
