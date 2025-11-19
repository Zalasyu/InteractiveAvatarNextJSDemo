/**
 * OpenAI Adapter
 *
 * Adapter for OpenAI-compliant backends using the official OpenAI SDK.
 * Supports both OpenAI and OpenAI-compatible endpoints (e.g., Azure OpenAI, local models).
 */

import OpenAI from "openai";
import {
  BaseLLMAdapter,
  LLMStreamRequest,
  LLMStreamChunk,
  LLMAdapterError,
} from "./BaseLLMAdapter";

export interface OpenAIAdapterConfig {
  apiKey: string;
  baseURL?: string; // For OpenAI-compatible endpoints
  model?: string; // Default model to use
  organization?: string;
}

export class OpenAIAdapter implements BaseLLMAdapter {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(config: OpenAIAdapterConfig) {
    if (!config.apiKey) {
      throw new LLMAdapterError(
        "API key is required for OpenAIAdapter",
        "OpenAIAdapter"
      );
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
    });

    this.defaultModel = config.model || "gpt-4-turbo-preview";
  }

  getName(): string {
    return "OpenAIAdapter";
  }

  /**
   * Stream responses from OpenAI or OpenAI-compatible backend
   */
  async *stream(request: LLMStreamRequest): AsyncIterable<LLMStreamChunk> {
    const { messages, temperature, maxTokens, model } = request;

    try {
      // Convert our LLMMessage format to OpenAI format (already compatible)
      const openAIMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Create streaming request
      const stream = await this.client.chat.completions.create({
        model: model || this.defaultModel,
        messages: openAIMessages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens,
        stream: true,
      });

      // Stream chunks
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (delta?.content) {
          yield {
            content: delta.content,
            done: false,
          };
        }

        // Check if stream is complete
        if (finishReason === "stop" || finishReason === "length") {
          yield {
            content: "",
            done: true,
          };
          break;
        }

        // Handle errors
        if (finishReason === "content_filter") {
          yield {
            content: "",
            done: true,
            error: "Content was filtered by safety systems",
          };
          break;
        }
      }
    } catch (error) {
      // Handle OpenAI API errors
      if (error instanceof OpenAI.APIError) {
        throw new LLMAdapterError(
          `OpenAI API error (${error.status}): ${error.message}`,
          this.getName(),
          error
        );
      }

      throw new LLMAdapterError(
        `Stream error: ${error instanceof Error ? error.message : String(error)}`,
        this.getName(),
        error
      );
    }
  }
}
