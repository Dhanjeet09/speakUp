"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const { user, profile } = useAuthStore();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-primary">
          SpeakUp
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-primary"
              >
                Dashboard
              </Link>
              <Link
                href={profile ? `/profile/${profile.id}` : "/settings"}
                className="text-sm text-gray-600 hover:text-primary"
              >
                Profile
              </Link>
              <Link href="/settings" className="text-sm text-gray-600 hover:text-primary">
                Settings
              </Link>
              <form action="/auth/signout" method="post">
                <Button variant="ghost" size="sm" type="submit">
                  Sign Out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign Up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
