"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        toast.error(result.error.message || "Invalid credentials");
        setLoading(false);
        return;
      }

      // Fetch session to get role and redirect
      const res = await fetch("/api/auth/get-session");
      const session = await res.json();
      const role = session?.user?.role;

      switch (role) {
        case "SUPER_ADMIN":
          router.push("/admin");
          break;
        case "COLLEGE_ADMIN":
          router.push("/college");
          break;
        case "STUDENT":
          router.push("/student");
          break;
        default:
          router.push("/");
      }
    } catch {
      toast.error("An error occurred during login");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">PrepZero</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <div className="text-sm text-center space-y-1">
            <p>
              College Admin?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Register here
              </Link>
            </p>
            <p>
              Student?{" "}
              <Link
                href="/register/student"
                className="text-primary hover:underline"
              >
                Register here
              </Link>
            </p>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
