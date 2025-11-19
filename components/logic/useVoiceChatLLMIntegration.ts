import { useEffect, useRef } from "react";
import { useStreamingAvatarContext, MessageSender } from "./context";
import { useLLMChat } from "./useLLMChat";

/**
 * Hook that integrates LLM processing with voice chat
 * Automatically sends user voice transcripts to LLM when user finishes speaking
 */
export const useVoiceChatLLMIntegration = () => {
  const { messages, isVoiceChatActive, isLLMProcessing } =
    useStreamingAvatarContext();
  const { sendToLLM } = useLLMChat();
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    // Only process messages during active voice chat
    if (!isVoiceChatActive || isLLMProcessing || processingRef.current) {
      return;
    }

    // Get the last message
    if (messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];

    // BUGFIX: Check if this is a new, COMPLETE user message that hasn't been processed
    // Use isComplete flag instead of arbitrary timeout to prevent race conditions
    if (
      lastMessage.sender === MessageSender.CLIENT &&
      lastMessage.id !== lastProcessedMessageIdRef.current &&
      lastMessage.content.trim() !== "" &&
      lastMessage.isComplete === true // Only process complete messages
    ) {
      // CRITICAL FIX: Set flag BEFORE async processing to prevent race condition
      // If useEffect fires again quickly, we need the flag to already be set
      processingRef.current = true;
      lastProcessedMessageIdRef.current = lastMessage.id;

      const processMessage = async () => {
        try {
          console.log(
            "[useVoiceChatLLMIntegration] Processing voice message:",
            lastMessage.content.substring(0, 50)
          );

          // Pass skipAddingToHistory=true since voice messages are already added to state via USER_TALKING events
          await sendToLLM(lastMessage.content, true);
        } catch (error) {
          console.error(
            "[useVoiceChatLLMIntegration] Failed to process voice message:",
            error
          );
        } finally {
          // BUGFIX: Always reset processing flag, even on error
          processingRef.current = false;
        }
      };

      // Process immediately since we know the message is complete
      processMessage();
    }
  }, [messages, isVoiceChatActive, isLLMProcessing, sendToLLM]);
};
