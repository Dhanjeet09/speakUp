"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getSocket, disconnectSocket } from "@/lib/socket";

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const steps = [
  { title: "Sign Up", desc: "Create your free account in 30 seconds" },
  { title: "Set Your Level", desc: "Tell us your English level and interests" },
  { title: "Get Matched", desc: "We find the perfect partner for you" },
  { title: "Start Speaking", desc: "Video call and practice together" },
];
const features = [
  { title: "Smart Matching", desc: "Matched by level and interests for the best conversation experience" },
  { title: "Daily Topics", desc: "Never run out of things to talk about" },
  { title: "Progress Tracking", desc: "Watch your fluency improve over time" },
  { title: "Safe Community", desc: "Report and block features keep everyone safe" },
];

export default function LandingPage() {
  const { user } = useAuthStore();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    socket.on("onlineCount", ({ count }: { count: number }) => {
      setOnlineCount(count);
    });

    socket.emit("getOnlineCount");

    return () => {
      socket.off("onlineCount");
      disconnectSocket();
    };
  }, []);

  return (
    <>
      <Navbar />
      <main>
        <section className="flex flex-col items-center px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Practice English speaking with{" "}
            <span className="text-primary">real people</span>, face-to-face
          </h1>
          <p className="mt-4 max-w-xl text-lg text-gray-600">
            SpeakUp connects you with English learners worldwide for live video
            conversations. Improve your fluency, build confidence, and make
            friends.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link href={user ? "/dashboard" : "/signup"}>
              <Button size="lg">Start Speaking Now</Button>
            </Link>
            {!user && (
              <Link href="/login">
                <Button variant="outline" size="lg">
                  I already have an account
                </Button>
              </Link>
            )}
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            {onlineCount > 0
              ? `${onlineCount} users online now`
              : "Connecting..."}
          </div>
        </section>

        <section className="bg-white py-16" id="features">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-bold">How it works</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-4">
              {steps.map((step, i) => (
                <div key={i} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {i + 1}
                  </div>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-bold">Why SpeakUp?</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="rounded-card border border-gray-200 bg-white p-6"
                >
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-16" id="about">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h2 className="text-2xl font-bold">All levels welcome</h2>
            <p className="mt-2 text-gray-600">
              Whether you are just starting or almost fluent, we have a partner
              for you.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {levels.map((level) => (
                <Badge key={level} variant="outline" className="px-4 py-2 text-sm">
                  {level}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
