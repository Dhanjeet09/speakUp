import Peer, { MediaConnection } from "peerjs";

let peer: Peer | null = null;
let currentCall: MediaConnection | null = null;
let localStream: MediaStream | null = null;

const ICE_SERVERS = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
};

export function createPeer(userId: string): Peer {
  destroyPeer();
  peer = new Peer(userId, ICE_SERVERS);

  peer.on("error", (err) => {
    console.error("PeerJS error:", err.type, err.message);
  });

  return peer;
}

export function destroyPeer(): void {
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
}

export async function startLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;

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

    peer.on("call", (call) => {
      clearTimeout(timeout);
      const stream = getLocalStream();
      if (stream) {
        call.answer(stream);
      }
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

  currentCall = peer.call(peerId, stream);
  currentCall.on("stream", onRemoteStream);
  currentCall.on("close", () => {
    currentCall = null;
  });

  return currentCall;
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
