"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Drawer } from "@/components/ui/drawer";

const breadcrumbMap: Record<string, { label: string; href?: string }[]> = {
  "/dashboard": [{ label: "Dashboard" }],
  "/match": [{ label: "Practice" }],
  "/friends": [{ label: "Friends" }],
  "/chat": [{ label: "Chat" }],
  "/history": [{ label: "History" }],
  "/settings": [{ label: "Settings" }],
  "/admin": [{ label: "Admin" }],
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isAppRoute = pathname !== "/" && pathname !== "/login" && pathname !== "/signup" && pathname !== "/forgot-password" && !pathname.startsWith("/auth/");

  if (!isAppRoute) return <>{children}</>;

  const crumbs = breadcrumbMap[pathname] || [];
  const pageTitle = crumbs.length > 0 ? crumbs[crumbs.length - 1].label : "";

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Navigation" side="left">
        <Sidebar onNavClick={() => setMobileNavOpen(false)} />
      </Drawer>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-navbar shrink-0 items-center gap-4 border-b border-border bg-white px-4 sm:px-6">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex md:hidden items-center justify-center rounded-lg p-2 text-text-secondary hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Breadcrumb items={crumbs} />
          <div className="ml-auto flex items-center gap-3">
            <form action="/auth/signout" method="post">
              <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-body-sm text-text-secondary hover:bg-gray-100 transition-colors">
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
