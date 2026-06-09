declare module "peerjs" {
  interface PeerJSOption {
    key?: string;
    host?: string;
    port?: number;
    path?: string;
    secure?: boolean;
    token?: string;
    config?: Record<string, unknown>;
    debug?: number;
  }

  interface PeerError {
    type: string;
    message: string;
  }

  interface DataConnection {
    send(data: unknown): void;
    close(): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    peer: string;
    open: boolean;
  }

  interface MediaConnection {
    answer(stream?: MediaStream): void;
    close(): void;
    on(event: "stream", cb: (stream: MediaStream) => void): void;
    on(event: "close", cb: () => void): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    open: boolean;
    peer: string;
    remoteStream?: MediaStream;
  }

  export default class Peer {
    constructor(id: string | null, options?: PeerJSOption);
    on(event: "open", cb: (id: string) => void): void;
    on(event: "connection", cb: (conn: DataConnection) => void): void;
    on(event: "call", cb: (call: MediaConnection) => void): void;
    on(event: "close", cb: () => void): void;
    on(event: "disconnected", cb: () => void): void;
    on(event: "error", cb: (err: PeerError) => void): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    call(peerId: string, stream: MediaStream): MediaConnection;
    connect(peerId: string): DataConnection;
    disconnect(): void;
    destroy(): void;
    reconnect(): void;
    id: string;
    destroyed: boolean;
  }
}
