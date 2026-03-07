import { NextResponse } from "next/server";
import { modelLite, REFINE_PROMPT, safeGenerateContent } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { chinese, pinyin, currentText, comment } = await req.json();

    if (!chinese || !pinyin || !currentText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const filledPrompt = REFINE_PROMPT
      .replace("{chinese}", chinese)
      .replace("{pinyin}", pinyin)
      .replace("{currentText}", currentText)
      .replace("{comment}", comment || "Follow hearsay rules.");

    const result = await safeGenerateContent(modelLite, filledPrompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to generate refined lyrics");
    }

    const candidates = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
        chinese,
        pinyin,
        meaning: "", // We don't need to re-generate meaning
        candidates
    });
  } catch (error) {
    console.error("Refinement Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refine lyrics" },
      { status: 500 }
    );
  }
}
