import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";
import { format } from "date-fns";

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default async function StudentResultsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user as {
    id: string;
    role: string;
    collegeId: string | null;
  };

  if (user.role !== "STUDENT") {
    redirect("/login");
  }

  const attempts = await prisma.testAttempt.findMany({
    where: {
      studentId: user.id,
      status: { in: ["SUBMITTED", "TIMED_OUT"] },
    },
    include: {
      test: {
        select: {
          title: true,
          totalMarks: true,
          passingMarks: true,
          drive: {
            select: { title: true, companyName: true },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground">
          View all your test results and scores.
        </p>
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No results yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Complete a test to see your results here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Drive / Company</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Total Marks</TableHead>
                  <TableHead className="text-center">Percentage</TableHead>
                  <TableHead className="text-center">Result</TableHead>
                  <TableHead className="text-center">Time Taken</TableHead>
                  <TableHead className="text-center">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => {
                  const passed =
                    attempt.test.passingMarks > 0 &&
                    (attempt.score ?? 0) >= attempt.test.passingMarks;
                  const failed =
                    attempt.test.passingMarks > 0 &&
                    (attempt.score ?? 0) < attempt.test.passingMarks;

                  return (
                    <TableRow key={attempt.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link
                          href={`/student/results/${attempt.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {attempt.test.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{attempt.test.drive.title}</div>
                        {attempt.test.drive.companyName && (
                          <p className="text-xs text-muted-foreground">
                            {attempt.test.drive.companyName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {attempt.score ?? 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.test.totalMarks}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">
                          {attempt.percentage !== null
                            ? `${Math.round(attempt.percentage)}%`
                            : "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {passed ? (
                          <Badge variant="default" className="bg-green-600">
                            Passed
                          </Badge>
                        ) : failed ? (
                          <Badge variant="destructive">Failed</Badge>
                        ) : (
                          <Badge variant="secondary">
                            {attempt.status === "TIMED_OUT"
                              ? "Timed Out"
                              : "Submitted"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {formatDuration(attempt.timeTakenSeconds)}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {attempt.submittedAt
                          ? format(attempt.submittedAt, "MMM d, yyyy")
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
