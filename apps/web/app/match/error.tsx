"use client";

import { Button } from "@/components/ui/button";

export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900">Match error</h2>
      <p className="mt-2 text-gray-500 max-w-md">
        {error.message || "Unable to start matching. Check your camera and microphone permissions, then try again."}
      </p>
      <Button onClick={reset} variant="outline" className="mt-6">
        Try again
      </Button>
    </div>
  );
}
