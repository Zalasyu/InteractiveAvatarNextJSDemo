/**
 * Custom Backend Adapter
 *
 * Wraps the existing custom LLM backend that expects {"Question": "..."} format
 * and returns SSE events. Maintains backward compatibility with current implementation.
 */

import {
  BaseLLMAdapter,
  LLMStreamRequest,
  LLMStreamChunk,
  LLMAdapterError,
} from "./BaseLLMAdapter";

// Backend SSE Event Types (matching current implementation)
interface SSEStartEvent {
  type: "start";
  message: string;
}

interface SSEChunkEvent {
  type: "chunk";
  content: string;
}

interface SSECompleteEvent {
  type: "complete";
  success: boolean;
  tokensUsed: number;
  estimatedCost: number;
  errorMessage: string | null;
}

interface SSEFinalEvent {
  type: "final";
  success: boolean;
  response: string;
  tokensUsed: number;
  estimatedCost: number;
  totalTimeMs: number;
  errorMessage: string | null;
}

type SSEEvent = SSEStartEvent | SSEChunkEvent | SSECompleteEvent | SSEFinalEvent;

export class CustomBackendAdapter implements BaseLLMAdapter {
  private readonly apiUrl: string;
  private readonly systemPrompt: string;

  constructor(apiUrl: string, systemPrompt?: string) {
    if (!apiUrl) {
      throw new LLMAdapterError(
        "API URL is required for CustomBackendAdapter",
        "CustomBackendAdapter"
      );
    }
    this.apiUrl = apiUrl;
    this.systemPrompt =
      systemPrompt ||
      "You are a helpful AI tutor assistant. Provide clear, concise, and educational responses to help students learn.";
  }

  getName(): string {
    return "CustomBackendAdapter";
  }

  /**
   * Convert normalized LLMMessage[] format to backend's "Question" format
   *
   * Backend handles system prompt and conversation history internally,
   * so we only send the current user question.
   */
  private formatMessagesForBackend(request: LLMStreamRequest): string {
    const { messages } = request;

    // Find the last user message (the current question)
    const userMessages = messages.filter((m) => m.role === "user");

    if (userMessages.length === 0) {
      throw new LLMAdapterError(
        "No user message found in request",
        this.getName()
      );
    }

    // Return ONLY the user's question - backend handles system prompt and history
    const currentQuestion = userMessages[userMessages.length - 1].content;
    return currentQuestion;
  }

  /**
   * Stream responses from the custom backend
   */
  async *stream(request: LLMStreamRequest): AsyncIterable<LLMStreamChunk> {
    const formattedQuestion = this.formatMessagesForBackend(request);

    // LOG: Request being sent to TutorAI Backend
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 SENDING REQUEST TO TUTORAI BACKEND");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Endpoint:", this.apiUrl);
    console.log("Method: POST");
    console.log("Headers:", {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    });
    console.log("Request Body:", JSON.stringify({ Question: formattedQuestion }, null, 2));
    console.log("Question Length:", formattedQuestion.length, "characters");
    console.log("Question Preview:", formattedQuestion.substring(0, 200) + "...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    try {
      // Call the custom LLM streaming endpoint
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Question: formattedQuestion }),
      });

      // LOG: Response received
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📥 RESPONSE FROM TUTORAI BACKEND");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Status:", response.status, response.statusText);
      console.log("OK:", response.ok);
      console.log("Headers:", Object.fromEntries(response.headers.entries()));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      if (!response.ok) {
        const errorText = await response.text();
        throw new LLMAdapterError(
          `API request failed: ${response.status} ${response.statusText}. ${errorText}`,
          this.getName()
        );
      }

      // Verify response is streaming
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("text/event-stream")) {
        // Fallback for non-streaming response
        const data = await response.json();
        yield {
          content: data.content || data.message || JSON.stringify(data),
          done: true,
        };
        return;
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new LLMAdapterError(
          "Response body is not readable",
          this.getName()
        );
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let tokensUsed = 0;
      let estimatedCost = 0;
      let chunkCount = 0;

      console.log("🔄 STARTING SSE STREAM FROM TUTORAI BACKEND\n");

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Stream complete
            console.log("\n✅ SSE STREAM COMPLETE");
            console.log("Total chunks received:", chunkCount);
            console.log("Total tokens used:", tokensUsed);
            console.log("Estimated cost: $" + estimatedCost.toFixed(6));
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
            yield { content: "", done: true };
            break;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          // Keep last incomplete line in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // Skip event type lines
            if (trimmedLine.startsWith("event:")) {
              continue;
            }

            // Parse data lines
            if (trimmedLine.startsWith("data:")) {
              const dataContent = trimmedLine.substring(5).trim();

              // Handle [DONE] signal
              if (dataContent === "[DONE]") {
                console.log("📌 Received [DONE] signal from TutorAI");
                continue;
              }

              try {
                const parsed: SSEEvent = JSON.parse(dataContent);

                // Handle different event types
                if (parsed.type === "start") {
                  console.log("🚀 SSE Event [start]:", parsed.message);
                  continue;
                }

                if (parsed.type === "chunk") {
                  if (parsed.content) {
                    chunkCount++;
                    console.log(`📦 SSE Event [chunk #${chunkCount}]:`, {
                      length: parsed.content.length,
                      content: parsed.content.substring(0, 50) + (parsed.content.length > 50 ? "..." : ""),
                    });
                    yield { content: parsed.content, done: false };
                  }
                  continue;
                }

                if (parsed.type === "complete") {
                  tokensUsed = parsed.tokensUsed;
                  estimatedCost = parsed.estimatedCost;
                  console.log("✓ SSE Event [complete]:", {
                    success: parsed.success,
                    tokensUsed: parsed.tokensUsed,
                    estimatedCost: parsed.estimatedCost,
                    errorMessage: parsed.errorMessage,
                  });

                  if (!parsed.success && parsed.errorMessage) {
                    yield {
                      content: "",
                      done: true,
                      error: parsed.errorMessage,
                    };
                    return;
                  }
                  continue;
                }

                if (parsed.type === "final") {
                  tokensUsed = parsed.tokensUsed;
                  estimatedCost = parsed.estimatedCost;
                  console.log("🏁 SSE Event [final]:", {
                    success: parsed.success,
                    tokensUsed: parsed.tokensUsed,
                    estimatedCost: parsed.estimatedCost,
                    totalTimeMs: parsed.totalTimeMs,
                    errorMessage: parsed.errorMessage,
                  });

                  if (!parsed.success && parsed.errorMessage) {
                    yield {
                      content: "",
                      done: true,
                      error: parsed.errorMessage,
                    };
                    return;
                  }
                  continue;
                }
              } catch (parseError) {
                // Log parsing errors but don't crash the stream
                console.error(
                  "[CustomBackendAdapter] Failed to parse SSE data:",
                  parseError,
                  "Data:",
                  dataContent
                );
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof LLMAdapterError) {
        throw error;
      }
      throw new LLMAdapterError(
        `Stream error: ${error instanceof Error ? error.message : String(error)}`,
        this.getName(),
        error
      );
    }
  }
}
