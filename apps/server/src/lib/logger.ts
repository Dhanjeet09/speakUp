import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  name: "speakup-server",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l" } }
      : undefined,
});

export function logError(context: string, message: string, meta?: Record<string, unknown>) {
  logger.error({ context, ...meta }, message);
}

export function logWarn(context: string, message: string, meta?: Record<string, unknown>) {
  logger.warn({ context, ...meta }, message);
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  logger.info({ context, ...meta }, message);
}

export function logDebug(context: string, message: string, meta?: Record<string, unknown>) {
  logger.debug({ context, ...meta }, message);
}

export default logger;
