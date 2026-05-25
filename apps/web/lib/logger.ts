const PREFIX = "[SpeakUp]";

type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = typeof window !== "undefined"
  ? window.location.hostname === "localhost"
  : process.env.NODE_ENV !== "production";

const LOG_LEVEL: LogLevel = isDev ? "debug" : "warn";

const LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function log(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `${PREFIX}[${context}]`;
  const data = meta ? ` ${JSON.stringify(meta)}` : "";

  switch (level) {
    case "debug":
      console.debug(`${prefix} ${message}${data}`);
      break;
    case "info":
      console.info(`${prefix} ${message}${data}`);
      break;
    case "warn":
      console.warn(`${prefix} ${message}${data}`);
      break;
    case "error":
      console.error(`${prefix} ${message}${data}`);
      break;
  }
}

export function logDebug(context: string, message: string, meta?: Record<string, unknown>) {
  log("debug", context, message, meta);
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  log("info", context, message, meta);
}

export function logWarn(context: string, message: string, meta?: Record<string, unknown>) {
  log("warn", context, message, meta);
}

export function logError(context: string, message: string, meta?: Record<string, unknown>) {
  log("error", context, message, meta);
}
