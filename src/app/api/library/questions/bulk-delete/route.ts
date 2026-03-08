import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

const requestSchema = z.object({
  questionIds: z.array(z.string()).min(1, "At least 1 question ID is required"),
});

// POST /api/library/questions/bulk-delete — delete multiple library questions
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; collegeId: string | null };
    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { questionIds } = parsed.data;

    // Build where clause based on role
    // College admins can only delete their own private questions, not global ones
    const where: Record<string, unknown> = { id: { in: questionIds } };
    if (user.role === "COLLEGE_ADMIN") {
      where.collegeId = user.collegeId;
    }

    const result = await prisma.libraryQuestion.deleteMany({ where });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("POST /api/library/questions/bulk-delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
