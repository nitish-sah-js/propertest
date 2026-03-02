import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "better-auth/crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   RESET & SEED                                  ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── 1. Delete everything (order matters for foreign keys) ─────────────
  console.log("── Deleting all data ──\n");

  await prisma.answer.deleteMany();
  console.log("  Deleted all answers");
  await prisma.testAttempt.deleteMany();
  console.log("  Deleted all test attempts");
  await prisma.testCase.deleteMany();
  console.log("  Deleted all test cases");
  await prisma.question.deleteMany();
  console.log("  Deleted all questions");
  await prisma.test.deleteMany();
  console.log("  Deleted all tests");
  await prisma.placementDrive.deleteMany();
  console.log("  Deleted all placement drives");
  await prisma.libraryTestCase.deleteMany();
  console.log("  Deleted all library test cases");
  await prisma.libraryQuestion.deleteMany();
  console.log("  Deleted all library questions");
  await prisma.session.deleteMany();
  console.log("  Deleted all sessions");
  await prisma.account.deleteMany();
  console.log("  Deleted all accounts");
  await prisma.user.deleteMany();
  console.log("  Deleted all users");
  await prisma.department.deleteMany();
  console.log("  Deleted all departments");
  await prisma.college.deleteMany();
  console.log("  Deleted all colleges");
  await prisma.verification.deleteMany();
  console.log("  Deleted all verifications");

  console.log("\n  All data cleared.\n");

  // ── 2. Create college ─────────────────────────────────────────────────
  console.log("── Creating college ──\n");

  const college = await prisma.college.create({
    data: {
      name: "Demo Engineering College",
      code: "DEMO2026",
      address: "123 Education Street",
      website: "https://demo-college.edu",
      contactEmail: "admin@demo-college.edu",
      contactPhone: "+1234567890",
      isActive: true,
    },
  });
  console.log(`  College: ${college.name} (${college.code})`);

  // ── 3. Create departments ─────────────────────────────────────────────
  console.log("\n── Creating departments ──\n");

  const deptData = [
    { name: "Computer Science", code: "CS" },
    { name: "Electronics", code: "ECE" },
    { name: "Mechanical", code: "ME" },
    { name: "Civil", code: "CE" },
  ];

  const departments: { id: string; name: string; code: string }[] = [];
  for (const d of deptData) {
    const dept = await prisma.department.create({
      data: { collegeId: college.id, name: d.name, code: d.code },
    });
    departments.push({ id: dept.id, name: dept.name, code: d.code });
    console.log(`  ${d.code} — ${d.name}`);
  }

  // ── 4. Helper to create a user with auth account ──────────────────────
  async function createUser(opts: {
    name: string;
    email: string;
    password: string;
    role: "SUPER_ADMIN" | "COLLEGE_ADMIN" | "STUDENT";
    collegeId?: string;
    departmentId?: string;
    semester?: number;
    usn?: string;
  }) {
    const hashedPassword = await hashPassword(opts.password);
    const user = await prisma.user.create({
      data: {
        name: opts.name,
        email: opts.email,
        emailVerified: true,
        role: opts.role,
        collegeId: opts.collegeId ?? null,
        departmentId: opts.departmentId ?? null,
        semester: opts.semester ?? null,
        usn: opts.usn ?? null,
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

  // ── 5. Create admin users ─────────────────────────────────────────────
  console.log("\n── Creating admin users ──\n");

  await createUser({
    name: "Super Admin",
    email: "admin@prepzero.com",
    password: "admin123456",
    role: "SUPER_ADMIN",
  });
  console.log("  SUPER_ADMIN:   admin@prepzero.com / admin123456");

  await createUser({
    name: "College Admin",
    email: "college@demo.com",
    password: "college123456",
    role: "COLLEGE_ADMIN",
    collegeId: college.id,
  });
  console.log("  COLLEGE_ADMIN: college@demo.com / college123456");

  // ── 6. Create students: 4 depts × 4 even semesters × 30 each = 480 ──
  const STUDENTS_PER_SEM = 30;
  const EVEN_SEMESTERS = [2, 4, 6, 8];
  const totalStudents = departments.length * EVEN_SEMESTERS.length * STUDENTS_PER_SEM;
  console.log(`\n── Creating students (4 depts × 4 even sems × ${STUDENTS_PER_SEM} = ${totalStudents}) ──\n`);

  const firstNames = [
    "Aarav", "Aditi", "Anika", "Arjun", "Diya", "Ishaan", "Kavya", "Krishna",
    "Meera", "Neha", "Om", "Priya", "Rahul", "Riya", "Rohan", "Saanvi",
    "Sahil", "Shreya", "Siddharth", "Tanvi", "Varun", "Vihaan", "Yash", "Zara",
    "Aditya", "Bhavya", "Chirag", "Deepa", "Esha", "Farhan",
  ];

  let count = 0;
  for (const dept of departments) {
    for (const sem of EVEN_SEMESTERS) {
      for (let i = 1; i <= STUDENTS_PER_SEM; i++) {
        const num = String(i).padStart(3, "0");
        const usn = `DEMO2026${dept.code}${String(sem).padStart(2, "0")}${num}`;
        const email = `${dept.code.toLowerCase()}.sem${sem}.s${i}@demo.com`;
        const firstName = firstNames[(i - 1) % firstNames.length];
        const name = `${firstName} ${dept.code}-S${sem}-${i}`;

        await createUser({
          name,
          email,
          password: "student123456",
          role: "STUDENT",
          collegeId: college.id,
          departmentId: dept.id,
          semester: sem,
          usn,
        });
        count++;
      }
    }
    console.log(`  ${dept.code} — ${EVEN_SEMESTERS.length * STUDENTS_PER_SEM} students (Sem 2: 30, Sem 4: 30, Sem 6: 30, Sem 8: 30)`);
  }

  // ── 7. Create a placement drive + sample test ─────────────────────────
  console.log("\n── Creating placement drive & sample test ──\n");

  const drive = await prisma.placementDrive.create({
    data: {
      collegeId: college.id,
      title: "TechCorp Campus Drive 2026",
      description: "Campus recruitment drive by TechCorp for SDE roles.",
      companyName: "TechCorp",
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`  Drive: ${drive.title}`);

  const test = await prisma.test.create({
    data: {
      driveId: drive.id,
      title: "Aptitude Round 1",
      description: "Basic aptitude and logical reasoning test.",
      instructions:
        "Answer all questions. No negative marking. Proctoring is enabled.",
      durationMinutes: 30,
      totalMarks: 5,
      passingMarks: 3,
      status: "PUBLISHED",
      startTime: new Date(),
      endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`  Test: ${test.title} (no eligibility criteria — no student can see it yet)`);

  const questions = [
    {
      questionText: "What is the next number in the series: 2, 6, 12, 20, 30, ?",
      questionType: "SINGLE_SELECT" as const,
      options: [
        { id: "q1a", text: "40" },
        { id: "q1b", text: "42" },
        { id: "q1c", text: "38" },
        { id: "q1d", text: "44" },
      ],
      correctOptionIds: ["q1b"],
      marks: 1,
      explanation: "The differences are 4, 6, 8, 10, 12. So next is 30+12=42.",
    },
    {
      questionText:
        "If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely Lazzies?",
      questionType: "SINGLE_SELECT" as const,
      options: [
        { id: "q2a", text: "True" },
        { id: "q2b", text: "False" },
        { id: "q2c", text: "Cannot be determined" },
        { id: "q2d", text: "Partially true" },
      ],
      correctOptionIds: ["q2a"],
      marks: 1,
      explanation: "Classic syllogism — if A⊂B and B⊂C, then A⊂C.",
    },
    {
      questionText:
        "A train 150m long passes a pole in 15 seconds. What is its speed in km/h?",
      questionType: "SINGLE_SELECT" as const,
      options: [
        { id: "q3a", text: "36 km/h" },
        { id: "q3b", text: "40 km/h" },
        { id: "q3c", text: "30 km/h" },
        { id: "q3d", text: "45 km/h" },
      ],
      correctOptionIds: ["q3a"],
      marks: 1,
      explanation: "Speed = 150/15 = 10 m/s = 10 × 3.6 = 36 km/h.",
    },
    {
      questionText:
        "Which of the following are prime numbers? (Select all that apply)",
      questionType: "MULTI_SELECT" as const,
      options: [
        { id: "q4a", text: "2" },
        { id: "q4b", text: "15" },
        { id: "q4c", text: "23" },
        { id: "q4d", text: "9" },
      ],
      correctOptionIds: ["q4a", "q4c"],
      marks: 1,
      explanation: "2 and 23 are prime. 15=3×5 and 9=3×3 are not.",
    },
    {
      questionText: "What is 25% of 80?",
      questionType: "SINGLE_SELECT" as const,
      options: [
        { id: "q5a", text: "15" },
        { id: "q5b", text: "20" },
        { id: "q5c", text: "25" },
        { id: "q5d", text: "30" },
      ],
      correctOptionIds: ["q5b"],
      marks: 1,
      explanation: "25% of 80 = 0.25 × 80 = 20.",
    },
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await prisma.question.create({
      data: {
        testId: test.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        correctOptionIds: q.correctOptionIds,
        marks: q.marks,
        negativeMarks: 0,
        explanation: q.explanation,
        order: i + 1,
      },
    });
  }
  console.log(`  ${questions.length} questions created`);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   SEED COMPLETE                                 ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");
  console.log("  Accounts:");
  console.log("  ─────────");
  console.log("  Super Admin:    admin@prepzero.com    / admin123456");
  console.log("  College Admin:  college@demo.com      / college123456");
  console.log("  All students:   <dept>.sem<N>@demo.com / student123456");
  console.log("");
  console.log("  Student emails (pattern: <dept>.sem<S>.s<N>@demo.com):");
  console.log("  ──────────────────────────────────────────────────────");
  console.log("  cs.sem2.s1@demo.com  … cs.sem2.s30@demo.com   (CS, Sem 2)");
  console.log("  cs.sem4.s1@demo.com  … cs.sem4.s30@demo.com   (CS, Sem 4)");
  console.log("  cs.sem6.s1@demo.com  … cs.sem6.s30@demo.com   (CS, Sem 6)");
  console.log("  cs.sem8.s1@demo.com  … cs.sem8.s30@demo.com   (CS, Sem 8)");
  console.log("  (same pattern for ece, me, ce)");
  console.log("");
  console.log("  Semesters: 2, 4, 6, 8 only (30 students each)");
  console.log("  College code: DEMO2026");
  console.log(`  Total students: ${totalStudents}`);
  console.log(`  Total users: ${totalStudents + 2} (${totalStudents} students + 2 admins)`);
  console.log("══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
