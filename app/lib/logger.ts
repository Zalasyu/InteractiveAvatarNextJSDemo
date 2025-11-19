/**
 * Centralized Logging Utility
 *
 * Provides structured logging using Pino for consistent logging
 * across the application. Replaces console.log with proper structured logs.
 */

import pino from "pino";

/**
 * Logger configuration based on environment
 */
const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Create pino logger instance with appropriate configuration
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Pretty print in development for better readability
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

/**
 * Create a child logger with additional context
 *
 * @param context - Additional context to include in all logs
 * @returns Child logger instance
 *
 * @example
 * ```typescript
 * const chatLogger = createLogger({ module: "chat-api" });
 * chatLogger.info({ messageLength: 123 }, "Processing chat request");
 * ```
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Default logger instance
 */
export default logger;

/**
 * Log levels available:
 * - trace: Very detailed diagnostic information
 * - debug: Detailed information for debugging
 * - info: General informational messages
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal errors that cause application crash
 *
 * Usage examples:
 * ```typescript
 * import logger from "@/app/lib/logger";
 *
 * // Simple message
 * logger.info("Server started");
 *
 * // With structured data
 * logger.info({ userId: "123", action: "login" }, "User logged in");
 *
 * // Error logging
 * try {
 *   // code
 * } catch (error) {
 *   logger.error({ error }, "Failed to process request");
 * }
 *
 * // Create module-specific logger
 * const apiLogger = createLogger({ module: "api" });
 * apiLogger.debug({ endpoint: "/chat" }, "API request received");
 * ```
 */
