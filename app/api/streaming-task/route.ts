import { createLogger } from "@/app/lib/logger";

const logger = createLogger({ module: "streaming-task-api" });
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function POST(request: Request) {
  logger.info({ hasApiKey: !!HEYGEN_API_KEY }, "Task request started");

  try {
    if (!HEYGEN_API_KEY) {
      logger.error("API key missing");
      throw new Error("API key is missing from .env");
    }

    const body = await request.json();
    const { session_id, text, task_type = "repeat", session_token } = body;

    if (!session_id || !text || !session_token) {
      logger.error({
        hasSessionId: !!session_id,
        hasText: !!text,
        hasSessionToken: !!session_token,
      }, "Missing required fields");
      throw new Error("Missing required fields: session_id, text, session_token");
    }

    const baseApiUrl = process.env.NEXT_PUBLIC_BASE_API_URL;
    const endpoint = `${baseApiUrl}/v1/streaming.task`;

    logger.info({
      endpoint,
      taskType: task_type,
      textLength: text.length,
      textPreview: text.substring(0, 50) + "...",
      sessionIdPreview: session_id.substring(0, 20) + "...",
    }, "Calling HeyGen task endpoint");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session_token}`,
      },
      body: JSON.stringify({
        session_id,
        text,
        task_type,
      }),
    });

    logger.info({
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
    }, "HeyGen response received");

    const data = await res.json();

    logger.debug({
      hasData: !!data,
      response: data,
    }, "Response data");

    if (!res.ok) {
      logger.error({
        status: res.status,
        response: data,
      }, "Task failed");
      throw new Error(`Task failed: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    logger.error({
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    }, "Error sending task");

    return new Response(
      JSON.stringify({
        error: "Failed to send task",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
