import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/layout/AuthProvider";
import Navbar from "@/components/layout/Navbar";
import AppShell from "@/components/layout/AppShell";
import OfflineBanner from "@/components/ui/OfflineBanner";
import FriendCallHandler from "@/components/call/FriendCallHandler";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SpeakUp - Practice English with Real People",
  description:
    "Practice English speaking with real people face-to-face. Find a partner, video call, and improve your fluency.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>
        <AuthProvider>
          <OfflineBanner />
          <FriendCallHandler />
          <Navbar />
          <AppShell>{children}</AppShell>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: "12px",
                background: "#0F172A",
                color: "#fff",
                fontSize: "14px",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
