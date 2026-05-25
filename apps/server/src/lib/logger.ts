import winston from "winston";
import path from "path";

const LOG_DIR = path.resolve(__dirname, "../../logs");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "debug",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "speakup-server" },
  transports: [
    new winston.transports.File({
      dirname: LOG_DIR,
      filename: "error.log",
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      dirname: LOG_DIR,
      filename: "combined.log",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 10,
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const ctx = meta.context ? ` [${meta.context}]` : "";
          const extra = Object.keys(meta).filter(k => !["context", "service", "timestamp"].includes(k)).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `${timestamp} ${level}${ctx}: ${message}${extra}`;
        })
      ),
    })
  );
}

export function logError(context: string, message: string, meta?: Record<string, unknown>) {
  logger.error(message, { context, ...meta });
}

export function logWarn(context: string, message: string, meta?: Record<string, unknown>) {
  logger.warn(message, { context, ...meta });
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  logger.info(message, { context, ...meta });
}

export function logDebug(context: string, message: string, meta?: Record<string, unknown>) {
  logger.debug(message, { context, ...meta });
}

export default logger;
