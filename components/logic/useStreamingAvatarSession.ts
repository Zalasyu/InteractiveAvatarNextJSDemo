import StreamingAvatar, {
  ConnectionQuality,
  StartAvatarRequest,
  StreamingEvents,
} from "@heygen/streaming-avatar";
import { useCallback } from "react";

import {
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./context";
import { useVoiceChat } from "./useVoiceChat";
import { useMessageHistory } from "./useMessageHistory";

/**
 * Deep clean function to recursively remove all undefined values from an object
 * This is necessary because the HeyGen SDK reconstructs the API payload and
 * includes undefined values for optional fields, which the API rejects with 400 errors
 */
function deepClean<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClean) as unknown as T;
  }

  if (typeof obj === "object") {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        (acc as any)[key] = deepClean(value);
      }
      return acc;
    }, {} as T);
  }

  return obj;
}

export const useStreamingAvatarSession = () => {
  const {
    avatarRef,
    basePath,
    sessionState,
    setSessionState,
    stream,
    setStream,
    setSessionId,
    setSessionToken,
    setIsListening,
    setIsUserTalking,
    setIsAvatarTalking,
    setConnectionQuality,
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
    clearMessages,
  } = useStreamingAvatarContext();
  const { stopVoiceChat } = useVoiceChat();

  useMessageHistory();

  const init = useCallback(
    (token: string) => {
      avatarRef.current = new StreamingAvatar({
        token,
        basePath: basePath,
      });

      // Store the session token for later API calls
      setSessionToken(token);

      return avatarRef.current;
    },
    [basePath, avatarRef, setSessionToken],
  );

  const handleStream = useCallback(
    ({ detail }: { detail: MediaStream }) => {
      setStream(detail);
      setSessionState(StreamingAvatarSessionState.CONNECTED);
    },
    [setSessionState, setStream],
  );

  // BUGFIX: Named event handlers for proper cleanup
  const handleUserStart = useCallback(() => {
    setIsUserTalking(true);
  }, [setIsUserTalking]);

  const handleUserStop = useCallback(() => {
    setIsUserTalking(false);
  }, [setIsUserTalking]);

  const handleAvatarStartTalking = useCallback(() => {
    setIsAvatarTalking(true);
  }, [setIsAvatarTalking]);

  const handleAvatarStopTalking = useCallback(() => {
    setIsAvatarTalking(false);
  }, [setIsAvatarTalking]);

  const handleConnectionQualityChanged = useCallback(
    ({ detail }: { detail: ConnectionQuality }) => {
      setConnectionQuality(detail);
    },
    [setConnectionQuality],
  );

  const stop = useCallback(async () => {
    // BUGFIX: Remove ALL event listeners to prevent memory leaks
    // Previously only removed 2 listeners, causing accumulation on multiple session restarts
    if (avatarRef.current) {
      avatarRef.current.off(StreamingEvents.STREAM_READY, handleStream);
      avatarRef.current.off(StreamingEvents.STREAM_DISCONNECTED, stop);
      avatarRef.current.off(StreamingEvents.CONNECTION_QUALITY_CHANGED, handleConnectionQualityChanged);
      avatarRef.current.off(StreamingEvents.USER_START, handleUserStart);
      avatarRef.current.off(StreamingEvents.USER_STOP, handleUserStop);
      avatarRef.current.off(StreamingEvents.AVATAR_START_TALKING, handleAvatarStartTalking);
      avatarRef.current.off(StreamingEvents.AVATAR_STOP_TALKING, handleAvatarStopTalking);
      avatarRef.current.off(StreamingEvents.USER_TALKING_MESSAGE, handleUserTalkingMessage);
      avatarRef.current.off(StreamingEvents.AVATAR_TALKING_MESSAGE, handleStreamingTalkingMessage);
      avatarRef.current.off(StreamingEvents.USER_END_MESSAGE, handleEndMessage);
      avatarRef.current.off(StreamingEvents.AVATAR_END_MESSAGE, handleEndMessage);
    }

    clearMessages();
    stopVoiceChat();
    setIsListening(false);
    setIsUserTalking(false);
    setIsAvatarTalking(false);
    setStream(null);
    setSessionId(null);
    setSessionToken(null);
    await avatarRef.current?.stopAvatar();
    setSessionState(StreamingAvatarSessionState.INACTIVE);
  }, [
    handleStream,
    handleConnectionQualityChanged,
    handleUserStart,
    handleUserStop,
    handleAvatarStartTalking,
    handleAvatarStopTalking,
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
    setSessionState,
    setStream,
    avatarRef,
    setIsListening,
    stopVoiceChat,
    clearMessages,
    setIsUserTalking,
    setIsAvatarTalking,
    setSessionId,
    setSessionToken,
  ]);

  const start = useCallback(
    async (config: StartAvatarRequest, token?: string) => {
      // PRIORITY 2 LOGGING: Config received by hook
      console.log("[useStreamingAvatarSession] start() called:", {
        receivedConfig: JSON.stringify(config, null, 2),
        configKeys: Object.keys(config),
        hasToken: !!token,
        sessionState,
        avatarRefExists: !!avatarRef.current,
        hasKnowledgeId: "knowledgeId" in config,
        hasKnowledgeBase: "knowledgeBase" in config,
      });

      if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
        throw new Error("There is already an active session");
      }

      if (!avatarRef.current) {
        if (!token) {
          throw new Error("Token is required");
        }
        init(token);
      }

      if (!avatarRef.current) {
        throw new Error("Avatar is not initialized");
      }

      setSessionState(StreamingAvatarSessionState.CONNECTING);
      // BUGFIX: Use named functions instead of anonymous functions for proper cleanup
      avatarRef.current.on(StreamingEvents.STREAM_READY, handleStream);
      avatarRef.current.on(StreamingEvents.STREAM_DISCONNECTED, stop);
      avatarRef.current.on(StreamingEvents.CONNECTION_QUALITY_CHANGED, handleConnectionQualityChanged);
      avatarRef.current.on(StreamingEvents.USER_START, handleUserStart);
      avatarRef.current.on(StreamingEvents.USER_STOP, handleUserStop);
      avatarRef.current.on(StreamingEvents.AVATAR_START_TALKING, handleAvatarStartTalking);
      avatarRef.current.on(StreamingEvents.AVATAR_STOP_TALKING, handleAvatarStopTalking);
      avatarRef.current.on(StreamingEvents.USER_TALKING_MESSAGE, handleUserTalkingMessage);
      avatarRef.current.on(StreamingEvents.AVATAR_TALKING_MESSAGE, handleStreamingTalkingMessage);
      avatarRef.current.on(StreamingEvents.USER_END_MESSAGE, handleEndMessage);
      avatarRef.current.on(StreamingEvents.AVATAR_END_MESSAGE, handleEndMessage);

      // BUGFIX: Deep clean config to recursively remove ALL undefined properties
      // The HeyGen SDK reconstructs the API payload and includes undefined values
      // for optional fields, which the API rejects with 400 errors

      // PRIORITY 1 LOGGING: Config BEFORE deepClean
      console.log("[useStreamingAvatarSession] Config BEFORE deepClean:", {
        original: JSON.stringify(config, null, 2),
        hasKnowledgeId: "knowledgeId" in config,
        hasKnowledgeBase: "knowledgeBase" in config,
        knowledgeIdValue: config.knowledgeId,
        knowledgeBaseValue: (config as any).knowledgeBase,
        voice: config.voice,
        voiceKeys: config.voice ? Object.keys(config.voice) : [],
        sttSettings: config.sttSettings,
        sttKeys: config.sttSettings ? Object.keys(config.sttSettings) : [],
        allConfigKeys: Object.keys(config),
      });

      const cleanedConfig = deepClean(config);

      // PRIORITY 1 LOGGING: Config AFTER deepClean
      console.log("[useStreamingAvatarSession] Config AFTER deepClean:", {
        cleaned: JSON.stringify(cleanedConfig, null, 2),
        hasKnowledgeId: "knowledgeId" in cleanedConfig,
        hasKnowledgeBase: "knowledgeBase" in cleanedConfig,
        knowledgeIdValue: cleanedConfig.knowledgeId,
        knowledgeBaseValue: (cleanedConfig as any).knowledgeBase,
        voice: cleanedConfig.voice,
        voiceKeys: cleanedConfig.voice ? Object.keys(cleanedConfig.voice) : [],
        sttSettings: cleanedConfig.sttSettings,
        sttKeys: cleanedConfig.sttSettings
          ? Object.keys(cleanedConfig.sttSettings)
          : [],
        allConfigKeys: Object.keys(cleanedConfig),
        removedKeys: Object.keys(config).filter((k) => !(k in cleanedConfig)),
      });

      // PRIORITY 1 LOGGING: Exact config being passed to SDK
      console.log(
        "[useStreamingAvatarSession] Calling SDK createStartAvatar:",
        {
          timestamp: new Date().toISOString(),
          configJSON: JSON.stringify(cleanedConfig, null, 2),
          configStringified: JSON.stringify(cleanedConfig),
          containsUndefined: JSON.stringify(cleanedConfig).includes("undefined"),
          allFields: {
            quality: cleanedConfig.quality,
            avatarName: cleanedConfig.avatarName,
            knowledgeId: cleanedConfig.knowledgeId,
            knowledgeBase: (cleanedConfig as any).knowledgeBase,
            voice: cleanedConfig.voice,
            language: cleanedConfig.language,
            voiceChatTransport: cleanedConfig.voiceChatTransport,
            sttSettings: cleanedConfig.sttSettings,
            disableIdleTimeout: (cleanedConfig as any).disableIdleTimeout,
            useSilencePrompt: (cleanedConfig as any).useSilencePrompt,
            activityIdleTimeout: (cleanedConfig as any).activityIdleTimeout,
            enablePushToTalk: (cleanedConfig as any).enablePushToTalk,
          },
        }
      );

      try {
        const response = await avatarRef.current.createStartAvatar(cleanedConfig);

        console.log("[useStreamingAvatarSession] createStartAvatar SUCCESS:", {
          response,
          hasSessionId: !!(response as any)?.session_id,
        });

        // Extract and store session_id from the response
        const session_id = (response as any)?.session_id;
        if (session_id) {
          console.log("[useStreamingAvatarSession] Storing session_id:", {
            sessionIdLength: session_id.length,
            sessionIdPrefix: session_id.substring(0, 20) + "...",
          });
          setSessionId(session_id);
        } else {
          console.warn("[useStreamingAvatarSession] No session_id found in createStartAvatar response");
        }
      } catch (error) {
        console.error("[useStreamingAvatarSession] createStartAvatar FAILED:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          errorName: error instanceof Error ? error.name : undefined,
          errorResponse: (error as any)?.response,
          errorData: (error as any)?.data,
          errorStatus: (error as any)?.status,
          errorCode: (error as any)?.code,
          errorResponseText: (error as any)?.responseText,
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });

        // BUGFIX: Enhanced quota error detection and user-friendly messaging
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = (error as any)?.code;
        const errorStatus = (error as any)?.status;
        const responseText = (error as any)?.responseText;

        // Check for quota error (code 10008 or "quota not enough" in message)
        if (
          errorCode === 10008 ||
          errorMessage.includes("quota not enough") ||
          (responseText && responseText.includes("quota not enough"))
        ) {
          console.error("[useStreamingAvatarSession] QUOTA ERROR DETECTED:", {
            code: errorCode,
            message: errorMessage,
            responseText,
          });

          // Throw enhanced error with user-friendly message
          const quotaError = new Error(
            "QUOTA_ERROR: Insufficient HeyGen API credits for streaming avatar session.\n\n" +
            "Please check:\n" +
            "1. Your HeyGen account credits/quota\n" +
            "2. Active sessions that may need to be closed\n" +
            "3. Your plan tier and usage limits\n\n" +
            "Visit https://www.heygen.com to manage your account."
          );
          (quotaError as any).code = errorCode;
          (quotaError as any).originalError = error;
          throw quotaError;
        }

        // Check for 400 Bad Request errors (often quota or configuration issues)
        if (errorStatus === 400) {
          console.error("[useStreamingAvatarSession] BAD REQUEST ERROR:", {
            status: errorStatus,
            message: errorMessage,
            responseText,
          });

          throw new Error(
            `Session creation failed (400 Bad Request).\n\n` +
            `Details: ${responseText || errorMessage}\n\n` +
            "This may indicate:\n" +
            "- Insufficient quota/credits\n" +
            "- Invalid configuration parameters\n" +
            "- API key or authentication issues"
          );
        }

        throw error;
      }

      return avatarRef.current;
    },
    [
      init,
      handleStream,
      handleConnectionQualityChanged,
      handleUserStart,
      handleUserStop,
      handleAvatarStartTalking,
      handleAvatarStopTalking,
      handleUserTalkingMessage,
      handleStreamingTalkingMessage,
      handleEndMessage,
      stop,
      setSessionState,
      avatarRef,
      sessionState,
      setSessionId,
    ],
  );

  return {
    avatarRef,
    sessionState,
    stream,
    initAvatar: init,
    startAvatar: start,
    stopAvatar: stop,
  };
};
