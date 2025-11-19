import { TaskMode, TaskType } from "@heygen/streaming-avatar";
import { useCallback } from "react";

import { useStreamingAvatarContext, StreamingAvatarSessionState } from "./context";

export const useTextChat = () => {
  const { avatarRef, sessionState } = useStreamingAvatarContext();

  const sendMessage = useCallback(
    (message: string) => {
      if (!avatarRef.current) {
        console.error("[useTextChat] Avatar ref is null, cannot send message");
        return;
      }

      // BUGFIX: Validate avatar session is connected before calling speak()
      if (sessionState !== StreamingAvatarSessionState.CONNECTED) {
        console.error(
          "[useTextChat] Cannot send message: Avatar session not connected. State:",
          sessionState
        );
        throw new Error(
          `Avatar session is not connected (current state: ${sessionState})`
        );
      }

      if (!message || message.trim() === "") {
        console.warn("[useTextChat] Attempted to send empty message");
        return;
      }

      try {
        return avatarRef.current.speak({
          text: message,
          taskType: TaskType.TALK,
          taskMode: TaskMode.ASYNC,
        });
      } catch (error) {
        console.error("[useTextChat] Failed to send message:", error);
        throw error;
      }
    },
    [avatarRef, sessionState],
  );

  const sendMessageSync = useCallback(
    async (message: string) => {
      if (!avatarRef.current) {
        console.error("[useTextChat] Avatar ref is null, cannot send message");
        return;
      }

      if (sessionState !== StreamingAvatarSessionState.CONNECTED) {
        console.error(
          "[useTextChat] Cannot send message sync: Avatar session not connected. State:",
          sessionState
        );
        throw new Error(
          `Avatar session is not connected (current state: ${sessionState})`
        );
      }

      if (!message || message.trim() === "") {
        console.warn("[useTextChat] Attempted to send empty message");
        return;
      }

      try {
        return await avatarRef.current.speak({
          text: message,
          taskType: TaskType.TALK,
          taskMode: TaskMode.SYNC,
        });
      } catch (error) {
        console.error("[useTextChat] Failed to send message sync:", error);
        throw error;
      }
    },
    [avatarRef, sessionState],
  );

  const repeatMessage = useCallback(
    (message: string) => {
      if (!avatarRef.current) {
        console.error("[useTextChat] Avatar ref is null, cannot repeat message");
        return;
      }

      if (sessionState !== StreamingAvatarSessionState.CONNECTED) {
        console.error(
          "[useTextChat] Cannot repeat message: Avatar session not connected. State:",
          sessionState
        );
        throw new Error(
          `Avatar session is not connected (current state: ${sessionState})`
        );
      }

      if (!message || message.trim() === "") {
        console.warn("[useTextChat] Attempted to repeat empty message");
        return;
      }

      try {
        return avatarRef.current.speak({
          text: message,
          taskType: TaskType.REPEAT,
          taskMode: TaskMode.ASYNC,
        });
      } catch (error) {
        console.error("[useTextChat] Failed to repeat message:", error);
        throw error;
      }
    },
    [avatarRef, sessionState],
  );

  const repeatMessageSync = useCallback(
    async (message: string) => {
      if (!avatarRef.current) {
        console.error("[useTextChat] Avatar ref is null, cannot repeat message");
        return;
      }

      if (sessionState !== StreamingAvatarSessionState.CONNECTED) {
        console.error(
          "[useTextChat] Cannot repeat message sync: Avatar session not connected. State:",
          sessionState
        );
        throw new Error(
          `Avatar session is not connected (current state: ${sessionState})`
        );
      }

      if (!message || message.trim() === "") {
        console.warn("[useTextChat] Attempted to repeat empty message");
        return;
      }

      try {
        return await avatarRef.current.speak({
          text: message,
          taskType: TaskType.REPEAT,
          taskMode: TaskMode.SYNC,
        });
      } catch (error) {
        console.error("[useTextChat] Failed to repeat message sync:", error);
        throw error;
      }
    },
    [avatarRef, sessionState],
  );

  return {
    sendMessage,
    sendMessageSync,
    repeatMessage,
    repeatMessageSync,
  };
};
