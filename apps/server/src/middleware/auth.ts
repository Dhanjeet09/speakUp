import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import { prisma } from "../lib/db";
import { createAnonSupabaseClient } from "../lib/supabase";
import { logDebug, logWarn, logError as logErr } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

const JWT_SECRET = env.SUPABASE_JWT_SECRET;

function extractToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    logDebug("Auth", "Token extracted from Authorization header");
    return authHeader.slice(7);
  }

  const sbCookie = Object.keys(req.cookies || {}).find((k) =>
    k.startsWith("sb-") && k.endsWith("-auth-token")
  );
  if (sbCookie) {
    try {
      const parsed = JSON.parse(req.cookies[sbCookie]);
      logDebug("Auth", "Token extracted from cookie", { cookieName: sbCookie });
      return parsed.access_token || null;
    } catch {
      logWarn("Auth", "Failed to parse Supabase auth cookie", { cookieName: sbCookie });
      return null;
    }
  }

  return null;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      logWarn("Auth", "Authentication required - no token");
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    let userId: string | undefined;
    if (JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
        if (!decoded.aud || decoded.aud !== "authenticated") {
          logWarn("Auth", "Invalid token audience", { aud: decoded.aud });
          res.status(401).json({ success: false, error: "Invalid or expired token" });
          return;
        }
        userId = decoded.sub;
      } catch {
        logWarn("Auth", "Invalid or expired token");
        res.status(401).json({ success: false, error: "Invalid or expired token" });
        return;
      }
    } else {
      try {
        const supabase = createAnonSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          logWarn("Auth", "Invalid token via Supabase API");
          res.status(401).json({ success: false, error: "Invalid or expired token" });
          return;
        }
        userId = user.id;
      } catch {
        logWarn("Auth", "Supabase getUser exception");
        res.status(401).json({ success: false, error: "Invalid or expired token" });
        return;
      }
    }
    if (!userId) {
      res.status(401).json({ success: false, error: "Invalid or expired token" });
      return;
    }

    req.userId = userId;

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuspended: true, role: true, email: true },
    });

    if (!userRecord) {
      res.status(401).json({ success: false, error: "User not found" });
      return;
    }

    if (userRecord.isSuspended) {
      res.status(403).json({ success: false, error: "Account suspended. Please contact support." });
      return;
    }

    req.userEmail = userRecord.email;
    req.userRole = userRecord.role || "learner";
    logDebug("Auth", "User authenticated", { userId });
    next();
  } catch (err) {
    logErr("Auth", "Auth verification exception", { error: String(err) });
    res.status(500).json({ success: false, error: "Authentication verification failed" });
  }
}

export function requireSameUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const targetId = req.params.id || req.params.userId;
  if (targetId && req.userId !== targetId) {
    logWarn("Auth", "Forbidden access", { userId: req.userId, targetId });
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  next();
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    if (req.userRole !== "admin" && !env.ADMIN_USER_IDS.includes(req.userId)) {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    next();
  } catch (err) {
    logErr("Auth", "Admin verification exception", { error: String(err) });
    res.status(500).json({ success: false, error: "Failed to verify admin status" });
  }
}

export async function requireModerator(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    if (req.userRole !== "admin" && req.userRole !== "moderator") {
      res.status(403).json({ success: false, error: "Moderator access required" });
      return;
    }

    next();
  } catch (err) {
    logErr("Auth", "Moderator verification exception", { error: String(err) });
    res.status(500).json({ success: false, error: "Failed to verify moderator status" });
  }
}
