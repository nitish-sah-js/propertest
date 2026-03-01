import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Briefcase, ClipboardList, Users, CheckCircle } from "lucide-react";

export default async function CollegeDashboardPage() {
  const session = await getSession();
  const user = session!.user as { id: string; name: string; collegeId: string };
  const collegeId = user.collegeId;

  const [driveCount, testCount, studentCount, activeTestCount] =
    await Promise.all([
      prisma.placementDrive.count({ where: { collegeId } }),
      prisma.test.count({
        where: { drive: { collegeId } },
      }),
      prisma.user.count({
        where: { collegeId, role: "STUDENT" },
      }),
      prisma.test.count({
        where: { drive: { collegeId }, status: "PUBLISHED" },
      }),
    ]);

  const stats = [
    {
      title: "Total Drives",
      value: driveCount,
      icon: Briefcase,
      description: "Placement drives created",
    },
    {
      title: "Total Tests",
      value: testCount,
      icon: ClipboardList,
      description: "Tests across all drives",
    },
    {
      title: "Total Students",
      value: studentCount,
      icon: Users,
      description: "Registered students",
    },
    {
      title: "Active Tests",
      value: activeTestCount,
      icon: CheckCircle,
      description: "Published and available",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-balance">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of your college placement activities.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="shrink-0 rounded-lg bg-muted p-2">
                <stat.icon className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight tabular-nums">
                {stat.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
