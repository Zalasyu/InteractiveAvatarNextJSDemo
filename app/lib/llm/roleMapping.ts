/**
 * Role Mapping Utilities
 *
 * Converts between the current MessageSender enum (CLIENT, AVATAR)
 * and the OpenAI-compliant MessageRole format (user, assistant, system).
 */

import { Message, MessageSender } from "@/components/logic/types";
import { LLMMessage, MessageRole } from "./BaseLLMAdapter";

/**
 * Convert MessageSender to MessageRole
 */
export function senderToRole(sender: MessageSender): MessageRole {
  switch (sender) {
    case MessageSender.CLIENT:
      return "user";
    case MessageSender.AVATAR:
      return "assistant";
    default:
      throw new Error(`Unknown MessageSender: ${sender}`);
  }
}

/**
 * Convert MessageRole to MessageSender
 */
export function roleToSender(role: MessageRole): MessageSender {
  switch (role) {
    case "user":
      return MessageSender.CLIENT;
    case "assistant":
      return MessageSender.AVATAR;
    case "system":
      // System messages don't have a direct equivalent in current enum
      // Default to AVATAR for system messages
      return MessageSender.AVATAR;
    default:
      throw new Error(`Unknown MessageRole: ${role}`);
  }
}

/**
 * Convert current Message format to LLMMessage format
 */
export function messageToLLMMessage(message: Message): LLMMessage {
  return {
    role: senderToRole(message.sender),
    content: message.content,
  };
}

/**
 * Convert LLMMessage format to current Message format
 */
export function llmMessageToMessage(llmMessage: LLMMessage): Message {
  return {
    id: Date.now().toString(), // Generate ID
    sender: roleToSender(llmMessage.role),
    content: llmMessage.content,
    isComplete: true, // LLM messages from history are always complete
  };
}

/**
 * Convert array of current Messages to LLMMessages
 */
export function messagesToLLMMessages(messages: Message[]): LLMMessage[] {
  return messages.map(messageToLLMMessage);
}

/**
 * Convert array of LLMMessages to current Messages
 */
export function llmMessagesToMessages(llmMessages: LLMMessage[]): Message[] {
  return llmMessages.map(llmMessageToMessage);
}

/**
 * Create a system message (LLM format)
 */
export function createSystemMessage(content: string): LLMMessage {
  return {
    role: "system",
    content,
  };
}

/**
 * Create a user message (LLM format)
 */
export function createUserMessage(content: string): LLMMessage {
  return {
    role: "user",
    content,
  };
}

/**
 * Create an assistant message (LLM format)
 */
export function createAssistantMessage(content: string): LLMMessage {
  return {
    role: "assistant",
    content,
  };
}

/**
 * Add system message to beginning of conversation if not present
 */
export function ensureSystemMessage(
  messages: LLMMessage[],
  systemPrompt: string
): LLMMessage[] {
  // Check if first message is already a system message
  if (messages.length > 0 && messages[0].role === "system") {
    return messages;
  }

  // Prepend system message
  return [createSystemMessage(systemPrompt), ...messages];
}
