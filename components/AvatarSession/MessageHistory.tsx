import React, { useEffect, useRef } from "react";

import { useMessageHistory, MessageSender, useStreamingAvatarContext } from "../logic";

export const MessageHistory: React.FC = () => {
  const { messages } = useMessageHistory();
  const { isLLMProcessing, currentLLMResponse } = useStreamingAvatarContext();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [messages, currentLLMResponse]);

  return (
    <div
      ref={containerRef}
      className="w-[600px] overflow-y-auto flex flex-col gap-2 px-2 py-2 text-white self-center max-h-[150px]"
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex flex-col gap-1 max-w-[350px] ${
            message.sender === MessageSender.CLIENT
              ? "self-end items-end"
              : "self-start items-start"
          }`}
        >
          <p className="text-xs text-zinc-400">
            {message.sender === MessageSender.AVATAR ? "Avatar" : "You"}
          </p>
          <p className="text-sm">{message.content}</p>
        </div>
      ))}
      {isLLMProcessing && (
        <div className="flex flex-col gap-1 max-w-[350px] self-start items-start">
          <p className="text-xs text-zinc-400">Avatar (thinking...)</p>
          <div className="text-sm">
            {currentLLMResponse ? (
              <p className="italic opacity-80">{currentLLMResponse}</p>
            ) : (
              <div className="flex gap-1">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce delay-100">●</span>
                <span className="animate-bounce delay-200">●</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
