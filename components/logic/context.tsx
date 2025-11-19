import StreamingAvatar, {
  ConnectionQuality,
  StreamingTalkingMessageEvent,
  UserTalkingMessageEvent,
} from "@heygen/streaming-avatar";
import React, { useRef, useState } from "react";

import {
  StreamingAvatarSessionState,
  MessageSender,
  Message,
  QuotaInfo,
} from "./types";

// Re-export for backward compatibility
export { StreamingAvatarSessionState, MessageSender };
export type { Message };

type StreamingAvatarContextProps = {
  avatarRef: React.MutableRefObject<StreamingAvatar | null>;
  basePath?: string;

  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
  isVoiceChatLoading: boolean;
  setIsVoiceChatLoading: (isVoiceChatLoading: boolean) => void;
  isVoiceChatActive: boolean;
  setIsVoiceChatActive: (isVoiceChatActive: boolean) => void;

  sessionState: StreamingAvatarSessionState;
  setSessionState: (sessionState: StreamingAvatarSessionState) => void;
  stream: MediaStream | null;
  setStream: (stream: MediaStream | null) => void;

  // Session identifiers for HeyGen API
  sessionId: string | null;
  setSessionId: (sessionId: string | null) => void;
  sessionToken: string | null;
  setSessionToken: (sessionToken: string | null) => void;

  messages: Message[];
  clearMessages: () => void;
  addTextMessage: (sender: MessageSender, content: string) => void;
  handleUserTalkingMessage: ({
    detail,
  }: {
    detail: UserTalkingMessageEvent;
  }) => void;
  handleStreamingTalkingMessage: ({
    detail,
  }: {
    detail: StreamingTalkingMessageEvent;
  }) => void;
  handleEndMessage: () => void;

  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isUserTalking: boolean;
  setIsUserTalking: (isUserTalking: boolean) => void;
  isAvatarTalking: boolean;
  setIsAvatarTalking: (isAvatarTalking: boolean) => void;

  connectionQuality: ConnectionQuality;
  setConnectionQuality: (connectionQuality: ConnectionQuality) => void;

  // LLM Integration State
  isLLMProcessing: boolean;
  setIsLLMProcessing: (isLLMProcessing: boolean) => void;
  currentLLMResponse: string;
  setCurrentLLMResponse: (currentLLMResponse: string) => void;
  llmError: string | null;
  setLLMError: (llmError: string | null) => void;
  suppressAvatarEvents: boolean;
  setSuppressAvatarEvents: (suppressAvatarEvents: boolean) => void;

  // Quota Monitoring State
  quotaInfo: QuotaInfo;
  setQuotaInfo: (quotaInfo: QuotaInfo) => void;
};

const StreamingAvatarContext = React.createContext<StreamingAvatarContextProps>(
  {
    avatarRef: { current: null },
    isMuted: true,
    setIsMuted: () => {},
    isVoiceChatLoading: false,
    setIsVoiceChatLoading: () => {},
    sessionState: StreamingAvatarSessionState.INACTIVE,
    setSessionState: () => {},
    isVoiceChatActive: false,
    setIsVoiceChatActive: () => {},
    stream: null,
    setStream: () => {},
    sessionId: null,
    setSessionId: () => {},
    sessionToken: null,
    setSessionToken: () => {},
    messages: [],
    clearMessages: () => {},
    addTextMessage: () => {},
    handleUserTalkingMessage: () => {},
    handleStreamingTalkingMessage: () => {},
    handleEndMessage: () => {},
    isListening: false,
    setIsListening: () => {},
    isUserTalking: false,
    setIsUserTalking: () => {},
    isAvatarTalking: false,
    setIsAvatarTalking: () => {},
    connectionQuality: ConnectionQuality.UNKNOWN,
    setConnectionQuality: () => {},
    isLLMProcessing: false,
    setIsLLMProcessing: () => {},
    currentLLMResponse: "",
    setCurrentLLMResponse: () => {},
    llmError: null,
    setLLMError: () => {},
    suppressAvatarEvents: false,
    setSuppressAvatarEvents: () => {},
    quotaInfo: {
      credits: 0,
      minutes: 0,
      activeSessions: 0,
      lastChecked: null,
    },
    setQuotaInfo: () => {},
  },
);

const useStreamingAvatarSessionState = () => {
  const [sessionState, setSessionState] = useState(
    StreamingAvatarSessionState.INACTIVE,
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  return {
    sessionState,
    setSessionState,
    stream,
    setStream,
    sessionId,
    setSessionId,
    sessionToken,
    setSessionToken,
  };
};

const useStreamingAvatarVoiceChatState = () => {
  const [isMuted, setIsMuted] = useState(true);
  const [isVoiceChatLoading, setIsVoiceChatLoading] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

  return {
    isMuted,
    setIsMuted,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
    isVoiceChatActive,
    setIsVoiceChatActive,
  };
};

const useStreamingAvatarMessageState = (suppressAvatarEvents: boolean) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const currentSenderRef = useRef<MessageSender | null>(null);

  const handleUserTalkingMessage = ({
    detail,
  }: {
    detail: UserTalkingMessageEvent;
  }) => {
    if (currentSenderRef.current === MessageSender.CLIENT) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...prev[prev.length - 1],
          content: [prev[prev.length - 1].content, detail.message].join(""),
          isComplete: false, // Still streaming
        },
      ]);
    } else {
      currentSenderRef.current = MessageSender.CLIENT;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: MessageSender.CLIENT,
          content: detail.message,
          isComplete: false, // Still streaming
        },
      ]);
    }
  };

  const handleStreamingTalkingMessage = ({
    detail,
  }: {
    detail: StreamingTalkingMessageEvent;
  }) => {
    // BUGFIX: Suppress avatar events during LLM streaming to prevent duplicates
    // When LLM is streaming, we manually add the complete message to history
    // and send progressive chunks to the avatar via the streaming task API
    if (suppressAvatarEvents) {
      console.log("[Context] AVATAR_TALKING_MESSAGE suppressed (LLM streaming active):", {
        messageChunk: detail.message.substring(0, 50) + "...",
        suppressAvatarEvents,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // DIAGNOSTIC LOGGING: Track avatar speech events and sender state
    console.log("[Context] AVATAR_TALKING_MESSAGE event:", {
      messageChunk: detail.message.substring(0, 50) + "...",
      currentSender: currentSenderRef.current,
      messageHistoryLength: messages.length,
      lastMessageSender:
        messages.length > 0 ? messages[messages.length - 1].sender : null,
      lastMessageContent:
        messages.length > 0
          ? messages[messages.length - 1].content.substring(0, 50) + "..."
          : null,
      willCreateNewMessage: currentSenderRef.current !== MessageSender.AVATAR,
      timestamp: new Date().toISOString(),
    });

    if (currentSenderRef.current === MessageSender.AVATAR) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...prev[prev.length - 1],
          content: [prev[prev.length - 1].content, detail.message].join(""),
          isComplete: false, // Still streaming
        },
      ]);
    } else {
      currentSenderRef.current = MessageSender.AVATAR;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: MessageSender.AVATAR,
          content: detail.message,
          isComplete: false, // Still streaming
        },
      ]);
    }
  };

  const handleEndMessage = () => {
    // Mark the last message as complete when the stream ends
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      return [
        ...prev.slice(0, -1),
        {
          ...prev[prev.length - 1],
          isComplete: true,
        },
      ];
    });
    currentSenderRef.current = null;
  };

  const addTextMessage = (sender: MessageSender, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender,
        content,
        isComplete: true, // Text messages are always complete
      },
    ]);
  };

  return {
    messages,
    clearMessages: () => {
      setMessages([]);
      currentSenderRef.current = null;
    },
    addTextMessage,
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
  };
};

const useStreamingAvatarListeningState = () => {
  const [isListening, setIsListening] = useState(false);

  return { isListening, setIsListening };
};

const useStreamingAvatarTalkingState = () => {
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);

  return {
    isUserTalking,
    setIsUserTalking,
    isAvatarTalking,
    setIsAvatarTalking,
  };
};

const useStreamingAvatarConnectionQualityState = () => {
  const [connectionQuality, setConnectionQuality] = useState(
    ConnectionQuality.UNKNOWN,
  );

  return { connectionQuality, setConnectionQuality };
};

const useStreamingAvatarLLMState = () => {
  const [isLLMProcessing, setIsLLMProcessing] = useState(false);
  const [currentLLMResponse, setCurrentLLMResponse] = useState("");
  const [llmError, setLLMError] = useState<string | null>(null);
  const [suppressAvatarEvents, setSuppressAvatarEvents] = useState(false);

  return {
    isLLMProcessing,
    setIsLLMProcessing,
    currentLLMResponse,
    setCurrentLLMResponse,
    llmError,
    setLLMError,
    suppressAvatarEvents,
    setSuppressAvatarEvents,
  };
};

const useStreamingAvatarQuotaState = () => {
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo>({
    credits: 0,
    minutes: 0,
    activeSessions: 0,
    lastChecked: null,
  });

  return {
    quotaInfo,
    setQuotaInfo,
  };
};

export const StreamingAvatarProvider = ({
  children,
  basePath,
}: {
  children: React.ReactNode;
  basePath?: string;
}) => {
  const avatarRef = React.useRef<StreamingAvatar>(null);
  const voiceChatState = useStreamingAvatarVoiceChatState();
  const sessionState = useStreamingAvatarSessionState();
  const llmState = useStreamingAvatarLLMState();
  const messageState = useStreamingAvatarMessageState(llmState.suppressAvatarEvents);
  const listeningState = useStreamingAvatarListeningState();
  const talkingState = useStreamingAvatarTalkingState();
  const connectionQualityState = useStreamingAvatarConnectionQualityState();
  const quotaState = useStreamingAvatarQuotaState();

  return (
    <StreamingAvatarContext.Provider
      value={{
        avatarRef,
        basePath,
        ...voiceChatState,
        ...sessionState,
        ...messageState,
        ...listeningState,
        ...talkingState,
        ...connectionQualityState,
        ...llmState,
        ...quotaState,
      }}
    >
      {children}
    </StreamingAvatarContext.Provider>
  );
};

export const useStreamingAvatarContext = () => {
  return React.useContext(StreamingAvatarContext);
};
