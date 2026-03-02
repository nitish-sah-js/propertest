import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import * as fs from "fs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: { department: { select: { name: true, code: true } } },
  });

  // Shuffle and pick 25 random students across different depts/semesters
  const shuffled = students.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 25);

  // Build CSV
  const rows = ["name,usn,email,department"];
  for (const s of picked) {
    rows.push(`${s.name},${s.usn},${s.email},${s.department?.code ?? ""}`);
  }
  const csv = rows.join("\n") + "\n";

  fs.writeFileSync("test-students.csv", csv);

  // Print summary
  console.log(`CSV written to test-students.csv with ${picked.length} students:\n`);

  const deptCounts: Record<string, Record<number, number>> = {};
  for (const s of picked) {
    const dept = s.department?.code ?? "N/A";
    const sem = s.semester ?? 0;
    if (!deptCounts[dept]) deptCounts[dept] = {};
    deptCounts[dept][sem] = (deptCounts[dept][sem] || 0) + 1;
  }
  for (const [dept, sems] of Object.entries(deptCounts)) {
    const breakdown = Object.entries(sems)
      .map(([s, c]) => `Sem${s}:${c}`)
      .join(", ");
    console.log(`  ${dept}: ${breakdown}`);
  }

  console.log("\n--- CSV Content ---\n");
  console.log(csv);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
