"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

export default function SignupPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await getSupabase().auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Check your email to confirm your account!");
    router.push("/login");
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || phone.length < 10) { toast.error("Enter a valid phone number"); return; }
    setLoading(true);
    const { error } = await getSupabase().auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("OTP sent!");
    setStep("otp");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length < 4) { toast.error("Enter valid OTP"); return; }
    setLoading(true);
    const { error } = await getSupabase().auth.verifyOtp({ phone, token: otp, type: "sms" });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    router.push("/onboarding");
  }

  async function handleGoogleSignup() {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(error.message);
  }

  if (method === "phone" && step === "otp") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
        <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">📱</div>
            <h1 className="text-h3">Verify your phone</h1>
            <p className="mt-1 text-body-sm text-text-secondary">OTP sent to {phone}</p>
          </div>
          <form onSubmit={handleVerifyOtp} className="mt-6 flex flex-col gap-4">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Verifying..." : "Create Account"}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("credentials"); setPhone(""); setOtp(""); }}
              className="text-center text-body-sm text-text-secondary hover:text-primary"
            >
              Use a different number
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-border bg-white p-8 shadow-card">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 text-2xl">
            🎉
          </div>
          <h1 className="text-h3">Join SpeakUp</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            Start practicing English with real people
          </p>
        </div>

        <div className="mt-6 flex rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => setMethod("email")}
            className={`flex-1 rounded-lg py-2 text-body-sm font-medium transition-all ${
              method === "email" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary"
            }`}
          >Email</button>
          <button
            onClick={() => setMethod("phone")}
            className={`flex-1 rounded-lg py-2 text-body-sm font-medium transition-all ${
              method === "phone" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary"
            }`}
          >Phone</button>
        </div>

        {method === "email" ? (
          <form onSubmit={handleEmailSignup} className="mt-6 flex flex-col gap-4">
            <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSendOtp} className="mt-6 flex flex-col gap-4">
            <Input type="tel" placeholder="Phone number (e.g. +1234567890)" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </form>
        )}

        <div className="my-6 flex items-center gap-3">
          <hr className="flex-1 border-border" />
          <span className="text-caption text-text-muted">OR</span>
          <hr className="flex-1 border-border" />
        </div>

        <Button variant="outline" onClick={handleGoogleSignup} className="w-full">
          <svg className="mr-2 size-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-body-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">Log in</Link>
        </p>
      </div>
    </main>
  );
}
