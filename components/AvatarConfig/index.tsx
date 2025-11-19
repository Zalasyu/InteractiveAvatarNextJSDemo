import React, { useMemo, useState } from "react";
import {
  AvatarQuality,
  ElevenLabsModel,
  STTProvider,
  VoiceEmotion,
  StartAvatarRequest,
  VoiceChatTransport,
} from "@heygen/streaming-avatar";

import { Input } from "../Input";
import { Select } from "../Select";

import { Field } from "./Field";

import { STT_LANGUAGE_LIST } from "@/app/lib/constants";
import { AvatarOption } from "@/app/lib/avatar-filter";

interface AvatarConfigProps {
  onConfigChange: (config: StartAvatarRequest) => void;
  config: StartAvatarRequest;
  avatars?: AvatarOption[];
  avatarsLoading?: boolean;
  avatarsError?: string | null;
}

export const AvatarConfig: React.FC<AvatarConfigProps> = ({
  onConfigChange,
  config,
  avatars = [],
  avatarsLoading = false,
  avatarsError = null,
}) => {
  const onChange = <T extends keyof StartAvatarRequest>(
    key: T,
    value: StartAvatarRequest[T],
  ) => {
    // PRIORITY 4 LOGGING: Config changes from UI
    console.log("[AvatarConfig] onChange called:", {
      key,
      value,
      valueType: typeof value,
      isUndefined: value === undefined,
      currentConfig: JSON.stringify(config, null, 2),
    });

    const newConfig = { ...config, [key]: value };

    console.log("[AvatarConfig] New config after change:", {
      newConfig: JSON.stringify(newConfig, null, 2),
      changedKey: key,
      oldValue: config[key],
      newValue: value,
      hasKnowledgeId: "knowledgeId" in newConfig,
      hasKnowledgeBase: "knowledgeBase" in newConfig,
    });

    onConfigChange(newConfig);
  };
  const [showMore, setShowMore] = useState<boolean>(false);

  const selectedAvatar = useMemo(() => {
    const avatar = avatars.find(
      (avatar) => avatar.avatar_id === config.avatarName,
    );

    if (!avatar) {
      return {
        isCustom: true,
        name: "Custom Avatar ID",
        avatarId: null,
      };
    } else {
      return {
        isCustom: false,
        name: avatar.avatar_name,
        avatarId: avatar.avatar_id,
      };
    }
  }, [config.avatarName, avatars]);

  return (
    <div className="relative flex flex-col gap-4 w-[550px] py-8 max-h-full overflow-y-auto px-4">
      {/* BUGFIX: Removed Custom Knowledge Base ID field to prevent knowledgeId: undefined from being added to config */}
      <Field label="Avatar ID">
        {avatarsLoading ? (
          <div className="text-zinc-400 text-sm">Loading medical avatars...</div>
        ) : avatarsError ? (
          <div className="text-red-400 text-sm">Error loading avatars: {avatarsError}</div>
        ) : (
          <Select
            isSelected={(option) =>
              typeof option === "string"
                ? !!selectedAvatar?.isCustom
                : option.avatar_id === selectedAvatar?.avatarId
            }
            options={[...avatars, "CUSTOM"]}
            placeholder="Select Avatar"
            renderOption={(option) => {
              return typeof option === "string"
                ? "Custom Avatar ID"
                : option.avatar_name;
            }}
            value={
              selectedAvatar?.isCustom ? "Custom Avatar ID" : selectedAvatar?.name
            }
            onSelect={(option) => {
              if (typeof option === "string") {
                onChange("avatarName", "");
              } else {
                onChange("avatarName", option.avatar_id);
              }
            }}
          />
        )}
      </Field>
      {selectedAvatar?.isCustom && (
        <Field label="Custom Avatar ID">
          <Input
            placeholder="Enter custom avatar ID"
            value={config.avatarName}
            onChange={(value) => onChange("avatarName", value)}
          />
        </Field>
      )}
      <Field label="Language">
        <Select
          isSelected={(option) => option.value === config.language}
          options={STT_LANGUAGE_LIST}
          renderOption={(option) => option.label}
          value={
            STT_LANGUAGE_LIST.find((option) => option.value === config.language)
              ?.label
          }
          onSelect={(option) => onChange("language", option.value)}
        />
      </Field>
      <Field label="Avatar Quality">
        <Select
          isSelected={(option) => option === config.quality}
          options={Object.values(AvatarQuality)}
          renderOption={(option) => option}
          value={config.quality}
          onSelect={(option) => onChange("quality", option)}
        />
      </Field>
      <Field label="Voice Chat Transport">
        <Select
          isSelected={(option) => option === config.voiceChatTransport}
          options={Object.values(VoiceChatTransport)}
          renderOption={(option) => option}
          value={config.voiceChatTransport}
          onSelect={(option) => onChange("voiceChatTransport", option)}
        />
      </Field>
      {showMore && (
        <>
          <h1 className="text-zinc-100 w-full text-center mt-5">
            Voice Settings
          </h1>
          <Field label="Custom Voice ID">
            <Input
              placeholder="Enter custom voice ID"
              value={config.voice?.voiceId}
              onChange={(value) =>
                onChange("voice", { ...config.voice, voiceId: value })
              }
            />
          </Field>
          <Field label="Emotion">
            <Select
              isSelected={(option) => option === config.voice?.emotion}
              options={Object.values(VoiceEmotion)}
              renderOption={(option) => option}
              value={config.voice?.emotion}
              onSelect={(option) =>
                onChange("voice", { ...config.voice, emotion: option })
              }
            />
          </Field>
          <Field label="ElevenLabs Model">
            <Select
              isSelected={(option) => option === config.voice?.model}
              options={Object.values(ElevenLabsModel)}
              renderOption={(option) => option}
              value={config.voice?.model}
              onSelect={(option) =>
                onChange("voice", { ...config.voice, model: option })
              }
            />
          </Field>
          <h1 className="text-zinc-100 w-full text-center mt-5">
            STT Settings
          </h1>
          <Field label="Provider">
            <Select
              isSelected={(option) => option === config.sttSettings?.provider}
              options={Object.values(STTProvider)}
              renderOption={(option) => option}
              value={config.sttSettings?.provider}
              onSelect={(option) =>
                onChange("sttSettings", {
                  ...config.sttSettings,
                  provider: option,
                })
              }
            />
          </Field>
        </>
      )}
      <button
        className="text-zinc-400 text-sm cursor-pointer w-full text-center bg-transparent"
        onClick={() => setShowMore(!showMore)}
      >
        {showMore ? "Show less" : "Show more..."}
      </button>
    </div>
  );
};
