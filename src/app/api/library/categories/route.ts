import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-guard";

// GET /api/library/categories — get distinct categories for autocomplete
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { role: string };
    if (user.role !== "SUPER_ADMIN" && user.role !== "COLLEGE_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = await prisma.libraryQuestion.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    const categories = results.map((r) => r.category);

    return NextResponse.json(categories);
  } catch (error) {
    console.error("GET /api/library/categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
