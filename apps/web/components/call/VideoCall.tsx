"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCallStore } from "@/store/useCallStore";
import {
  createPeer,
  destroyPeer,
  startLocalStream,
  getLocalStream,
  answerIncomingCall,
  initiateCall,
  toggleMute,
  toggleCamera,
  endCall,
} from "@/lib/webrtc";
import { Button } from "@/components/ui/button";

interface VideoCallProps {
  partnerPeerId: string;
  isCaller: boolean;
  onEndCall: () => void;
}

type ConnectionQuality = "good" | "fair" | "poor";

export default function VideoCall({
  partnerPeerId,
  isCaller,
  onEndCall,
}: VideoCallProps) {
  const { user } = useAuthStore();
  const { isMuted, isCameraOff, setIsMuted, setIsCameraOff } = useCallStore();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<ReturnType<typeof createPeer> | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [quality, setQuality] = useState<ConnectionQuality>("good");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!("mediaDevices" in navigator)) {
      setCallError("Camera and microphone not available on this device");
      return;
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const currentUserId = user.id;

    async function init() {
      try {
        const stream = await startLocalStream();
        if (cancelled) return;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const peer = createPeer(currentUserId);
        peerRef.current = peer;

        if (isCaller) {
          const remoteStream = await new Promise<MediaStream>(
            (resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error("Call connection timed out")),
                20000
              );
              peer.on("open", () => {
                clearTimeout(timeout);
                if (cancelled) return;
                const local = getLocalStream();
                if (!local) {
                  reject(new Error("No local stream available"));
                  return;
                }
                initiateCall(partnerPeerId, local, (remote) => {
                  resolve(remote);
                });
              });
              peer.on("error", (err) => {
                clearTimeout(timeout);
                reject(new Error(err.message));
              });
            }
          );

          if (cancelled) return;
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        } else {
          await answerIncomingCall((remoteStream) => {
            if (!cancelled && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Failed to start video call";
          setCallError(msg);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      destroyPeer();
      peerRef.current = null;
    };
  }, [user, partnerPeerId, isCaller]);

  useEffect(() => {
    const interval = setInterval(() => {
      useCallStore.getState().setDurationSeconds(
        useCallStore.getState().durationSeconds + 1
      );
    }, 1000);
    timerRef.current = interval;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let cancelled = false;

    async function requestWakeLock() {
      try {
        const wl = await navigator.wakeLock.request("screen");
        wakeLockRef.current = wl;
        wl.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        // WakeLock not granted, continue without it
      }
    }

    requestWakeLock();

    return () => {
      cancelled = true;
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!peerRef.current) return;

    const interval = setInterval(async () => {
      const peer = peerRef.current;
      if (!peer) return;
      try {
        const streams = (peer as any).connections || {};
        const connKeys = Object.keys(streams);
        if (connKeys.length === 0) return;
        for (const key of connKeys) {
          const conns = streams[key] || [];
          for (const conn of conns) {
            if (conn.peerConnection) {
              const stats = await conn.peerConnection.getStats();
              stats.forEach((report: any) => {
                if (report.type === "candidate-pair" && report.state === "succeeded") {
                  const rtt = report.currentRoundTripTime;
                  if (rtt !== undefined) {
                    if (rtt < 0.3) setQuality("good");
                    else if (rtt < 0.8) setQuality("fair");
                    else setQuality("poor");
                  }
                }
              });
            }
          }
        }
      } catch {
        // Stats not available
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleMute = useCallback(() => {
    const enabled = toggleMute();
    setIsMuted(!enabled);
  }, []);

  const handleCamera = useCallback(() => {
    const enabled = toggleCamera();
    setIsCameraOff(!enabled);
  }, []);

  const handleEndCall = useCallback(() => {
    endCall();
    onEndCall();
  }, [onEndCall]);

  const duration = useCallStore((s) => s.durationSeconds);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const qualityColor = {
    good: "bg-success",
    fair: "bg-yellow-500",
    poor: "bg-danger",
  };

  if (callError) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-card bg-gray-100 text-center">
        <p className="text-danger mb-4">{callError}</p>
        <Button variant="outline" onClick={handleEndCall}>
          Return to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="relative aspect-video w-full overflow-hidden rounded-card bg-black">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-4 right-4 h-32 w-48 overflow-hidden rounded-lg border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-sm text-white">
          {String(minutes).padStart(2, "0")}:
          {String(seconds).padStart(2, "0")}
        </div>
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1">
          <span className={`h-2 w-2 rounded-full ${qualityColor[quality]}`} />
          <span className="text-xs text-white capitalize">{quality}</span>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-4">
        <Button
          variant={isMuted ? "danger" : "outline"}
          onClick={handleMute}
          className="h-12 w-12 rounded-full"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🔇" : "🎤"}
        </Button>
        <Button
          variant={isCameraOff ? "danger" : "outline"}
          onClick={handleCamera}
          className="h-12 w-12 rounded-full"
          title={isCameraOff ? "Turn camera on" : "Turn camera off"}
        >
          {isCameraOff ? "📷" : "🎥"}
        </Button>
        <Button
          variant="danger"
          onClick={handleEndCall}
          className="h-12 w-12 rounded-full"
          title="End call"
        >
          📞
        </Button>
      </div>
    </div>
  );
}
