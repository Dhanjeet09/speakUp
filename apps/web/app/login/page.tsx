"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/layout/Navbar";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    router.push("/dashboard");
  }

  async function handleGoogleLogin() {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4">
        <h1 className="text-2xl font-bold text-center">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          Log in to continue practicing
        </p>

        <form onSubmit={handleEmailLogin} className="mt-8 flex flex-col gap-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Logging in..." : "Log In"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <hr className="flex-1 border-gray-200" />
          <span className="text-xs text-gray-400">OR</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        <Button
          variant="outline"
          onClick={handleGoogleLogin}
          className="w-full"
        >
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-gray-500">
          No account yet?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </main>
    </>
  );
}
