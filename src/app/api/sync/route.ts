import { modelPro, AUTO_SYNC_PROMPT, safeGenerateContent } from "@/lib/gemini";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { lyrics, audioData } = await req.json();

    if (!lyrics || !audioData) {
      return NextResponse.json({ error: "Missing lyrics or audio data" }, { status: 400 });
    }

    // Convert base64 audio to parts for Gemini
    const audioPart = {
      inlineData: {
        data: audioData,
        mimeType: "audio/mp3",
      },
    };

    const prompt = `${AUTO_SYNC_PROMPT}\n\nLyrics:\n${lyrics}`;

    const result = await safeGenerateContent(modelPro, [{ text: prompt }, audioPart]);
    const response = await result.response;
    const text = response.text();

    // Clean up JSON response if needed
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : text;
    const syncData = JSON.parse(jsonString);

    return NextResponse.json(syncData);
  } catch (error: any) {
    console.error("Sync API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
