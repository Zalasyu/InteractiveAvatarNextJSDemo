import { NextResponse } from "next/server";
import { createLogger } from "@/app/lib/logger";

const logger = createLogger({ module: "avatars-api" });

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const BASE_API_URL = process.env.NEXT_PUBLIC_BASE_API_URL || "https://api.heygen.com";

/**
 * GET /api/avatars
 * Fetches available interactive streaming avatars from HeyGen API
 * Returns only streaming avatars for medical domain filtering
 */
export async function GET() {
  try {
    if (!HEYGEN_API_KEY) {
      logger.error("HEYGEN_API_KEY not configured");
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    logger.info("Fetching streaming avatars from HeyGen API");

    const response = await fetch(`${BASE_API_URL}/v1/streaming/avatar.list`, {
      method: "GET",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        "Failed to fetch streaming avatars from HeyGen"
      );
      return NextResponse.json(
        { error: `HeyGen API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Streaming avatar API returns: { code: 100, message: "Success", data: [...] }
    if (data.code !== 100) {
      logger.error(
        { code: data.code, message: data.message },
        "HeyGen API returned error code"
      );
      return NextResponse.json(
        { error: data.message || "Failed to fetch avatars" },
        { status: 400 }
      );
    }

    const avatars = data.data || [];

    logger.info(
      { avatarCount: avatars.length },
      "Successfully fetched streaming avatars from HeyGen"
    );

    return NextResponse.json({
      avatars: avatars,
    });
  } catch (error) {
    logger.error({ error }, "Unexpected error fetching avatars");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
