"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useMediaStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    setIsPending(true);
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = s;
      setStream(s);
      return s;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Camera/mic access denied";
      setError(msg);
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const toggleAudio = useCallback(() => {
    if (!streamRef.current) return false;
    const track = streamRef.current.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }, []);

  const toggleVideo = useCallback(() => {
    if (!streamRef.current) return false;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { stream, error, isPending, start, stop, toggleAudio, toggleVideo };
}
