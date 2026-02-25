import { getSession } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { TestInterface } from "@/components/test/test-interface";

export default async function TestAttemptPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
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

  const { testId } = await params;

  return <TestInterface testId={testId} />;
}
