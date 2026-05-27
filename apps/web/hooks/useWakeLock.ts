"use client";

import { useEffect, useRef } from "react";

export function useWakeLock(active: boolean) {
  const wlRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let cancelled = false;

    navigator.wakeLock.request("screen").then((wl) => {
      if (cancelled) {
        wl.release();
        return;
      }
      wlRef.current = wl;
      wl.addEventListener("release", () => {
        wlRef.current = null;
      });
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (wlRef.current) {
        wlRef.current.release();
        wlRef.current = null;
      }
    };
  }, [active]);
}
