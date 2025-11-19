import React, { forwardRef } from "react";
import { ConnectionQuality } from "@heygen/streaming-avatar";

import { useConnectionQuality } from "../logic/useConnectionQuality";
import { useStreamingAvatarSession } from "../logic/useStreamingAvatarSession";
import { useQuotaMonitoring } from "../logic/useQuotaMonitoring";
import { StreamingAvatarSessionState } from "../logic";
import { CloseIcon } from "../Icons";
import { Button } from "../Button";

export const AvatarVideo = forwardRef<HTMLVideoElement>(({}, ref) => {
  const { sessionState, stopAvatar } = useStreamingAvatarSession();
  const { connectionQuality } = useConnectionQuality();
  const { quotaInfo, hasLowQuota } = useQuotaMonitoring();

  const isLoaded = sessionState === StreamingAvatarSessionState.CONNECTED;

  return (
    <>
      {connectionQuality !== ConnectionQuality.UNKNOWN && (
        <div className="absolute top-3 left-3 bg-black text-white rounded-lg px-3 py-2 text-sm">
          Connection Quality: {connectionQuality}
        </div>
      )}
      {quotaInfo.lastChecked && (
        <div
          className={`absolute top-14 left-3 rounded-lg px-3 py-2 text-sm ${
            hasLowQuota
              ? "bg-red-600 text-white"
              : "bg-black bg-opacity-70 text-white"
          }`}
        >
          <div className="font-semibold">
            {quotaInfo.credits} credits ({quotaInfo.minutes} min)
          </div>
          {quotaInfo.activeSessions > 0 && (
            <div className="text-xs mt-1 opacity-80">
              {quotaInfo.activeSessions} active session{quotaInfo.activeSessions > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
      {isLoaded && (
        <Button
          className="absolute top-3 right-3 !p-2 bg-zinc-700 bg-opacity-50 z-10"
          onClick={stopAvatar}
        >
          <CloseIcon />
        </Button>
      )}
      <video
        ref={ref}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      >
        <track kind="captions" />
      </video>
      {!isLoaded && (
        <div className="w-full h-full flex items-center justify-center absolute top-0 left-0">
          Loading...
        </div>
      )}
    </>
  );
});
AvatarVideo.displayName = "AvatarVideo";
