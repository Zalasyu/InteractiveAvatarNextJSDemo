/**
 * Base LLM Adapter Interface
 *
 * This interface defines the contract for all LLM backend adapters.
 * Supports multiple backends (custom, OpenAI-compliant, etc.) through a unified interface.
 */

/**
 * Message role types following OpenAI convention
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * Normalized message format for LLM adapters
 * Compatible with OpenAI chat completion format
 */
export interface LLMMessage {
  role: MessageRole;
  content: string;
}

/**
 * Request configuration for LLM streaming
 */
export interface LLMStreamRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Streaming response chunk from LLM
 */
export interface LLMStreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

/**
 * Base interface that all LLM adapters must implement
 *
 * Adapters handle the translation between the normalized format
 * and the specific backend API format.
 */
export interface BaseLLMAdapter {
  /**
   * Stream responses from the LLM backend
   *
   * @param request - Normalized request with messages and options
   * @returns AsyncIterable of response chunks
   * @throws Error if streaming fails
   */
  stream(request: LLMStreamRequest): AsyncIterable<LLMStreamChunk>;

  /**
   * Get the adapter name for logging/debugging
   */
  getName(): string;
}

/**
 * Error class for LLM adapter failures
 */
export class LLMAdapterError extends Error {
  constructor(
    message: string,
    public readonly adapter: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "LLMAdapterError";
  }
}
