import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import type { Prisma, Role } from "@/generated/prisma/client";
import { RoleFilter } from "./role-filter";
import { DeleteUserButton } from "./delete-user-button";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const validRoles: Role[] = ["SUPER_ADMIN", "COLLEGE_ADMIN", "STUDENT"];

const roleBadgeVariant: Record<
  Role,
  "destructive" | "default" | "secondary"
> = {
  SUPER_ADMIN: "destructive",
  COLLEGE_ADMIN: "default",
  STUDENT: "secondary",
};

const roleLabel: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  COLLEGE_ADMIN: "College Admin",
  STUDENT: "Student",
};

type PageProps = { searchParams: Promise<{ role?: string }> };

export default async function UsersListPage({ searchParams }: PageProps) {
  const { role } = await searchParams;

  const where: Prisma.UserWhereInput = {};
  if (role && validRoles.includes(role as Role)) {
    where.role = role as Role;
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      college: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          testAttempts: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Users
          </h1>
          <p className="text-sm text-muted-foreground">
            All registered users across the platform.
          </p>
        </div>
        <RoleFilter />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="px-4">Email</TableHead>
              <TableHead className="px-4">Role</TableHead>
              <TableHead className="px-4">College</TableHead>
              <TableHead className="px-4">Joined</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="rounded-full bg-muted p-3">
                      <Users
                        className="size-6 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No users found</p>
                      <p className="text-xs text-muted-foreground">
                        Try adjusting the role filter.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="px-4 font-medium">
                    {user.name}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant={roleBadgeVariant[user.role]}>
                      {roleLabel[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {user.college?.name ?? "—"}
                  </TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {dateFormatter.format(new Date(user.createdAt))}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <DeleteUserButton
                      userId={user.id}
                      userName={user.name}
                      userEmail={user.email}
                      userRole={user.role}
                      testAttemptCount={user._count.testAttempts}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
