import { Response, NextFunction } from "express";
import { createSupabaseClient } from "../lib/supabase";
import { logDebug, logWarn, logError as logErr } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

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

  const allCookies = Object.keys(req.cookies || {});
  logDebug("Auth", "No auth token found", { availableCookies: allCookies });
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

    const supabase = createSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logWarn("Auth", "Invalid or expired token", { error: String(error) });
      res.status(401).json({ success: false, error: "Invalid or expired token" });
      return;
    }

    req.userId = data.user.id;
    req.userEmail = data.user.email;
    logDebug("Auth", "User authenticated", { userId: data.user.id });
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
  const targetId = req.params.id || req.body.userId || req.body.user1Id;
  if (targetId && req.userId !== targetId) {
    logWarn("Auth", "Forbidden access", { userId: req.userId, targetId });
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }
  next();
}
