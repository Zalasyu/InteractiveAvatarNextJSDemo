const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function POST() {
  // PRIORITY 3 LOGGING: Token request started
  console.log("[get-access-token] Token request started:", {
    timestamp: new Date().toISOString(),
    hasApiKey: !!HEYGEN_API_KEY,
    apiKeyLength: HEYGEN_API_KEY?.length,
    apiKeyPrefix: HEYGEN_API_KEY?.substring(0, 10) + "...",
    baseApiUrl: process.env.NEXT_PUBLIC_BASE_API_URL,
  });

  try {
    if (!HEYGEN_API_KEY) {
      console.error("[get-access-token] API key missing");
      throw new Error("API key is missing from .env");
    }
    const baseApiUrl = process.env.NEXT_PUBLIC_BASE_API_URL;
    const endpoint = `${baseApiUrl}/v1/streaming.create_token`;

    console.log("[get-access-token] Calling HeyGen token endpoint:", {
      endpoint,
      method: "POST",
    });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
      },
    });

    console.log("[get-access-token] HeyGen response received:", {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
    });

    const data = await res.json();

    console.log("[get-access-token] Response data:", {
      hasData: !!data,
      hasDataField: !!data.data,
      hasToken: !!data.data?.token,
      tokenLength: data.data?.token?.length,
      tokenPrefix: data.data?.token?.substring(0, 20) + "...",
      fullResponse: JSON.stringify(data, null, 2),
    });

    if (!res.ok) {
      console.error("[get-access-token] Token creation failed:", {
        status: res.status,
        response: data,
      });
      throw new Error(`Token creation failed: ${JSON.stringify(data)}`);
    }

    return new Response(data.data.token, {
      status: 200,
    });
  } catch (error) {
    console.error("[get-access-token] Error retrieving access token:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    return new Response("Failed to retrieve access token", {
      status: 500,
    });
  }
}
