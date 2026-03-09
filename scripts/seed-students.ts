/**
 * Seed 100 students into DEMO2026 college:
 *   - 50 in CS department, semester 3
 *   - 50 in IS department, semester 7
 *
 * Usage: npx tsx scripts/seed-students.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "better-auth/crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "student123456";

async function main() {
  console.log("Seeding 100 students into DEMO2026...\n");

  // Find college
  const college = await prisma.college.findUnique({
    where: { code: "DEMO2026" },
  });
  if (!college) {
    console.error("College DEMO2026 not found. Run `npm run db:seed` first.");
    process.exit(1);
  }

  // Upsert CS and IS departments
  let csDept = await prisma.department.findFirst({
    where: { collegeId: college.id, name: "Computer Science" },
  });
  if (!csDept) {
    csDept = await prisma.department.create({
      data: { collegeId: college.id, name: "Computer Science", code: "CS" },
    });
    console.log("  + Created department: Computer Science (CS)");
  } else {
    console.log("  ✓ Department: Computer Science (CS) already exists");
  }

  let isDept = await prisma.department.findFirst({
    where: { collegeId: college.id, name: "Information Science" },
  });
  if (!isDept) {
    isDept = await prisma.department.create({
      data: { collegeId: college.id, name: "Information Science", code: "IS" },
    });
    console.log("  + Created department: Information Science (IS)");
  } else {
    console.log("  ✓ Department: Information Science (IS) already exists");
  }

  const hashed = await hashPassword(PASSWORD);

  const batches: { dept: typeof csDept; code: string; semester: number; count: number }[] = [
    { dept: csDept, code: "CS", semester: 3, count: 50 },
    { dept: isDept, code: "IS", semester: 7, count: 50 },
  ];

  let created = 0;
  let skipped = 0;

  for (const batch of batches) {
    console.log(`\n  Seeding ${batch.count} ${batch.code} students (semester ${batch.semester})...`);

    for (let i = 1; i <= batch.count; i++) {
      const num = String(i).padStart(3, "0");
      const email = `${batch.code.toLowerCase()}.student${num}@demo.com`;
      const name = `${batch.code} Student ${num}`;
      const usn = `DEMO2026${batch.code}${num}`;

      // Skip if already exists
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            emailVerified: true,
            role: "STUDENT",
            collegeId: college.id,
            departmentId: batch.dept.id,
            semester: batch.semester,
            usn,
          },
        });

        await tx.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: hashed,
          },
        });
      });

      created++;
    }

    console.log(`    ${batch.code}: done`);
  }

  console.log("\n========================================");
  console.log(`  Created: ${created} students`);
  console.log(`  Skipped: ${skipped} (already exist)`);
  console.log("========================================");
  console.log("  Password for all: student123456");
  console.log("  CS emails: cs.student001@demo.com ... cs.student050@demo.com");
  console.log("  IS emails: is.student001@demo.com ... is.student050@demo.com");
  console.log("========================================\n");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
