import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ArrowRight, Briefcase } from "lucide-react";
import { DriveStatusBadge } from "@/components/drives/drive-status-badge";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return dateFormatter.format(new Date(date));
}

export default async function DrivesListPage() {
  const session = await getSession();
  const user = session!.user as { id: string; collegeId: string };

  const drives = await prisma.placementDrive.findMany({
    where: { collegeId: user.collegeId },
    include: {
      _count: { select: { tests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Placement Drives
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your college placement drives and associated tests.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/college/drives/new">
            <Plus className="size-4" aria-hidden="true" />
            Create Drive
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">Title</TableHead>
              <TableHead className="px-4">Company</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4 text-center">Tests</TableHead>
              <TableHead className="px-4">Start Date</TableHead>
              <TableHead className="px-4">End Date</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drives.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="rounded-full bg-muted p-3">
                      <Briefcase
                        className="size-6 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No drives yet</p>
                      <p className="text-xs text-muted-foreground">
                        Create your first placement drive to get started.
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="mt-1">
                      <Link href="/college/drives/new">
                        <Plus className="size-4" aria-hidden="true" />
                        Create Drive
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              drives.map((drive) => (
                <TableRow key={drive.id}>
                  <TableCell className="px-4 font-medium">
                    {drive.title}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {drive.companyName ?? "—"}
                  </TableCell>
                  <TableCell className="px-4">
                    <DriveStatusBadge status={drive.status} />
                  </TableCell>
                  <TableCell className="px-4 text-center tabular-nums">
                    {drive._count.tests}
                  </TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {formatDate(drive.startDate)}
                  </TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {formatDate(drive.endDate)}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/college/drives/${drive.id}`}
                        aria-label={`View ${drive.title}`}
                      >
                        View
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
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
