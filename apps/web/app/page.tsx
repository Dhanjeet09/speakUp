"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSocket, disconnectSocket } from "@/lib/socket";

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const steps = [
  { title: "Sign Up", desc: "Create your free account in 30 seconds", icon: "1" },
  { title: "Set Your Level", desc: "Tell us your English level and interests", icon: "2" },
  { title: "Get Matched", desc: "We find the perfect partner for you", icon: "3" },
  { title: "Start Speaking", desc: "Video call and practice together", icon: "4" },
];
const features = [
  { title: "Smart Matching", desc: "Matched by level and interests for the best conversation experience", icon: "🎯" },
  { title: "Daily Topics", desc: "Never run out of things to talk about", icon: "💡" },
  { title: "Progress Tracking", desc: "Watch your fluency improve over time", icon: "📈" },
  { title: "Safe Community", desc: "Report and block features keep everyone safe", icon: "🛡️" },
];

export default function LandingPage() {
  const { user } = useAuthStore();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    socket.on("onlineCount", ({ count }: { count: number }) => setOnlineCount(count));
    socket.emit("getOnlineCount");
    return () => { socket.off("onlineCount"); disconnectSocket(); };
  }, []);

  return (
    <main>
      {/* Hero */}
      <section className="relative flex flex-col items-center px-4 pt-28 pb-20 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <Badge variant="secondary" className="mb-5 px-4 py-1.5 text-xs animate-fade-in">
          {onlineCount > 0 ? `🟢 ${onlineCount} speaking right now` : "🌐 Connecting..."}
        </Badge>
        <h1 className="text-h1 tracking-tight max-w-3xl animate-slide-up">
          Practice English speaking with{" "}
          <span className="text-gradient">real people</span>, face-to-face
        </h1>
        <p className="mt-4 max-w-xl text-body-lg text-text-secondary animate-fade-in">
          SpeakUp connects you with English learners worldwide for live video
          conversations. Improve your fluency, build confidence, and make friends.
        </p>
        <div className="mt-10 flex items-center gap-4 animate-fade-in">
          <Link href={user ? "/dashboard" : "/signup"}>
            <Button size="lg" className="shadow-lg shadow-primary/20">Start speaking now</Button>
          </Link>
          {!user && (
            <Link href="/login">
              <Button variant="outline" size="lg">I already have an account</Button>
            </Link>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-24" id="features">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-h2 text-center">How it works</h2>
          <p className="mt-2 text-center text-body-reg text-text-secondary max-w-lg mx-auto">Get started in four simple steps</p>
          <div className="mt-14 grid gap-8 md:grid-cols-4">
            {steps.map((step, i) => (
              <div key={i} className="group relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-xl font-bold text-white shadow-lg shadow-primary/15 group-hover:scale-105 transition-transform">
                  {step.icon}
                </div>
                <h3 className="mt-5 font-semibold text-h4">{step.title}</h3>
                <p className="mt-1 text-body-sm text-text-secondary">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why SpeakUp */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-h2 text-center">Why SpeakUp?</h2>
          <p className="mt-2 text-center text-body-reg text-text-secondary max-w-lg mx-auto">Everything you need to improve your spoken English</p>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <div key={i} className="group rounded-2xl border border-border bg-white p-6 shadow-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="font-semibold text-h4">{f.title}</h3>
                <p className="mt-2 text-body-sm text-text-secondary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Levels */}
      <section className="bg-white py-24" id="about">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-h2">All levels welcome</h2>
          <p className="mt-2 text-body-reg text-text-secondary max-w-lg mx-auto">Whether you are just starting or almost fluent, we have a partner for you.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {levels.map((level) => (
              <Badge key={level} variant="outline" className="px-6 py-3 text-body-sm hover:border-primary hover:text-primary transition-colors cursor-default">
                {level}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-h2">Ready to start speaking?</h2>
          <p className="mt-2 text-body-reg text-text-secondary">Join thousands of learners improving their English every day.</p>
          <div className="mt-10">
            <Link href={user ? "/dashboard" : "/signup"}>
              <Button size="xl" className="shadow-lg shadow-primary/20 px-10">Get started free</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 text-center text-body-sm text-text-muted">
          © {new Date().getFullYear()} SpeakUp. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
