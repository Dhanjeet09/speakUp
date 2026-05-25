import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/layout/AuthProvider";

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
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: "8px",
                background: "#333",
                color: "#fff",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
