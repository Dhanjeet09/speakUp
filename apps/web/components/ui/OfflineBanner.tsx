"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function onOnline() { setOffline(false); }
    function onOffline() { setOffline(true); }
    setOffline(!navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-danger px-4 py-2 text-center text-sm text-white"
      role="alert"
    >
      You are offline. Connect to the internet to continue using SpeakUp.
    </div>
  );
}
