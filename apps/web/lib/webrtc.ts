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
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    ],
  },
};

let turnWarningShown = false;
if (typeof window !== "undefined" && !turnWarningShown) {
  turnWarningShown = true;
  console.warn(
    "[webrtc] Free TURN servers are provided for development only. " +
    "For production, use a properly provisioned TURN server (e.g., Twilio, Metered, or self-hosted coturn)."
  );
}

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
    return peer;
  }
  destroyPeer();
  peerUserId = userId;
  peer = new Peer(userId, ICE_SERVERS);
  return peer;
}

export function destroyPeer(): void {
  endCall();
  if (peer) {
    peer.destroy();
    peer = null;
  }
}

let videoEnabled = true;

export function isVideoActive(): boolean {
  return videoEnabled;
}

export async function startLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("browser-incompatible");
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    videoEnabled = true;
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "NotAllowedError" || err.name === "NotFoundError")
    ) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      videoEnabled = false;
    } else {
      throw err;
    }
  }

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
      const stream = getLocalStream();
      if (!stream) {
        call.close();
        reject(new Error("No local stream available to answer call"));
        return;
      }
      call.answer(stream);
      call.on("stream", onRemoteStream);
      call.on("close", () => {
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

  const call = peer.call(peerId, stream);
  if (!call) throw new Error("peer-unavailable");

  call.on("stream", onRemoteStream);
  call.on("close", () => {
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
  return audioTrack.enabled;
}

export function toggleCamera(): boolean {
  if (!localStream) return false;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return false;
  videoTrack.enabled = !videoTrack.enabled;
  return videoTrack.enabled;
}

export function endCall(): void {
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
}

export function releaseLocalStream(): void {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
}

export function startSpeakingDetection(
  stream: MediaStream,
  onSpeaking: (speaking: boolean) => void
): () => void {
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastSpeaking = false;

    const interval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const avg =
        dataArray.reduce((a, b) => a + b, 0) /
        dataArray.length;
      const speaking = avg > 10;
      if (speaking !== lastSpeaking) {
        lastSpeaking = speaking;
        onSpeaking(speaking);
      }
    }, 150);

    return () => {
      clearInterval(interval);
      context.close();
    };
  } catch {
    return () => {};
  }
}

export function startMicLevelDetection(
  stream: MediaStream,
  onLevel: (level: number) => void
): () => void {
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const interval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      onLevel(Math.min(100, Math.round((avg / 255) * 100)));
    }, 100);

    return () => {
      clearInterval(interval);
      context.close();
    };
  } catch {
    return () => {};
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
