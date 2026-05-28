"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
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
    <section className="flex flex-col items-center px-4 py-20 text-center">
      <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
        Practice English speaking with{" "}
        <span className="text-primary">real people</span>, face-to-face
      </h1>
      <p className="mt-4 max-w-xl text-lg text-gray-600">
        SpeakUp connects you with English learners worldwide for live video
        conversations. Improve your fluency, build confidence, and make friends.
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
      <div className="mt-6 flex h-6 items-center gap-2 text-sm text-gray-500">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-success" />
        {onlineCount > 0
          ? `${onlineCount} users online now`
          : "Connecting..."}
      </div>
    </section>
  );
}
