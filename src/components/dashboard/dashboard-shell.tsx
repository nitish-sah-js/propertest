import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: string;
  };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-muted/40">
      <Sidebar role={user.role} />
      <div className="md:pl-64 bg-background min-h-screen">
        <Topbar user={user} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
