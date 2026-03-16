import { NextResponse } from "next/server";
import { genAI, modelLite, modelImage, DIRECTOR_PROMPT, safeGenerateContent } from "@/lib/gemini";
import { getLineLevelPinyin } from "@/lib/pinyin";

export interface DirectorLine {
  chinese: string;
  pinyin: string;
  meaning: string;
  hearsay: string;
  visual: string;
  mood: string;
  palette: string[];
  imageBase64?: string;
  imageMimeType?: string;
  startTime?: number;
}

export async function POST(req: Request) {
  try {
    const { text, funnyWeight = 0.5, generateImages = true } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const allLines = getLineLevelPinyin(text);
    
    // Process in smaller chunks for reliability
    const chunkSize = 6;
    const lineChunks: (typeof allLines)[] = [];
    for (let i = 0; i < allLines.length; i += chunkSize) {
      lineChunks.push(allLines.slice(i, i + chunkSize));
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let chunkIndex = 0; chunkIndex < lineChunks.length; chunkIndex++) {
            const chunk = lineChunks[chunkIndex];

            // Step 1: Generate hearsay + visual concepts
            const directorPrompt = `
${DIRECTOR_PROMPT}

Humor/Fun Weight: ${funnyWeight} (0=faithful, 1=hilarious)

Process these lines:
${JSON.stringify(chunk)}

Return valid JSON array of director outputs.
`;
            const genResult = await safeGenerateContent(modelLite, directorPrompt);
            const responseText = genResult.response.text();

            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
              throw new Error(`Failed to parse director output for chunk ${chunkIndex}`);
            }

            const directorLines: DirectorLine[] = JSON.parse(jsonMatch[0]);

            // Step 2: Generate images for each line if requested
            if (generateImages) {
              for (let i = 0; i < directorLines.length; i++) {
                const line = directorLines[i];
                
                try {
                  // Use Gemini's native image generation with interleaved output
                  const imagePrompt = `Generate a single vivid image: ${line.visual}. 
Style: Surrealist music video aesthetic, ${line.mood} mood, ${line.palette.join(" and ")} color palette.
Cinematic 16:9, no text in image.`;

                  const imageResponse = await genAI.models.generateContent({
                    model: "gemini-3.1-flash-image-preview",
                    contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
                    config: { responseModalities: ["IMAGE", "TEXT"] },
                  });

                  // Extract image from response
                  const parts = imageResponse?.candidates?.[0]?.content?.parts ?? [];
                  for (const part of parts) {
                    if (part.thought) continue;
                    if (part.inlineData?.data) {
                      line.imageBase64 = part.inlineData.data;
                      line.imageMimeType = part.inlineData.mimeType || "image/png";
                      break;
                    }
                  }
                } catch (imgErr) {
                  console.error(`[director] Image generation failed for line ${i}:`, imgErr);
                  // Continue without image — don't block the whole flow
                }

                // Stream each line as it completes (for progressive UI)
                controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
              }
            } else {
              // Stream all lines without images
              for (const line of directorLines) {
                controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
              }
            }
          }
        } catch (error) {
          console.error("[director] Stream Error:", error);
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
    console.error("[director] Error:", error);
    const message = error instanceof Error ? error.message : "Director generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
