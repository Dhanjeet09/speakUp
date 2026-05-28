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

let callHandler: ((call: MediaConnection) => void) | null = null;

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
  if (callHandler && peer) {
    peer.off("call", callHandler);
    callHandler = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
  peerUserId = null;
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

    if (callHandler) {
      peer.off("call", callHandler);
    }

    callHandler = (call) => {
      clearTimeout(timeout);
      const stream = getLocalStream();
      if (!stream) {
        call.close();
        reject(new Error("No local stream available to answer call"));
        return;
      }
      call.on("stream", onRemoteStream);
      call.answer(stream);
      call.on("close", () => {
        currentCall = null;
      });
      currentCall = call;
      resolve(call);
    };

    peer.on("call", callHandler);
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
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
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
