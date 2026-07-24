import { getEmployeeRoles, getEmployees } from "@/lib/data/team.server";
import { EquipeScreen } from "@/components/dashboard/screens/EquipeScreen";

export default async function EquipePage() {
  const [roles, employees] = await Promise.all([getEmployeeRoles(), getEmployees()]);
  return <EquipeScreen roles={roles} employees={employees} />;
}
