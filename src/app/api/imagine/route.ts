import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { modelLite, safeGenerateContent } from "@/lib/gemini";

const genaiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const VISUAL_PROMPT_TEMPLATE = `
You are a surrealist music video art director. 
Given a song lyric and its meaning, generate a single vivid, cinematic, slightly absurd image description.

The image should:
- LITERALLY visualize what the English "hearsay" lyric says, even if it's crazy or nonsensical
- Be specific about subjects, colors, lighting, camera angle, and mood
- Be 1-2 sentences max. No preamble, no explanations.

Examples:
- Hearsay: "Man on the moon eating cheese" → "A suited astronaut sitting cross-legged on a glowing moon, fork in hand, eating an enormous wheel of yellow cheese. Cinematic, warm golden light, wide shot."
- Hearsay: "Baby shark took my heart" → "A cartoonish great white shark wearing a bow tie and holding a glowing red heart in its fin, wide eyes, underwater disco lighting."

Hearsay lyric: "{hearsay}"
Original meaning: "{meaning}"

Respond with ONLY the image description, nothing else.
`;

export async function POST(req: Request) {
  try {
    const { hearsayText, meaning, chinese } = await req.json();

    if (!hearsayText) {
      return NextResponse.json({ error: "No lyric provided" }, { status: 400 });
    }

    // Step 1: Use Gemini text model to craft a vivid visual prompt
    const promptRequest = VISUAL_PROMPT_TEMPLATE
      .replace("{hearsay}", hearsayText)
      .replace("{meaning}", meaning || chinese || "");

    const promptResult = await safeGenerateContent(modelLite, promptRequest);
    const visualPrompt = promptResult.response.text().trim();

    console.log(`[imagine] Visual prompt for "${hearsayText}": ${visualPrompt}`);

    // Step 2: Generate image with Nano Banana 2 (gemini-3.1-flash-image-preview)
    const imageResponse = await genaiClient.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate a single vivid image: ${visualPrompt}. Cinematic 16:9 composition. No text in the image.`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    // Extract image from response
    const parts = imageResponse.candidates?.[0]?.content?.parts ?? [];
    let imageBase64: string | null = null;
    let mimeType = "image/png";

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageBase64) {
      console.error("[imagine] No image in response:", JSON.stringify(imageResponse, null, 2));
      return NextResponse.json({ error: "Image generation returned no image" }, { status: 500 });
    }

    return NextResponse.json({
      imageBase64,
      mimeType,
      visualPrompt, // Return so we can show it as a "director's note" in the UI
    });
  } catch (error) {
    console.error("[imagine] Error:", error);
    const message = error instanceof Error ? error.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
