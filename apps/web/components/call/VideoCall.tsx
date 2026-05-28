"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useCallStore } from "@/store/useCallStore";
import type { MediaConnection } from "peerjs";
import {
  createPeer,
  startLocalStream,
  getLocalStream,
  answerIncomingCall,
  initiateCall,
  toggleMute,
  toggleCamera,
  endCall,
  mapPeerError,
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
  const onEndCallRef = useRef(onEndCall);
  onEndCallRef.current = onEndCall;

  useEffect(() => {
    if (!("mediaDevices" in navigator)) {
      setCallError("Camera and microphone not available on this device");
      return;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    let cancelled = false;

    async function init() {
      try {
        const stream = await startLocalStream();
        if (cancelled) return;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const p = createPeer(currentUserId);
        peerRef.current = p;

        let callPromise: Promise<MediaConnection> | null = null;

        if (!isCaller) {
          callPromise = answerIncomingCall((remoteStream) => {
            if (!cancelled && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });
        }

        return new Promise<void>((resolveInit, rejectInit) => {
          const peerOpenTimeout = setTimeout(() => {
            rejectInit(new Error("peer-connection-timeout"));
          }, 15000);

          p.on("open", async () => {
            clearTimeout(peerOpenTimeout);
            if (cancelled) return;

            try {
              if (isCaller) {
                const local = getLocalStream();
                if (!local) {
                  rejectInit(new Error("No local stream available"));
                  return;
                }

                const remoteStream = await new Promise<MediaStream>(
                  (resolve, reject) => {
                    const callTimeout = setTimeout(() => {
                      reject(new Error("Call connection timed out"));
                    }, 20000);

                    p.on("error", (err) => {
                      clearTimeout(callTimeout);
                      reject(mapPeerError(err));
                    });

                    initiateCall(partnerPeerId, local, (remote) => {
                      clearTimeout(callTimeout);
                      resolve(remote);
                    });
                  }
                );

                if (cancelled) return;
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                }
              } else {
                await callPromise;
              }
              resolveInit();
            } catch (err) {
              rejectInit(err);
            }
          });

          p.on("error", (err) => {
            clearTimeout(peerOpenTimeout);
            rejectInit(mapPeerError(err));
          });

          p.on("disconnected", () => {
            p.reconnect();
          });
        });
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
      endCall();
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
        if (cancelled) {
          wl.release();
          return;
        }
        wakeLockRef.current = wl;
        wl.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
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
    const interval = setInterval(async () => {
      const p = peerRef.current;
      if (!p) return;
      try {
        const streams = (p as any).connections || {};
        const connKeys = Object.keys(streams);
        if (connKeys.length === 0) return;
        for (const key of connKeys) {
          const conns = streams[key] || [];
          for (const conn of conns) {
            if (conn.peerConnection) {
              const stats = await conn.peerConnection.getStats();
              stats.forEach((report: any) => {
                if (
                  report.type === "candidate-pair" &&
                  report.state === "succeeded"
                ) {
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
    onEndCallRef.current();
  }, []);

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
      <div
        className="flex aspect-video w-full flex-col items-center justify-center rounded-card bg-gray-100 text-center"
        role="alert"
      >
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
        <div
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-sm text-white"
          aria-live="polite"
        >
          {String(minutes).padStart(2, "0")}:
          {String(seconds).padStart(2, "0")}
        </div>
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1">
          <span
            className={`h-2 w-2 rounded-full ${qualityColor[quality]}`}
            aria-hidden="true"
          />
          <span className="text-xs text-white capitalize" aria-label={`Connection ${quality}`}>
            {quality}
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-4" role="toolbar" aria-label="Call controls">
        <Button
          variant={isMuted ? "danger" : "outline"}
          onClick={handleMute}
          className="h-12 w-12 rounded-full"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🔇" : "🎤"}
        </Button>
        <Button
          variant={isCameraOff ? "danger" : "outline"}
          onClick={handleCamera}
          className="h-12 w-12 rounded-full"
          aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
        >
          {isCameraOff ? "📷" : "🎥"}
        </Button>
        <Button
          variant="danger"
          onClick={handleEndCall}
          className="h-12 w-12 rounded-full"
          aria-label="End call"
        >
          📞
        </Button>
      </div>
    </div>
  );
}
