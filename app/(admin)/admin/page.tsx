import { headers } from "next/headers";
import { EmployeeManager, type Employee } from "@/components/employee-manager";
import { auth } from "@/lib/auth";
import { emailToUsername } from "@/lib/username";

export default async function AdminUsersPage() {
  const result = await auth.api.listUsers({
    query: {
      limit: 200,
      sortBy: "createdAt",
      sortDirection: "asc",
    },
    headers: await headers(),
  });

  const employees: Employee[] = result.users
    .filter((user) => (user as { role?: string | null }).role !== "owner")
    .map((user) => ({
      id: user.id,
      name: user.name,
      username: emailToUsername(user.email),
      banned: Boolean((user as { banned?: boolean | null }).banned),
      createdAt: user.createdAt ?? null,
    }));

  return <EmployeeManager employees={employees} />;
}
