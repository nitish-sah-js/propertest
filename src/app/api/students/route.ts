import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

// GET /api/students — list students with optional filters and test stats
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId: string };
    if (user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const semesterParam = searchParams.get("semester");
    const semester = semesterParam ? parseInt(semesterParam, 10) : null;
    const graduatedParam = searchParams.get("graduated");
    const search = searchParams.get("search");

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 30;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      collegeId: user.collegeId,
      role: "STUDENT",
    };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (semester && semester >= 1 && semester <= 8) {
      where.semester = semester;
    }

    if (graduatedParam === "true") {
      where.isGraduated = true;
    } else if (graduatedParam === "false") {
      where.isGraduated = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { usn: { contains: search, mode: "insensitive" } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          usn: true,
          semester: true,
          isGraduated: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          createdAt: true,
          testAttempts: {
            where: {
              status: { in: ["SUBMITTED", "TIMED_OUT"] },
            },
            select: {
              percentage: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const result = students.map((student) => {
      const attempts = student.testAttempts;
      const testsTaken = attempts.length;
      const averageScore =
        testsTaken > 0
          ? Math.round(
              (attempts.reduce((sum, a) => sum + (a.percentage ?? 0), 0) /
                testsTaken) *
                10
            ) / 10
          : null;

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        usn: student.usn,
        semester: student.semester,
        isGraduated: student.isGraduated,
        department: student.department,
        createdAt: student.createdAt,
        testsTaken,
        averageScore,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ students: result, total, page, limit, totalPages });
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
