"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile } = useAuthStore();
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password";
  const isLanding = pathname === "/";

  if (!isLanding && !isAuthPage) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-navbar max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white text-sm font-bold">
            S
          </div>
          <span className="text-xl font-bold text-text-primary">SpeakUp</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
              <form action="/auth/signout" method="post">
                <Button variant="ghost" size="sm">Sign Out</Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Log In</Button></Link>
              <Link href="/signup"><Button size="sm">Sign Up</Button></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
