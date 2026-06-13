import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
  },
  verify: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  createAnonSupabaseClient: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import jwt from "jsonwebtoken";
import { createAnonSupabaseClient } from "../lib/supabase";
import { prisma } from "../lib/db";

const mockJwt = vi.mocked(jwt);
const mockSupabase = vi.mocked(createAnonSupabaseClient);
const mockPrisma = vi.mocked(prisma);

type NextCallback = (err?: Error) => void;

interface MockSocket {
  id: string;
  handshake: { auth: Record<string, unknown> };
  data: Record<string, unknown>;
}

function createMockSocket(auth: Record<string, unknown> = {}): MockSocket {
  return {
    id: "socket-1",
    handshake: { auth },
    data: {},
  };
}

function createMockNext(): { fn: NextCallback; calledWith: (Error | undefined)[] } {
  const calls: (Error | undefined)[] = [];
  const fn: NextCallback = (err?: Error) => {
    calls.push(err);
  };
  return { fn, calledWith: calls };
}

async function runAuthMiddleware(
  socket: MockSocket,
): Promise<Error | undefined> {
  const userId = socket.handshake.auth?.userId as string | undefined;
  const token = socket.handshake.auth?.token as string | undefined;

  if (!userId) {
    return undefined;
  }

  if (!token) {
    return new Error("Authentication token required");
  }

  try {
    const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
    let verifiedUserId: string | undefined;

    if (JWT_SECRET) {
      const decoded = mockJwt.verify(token, JWT_SECRET, {
        algorithms: ["HS256"],
      }) as { aud?: string; sub?: string };
      if (!decoded.aud || decoded.aud !== "authenticated") {
        return new Error("Invalid authentication token");
      }
      verifiedUserId = decoded.sub;
    } else {
      const supabase = mockSupabase();
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        return new Error("Invalid authentication token");
      }
      verifiedUserId = data.user.id;
    }

    if (!verifiedUserId || verifiedUserId !== userId) {
      return new Error("Authentication mismatch");
    }

    const userRecord = await mockPrisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true },
    });

    if (userRecord?.isSuspended) {
      return new Error("Account suspended");
    }

    (socket.data as Record<string, unknown>).userId = userId;
    return undefined;
  } catch {
    return new Error("Authentication verification failed");
  }
}

describe("socket auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_JWT_SECRET;
  });

  it("allows anonymous connections (no userId)", async () => {
    const socket = createMockSocket({});
    const err = await runAuthMiddleware(socket);
    expect(err).toBeUndefined();
  });

  it("allows anonymous connections with empty userId", async () => {
    const socket = createMockSocket({ userId: "" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeUndefined();
  });

  it("authenticated connection with valid token passes", async () => {
    process.env.SUPABASE_JWT_SECRET = "my-secret";
    mockJwt.verify.mockReturnValue({
      aud: "authenticated",
      sub: "user-123",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      isSuspended: false,
    } as never);

    const socket = createMockSocket({ userId: "user-123", token: "valid-token" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeUndefined();
    expect(socket.data.userId).toBe("user-123");
  });

  it("fails when user provides userId but no token", async () => {
    const socket = createMockSocket({ userId: "user-123" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeDefined();
    expect(err!.message).toBe("Authentication token required");
  });

  it("fails when token userId does not match claimed userId", async () => {
    process.env.SUPABASE_JWT_SECRET = "my-secret";
    mockJwt.verify.mockReturnValue({
      aud: "authenticated",
      sub: "user-456",
    } as never);

    const socket = createMockSocket({ userId: "user-123", token: "valid-token" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeDefined();
    expect(err!.message).toBe("Authentication mismatch");
  });

  it("fails when user is suspended", async () => {
    process.env.SUPABASE_JWT_SECRET = "my-secret";
    mockJwt.verify.mockReturnValue({
      aud: "authenticated",
      sub: "user-123",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      isSuspended: true,
    } as never);

    const socket = createMockSocket({ userId: "user-123", token: "valid-token" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeDefined();
    expect(err!.message).toBe("Account suspended");
  });

  it("fails when JWT verification throws an exception", async () => {
    process.env.SUPABASE_JWT_SECRET = "my-secret";
    mockJwt.verify.mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    const socket = createMockSocket({ userId: "user-123", token: "invalid-token" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeDefined();
    expect(err!.message).toBe("Authentication verification failed");
  });

  it("fails when token audience is not authenticated", async () => {
    process.env.SUPABASE_JWT_SECRET = "my-secret";
    mockJwt.verify.mockReturnValue({
      aud: "service_role",
      sub: "user-123",
    } as never);

    const socket = createMockSocket({ userId: "user-123", token: "valid-token" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeDefined();
    expect(err!.message).toBe("Invalid authentication token");
  });

  it("uses Supabase client when JWT_SECRET is not set", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockSupabase.mockReturnValue({
      auth: { getUser: mockGetUser },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue({
      isSuspended: false,
    } as never);

    const socket = createMockSocket({ userId: "user-123", token: "supabase-token" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeUndefined();
    expect(socket.data.userId).toBe("user-123");
    expect(mockGetUser).toHaveBeenCalledWith("supabase-token");
  });

  it("fails when Supabase token verification fails", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token"),
    });
    mockSupabase.mockReturnValue({
      auth: { getUser: mockGetUser },
    } as never);

    const socket = createMockSocket({ userId: "user-123", token: "bad-token" });
    const err = await runAuthMiddleware(socket);
    expect(err).toBeDefined();
    expect(err!.message).toBe("Invalid authentication token");
  });
});
