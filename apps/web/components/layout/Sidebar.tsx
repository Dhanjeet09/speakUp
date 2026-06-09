"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { Tooltip } from "@/components/ui/tooltip";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/match", label: "Practice", icon: "🎯" },
  { href: "/friends", label: "Friends", icon: "👥" },
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/history", label: "History", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const { profile } = useAuthStore();

  return (
    <aside className="flex h-full flex-col bg-white border-r border-border">
      <div className="flex h-navbar items-center gap-3 border-b border-border px-5">
        <Link href="/dashboard" onClick={onNavClick} className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white text-sm font-bold">
            S
          </div>
          <span className="text-lg font-bold text-text-primary">SpeakUp</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-body-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-text-secondary hover:bg-gray-50 hover:text-text-primary"
                  )}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {profile?.role === "moderator" || profile?.role === "admin" ? (
          <>
            <div className="my-3 border-t border-border" />
            <p className="px-4 pb-2 text-caption font-semibold uppercase tracking-wider text-text-muted">
              Moderation
            </p>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/admin"
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-body-sm font-medium transition-all duration-200",
                    pathname === "/admin"
                      ? "bg-primary/10 text-primary"
                      : "text-text-secondary hover:bg-gray-50 hover:text-text-primary"
                  )}
                >
                  <span className="text-lg">🛡️</span>
                  <span>Admin Panel</span>
                </Link>
              </li>
            </ul>
          </>
        ) : null}
      </nav>

      <div className="border-t border-border p-3">
        <Tooltip content={profile?.name || "Profile"}>
          <Link
            href={`/profile/${profile?.id || ""}`}
            onClick={onNavClick}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-sm font-semibold text-primary">
              {profile?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-text-primary">
                {profile?.name || "User"}
              </p>
              <p className="truncate text-caption text-text-muted">{profile?.englishLevel || "Learner"}</p>
            </div>
          </Link>
        </Tooltip>
      </div>
    </aside>
  );
}
