"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) { toast.error(error.message); } else { setSent(true); toast.success("Check your email"); }
    } catch { toast.error("Something went wrong"); } finally { setLoading(false); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">🔑</div>
          <h1 className="text-h3">Reset your password</h1>
          <p className="mt-1 text-body-sm text-text-secondary">Enter your email to receive a reset link</p>
        </div>
        {sent ? (
          <div className="mt-6 text-center space-y-4">
            <p className="text-body-sm text-text-secondary">Check your email for the password reset link.</p>
            <Link href="/login"><Button variant="outline" className="w-full">Back to login</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <Input type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" disabled={loading} className="w-full">{loading ? "Sending..." : "Send reset link"}</Button>
            <Link href="/login" className="text-center text-body-sm text-primary hover:underline">Back to login</Link>
          </form>
        )}
      </div>
    </main>
  );
}
