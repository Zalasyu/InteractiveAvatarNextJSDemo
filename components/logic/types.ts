/**
 * Shared types and enums for the Interactive Avatar application
 * This file contains only type definitions with no React dependencies,
 * making it safe to import in both client and server contexts
 */

export enum StreamingAvatarSessionState {
  INACTIVE = "inactive",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

export enum MessageSender {
  CLIENT = "CLIENT",
  AVATAR = "AVATAR",
}

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  isComplete?: boolean; // Track if message is fully received (for streaming responses)
}

export interface QuotaInfo {
  credits: number; // Number of API credits remaining
  minutes: number; // Estimated minutes of streaming time remaining (credits * 5)
  activeSessions: number; // Number of currently active streaming sessions
  lastChecked: Date | null; // Timestamp of last quota check
}
