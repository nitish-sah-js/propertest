import { requireRole } from "@/lib/auth-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function CollegeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("COLLEGE_ADMIN");
  const user = session.user as { name: string; email: string; role: string };

  return (
    <DashboardShell user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
    </DashboardShell>
  );
}
