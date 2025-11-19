import { useCallback } from "react";
import { useStreamingAvatarContext, MessageSender } from "./context";
import { useTextChat } from "./useTextChat";

interface LLMChatResponse {
  success: boolean;
  response?: string;
  error?: string;
}

// Configuration for progressive streaming - Sentence-aware batching
const SENTENCE_ENDING_REGEX = /[.!?]+(\s|$)/; // Detect sentence boundaries
const MAX_BUFFER_LENGTH = 500; // Maximum characters before forcing a send (safety fallback)
const CHUNK_DELAY_MS = 800; // Delay between chunks sent to HeyGen (increased to prevent rate limiting)

// Configuration for retry logic
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * Helper function to determine if an error is retryable
 * Retries on: network errors, timeouts, 5xx server errors
 * Does NOT retry on: 4xx client errors (bad request, auth, etc.)
 */
const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error) {
    // Retry on timeout/abort errors
    if (error.name === 'AbortError') {
      return true;
    }

    // Retry on network errors
    if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      return true;
    }

    // Check for HTTP status codes in error message
    const statusMatch = error.message.match(/(\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      // Retry on 5xx server errors, but not 4xx client errors
      return status >= 500 && status < 600;
    }
  }

  return false;
};

/**
 * Sleep helper for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Custom hook for managing LLM chat interactions with streaming support
 * Integrates with the custom LLM backend and sends responses to the HeyGen avatar
 */
export const useLLMChat = () => {
  const {
    messages,
    isLLMProcessing,
    setIsLLMProcessing,
    currentLLMResponse,
    setCurrentLLMResponse,
    llmError,
    setLLMError,
    addTextMessage,
    sessionId,
    sessionToken,
    setSuppressAvatarEvents,
  } = useStreamingAvatarContext();
  const { sendMessage } = useTextChat();

  /**
   * Send text chunk to HeyGen avatar via streaming task API with retry logic
   */
  const sendChunkToAvatar = useCallback(
    async (text: string) => {
      if (!sessionId || !sessionToken) {
        console.warn("[useLLMChat] Cannot send chunk: session not initialized");
        return;
      }

      // Retry logic for HeyGen streaming tasks (often rate limited)
      const MAX_CHUNK_RETRIES = 2;
      const CHUNK_RETRY_DELAY = 500; // 500ms between retries

      for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
        try {
          console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log("🎤 SENDING TO HEYGEN TTS SERVICE");
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log("Attempt:", attempt, "/", MAX_CHUNK_RETRIES);
          console.log("Endpoint: /api/streaming-task");
          console.log("Text length:", text.length, "characters");
          console.log("Text content:", text);
          console.log("Session ID:", sessionId?.substring(0, 20) + "...");
          console.log("Task type: repeat (TTS)");
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

          const response = await fetch("/api/streaming-task", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
              session_token: sessionToken,
              text,
              task_type: "repeat",
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("❌ HEYGEN TTS FAILED");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("Status:", response.status, response.statusText);
            console.log("Error:", result);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

            // Retry on 500 errors (HeyGen rate limiting or temporary issues)
            if (response.status === 500 && attempt < MAX_CHUNK_RETRIES) {
              console.warn(`⚠️ Retrying in ${CHUNK_RETRY_DELAY}ms...`);
              await sleep(CHUNK_RETRY_DELAY);
              continue; // Retry
            }

            console.error("🛑 Giving up on this chunk, continuing with next chunks");
            return; // Give up on this chunk but continue with next chunks
          } else {
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("✅ HEYGEN TTS SUCCESS");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("Status:", response.status, response.statusText);
            console.log("Response:", result);
            console.log("Task ID:", result.data?.task_id);
            console.log("Duration:", result.data?.duration_ms, "ms");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
            return; // Success - exit retry loop
          }
        } catch (error) {
          if (attempt < MAX_CHUNK_RETRIES) {
            console.warn(`[useLLMChat] Network error sending chunk, retrying in ${CHUNK_RETRY_DELAY}ms...`, error);
            await sleep(CHUNK_RETRY_DELAY);
            continue; // Retry
          }
          console.error("[useLLMChat] Error sending chunk to avatar after retries:", error);
          return; // Give up on this chunk but continue with next chunks
        }
      }
    },
    [sessionId, sessionToken]
  );

  /**
   * Send a message to the LLM backend and stream the response
   * The complete LLM response will be sent to the avatar for speech
   */
  const sendToLLM = useCallback(
    async (userMessage: string, skipAddingToHistory = false): Promise<LLMChatResponse> => {
      try {
        // Reset state at the beginning
        setIsLLMProcessing(true);
        setCurrentLLMResponse("");
        setLLMError(null);

        // BUGFIX: Suppress avatar speech events during LLM streaming
        // This prevents duplicate messages in history (we manually add the complete message)
        setSuppressAvatarEvents(true);

        console.log("[useLLMChat] Sending message to LLM:", userMessage);

        // Add user's text message to history if it's not already there (voice messages are added via events)
        // The skipAddingToHistory flag is used when the message is already in the messages array (e.g., from voice chat)
        if (!skipAddingToHistory) {
          addTextMessage(MessageSender.CLIENT, userMessage);
        }

        // BUGFIX: Implement retry logic with exponential backoff
        let lastError: Error | null = null;
        let attempt = 0;

      while (attempt < MAX_RETRY_ATTEMPTS) {
        attempt++;

        // BUGFIX: Add AbortController with 30s timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error("[useLLMChat] Request timeout after 30 seconds, aborting...");
          controller.abort();
        }, 30000); // 30 second timeout

        try {
          console.log(`[useLLMChat] Attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);

          // Call the backend API route with timeout support
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: userMessage,
              conversationHistory: messages,
            }),
            signal: controller.signal, // Add abort signal for timeout
          });

          // Clear timeout since request was successful
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(
              `LLM API request failed: ${response.status} ${response.statusText}`
            );
          }

        // Handle streaming response with progressive word batching
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();
        let accumulatedResponse = "";
        let sentenceBuffer = ""; // Buffer to accumulate text until we hit a sentence boundary

        console.log("\n╔════════════════════════════════════════════════════╗");
        console.log("║  STREAMING PIPELINE: TutorAI → Client → HeyGen   ║");
        console.log("╚════════════════════════════════════════════════════╝");
        console.log("Starting progressive streaming with sentence-aware batching");
        console.log("Sentence delay:", CHUNK_DELAY_MS, "ms");
        console.log("Max buffer length:", MAX_BUFFER_LENGTH, "characters\n");

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("[useLLMChat] Stream complete");

            // Send any remaining text in buffer
            if (sentenceBuffer.trim().length > 0) {
              console.log("[useLLMChat] Sending final batch:", {
                length: sentenceBuffer.length,
                text: sentenceBuffer.substring(0, 50) + "...",
              });
              await sendChunkToAvatar(sentenceBuffer.trim());
              // Note: No delay needed after final batch since stream is complete
              sentenceBuffer = "";
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.content) {
                accumulatedResponse += data.content;
                setCurrentLLMResponse(accumulatedResponse);

                // Add content to sentence buffer
                sentenceBuffer += data.content;

                console.log(
                  "[useLLMChat] Received chunk, buffer status:",
                  {
                    chunkLength: data.content.length,
                    bufferLength: sentenceBuffer.length,
                    bufferPreview: sentenceBuffer.substring(0, 50) + "...",
                  }
                );

                // BUGFIX: Sentence-aware batching - Split on sentence boundaries (.!?)
                // This ensures natural phrasing and prevents mid-sentence splits
                let lastSentenceEnd = -1;
                const match = sentenceBuffer.match(SENTENCE_ENDING_REGEX);

                if (match && match.index !== undefined) {
                  // Find the position after the sentence ending punctuation and space
                  lastSentenceEnd = match.index + match[0].length;
                }

                // Send complete sentences, or force send if buffer gets too long
                if (lastSentenceEnd > 0 || sentenceBuffer.length > MAX_BUFFER_LENGTH) {
                  const textToSend = lastSentenceEnd > 0
                    ? sentenceBuffer.substring(0, lastSentenceEnd).trim()
                    : sentenceBuffer.trim();

                  const remainingText = lastSentenceEnd > 0
                    ? sentenceBuffer.substring(lastSentenceEnd)
                    : "";

                  if (textToSend.length > 0) {
                    console.log("\n📝 SENTENCE BATCH READY:");
                    console.log("Length:", textToSend.length, "characters");
                    console.log("Text:", textToSend);
                    console.log("Remaining buffer:", remainingText.length, "characters");
                    console.log("Batch reason:", lastSentenceEnd > 0 ? "sentence_boundary" : "max_length");

                    await sendChunkToAvatar(textToSend);
                    sentenceBuffer = remainingText;

                    // BUGFIX: Add delay between chunks to prevent TTS queue flooding and HeyGen rate limiting
                    // This prevents audio overlap and gives avatar time to process each chunk
                    console.log(`⏱️  Waiting ${CHUNK_DELAY_MS}ms before next chunk...\n`);
                    await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
                  }
                }
              }

              if (data.done) {
                console.log(
                  "[useLLMChat] Stream marked as done, accumulated:",
                  accumulatedResponse.substring(0, 100)
                );
                break;
              }
            } catch (parseError) {
              console.error("[useLLMChat] Failed to parse chunk:", parseError);
            }
          }
        }

        // Validate we got a response
        if (!accumulatedResponse || accumulatedResponse.trim() === "") {
          throw new Error("LLM returned an empty response");
        }

        console.log(
          "[useLLMChat] Final response length:",
          accumulatedResponse.length
        );

        // DIAGNOSTIC LOGGING: Track manual message addition sequence
        console.log(
          "[useLLMChat] Adding complete LLM response to history:",
          {
            responseLength: accumulatedResponse.length,
            responsePreview: accumulatedResponse.substring(0, 100) + "...",
            sender: "AVATAR",
            timestamp: new Date().toISOString(),
          }
        );

        // Add the complete LLM response to message history
        // The avatar is already speaking via progressive chunks sent above
        addTextMessage(MessageSender.AVATAR, accumulatedResponse);

          console.log("[useLLMChat] Message added to history, avatar already speaking via streaming chunks");

          // Success! Clear timeout and return
          // Note: setIsLLMProcessing and setSuppressAvatarEvents will be reset in finally block
          clearTimeout(timeoutId);
          return { success: true, response: accumulatedResponse };

        } catch (error) {
          // BUGFIX: Clear timeout on error to prevent memory leaks
          clearTimeout(timeoutId);

          // Store error for potential retry
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we should retry
          if (isRetryableError(lastError) && attempt < MAX_RETRY_ATTEMPTS) {
            const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
            console.warn(
              `[useLLMChat] Attempt ${attempt} failed, retrying in ${delayMs}ms...`,
              lastError.message
            );
            await sleep(delayMs);
            continue; // Retry
          }

          // All retries exhausted or non-retryable error
          console.error(
            `[useLLMChat] All ${attempt} attempts failed or non-retryable error:`,
            lastError.message
          );
          break; // Exit retry loop
        }
      }

      // If we reach here, all retries failed - handle the error
      if (lastError) {
        // Handle abort/timeout errors specifically
        let errorMessage: string;
        if (lastError.name === 'AbortError') {
          errorMessage = `Request timed out after ${MAX_RETRY_ATTEMPTS} attempts. The LLM backend may be unavailable or overloaded.`;
          console.error("[useLLMChat] All retries timed out:", errorMessage);
        } else {
          errorMessage = lastError.message;
          console.error("[useLLMChat] All retries failed:", errorMessage);
        }

        setLLMError(errorMessage);
        setCurrentLLMResponse("");
        // Note: setIsLLMProcessing and setSuppressAvatarEvents will be reset in finally block

        // Send a fallback message to the avatar (only if avatar is connected)
        try {
          const fallbackMessage = lastError.name === 'AbortError'
            ? "I apologize, but my response timed out after multiple attempts. The system may be experiencing high load. Please try again later."
            : "I apologize, but I encountered an error processing your request after multiple attempts. Please try again.";

          sendMessage(fallbackMessage);
        } catch (sendError) {
          console.error(
            "[useLLMChat] Failed to send fallback error message to avatar:",
            sendError
          );
          // Don't throw here - the main error is already captured
        }

        return { success: false, error: errorMessage };
      }

        // Should never reach here, but TypeScript needs this
        return { success: false, error: "Unknown error: no attempts made" };
      } finally {
        // BUGFIX: ALWAYS reset these flags, even on unexpected errors
        // This ensures the UI doesn't get stuck in a loading/suppressed state
        setIsLLMProcessing(false);
        setSuppressAvatarEvents(false);
      }
    },
    [
      messages,
      setIsLLMProcessing,
      setCurrentLLMResponse,
      setLLMError,
      sendMessage,
      addTextMessage,
      sendChunkToAvatar,
      setSuppressAvatarEvents,
    ]
  );

  return {
    sendToLLM,
    isLLMProcessing,
    currentLLMResponse,
    llmError,
  };
};
