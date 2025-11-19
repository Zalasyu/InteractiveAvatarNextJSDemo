/**
 * Session Cleanup Beacon Endpoint
 *
 * Receives cleanup requests via navigator.sendBeacon when browser closes/refreshes
 * This is more reliable than beforeunload handlers for network requests
 *
 * Note: This is primarily for logging/monitoring. The actual session cleanup
 * still happens via stopAvatar() in the useUnmount hook as a fallback.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log("[session-cleanup] Beacon cleanup received:", {
      action: body.action,
      timestamp: new Date(body.timestamp).toISOString(),
      sessionState: body.sessionState,
    });

    // Log cleanup attempts for monitoring and debugging
    // This helps identify if sessions are being orphaned despite cleanup attempts

    // Future enhancement: Could call HeyGen API here to force-close sessions
    // For now, we rely on the client-side stopAvatar() call and HeyGen's
    // automatic session timeout (if disableIdleTimeout: false is set)

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[session-cleanup] Error processing beacon:", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // Still return 200 to avoid console errors in the browser
    return new Response("OK", { status: 200 });
  }
}
