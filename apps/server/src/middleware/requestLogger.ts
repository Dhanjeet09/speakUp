import { Response, NextFunction } from "express";
import { logInfo, logWarn } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

export function requestLogger(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const userId = req.userId || "anon";
    const level = res.statusCode >= 400 ? "warn" : "info";
    const log = level === "warn" ? logWarn : logInfo;

    log("HTTP", `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration,
      userId,
    });
  });

  next();
}
