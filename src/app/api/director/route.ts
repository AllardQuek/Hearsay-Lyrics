import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { genAI, modelLite, DIRECTOR_PROMPT, safeGenerateContent } from "@/lib/gemini";
import { getLineLevelPinyin } from "@/lib/pinyin";
import {
  exportAssetsForCache,
  isCacheableSongId,
  isCacheMode,
  type CacheMode,
  type CachedSongAssets,
} from "@/lib/cache";

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
  imageRateLimited?: boolean;
  imageError?: string;
  startTime?: number;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function isRateLimitedImageError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && status === 429) return true;
  }

  const message = getErrorMessage(error);
  return /429|rate limit|resource exhausted|quota/i.test(message);
}

const CACHE_DIR = path.join(process.cwd(), "public", "cache");

function getCacheFilePath(songId: string): string {
  return path.join(CACHE_DIR, `${songId}.json`);
}

async function loadDirectorLinesFromCache(songId: string): Promise<DirectorLine[] | null> {
  try {
    const filePath = getCacheFilePath(songId);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CachedSongAssets;
    if (!Array.isArray(parsed?.directorLines)) return null;
    return parsed.directorLines;
  } catch {
    return null;
  }
}

async function writeDirectorLinesToCache(songId: string, directorLines: DirectorLine[]): Promise<void> {
  const filePath = getCacheFilePath(songId);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filePath, exportAssetsForCache(songId, directorLines), "utf8");
}

function streamDirectorLines(directorLines: DirectorLine[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      try {
        for (const line of directorLines) {
          controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        }
      } finally {
        controller.close();
      }
    },
  });
}

function normalizeCacheMode(value: unknown): CacheMode {
  return isCacheMode(value) ? value : "prefer-cache";
}

export async function POST(req: Request) {
  try {
    const { text, funnyWeight = 0.5, generateImages = true, songId, cacheMode } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const cacheableSongId = isCacheableSongId(songId) ? songId : undefined;
    const requestedCacheMode = normalizeCacheMode(cacheMode);
    const effectiveCacheMode: CacheMode = cacheableSongId ? requestedCacheMode : "bypass-cache";

    if (cacheableSongId && effectiveCacheMode === "prefer-cache") {
      const cachedLines = await loadDirectorLinesFromCache(cacheableSongId);
      if (cachedLines && cachedLines.length > 0) {
        return new Response(streamDirectorLines(cachedLines), {
          headers: {
            "Content-Type": "application/x-ndjson",
            "X-Hearsay-Cache": "hit",
          },
        });
      }
    }

    const allLines = getLineLevelPinyin(text);
    
    // Process in smaller chunks for reliability
    const chunkSize = 6;
    const lineChunks: (typeof allLines)[] = [];
    for (let i = 0; i < allLines.length; i += chunkSize) {
      lineChunks.push(allLines.slice(i, i + chunkSize));
    }

    const encoder = new TextEncoder();
    const generatedLines: DirectorLine[] = [];
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
                  line.imageRateLimited = isRateLimitedImageError(imgErr);
                  line.imageError = getErrorMessage(imgErr);
                  // Continue without image — don't block the whole flow
                }

                // Stream each line as it completes (for progressive UI)
                generatedLines.push(line);
                controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
              }
            } else {
              // Stream all lines without images
              for (const line of directorLines) {
                generatedLines.push(line);
                controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
              }
            }
          }

          if (
            cacheableSongId &&
            generatedLines.length > 0 &&
            (effectiveCacheMode === "prefer-cache" || effectiveCacheMode === "refresh-cache")
          ) {
            try {
              await writeDirectorLinesToCache(cacheableSongId, generatedLines);
            } catch (cacheErr) {
              console.error(`[director] Failed to write cache for ${cacheableSongId}:`, cacheErr);
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
      headers: {
        "Content-Type": "application/x-ndjson",
        "X-Hearsay-Cache":
          effectiveCacheMode === "refresh-cache"
            ? "refreshed"
            : effectiveCacheMode === "prefer-cache"
              ? "miss"
              : "bypassed",
      },
    });
  } catch (error) {
    console.error("[director] Error:", error);
    const message = error instanceof Error ? error.message : "Director generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
