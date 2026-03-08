import { NextResponse } from "next/server";
import { genAI, modelLite, safeGenerateContent } from "@/lib/gemini";
import { HearsayLine } from "@/lib/gemini";

const VIDEO_PROMPT_TEMPLATE = `
You are a surrealist music video director. Given a selection of English "hearsay" lyrics (phonetic mishearings of Mandarin pop songs), write a vivid, cinematic scene prompt for a short 8-second music video clip.

The clip should LITERALLY visualize what these lyrics say — lean into the absurdity, make it colorful and energetic. Think: anime aesthetics, dreamlike settings, playful characters.

Be specific about: visual style, characters, setting, camera movement, mood and lighting.
Write 2-3 sentences MAX. No preamble or explanations.

Lyrics to visualize:
{lyrics}

Respond with ONLY the scene description.
`.trim();

export async function POST(req: Request) {
  try {
    const { lines } = (await req.json()) as { lines: HearsayLine[] };

    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: "No lyrics provided" }, { status: 400 });
    }

    // Pick up to 5 lines with actual hearsay content
    const activeLines = lines.filter((l) => l.candidates?.length > 0).slice(0, 5);
    if (activeLines.length === 0) {
      return NextResponse.json({ error: "No valid lyric lines found" }, { status: 400 });
    }

    const lyricsText = activeLines
      .map((l) => `"${l.candidates[0].text}" (means: ${l.meaning || l.chinese})`)
      .join("\n");

    // Step 1: Generate a vivid visual scene prompt via Gemini text model
    const rawPrompt = VIDEO_PROMPT_TEMPLATE.replace("{lyrics}", lyricsText);
    const promptResult = await safeGenerateContent(modelLite, rawPrompt);
    const scenePrompt = promptResult.response.text().trim();

    console.log(`[video] Scene prompt: ${scenePrompt}`);

    // Step 2: Kick off Veo 3.1 video generation (async – returns operation immediately)
    const operation = await genAI.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: scenePrompt,
      config: {
        numberOfVideos: 1,
        durationSeconds: 8,
        aspectRatio: "16:9",
      },
    });

    if (!operation.name) {
      return NextResponse.json({ error: "Failed to start video generation" }, { status: 500 });
    }

    return NextResponse.json({
      operationName: operation.name,
      scenePrompt,
    });
  } catch (error) {
    console.error("[video] Error starting video generation:", error);
    const raw = error instanceof Error ? error.message : String(error);
    const is429 = (error instanceof Error && (error as Error & { status?: number }).status === 429) || raw.includes("429");
    const message = is429
      ? "Video generation quota exceeded — please wait a moment and try again."
      : raw.includes("not found") || raw.includes("404")
      ? "Video generation model is unavailable on your current API plan."
      : "Video generation failed";
    return NextResponse.json({ error: message }, { status: is429 ? 429 : 500 });
  }
}
