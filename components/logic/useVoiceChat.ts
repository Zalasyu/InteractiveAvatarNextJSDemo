import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";

export const useVoiceChat = () => {
  const {
    avatarRef,
    isMuted,
    setIsMuted,
    isVoiceChatActive,
    setIsVoiceChatActive,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
  } = useStreamingAvatarContext();

  const startVoiceChat = useCallback(
    async (isInputAudioMuted?: boolean) => {
      if (!avatarRef.current) return;

      try {
        setIsVoiceChatLoading(true);

        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Media devices API not available. Please ensure you're using HTTPS or localhost.");
        }

        // Request microphone permissions before starting voice chat
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately as HeyGen SDK will create its own
        stream.getTracks().forEach(track => track.stop());

        await avatarRef.current?.startVoiceChat({
          isInputAudioMuted,
        });
        setIsVoiceChatLoading(false);
        setIsVoiceChatActive(true);
        setIsMuted(!!isInputAudioMuted);
      } catch (error) {
        setIsVoiceChatLoading(false);
        console.error("Failed to start voice chat:", error);

        if (error instanceof DOMException && error.name === "NotAllowedError") {
          alert("Microphone access denied. Please allow microphone permissions to use voice chat.");
        } else if (error instanceof DOMException && error.name === "NotFoundError") {
          alert("No microphone found. Please connect a microphone to use voice chat.");
        } else if (error instanceof Error && error.message.includes("Media devices API not available")) {
          alert("Media devices not supported. Please use HTTPS or localhost to enable microphone access.");
        } else {
          alert("Failed to start voice chat. Please check your microphone and try again.");
        }
      }
    },
    [avatarRef, setIsMuted, setIsVoiceChatActive, setIsVoiceChatLoading],
  );

  const stopVoiceChat = useCallback(() => {
    if (!avatarRef.current) return;
    avatarRef.current?.closeVoiceChat();
    setIsVoiceChatActive(false);
    setIsMuted(true);
  }, [avatarRef, setIsMuted, setIsVoiceChatActive]);

  const muteInputAudio = useCallback(() => {
    if (!avatarRef.current) return;
    avatarRef.current?.muteInputAudio();
    setIsMuted(true);
  }, [avatarRef, setIsMuted]);

  const unmuteInputAudio = useCallback(() => {
    if (!avatarRef.current) return;
    avatarRef.current?.unmuteInputAudio();
    setIsMuted(false);
  }, [avatarRef, setIsMuted]);

  return {
    startVoiceChat,
    stopVoiceChat,
    muteInputAudio,
    unmuteInputAudio,
    isMuted,
    isVoiceChatActive,
    isVoiceChatLoading,
  };
};
