import { NextResponse } from "next/server";
import { modelLite, HEARSAY_PROMPT, HearsayLine } from "@/lib/gemini";
import { getLineLevelPinyin } from "@/lib/pinyin";

export async function POST(req: Request) {
  try {
    const { text, funnyWeight = 0.5, audioUrl } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // In a real implementation with Gemini File API, we would download the audioUrl 
    // and upload it to Gemini here. For now, we'll signal the intent to the prompt.
    const isUltraMode = !!audioUrl;
    
    const lines = getLineLevelPinyin(text);
    
    // Process lines in chunks to stay within model limits and maintain speed
    // For a hackathon, we'll process up to 10 lines for the demo
    const linesToProcess = lines.slice(0, 10);
    
    // Construct a single prompt for multiple lines to save tokens/time
    // NOTE: We now ALWAYS include the Aural Context instruction to force the best generation quality.
    // The presence of a real audioUrl is a WIP feature to be implemented with Gemini File API.
    const prompt = `
${HEARSAY_PROMPT}

Target Humor Weight: ${funnyWeight} (0-1)
AUDIO CONTEXT ENABLED: Prioritize the singer's cadence and slurring as described in the Aural Context guidelines.

Process these lines:
${JSON.stringify(linesToProcess)}

Return valid JSON array of HearsayLine objects.
`;

    const result = await modelLite.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    // Extract JSON from response (handling potential markdown fences)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to find JSON array in Gemini response");
    }
    
    const hearsayLines = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ lines: hearsayLines });
  } catch (error) {
    console.error("Hearsay Generation Error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate hearsay";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
