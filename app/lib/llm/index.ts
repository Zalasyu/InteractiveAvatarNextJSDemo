/**
 * LLM Adapter Factory
 *
 * Provides a factory function to create the appropriate LLM adapter
 * based on environment configuration.
 */

export * from "./BaseLLMAdapter";
export * from "./CustomBackendAdapter";
export * from "./OpenAIAdapter";
export * from "./roleMapping";

import { BaseLLMAdapter, LLMAdapterError } from "./BaseLLMAdapter";
import { CustomBackendAdapter } from "./CustomBackendAdapter";
import { OpenAIAdapter, OpenAIAdapterConfig } from "./OpenAIAdapter";

/**
 * Supported LLM provider types
 */
export type LLMProvider = "custom" | "openai";

/**
 * Configuration for creating an LLM adapter
 */
export interface LLMAdapterFactoryConfig {
  provider?: LLMProvider; // Defaults to "custom"
  // Custom backend config
  customApiUrl?: string;
  customSystemPrompt?: string;
  // OpenAI config
  openAIApiKey?: string;
  openAIBaseURL?: string;
  openAIModel?: string;
  openAIOrganization?: string;
}

/**
 * Create an LLM adapter based on the provider type
 *
 * @param config - Configuration for the adapter
 * @returns Initialized LLM adapter
 * @throws LLMAdapterError if configuration is invalid
 *
 * @example
 * ```typescript
 * // Using custom backend
 * const adapter = createLLMAdapter({
 *   provider: "custom",
 *   customApiUrl: process.env.CUSTOM_LLM_API_URL,
 * });
 *
 * // Using OpenAI
 * const adapter = createLLMAdapter({
 *   provider: "openai",
 *   openAIApiKey: process.env.OPENAI_API_KEY,
 *   openAIModel: "gpt-4-turbo-preview",
 * });
 * ```
 */
export function createLLMAdapter(
  config: LLMAdapterFactoryConfig = {}
): BaseLLMAdapter {
  const provider = config.provider || "custom";

  switch (provider) {
    case "custom":
      return createCustomAdapter(config);
    case "openai":
      return createOpenAIAdapter(config);
    default:
      throw new LLMAdapterError(
        `Unknown LLM provider: ${provider}`,
        "AdapterFactory"
      );
  }
}

/**
 * Create a CustomBackendAdapter instance
 */
function createCustomAdapter(
  config: LLMAdapterFactoryConfig
): CustomBackendAdapter {
  const apiUrl = config.customApiUrl || process.env.CUSTOM_LLM_API_URL;

  if (!apiUrl) {
    throw new LLMAdapterError(
      "CUSTOM_LLM_API_URL is required for custom provider",
      "AdapterFactory"
    );
  }

  const systemPrompt =
    config.customSystemPrompt ||
    process.env.LLM_SYSTEM_PROMPT ||
    "You are a helpful AI tutor assistant. Provide clear, concise, and educational responses to help students learn.";

  return new CustomBackendAdapter(apiUrl, systemPrompt);
}

/**
 * Create an OpenAIAdapter instance
 */
function createOpenAIAdapter(
  config: LLMAdapterFactoryConfig
): OpenAIAdapter {
  const apiKey = config.openAIApiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new LLMAdapterError(
      "OPENAI_API_KEY is required for openai provider",
      "AdapterFactory"
    );
  }

  const openAIConfig: OpenAIAdapterConfig = {
    apiKey,
    baseURL: config.openAIBaseURL || process.env.OPENAI_BASE_URL,
    model: config.openAIModel || process.env.OPENAI_MODEL,
    organization: config.openAIOrganization || process.env.OPENAI_ORGANIZATION,
  };

  return new OpenAIAdapter(openAIConfig);
}

/**
 * Create an LLM adapter from environment variables
 *
 * Reads LLM_PROVIDER environment variable to determine which adapter to use.
 * Defaults to "custom" if not specified.
 *
 * @returns Initialized LLM adapter based on environment
 * @throws LLMAdapterError if required environment variables are missing
 *
 * @example
 * ```typescript
 * // In .env file:
 * // LLM_PROVIDER=custom
 * // CUSTOM_LLM_API_URL=https://api.example.com
 *
 * const adapter = createLLMAdapterFromEnv();
 * ```
 */
export function createLLMAdapterFromEnv(): BaseLLMAdapter {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) || "custom";

  return createLLMAdapter({
    provider,
    // Config will be read from environment variables in create functions
  });
}
