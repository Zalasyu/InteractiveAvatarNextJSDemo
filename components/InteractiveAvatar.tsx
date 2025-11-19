import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { useVoiceChatLLMIntegration } from "./logic/useVoiceChatLLMIntegration";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";
import { useAvatars } from "./logic/useAvatars";

/**
 * Create default config for avatar session
 * Note: avatarName and voiceId will be set dynamically from fetched avatars
 */
const createDefaultConfig = (avatarId?: string, voiceId?: string): StartAvatarRequest => ({
  quality: AvatarQuality.Low,
  avatarName: avatarId || "", // Will be set from first available avatar
  // BUGFIX: Removed knowledgeId: undefined - explicitly setting undefined causes 400 errors
  // Optional fields should be omitted entirely, not set to undefined
  voice: {
    voiceId: voiceId || "", // Will be set from first available avatar's voice
    rate: 1.0, // BUGFIX: Reduced from 1.5 to 1.0 for normal, comprehensible speech speed
    emotion: VoiceEmotion.FRIENDLY, // BUGFIX: Changed from EXCITED to FRIENDLY for calmer, more measured delivery
    // HeyGen will use default TTS configuration for the selected voice
  },
  language: "en",
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
  },
  disableIdleTimeout: false, // BUGFIX: Enable auto-cleanup of inactive sessions (HeyGen will terminate after inactivity)
});

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();

  // Fetch medical domain avatars dynamically
  const { avatars, loading: avatarsLoading, error: avatarsError } = useAvatars();

  // Enable voice chat LLM integration
  useVoiceChatLLMIntegration();

  const [config, setConfig] = useState<StartAvatarRequest>(createDefaultConfig());

  // BUGFIX: Track if voice chat should be started when STREAM_READY fires
  const shouldStartVoiceChatRef = useRef(false);
  const streamReadyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const mediaStream = useRef<HTMLVideoElement>(null);

  // Update config when avatars are loaded
  useEffect(() => {
    if (avatars.length > 0) {
      const firstAvatar = avatars[0];
      console.log("[InteractiveAvatar] Setting default avatar:", {
        avatar_id: firstAvatar.avatar_id,
        avatar_name: firstAvatar.avatar_name,
        default_voice: firstAvatar.default_voice,
        totalAvatars: avatars.length,
      });

      setConfig(createDefaultConfig(firstAvatar.avatar_id, firstAvatar.default_voice));
    }
  }, [avatars]);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      // PRIORITY 3 LOGGING: Token validation
      console.log("[InteractiveAvatar] Access token received:", {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + "...",
        tokenSuffix: "..." + token.substring(token.length - 20),
        isValidFormat: token.startsWith("ey"), // JWT tokens start with "ey"
        responseStatus: response.status,
        responseOk: response.ok,
      });

      return token;
    } catch (error) {
      console.error("[InteractiveAvatar] Error fetching access token:", {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    // PRIORITY 2 LOGGING: Config at session start
    console.log("[InteractiveAvatar] startSessionV2 called:", {
      isVoiceChat,
      currentConfig: JSON.stringify(config, null, 2),
      configKeys: Object.keys(config),
      hasUndefinedValues: JSON.stringify(config).includes("undefined"),
      voice: config.voice,
      sttSettings: config.sttSettings,
      hasKnowledgeId: "knowledgeId" in config,
      hasKnowledgeBase: "knowledgeBase" in config,
    });

    try {
      // PRE-FLIGHT: Check quota before attempting to start session
      console.log("[InteractiveAvatar] Performing pre-flight quota check...");
      const quotaCheck = await fetch("/api/quota-check");

      if (quotaCheck.ok) {
        const quotaData = await quotaCheck.json();

        console.log("[InteractiveAvatar] Quota check result:", {
          credits: quotaData.credits,
          minutes: quotaData.minutes,
          activeSessions: quotaData.activeSessions,
        });

        // Block session start if no credits available
        if (quotaData.credits === 0) {
          alert(
            "⚠️ No streaming credits available\n\n" +
            "Please add credits to your HeyGen account to start a session.\n\n" +
            `Active sessions: ${quotaData.activeSessions}\n` +
            (quotaData.activeSessions > 0
              ? "If you have active sessions, please close them first."
              : "Check your HeyGen dashboard for quota information.")
          );
          return;
        }

        // Warn if credits are low (< 2 credits = 10 minutes)
        if (quotaData.credits < 2) {
          const proceed = confirm(
            "⚠️ Low credits warning\n\n" +
            `You have ${quotaData.credits} credits (${quotaData.minutes} minutes) remaining.\n\n` +
            "Do you want to continue with the session?"
          );
          if (!proceed) {
            console.log("[InteractiveAvatar] User declined to start session due to low credits");
            return;
          }
        }

        // Log warning if there are active sessions
        if (quotaData.activeSessions > 0) {
          console.warn(
            `[InteractiveAvatar] ${quotaData.activeSessions} active sessions detected. ` +
            "This may affect quota and could indicate orphaned sessions."
          );
        }
      } else {
        console.warn("[InteractiveAvatar] Quota check failed, proceeding anyway:", quotaCheck.status);
      }

      // Continue with existing session start logic
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      // CRITICAL FIX: Set flag BEFORE registering event listeners to prevent race condition
      // If STREAM_READY fires quickly, we need the flag to already be set
      shouldStartVoiceChatRef.current = isVoiceChat;

      avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
        console.log("Avatar started talking", e);
      });
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
        console.log("Avatar stopped talking", e);
      });
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("Stream disconnected");
      });
      avatar.on(StreamingEvents.STREAM_READY, async (event) => {
        console.log(">>>>> Stream ready:", event.detail);

        // Clear timeout since STREAM_READY fired successfully
        if (streamReadyTimeoutRef.current) {
          clearTimeout(streamReadyTimeoutRef.current);
          streamReadyTimeoutRef.current = null;
        }

        // BUGFIX: Start voice chat NOW (when SDK is truly ready)
        // This is the correct timing according to HeyGen SDK documentation
        if (shouldStartVoiceChatRef.current) {
          try {
            console.log(">>>>> Starting voice chat after STREAM_READY");
            await startVoiceChat();
            shouldStartVoiceChatRef.current = false; // Reset flag
          } catch (error) {
            console.error("Failed to start voice chat after STREAM_READY:", error);
          }
        }
      });
      avatar.on(StreamingEvents.USER_START, (event) => {
        console.log(">>>>> User started talking:", event);
      });
      avatar.on(StreamingEvents.USER_STOP, (event) => {
        console.log(">>>>> User stopped talking:", event);
      });
      avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => {
        console.log(">>>>> User end message:", event);
      });
      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => {
        console.log(">>>>> User talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        console.log(">>>>> Avatar talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
        console.log(">>>>> Avatar end message:", event);
      });

      // PRIORITY 2 LOGGING: Config before startAvatar
      console.log("[InteractiveAvatar] About to call startAvatar:", {
        config: JSON.stringify(config, null, 2),
        configSnapshot: { ...config },
        voiceSnapshot: config.voice ? { ...config.voice } : undefined,
        sttSnapshot: config.sttSettings ? { ...config.sttSettings } : undefined,
        allKeys: Object.keys(config),
        voiceKeys: config.voice ? Object.keys(config.voice) : [],
        sttKeys: config.sttSettings ? Object.keys(config.sttSettings) : [],
      });

      await startAvatar(config);

      // BUGFIX: Add timeout fallback in case STREAM_READY never fires (known SDK bug)
      if (isVoiceChat) {
        streamReadyTimeoutRef.current = setTimeout(() => {
          if (shouldStartVoiceChatRef.current) {
            console.warn(
              "STREAM_READY event did not fire within 10 seconds. Voice chat may not work properly."
            );
            shouldStartVoiceChatRef.current = false;
            alert(
              "Avatar initialization timed out. Voice chat may not be available. Please try restarting the session."
            );
          }
        }, 10000); // 10 second timeout
      }

      // REMOVED: No longer calling startVoiceChat() here
      // It will be called automatically when STREAM_READY fires
    } catch (error) {
      console.error("Error starting avatar session:", error);

      // Clean up on error
      shouldStartVoiceChatRef.current = false;
      if (streamReadyTimeoutRef.current) {
        clearTimeout(streamReadyTimeoutRef.current);
        streamReadyTimeoutRef.current = null;
      }
    }
  });

  useUnmount(() => {
    stopAvatar();

    // Clean up timeout on unmount
    if (streamReadyTimeoutRef.current) {
      clearTimeout(streamReadyTimeoutRef.current);
      streamReadyTimeoutRef.current = null;
    }
  });

  // CRITICAL FIX: Handle browser close/refresh to prevent session accumulation
  // Without this, sessions remain open on HeyGen servers when user closes/refreshes browser
  // This causes concurrency limit errors when trying to create new sessions
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only cleanup if we have an active session
      if (sessionState === StreamingAvatarSessionState.CONNECTED) {
        console.log("[InteractiveAvatar] Browser closing/refreshing - cleaning up session");

        // Try using navigator.sendBeacon for more reliable cleanup during page unload
        // sendBeacon is guaranteed to be sent even if the page is closing
        try {
          const cleanupData = JSON.stringify({
            action: 'session_cleanup',
            timestamp: Date.now(),
            sessionState: sessionState,
          });

          // Send beacon to a cleanup endpoint (if it exists)
          // This is asynchronous and doesn't block page unload
          const beaconSent = navigator.sendBeacon(
            '/api/session-cleanup',
            cleanupData
          );

          if (beaconSent) {
            console.log("[InteractiveAvatar] Cleanup beacon sent successfully");
          } else {
            console.warn("[InteractiveAvatar] Beacon failed, falling back to stopAvatar");
            // Fallback to synchronous cleanup
            stopAvatar();
          }
        } catch (error) {
          console.error("[InteractiveAvatar] Error in beacon cleanup, falling back:", error);
          // Fallback to stopAvatar if beacon fails
          stopAvatar();
        }
      }
    };

    // beforeunload: Fires when page is about to be unloaded (close, refresh, navigate away)
    window.addEventListener('beforeunload', handleBeforeUnload);

    // pagehide: More reliable on mobile browsers and handles bfcache scenarios
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [sessionState, stopAvatar]);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col rounded-xl bg-zinc-900 overflow-hidden">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <AvatarConfig
              config={config}
              onConfigChange={setConfig}
              avatars={avatars}
              avatarsLoading={avatarsLoading}
              avatarsError={avatarsError}
            />
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full">
          {sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <AvatarControls />
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex flex-row gap-4">
              <Button onClick={() => startSessionV2(true)}>
                Start Voice Chat
              </Button>
              <Button onClick={() => startSessionV2(false)}>
                Start Text Chat
              </Button>
            </div>
          ) : (
            <LoadingIcon />
          )}
        </div>
      </div>
      {sessionState === StreamingAvatarSessionState.CONNECTED && (
        <MessageHistory />
      )}
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}
