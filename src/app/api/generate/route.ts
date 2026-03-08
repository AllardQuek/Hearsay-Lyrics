import { NextResponse } from "next/server";
import { modelLite, HEARSAY_PROMPT, HearsayLine, safeGenerateContent } from "@/lib/gemini";
import { getLineLevelPinyin } from "@/lib/pinyin";
import { PHONETIC_ANCHORS, BANNED_PATTERNS } from "@/lib/phonetic-anchors";

export async function POST(req: Request) {
  try {
    const { text, funnyWeight = 0.5, audioUrl } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // In a real implementation with Gemini File API, we would download the audioUrl 
    // and upload it to Gemini here. For now, we'll signal the intent to the prompt.
    const isUltraMode = !!audioUrl;
    
    const allLines = getLineLevelPinyin(text);
    const chunkSize = 10;
    const lineChunks: (typeof allLines)[] = [];
    for (let i = 0; i < allLines.length; i += chunkSize) {
      lineChunks.push(allLines.slice(i, i + chunkSize));
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Process chunks SEQUENTIALLY to stay within 15 RPM limit.
          // Each chunk makes 2 serial calls (generate + review), so peak concurrent Gemini
          // calls is always 1 — well within the rate limit.
          for (let index = 0; index < lineChunks.length; index++) {
            const chunk = lineChunks[index];

            // Step 1: Creative Generation
            const generationPrompt = `
${HEARSAY_PROMPT}

Target Humor Weight: ${funnyWeight} (0-1)
Process these specific lines:
${JSON.stringify(chunk)}

Return valid JSON array of HearsayLine objects.
`;
            const genResult = await safeGenerateContent(modelLite, generationPrompt);
            const initialHearsay = genResult.response.text();

            // Step 2: Strict Dictionary Review (The "Editor" Step)
            const reviewPrompt = `
You are a Strict English Dictionary Editor. 
Review the following "Hearsay Lyrics" JSON. 

CRITICAL MISSION: 
Replace any "text" that contains non-English words, pseudo-English sounds, or pinyin.

PHONETIC ANCHOR GUIDE (USE AS SUGGESTIONS):
When you encounter these pinyin-style sounds, use these REAL English words as your primary inspiration:
${Object.entries(PHONETIC_ANCHORS).map(([pinyin, english]) => `- [${pinyin}] -> ${english.join(", ")}`).join("\n")}

BANNED PINYIN/PHONETIC SNIPPETS:
${BANNED_PATTERNS.join(", ")}

STRICT RULES:
1. NO PINYIN/SNIPPETS: "shuo" is NOT English. "Sure" IS English.
2. CREATIVE LIBERTY: You are NOT restricted to the anchors above, but any word you choose MUST be a real dictionary word or common slang.
3. RELIABILITY: Aim for 100% dictionary compliance in the final JSON.

INPUT JSON:
${initialHearsay}

Return the FIXED JSON array only.
`;
            const reviewResult = await safeGenerateContent(modelLite, reviewPrompt);
            const responseText = reviewResult.response.text();

            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
              throw new Error(`Failed to find JSON for chunk ${index}`);
            }
            const hearsayLines = JSON.parse(jsonMatch[0]);

            // Stream each chunk to the client as soon as it's ready
            controller.enqueue(encoder.encode(JSON.stringify(hearsayLines) + "\n"));
          }
        } catch (error) {
          console.error("Stream Error:", error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  } catch (error) {
    console.error("Hearsay Generation Error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate hearsay";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
