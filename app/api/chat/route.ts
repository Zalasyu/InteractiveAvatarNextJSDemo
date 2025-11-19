import { Message, MessageSender } from "@/components/logic/types";
import {
  createLLMAdapterFromEnv,
  messagesToLLMMessages,
  createSystemMessage,
  ensureSystemMessage,
  LLMAdapterError,
} from "@/app/lib/llm";
import { createLogger } from "@/app/lib/logger";

const logger = createLogger({ module: "chat-api" });

const LLM_SYSTEM_PROMPT =
  process.env.LLM_SYSTEM_PROMPT ||
  "You are a helpful AI tutor assistant. Provide clear, concise, and educational responses to help students learn.";

// Maximum number of previous conversation turns to include for context
const MAX_HISTORY_TURNS = 5;

interface ChatRequestBody {
  message: string;
  conversationHistory: Message[];
}

/**
 * Prepare messages for LLM adapter
 * Filters and limits conversation history, then converts to LLM format
 */
function prepareMessagesForLLM(
  message: string,
  conversationHistory: Message[]
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  // BUGFIX #1: Filter out incomplete messages to prevent race conditions
  const completeHistory = conversationHistory.filter(
    (msg) => msg.isComplete !== false
  );

  // BUGFIX #2: Remove duplicate current message from history
  let filteredHistory = completeHistory;
  if (completeHistory.length > 0) {
    const lastMsg = completeHistory[completeHistory.length - 1];
    if (lastMsg.sender === MessageSender.CLIENT && lastMsg.content === message) {
      filteredHistory = completeHistory.slice(0, -1);
    }
  }

  // BUGFIX #3: Limit history to prevent token overflow
  const recentHistory = filteredHistory.slice(-MAX_HISTORY_TURNS * 2);

  // Convert to LLM message format
  const llmMessages = messagesToLLMMessages(recentHistory);

  // Add system message and current user message
  const messagesWithContext = ensureSystemMessage(llmMessages, LLM_SYSTEM_PROMPT);

  // Add current user message
  messagesWithContext.push({
    role: "user",
    content: message,
  });

  return messagesWithContext;
}

/**
 * POST /api/chat
 * Unified streaming endpoint that supports multiple LLM backends through adapters
 * Returns: NDJSON stream with {content, done} format
 */
export async function POST(request: Request) {
  try {
    const body: ChatRequestBody = await request.json();
    const { message, conversationHistory } = body;

    // Prepare messages in LLM format
    const llmMessages = prepareMessagesForLLM(message, conversationHistory);

    logger.info({
      messageLength: message.length,
      historyTurns: conversationHistory.length,
      llmMessagesCount: llmMessages.length,
    }, "Processing chat request");

    // Get the appropriate adapter from environment
    const adapter = createLLMAdapterFromEnv();
    logger.info({ adapter: adapter.getName() }, "Using LLM adapter");

    // Create streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let chunksSentToClient = 0;
        console.log("\n🔁 FORWARDING CHUNKS TO CLIENT (NDJSON FORMAT)\n");

        try {
          // Stream from adapter
          for await (const chunk of adapter.stream({ messages: llmMessages })) {
            // Log chunk forwarding
            if (chunk.content) {
              chunksSentToClient++;
              console.log(`📨 Forwarding chunk #${chunksSentToClient} to client:`, {
                contentLength: chunk.content.length,
                contentPreview: chunk.content.substring(0, 50) + (chunk.content.length > 50 ? "..." : ""),
                done: chunk.done,
              });
            } else if (chunk.done) {
              console.log("📨 Forwarding completion signal to client");
            }

            // Forward chunk to client in NDJSON format
            controller.enqueue(
              encoder.encode(JSON.stringify(chunk) + "\n")
            );

            // Break if stream is done
            if (chunk.done) {
              console.log("\n✅ FINISHED FORWARDING TO CLIENT");
              console.log("Total chunks forwarded:", chunksSentToClient);
              console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
              controller.close();
              break;
            }

            // Handle errors
            if (chunk.error) {
              logger.error({ error: chunk.error }, "Stream error from adapter");
              console.log("❌ Error in stream, closing connection");
              controller.close();
              break;
            }
          }
        } catch (error) {
          logger.error({ error }, "Stream processing error");

          // Send error chunk
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                content: "",
                done: true,
                error:
                  error instanceof LLMAdapterError
                    ? error.message
                    : error instanceof Error
                    ? error.message
                    : "Stream processing error",
              }) + "\n"
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error({ error }, "Chat API error");
    return new Response(
      JSON.stringify({
        content: "",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        done: true,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
