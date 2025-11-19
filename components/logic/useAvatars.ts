import { useState, useEffect } from "react";
import {
  AvatarOption,
  HeyGenAvatar,
  getMedicalAvatarOptions,
} from "@/app/lib/avatar-filter";

interface AvatarsResponse {
  avatars: HeyGenAvatar[];
}

interface UseAvatarsReturn {
  avatars: AvatarOption[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * React hook for fetching and managing medical domain avatars
 * Fetches avatars from HeyGen API and filters for medical domain only
 */
export function useAvatars(): UseAvatarsReturn {
  const [avatars, setAvatars] = useState<AvatarOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAvatars = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/avatars");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch avatars");
      }

      const data: AvatarsResponse = await response.json();

      // Filter streaming avatars for medical domain only
      const medicalAvatars = getMedicalAvatarOptions(data.avatars);

      console.log("[useAvatars] Fetched streaming avatars:", {
        total: data.avatars.length,
        medical: medicalAvatars.length,
      });

      setAvatars(medicalAvatars);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      console.error("[useAvatars] Error fetching avatars:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvatars();
  }, []);

  return {
    avatars,
    loading,
    error,
    refetch: fetchAvatars,
  };
}
