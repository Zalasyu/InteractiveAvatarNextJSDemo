/**
 * Quota Check API Endpoint
 *
 * Fetches remaining HeyGen API quota and active streaming sessions
 * Used to prevent session creation when quota exhausted
 */

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function GET() {
  try {
    if (!HEYGEN_API_KEY) {
      throw new Error("HEYGEN_API_KEY is missing from environment variables");
    }

    const baseApiUrl = process.env.NEXT_PUBLIC_BASE_API_URL || "https://api.heygen.com";

    console.log("[quota-check] Fetching quota and session information...");

    // Fetch remaining quota from HeyGen
    const quotaRes = await fetch(`${baseApiUrl}/v2/user/remaining_quota`, {
      method: "GET",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
      },
    });

    if (!quotaRes.ok) {
      throw new Error(`Quota API request failed: ${quotaRes.status} ${quotaRes.statusText}`);
    }

    const quotaData = await quotaRes.json();

    // Fetch active streaming sessions
    const sessionsRes = await fetch(`${baseApiUrl}/v1/streaming.list`, {
      method: "GET",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
      },
    });

    const sessionsData = sessionsRes.ok ? await sessionsRes.json() : { data: { sessions: [] } };

    // Calculate useful metrics
    // HeyGen quota is in units where 60 units = 1 credit
    // 1 credit = 5 minutes of streaming time
    const remaining_quota = quotaData.data?.remaining_quota || 0;
    const credits = Math.floor(remaining_quota / 60);
    const minutes = credits * 5;
    const activeSessions = sessionsData.data?.sessions?.length || 0;

    console.log("[quota-check] Quota information:", {
      remaining_quota,
      credits,
      minutes,
      activeSessions,
    });

    return new Response(
      JSON.stringify({
        remaining_quota,
        credits,
        minutes,
        activeSessions,
        sessions: sessionsData.data?.sessions || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[quota-check] Error fetching quota:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({
        error: "Failed to check quota",
        details: error instanceof Error ? error.message : String(error),
        remaining_quota: 0,
        credits: 0,
        minutes: 0,
        activeSessions: 0,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
