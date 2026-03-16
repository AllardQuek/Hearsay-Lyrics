import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "gen-lang-client-0291259273";
const LOCATION = "us-central1";
const VEO_MODEL = "veo-3.1-fast-generate-001";
const POLL_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${VEO_MODEL}:fetchPredictOperation`;

async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!keyJson) throw new Error("GCP_SERVICE_ACCOUNT_JSON env var is not set");
  const auth = new GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain access token");
  return token;
}

export async function POST(req: Request) {
  try {
    const { operationName } = (await req.json()) as { operationName: string };

    if (!operationName) {
      return NextResponse.json({ error: "No operation name provided" }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    const pollRes = await fetch(POLL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ operationName }),
    });

    const data = await pollRes.json();
    if (!pollRes.ok) {
      console.error("[video/status] Poll error:", JSON.stringify(data));
      const message = data?.error?.message || "Status check failed";
      const isRateLimit = pollRes.status === 429 || /rate limit|quota|resource exhausted|429/i.test(String(message));
      return NextResponse.json({ error: message, isRateLimit }, { status: pollRes.status });
    }

    // Log full response shape so we can see the actual structure during development
    console.log("[video/status] Full response:", JSON.stringify(data).slice(0, 2000));

    if (!data.done) {
      return NextResponse.json({ done: false });
    }

    if (data.error) {
      const message = data.error?.message || "Video generation failed";
      const isRateLimit = /rate limit|quota|resource exhausted|429/i.test(String(message));
      return NextResponse.json({ done: true, error: message, isRateLimit });
    }

    // Vertex AI predictLongRunning uses `predictions` array in the response.
    // Older/alternative paths may use `videos`. Check both.
    type VideoEntry = { bytesBase64Encoded?: string; gcsUri?: string; mimeType?: string };
    const predictions: VideoEntry[] = data.response?.predictions ?? [];
    const videos: VideoEntry[] = data.response?.videos ?? [];
    const video: VideoEntry | undefined = predictions[0] ?? videos[0];

    if (!video) {
      console.error("[video/status] No video found. Response keys:", Object.keys(data.response ?? {}));
      return NextResponse.json({ done: true, error: "No video in response" });
    }

    if (video.bytesBase64Encoded) {
      return NextResponse.json({
        done: true,
        videoBase64: video.bytesBase64Encoded,
        mimeType: video.mimeType || "video/mp4",
      });
    }

    if (video.gcsUri) {
      return NextResponse.json({
        done: true,
        videoUri: video.gcsUri,
        mimeType: video.mimeType || "video/mp4",
      });
    }

    console.error("[video/status] Video entry has no bytes or URI:", JSON.stringify(video));
    return NextResponse.json({ done: true, error: "Video data unavailable" });
  } catch (error) {
    console.error("[video/status] Error polling operation:", error);
    const message = error instanceof Error ? error.message : "Status check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
