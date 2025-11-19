/**
 * Avatar Filtering Utility
 * Filters streaming avatars to show only medical domain avatars based on keywords
 */

/**
 * HeyGen Streaming Avatar schema from /v1/streaming/avatar.list API
 */
export interface HeyGenAvatar {
  avatar_id: string;
  pose_name: string;
  default_voice: string;
  is_public: boolean;
  normal_preview: string;
  status: string;
  created_at: number;
}

/**
 * Internal avatar option format for UI components
 */
export interface AvatarOption {
  avatar_id: string;
  avatar_name: string;
  default_voice?: string;
  preview_image_url?: string;
}

/**
 * Medical domain keywords for filtering avatars
 * Includes various healthcare-related terms
 */
const MEDICAL_KEYWORDS = [
  "doctor",
  "nurse",
  "medical",
  "healthcare",
  "therapist",
  "physician",
  "clinic",
  "hospital",
  "health",
  "care",
  "surgeon",
  "dentist",
  "pharmacist",
  "counselor",
  "psychologist",
  "psychiatrist",
  "clinical",
  "med",
  "wellness",
  "fitness",
];

/**
 * Filter avatars to show only medical domain avatars
 * Checks pose_name field for medical keywords
 */
export function filterMedicalAvatars(avatars: HeyGenAvatar[]): HeyGenAvatar[] {
  return avatars.filter((avatar) => {
    // Defensive check: skip if pose_name is missing
    if (!avatar.pose_name) {
      console.warn("[avatar-filter] Skipping avatar with missing pose_name:", avatar.avatar_id);
      return false;
    }

    const nameMatch = MEDICAL_KEYWORDS.some((keyword) =>
      avatar.pose_name.toLowerCase().includes(keyword)
    );

    return nameMatch;
  });
}

/**
 * Convert HeyGen streaming avatar format to internal AvatarOption format
 * Maps HeyGen API response fields to application's avatar configuration
 */
export function convertToAvatarOption(avatar: HeyGenAvatar): AvatarOption {
  return {
    avatar_id: avatar.avatar_id,
    avatar_name: avatar.pose_name, // Map pose_name → avatar_name for UI
    default_voice: avatar.default_voice, // Map default_voice directly
    preview_image_url: avatar.normal_preview, // Map normal_preview → preview_image_url
  };
}

/**
 * Get medical avatars and convert to AvatarOption format
 * Combines filtering and conversion in one step
 */
export function getMedicalAvatarOptions(
  avatars: HeyGenAvatar[]
): AvatarOption[] {
  const medicalAvatars = filterMedicalAvatars(avatars);
  return medicalAvatars.map(convertToAvatarOption);
}
