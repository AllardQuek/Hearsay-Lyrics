import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { HearsayLine } from "@/lib/gemini";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "gen-lang-client-0291259273";
const LOCATION = "us-central1";
const VEO_MODEL = "veo-3.1-fast-generate-001";
const VEO_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${VEO_MODEL}:predictLongRunning`;

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
    const { lines } = (await req.json()) as { lines: HearsayLine[] };

    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: "No lyrics provided" }, { status: 400 });
    }

    // Pick the best 3 lines: prefer longer/weirder hearsay text for more vivid visuals
    const activeLines = lines
      .filter((l) => l.candidates?.length > 0)
      .sort((a, b) => (b.candidates[0].text?.length ?? 0) - (a.candidates[0].text?.length ?? 0))
      .slice(0, 3);
    if (activeLines.length === 0) {
      return NextResponse.json({ error: "No valid lyric lines found" }, { status: 400 });
    }

    // Use only the hearsay text — no original meanings, the video should visualize the mishearing
    const hearsayLines = activeLines.map((l) => l.candidates[0].text);

    // Build the Veo prompt directly from the literal hearsay words — no LLM reinterpretation.
    // Each line is treated as a literal scene element so the video stays true to the mishearing.
    const scenePrompt = [
      "Surrealist anime music video, 8 seconds, vivid neon colors, dreamlike setting.",
      "Literally visualize these English lyrics word-for-word:",
      hearsayLines.map((l) => `\"${l}\"`).join(" / "),
      "Cinematic 16:9, energetic camera movement, no text on screen.",
    ].join(" ");

    console.log(`[video] Scene prompt: ${scenePrompt}`);

    // Step 2: Kick off Veo video generation via Vertex AI REST API
    const accessToken = await getAccessToken();
    const veoRes = await fetch(VEO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        instances: [{ prompt: scenePrompt }],
        parameters: {
          sampleCount: 1,
          durationSeconds: 8,
          aspectRatio: "16:9",
          generateAudio: true,
        },
      }),
    });

    const veoData = await veoRes.json();
    if (!veoRes.ok) {
      console.error("[video] Veo API error:", JSON.stringify(veoData));
      const is429 = veoRes.status === 429;
      const message = is429
        ? "Video generation quota exceeded — please wait a moment and try again."
        : veoData?.error?.message || "Video generation failed";
      return NextResponse.json({ error: message, isRateLimit: is429 }, { status: veoRes.status });
    }

    const operationName = veoData.name;
    if (!operationName) {
      return NextResponse.json({ error: "Failed to start video generation" }, { status: 500 });
    }

    return NextResponse.json({
      operationName,
      scenePrompt,
    });
  } catch (error) {
    console.error("[video] Error starting video generation:", error);
    const message = error instanceof Error ? error.message : "Video generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
