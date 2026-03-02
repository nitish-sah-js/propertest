import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "better-auth/crypto";
import { isStudentEligible } from "../src/lib/test-eligibility.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Helpers ────────────────────────────────────────────────────────────────

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";

interface TestResult {
  scenario: string;
  check: string;
  expected: boolean;
  actual: boolean;
  status: "PASS" | "FAIL";
}

const results: TestResult[] = [];

function check(
  scenario: string,
  description: string,
  expected: boolean,
  actual: boolean
) {
  const status = expected === actual ? "PASS" : "FAIL";
  results.push({ scenario, check: description, expected, actual, status });
  const icon = status === "PASS" ? PASS : FAIL;
  console.log(
    `  ${icon} ${description} — expected: ${expected}, got: ${actual}`
  );
}

async function createStudentUser(
  name: string,
  email: string,
  collegeId: string,
  departmentId: string,
  semester: number
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Update dept/semester in case they changed
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { departmentId, semester, collegeId, role: "STUDENT" },
    });
    return updated;
  }

  const hashedPassword = await hashPassword("test123456");
  const user = await prisma.user.create({
    data: {
      name,
      email,
      emailVerified: true,
      role: "STUDENT",
      collegeId,
      departmentId,
      semester,
    },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hashedPassword,
    },
  });
  return user;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   ELIGIBILITY TEST SUITE                        ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── 1. Setup: College + Departments ───────────────────────────────────────

  console.log("── Setting up college & departments ──\n");

  const college = await prisma.college.upsert({
    where: { code: "TEST2026" },
    update: {},
    create: {
      name: "Test Engineering College",
      code: "TEST2026",
      isActive: true,
    },
  });

  const deptNames = [
    "Computer Science",
    "Electronics",
    "Mechanical",
    "Civil",
  ];
  const departments: Record<string, { id: string; name: string }> = {};

  for (const name of deptNames) {
    const dept = await prisma.department.upsert({
      where: { collegeId_name: { collegeId: college.id, name } },
      update: {},
      create: { collegeId: college.id, name, code: name.slice(0, 3).toUpperCase() },
    });
    departments[name] = { id: dept.id, name: dept.name };
    console.log(`  Dept: ${dept.name} (${dept.id})`);
  }

  // ── 2. Create students across all 8 semesters × 4 departments ────────────

  console.log("\n── Creating students (4 depts × 8 semesters = 32) ──\n");

  interface Student {
    id: string;
    email: string;
    name: string;
    departmentId: string | null;
    semester: number | null;
    deptName: string;
  }

  const students: Student[] = [];

  for (const [deptName, dept] of Object.entries(departments)) {
    for (let sem = 1; sem <= 8; sem++) {
      const shortDept = deptName.slice(0, 2).toLowerCase();
      const email = `${shortDept}.sem${sem}@test.com`;
      const name = `${deptName} Sem-${sem}`;
      const user = await createStudentUser(
        name,
        email,
        college.id,
        dept.id,
        sem
      );
      students.push({
        id: user.id,
        email: user.email,
        name: user.name,
        departmentId: user.departmentId,
        semester: user.semester,
        deptName,
      });
    }
  }
  console.log(`  Created/updated ${students.length} students\n`);

  // ── 3. Create a placement drive ───────────────────────────────────────────

  let drive = await prisma.placementDrive.findFirst({
    where: { collegeId: college.id, title: "Eligibility Test Drive" },
  });
  if (!drive) {
    drive = await prisma.placementDrive.create({
      data: {
        collegeId: college.id,
        title: "Eligibility Test Drive",
        companyName: "TestCorp",
        status: "ACTIVE",
      },
    });
  }

  // Clean up old test data from previous runs
  await prisma.test.deleteMany({ where: { driveId: drive.id } });

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Semester + Department filter only (no CSV/allowedStudentIds)
  // ══════════════════════════════════════════════════════════════════════════

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 1: Department (CS) + Semester (4) filter");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const csDept = departments["Computer Science"];
  const test1 = await prisma.test.create({
    data: {
      driveId: drive.id,
      title: "Scenario 1 — Dept+Sem",
      status: "PUBLISHED",
      durationMinutes: 30,
      totalMarks: 10,
      allowedDepartmentIds: [csDept.id],
      allowedSemesters: [4],
      allowedStudentIds: Prisma.DbNull,
    },
  });

  // CS Sem-4 should be eligible
  const csSem4 = students.find(
    (s) => s.deptName === "Computer Science" && s.semester === 4
  )!;
  check(
    "Scenario 1",
    "CS Sem-4 student CAN access dept+sem test",
    true,
    isStudentEligible(test1, csSem4)
  );

  // CS Sem-3 should NOT be eligible (wrong semester)
  const csSem3 = students.find(
    (s) => s.deptName === "Computer Science" && s.semester === 3
  )!;
  check(
    "Scenario 1",
    "CS Sem-3 student CANNOT access dept+sem test (wrong sem)",
    false,
    isStudentEligible(test1, csSem3)
  );

  // ECE Sem-4 should NOT be eligible (wrong dept)
  const eceSem4 = students.find(
    (s) => s.deptName === "Electronics" && s.semester === 4
  )!;
  check(
    "Scenario 1",
    "ECE Sem-4 student CANNOT access dept+sem test (wrong dept)",
    false,
    isStudentEligible(test1, eceSem4)
  );

  // Mech Sem-6 should NOT (both wrong)
  const mechSem6 = students.find(
    (s) => s.deptName === "Mechanical" && s.semester === 6
  )!;
  check(
    "Scenario 1",
    "MECH Sem-6 student CANNOT access (wrong dept+sem)",
    false,
    isStudentEligible(test1, mechSem6)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Department only (all semesters in that dept)
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 2: Department only (Electronics, all sems)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const eceDept = departments["Electronics"];
  const test2 = await prisma.test.create({
    data: {
      driveId: drive.id,
      title: "Scenario 2 — Dept only",
      status: "PUBLISHED",
      durationMinutes: 30,
      totalMarks: 10,
      allowedDepartmentIds: [eceDept.id],
      allowedSemesters: Prisma.DbNull,
      allowedStudentIds: Prisma.DbNull,
    },
  });

  const eceSem1 = students.find(
    (s) => s.deptName === "Electronics" && s.semester === 1
  )!;
  check(
    "Scenario 2",
    "ECE Sem-1 CAN access dept-only test",
    true,
    isStudentEligible(test2, eceSem1)
  );

  const eceSem8 = students.find(
    (s) => s.deptName === "Electronics" && s.semester === 8
  )!;
  check(
    "Scenario 2",
    "ECE Sem-8 CAN access dept-only test",
    true,
    isStudentEligible(test2, eceSem8)
  );

  const csSem1 = students.find(
    (s) => s.deptName === "Computer Science" && s.semester === 1
  )!;
  check(
    "Scenario 2",
    "CS Sem-1 CANNOT access ECE-only test",
    false,
    isStudentEligible(test2, csSem1)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Semester only (all depts for that sem)
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 3: Semester only (Sem 6, all departments)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const test3 = await prisma.test.create({
    data: {
      driveId: drive.id,
      title: "Scenario 3 — Sem only",
      status: "PUBLISHED",
      durationMinutes: 30,
      totalMarks: 10,
      allowedDepartmentIds: Prisma.DbNull,
      allowedSemesters: [6],
      allowedStudentIds: Prisma.DbNull,
    },
  });

  const civilSem6 = students.find(
    (s) => s.deptName === "Civil" && s.semester === 6
  )!;
  check(
    "Scenario 3",
    "Civil Sem-6 CAN access sem-only test",
    true,
    isStudentEligible(test3, civilSem6)
  );

  const csSem6 = students.find(
    (s) => s.deptName === "Computer Science" && s.semester === 6
  )!;
  check(
    "Scenario 3",
    "CS Sem-6 CAN access sem-only test",
    true,
    isStudentEligible(test3, csSem6)
  );

  const civilSem5 = students.find(
    (s) => s.deptName === "Civil" && s.semester === 5
  )!;
  check(
    "Scenario 3",
    "Civil Sem-5 CANNOT access sem-6-only test",
    false,
    isStudentEligible(test3, civilSem5)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: CSV only (specific student IDs, no dept/sem)
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 4: CSV only (3 specific students)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Pick 3 random students from different depts/semesters
  const csvStudent1 = students.find(
    (s) => s.deptName === "Computer Science" && s.semester === 2
  )!;
  const csvStudent2 = students.find(
    (s) => s.deptName === "Mechanical" && s.semester === 5
  )!;
  const csvStudent3 = students.find(
    (s) => s.deptName === "Civil" && s.semester === 8
  )!;

  const test4 = await prisma.test.create({
    data: {
      driveId: drive.id,
      title: "Scenario 4 — CSV only",
      status: "PUBLISHED",
      durationMinutes: 30,
      totalMarks: 10,
      allowedDepartmentIds: Prisma.DbNull,
      allowedSemesters: Prisma.DbNull,
      allowedStudentIds: [csvStudent1.id, csvStudent2.id, csvStudent3.id],
    },
  });

  check(
    "Scenario 4",
    `CSV student (CS Sem-2) CAN access`,
    true,
    isStudentEligible(test4, csvStudent1)
  );
  check(
    "Scenario 4",
    `CSV student (Mech Sem-5) CAN access`,
    true,
    isStudentEligible(test4, csvStudent2)
  );
  check(
    "Scenario 4",
    `CSV student (Civil Sem-8) CAN access`,
    true,
    isStudentEligible(test4, csvStudent3)
  );

  // A student NOT in the CSV list should NOT access
  const notInCsv = students.find(
    (s) => s.deptName === "Electronics" && s.semester === 3
  )!;
  check(
    "Scenario 4",
    `Non-CSV student (ECE Sem-3) CANNOT access`,
    false,
    isStudentEligible(test4, notInCsv)
  );

  // Another student same dept/sem as a CSV student but not listed
  const sameDeptSem = students.find(
    (s) =>
      s.deptName === "Computer Science" &&
      s.semester === 2 &&
      s.id !== csvStudent1.id
  );
  if (sameDeptSem) {
    check(
      "Scenario 4",
      "Same dept+sem as CSV student but NOT in list → CANNOT access",
      false,
      isStudentEligible(test4, sameDeptSem)
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Dept + Sem + CSV combined
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 5: Dept (CS) + Sem (4) + CSV (extra Mech Sem-7)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const extraCsvStudent = students.find(
    (s) => s.deptName === "Mechanical" && s.semester === 7
  )!;

  const test5 = await prisma.test.create({
    data: {
      driveId: drive.id,
      title: "Scenario 5 — Dept+Sem+CSV",
      status: "PUBLISHED",
      durationMinutes: 30,
      totalMarks: 10,
      allowedDepartmentIds: [csDept.id],
      allowedSemesters: [4],
      allowedStudentIds: [extraCsvStudent.id],
    },
  });

  // CS Sem-4 matches dept+sem → should be eligible
  check(
    "Scenario 5",
    "CS Sem-4 CAN access (matches dept+sem)",
    true,
    isStudentEligible(test5, csSem4)
  );

  // Mech Sem-7 is in CSV → should be eligible (override)
  check(
    "Scenario 5",
    "Mech Sem-7 CAN access (in CSV, overrides dept+sem)",
    true,
    isStudentEligible(test5, extraCsvStudent)
  );

  // ECE Sem-4 — right sem, wrong dept, not in CSV → should NOT
  check(
    "Scenario 5",
    "ECE Sem-4 CANNOT access (wrong dept, not in CSV)",
    false,
    isStudentEligible(test5, eceSem4)
  );

  // CS Sem-3 — right dept, wrong sem, not in CSV → should NOT
  check(
    "Scenario 5",
    "CS Sem-3 CANNOT access (wrong sem, not in CSV)",
    false,
    isStudentEligible(test5, csSem3)
  );

  // Civil Sem-2 — all wrong → should NOT
  const civilSem2 = students.find(
    (s) => s.deptName === "Civil" && s.semester === 2
  )!;
  check(
    "Scenario 5",
    "Civil Sem-2 CANNOT access (wrong dept+sem, not in CSV)",
    false,
    isStudentEligible(test5, civilSem2)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: No criteria set (all null) → no one should see
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 6: No criteria set (all null)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const test6 = await prisma.test.create({
    data: {
      driveId: drive.id,
      title: "Scenario 6 — No criteria",
      status: "PUBLISHED",
      durationMinutes: 30,
      totalMarks: 10,
      allowedDepartmentIds: Prisma.DbNull,
      allowedSemesters: Prisma.DbNull,
      allowedStudentIds: Prisma.DbNull,
    },
  });

  check(
    "Scenario 6",
    "Any student CANNOT access test with no criteria",
    false,
    isStudentEligible(test6, csSem4)
  );
  check(
    "Scenario 6",
    "Another student CANNOT access test with no criteria",
    false,
    isStudentEligible(test6, eceSem8)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: Empty arrays ([] instead of null) → no one should see
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 7: Empty arrays ([])");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const test7 = await prisma.test.create({
    data: {
      driveId: drive.id,
      title: "Scenario 7 — Empty arrays",
      status: "PUBLISHED",
      durationMinutes: 30,
      totalMarks: 10,
      allowedDepartmentIds: [],
      allowedSemesters: [],
      allowedStudentIds: [],
    },
  });

  check(
    "Scenario 7",
    "Any student CANNOT access test with empty arrays",
    false,
    isStudentEligible(test7, csSem4)
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   RESULTS SUMMARY                               ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const passed = results.filter((r) => r.status === "PASS");
  const failed = results.filter((r) => r.status === "FAIL");

  console.log(`  Total: ${results.length}`);
  console.log(`  ${PASS}: ${passed.length}`);
  console.log(`  ${FAIL}: ${failed.length}\n`);

  if (failed.length > 0) {
    console.log("  ── FAILURES ──\n");
    for (const f of failed) {
      console.log(`  ${FAIL} [${f.scenario}] ${f.check}`);
      console.log(`       expected: ${f.expected}, got: ${f.actual}\n`);
    }
  }

  // Write report to file
  const report = [
    "# Eligibility Test Report",
    `\nRun: ${new Date().toISOString()}`,
    `\nTotal: ${results.length} | Pass: ${passed.length} | Fail: ${failed.length}`,
    "",
    "## All Results",
    "",
    ...results.map(
      (r) =>
        `- [${r.status}] **${r.scenario}**: ${r.check} (expected: ${r.expected}, got: ${r.actual})`
    ),
  ];

  if (failed.length > 0) {
    report.push("", "## Problems Found", "");
    for (const f of failed) {
      report.push(`### ${f.scenario}: ${f.check}`);
      report.push(`- Expected: ${f.expected}`);
      report.push(`- Actual: ${f.actual}`);
      report.push(
        `- Root cause: The \`isStudentEligible\` function does not handle this case correctly.`
      );
      report.push("");
    }
  }

  const reportPath = "scripts/eligibility-test-report.md";
  const fs = await import("fs");
  fs.writeFileSync(reportPath, report.join("\n"));
  console.log(`  Report written to ${reportPath}`);

  // Clean up test data
  await prisma.test.deleteMany({ where: { driveId: drive.id } });
  console.log("\n  Cleaned up test data.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
