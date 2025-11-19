import { useCallback, useEffect } from "react";
import { useStreamingAvatarContext } from "./context";
import { StreamingAvatarSessionState } from "./types";

/**
 * Custom hook for monitoring HeyGen API quota and active sessions
 *
 * Features:
 * - Automatically checks quota on mount
 * - Re-checks quota after sessions end
 * - Provides low/no quota detection
 * - Exposes manual quota check function
 */
export const useQuotaMonitoring = () => {
  const { quotaInfo, setQuotaInfo, sessionState } = useStreamingAvatarContext();

  /**
   * Fetch current quota information from API
   * Returns quota data or null on error
   */
  const checkQuota = useCallback(async () => {
    try {
      console.log("[useQuotaMonitoring] Checking quota...");

      const response = await fetch("/api/quota-check");

      if (!response.ok) {
        console.error("[useQuotaMonitoring] Failed to check quota:", response.status);
        return null;
      }

      const data = await response.json();

      console.log("[useQuotaMonitoring] Quota check successful:", {
        credits: data.credits,
        minutes: data.minutes,
        activeSessions: data.activeSessions,
      });

      setQuotaInfo({
        credits: data.credits,
        minutes: data.minutes,
        activeSessions: data.activeSessions,
        lastChecked: new Date(),
      });

      return data;
    } catch (error) {
      console.error("[useQuotaMonitoring] Error checking quota:", {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }, [setQuotaInfo]);

  // Check quota when component mounts
  useEffect(() => {
    checkQuota();
  }, [checkQuota]);

  // Re-check quota when session transitions to INACTIVE (after session ends)
  useEffect(() => {
    if (sessionState === StreamingAvatarSessionState.INACTIVE) {
      // Add small delay to ensure session cleanup completed on server
      const timer = setTimeout(() => {
        console.log("[useQuotaMonitoring] Session ended, re-checking quota...");
        checkQuota();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [sessionState, checkQuota]);

  return {
    quotaInfo,
    checkQuota,
    hasLowQuota: quotaInfo.credits < 5, // Less than 25 minutes remaining
    hasNoQuota: quotaInfo.credits === 0, // No credits remaining
  };
};
