import Peer, { MediaConnection } from "peerjs";

let peer: Peer | null = null;
let peerUserId: string | null = null;
let currentCall: MediaConnection | null = null;
let localStream: MediaStream | null = null;

const ICE_SERVERS = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
  },
};

export type PeerErrorType =
  | "network"
  | "peer-unavailable"
  | "browser-incompatible"
  | "disconnected"
  | "server-error"
  | "unknown";

export interface PeerError {
  type: PeerErrorType;
  message: string;
}

export function createPeer(userId: string): Peer {
  if (peer && !peer.destroyed && peerUserId === userId) {
    console.log("[WebRTC] Reusing existing peer for", userId);
    return peer;
  }
  destroyPeer();
  peerUserId = userId;
  console.log("[WebRTC] Creating peer with ID:", userId);
  peer = new Peer(userId, ICE_SERVERS);
  peer.on("open", () => console.log("[WebRTC] Peer opened:", userId));
  peer.on("error", (err) => console.error("[WebRTC] Peer error:", err.type, err.message));
  peer.on("disconnected", () => console.warn("[WebRTC] Peer disconnected:", userId));
  peer.on("close", () => console.log("[WebRTC] Peer closed:", userId));
  return peer;
}

export function destroyPeer(): void {
  endCall();
  if (peer) {
    peer.destroy();
    peer = null;
  }
}

export async function startLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("browser-incompatible");
  }

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  console.log("[WebRTC] Local stream obtained:", {
    audio: localStream.getAudioTracks().length,
    video: localStream.getVideoTracks().length,
  });
  return localStream;
}

export function getLocalStream(): MediaStream | null {
  return localStream;
}

export function answerIncomingCall(
  onRemoteStream: (stream: MediaStream) => void
): Promise<MediaConnection> {
  return new Promise((resolve, reject) => {
    if (!peer) {
      reject(new Error("Peer not created"));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("No incoming call received within timeout"));
    }, 15000);

    peer.on("call", (call) => {
      clearTimeout(timeout);
      console.log("[WebRTC] Incoming call from:", call.peer);
      const stream = getLocalStream();
      if (!stream) {
        console.error("[WebRTC] No local stream to answer call");
        call.close();
        reject(new Error("No local stream available to answer call"));
        return;
      }
      call.on("stream", (remoteStream) => {
        console.log("[WebRTC] Remote stream received (callee):", {
          audio: remoteStream.getAudioTracks().length,
          video: remoteStream.getVideoTracks().length,
        });
        onRemoteStream(remoteStream);
      });
      call.answer(stream);
      call.on("close", () => {
        console.log("[WebRTC] Call closed (callee)");
        currentCall = null;
      });
      currentCall = call;
      resolve(call);
    });
  });
}

export function initiateCall(
  peerId: string,
  stream: MediaStream,
  onRemoteStream: (stream: MediaStream) => void
): MediaConnection {
  if (!peer) throw new Error("Peer not created");

  if (currentCall) {
    currentCall.close();
  }

  console.log("[WebRTC] Initiating call to:", peerId);
  const call = peer.call(peerId, stream);
  if (!call) {
    console.error("[WebRTC] peer.call() returned null for", peerId);
    throw new Error("peer-unavailable");
  }

  call.on("stream", (remoteStream) => {
    console.log("[WebRTC] Remote stream received (caller):", {
      audio: remoteStream.getAudioTracks().length,
      video: remoteStream.getVideoTracks().length,
    });
    onRemoteStream(remoteStream);
  });
  call.on("close", () => {
    console.log("[WebRTC] Call closed (caller)");
    currentCall = null;
  });

  currentCall = call;
  return call;
}

export function toggleMute(): boolean {
  if (!localStream) return false;
  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return false;
  audioTrack.enabled = !audioTrack.enabled;
  console.log("[WebRTC] Mute toggled:", audioTrack.enabled ? "unmuted" : "muted");
  return audioTrack.enabled;
}

export function toggleCamera(): boolean {
  if (!localStream) return false;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return false;
  videoTrack.enabled = !videoTrack.enabled;
  console.log("[WebRTC] Camera toggled:", videoTrack.enabled ? "on" : "off");
  return videoTrack.enabled;
}

export function endCall(): void {
  console.log("[WebRTC] Ending call");
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
}

export function mapPeerError(err: { type: string; message: string }): PeerError {
  switch (err.type) {
    case "network":
    case "disconnected":
      return { type: "network", message: "Connection lost, retrying..." };
    case "peer-unavailable":
      return { type: "peer-unavailable", message: "Partner disconnected before connecting" };
    case "browser-incompatible":
      return { type: "browser-incompatible", message: "Your browser doesn't support video calls" };
    case "server-error":
      return { type: "server-error", message: "Call service unavailable, try again" };
    default:
      return { type: "unknown", message: err.message || "An unexpected error occurred" };
  }
}
