import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { genAI, modelLite, DIRECTOR_PROMPT, safeGenerateContent } from "@/lib/gemini";
import { getLineLevelPinyin } from "@/lib/pinyin";
import { captureLastRun } from "@/lib/eval-capture";
import { getLangfuse } from "@/lib/langfuse";
import {
  type CachedVideoClip,
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

async function loadCachedAssetsFromCache(songId: string): Promise<CachedSongAssets | null> {
  try {
    const filePath = getCacheFilePath(songId);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CachedSongAssets;
    if (!Array.isArray(parsed?.directorLines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDirectorLinesToCache(songId: string, directorLines: DirectorLine[]): Promise<void> {
  const existingAssets = await loadCachedAssetsFromCache(songId);
  const existingVideoClips = Array.isArray(existingAssets?.videoClips)
    ? existingAssets?.videoClips
    : undefined;
  const existingSegmentOverrides =
    existingAssets?.segmentOverrides && typeof existingAssets.segmentOverrides === "object"
      ? existingAssets.segmentOverrides
      : undefined;

  const filePath = getCacheFilePath(songId);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    filePath,
    exportAssetsForCache(songId, directorLines, existingVideoClips, existingSegmentOverrides),
    "utf8"
  );
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

function streamCachedAssets(cachedAssets: CachedSongAssets): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const directorLines = cachedAssets.directorLines ?? [];
  const videoClips: CachedVideoClip[] = Array.isArray(cachedAssets.videoClips)
    ? cachedAssets.videoClips
    : [];
  const segmentOverrides =
    cachedAssets.segmentOverrides && typeof cachedAssets.segmentOverrides === "object"
      ? cachedAssets.segmentOverrides
      : undefined;

  return new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "meta",
              totalLines: directorLines.length,
            }) + "\n"
          )
        );

        if (videoClips.length > 0) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "video-clips",
                videoClips,
              }) + "\n"
            )
          );
        }

        if (segmentOverrides && Object.keys(segmentOverrides).length > 0) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "segment-overrides",
                segmentOverrides,
              }) + "\n"
            )
          );
        }

        for (const [lineIndex, line] of directorLines.entries()) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "line",
                payload: {
                  ...line,
                  lineIndex,
                },
              }) + "\n"
            )
          );
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
      const cachedAssets = await loadCachedAssetsFromCache(cacheableSongId);
      if (cachedAssets && cachedAssets.directorLines.length > 0) {
        console.log("[director] cache hit, calling captureLastRun with", cachedAssets.directorLines.length, "lines");
        captureLastRun(cachedAssets.directorLines);
        return new Response(streamCachedAssets(cachedAssets), {
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
    // Fetch versioned prompt from Langfuse; falls back to hardcoded if unreachable.
    const directorPromptClient = await getLangfuse().getPrompt("director-generation", undefined, {
      fallback: DIRECTOR_PROMPT,
      cacheTtlSeconds: 300,
    });
    const directorPromptText = directorPromptClient.prompt;
    const generatedLines: DirectorLine[] = [];
    const pendingImageLines: Array<{ line: DirectorLine; lineIndex: number }> = [];
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "meta",
                totalLines: allLines.length,
              }) + "\n"
            )
          );

          for (let chunkIndex = 0; chunkIndex < lineChunks.length; chunkIndex++) {
            const chunk = lineChunks[chunkIndex];
            const chunkStartIndex = chunkIndex * chunkSize;

            // Step 1: Generate hearsay + visual concepts
            const directorPrompt = `
${directorPromptText}

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

            // Stream all lines immediately so lyric rendering is not blocked by image latency.
            for (let i = 0; i < directorLines.length; i++) {
              const line = directorLines[i];
              const lineIndex = chunkStartIndex + i;
              generatedLines.push(line);
              pendingImageLines.push({ line, lineIndex });
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    type: "line",
                    payload: {
                      ...line,
                      lineIndex,
                    },
                  }) + "\n"
                )
              );
            }
          }

          // Capture text-only output for eval runs before images are attached.
          console.log("[director] live generation complete, calling captureLastRun with", generatedLines.length, "lines");
          captureLastRun(generatedLines);

          // Step 2: Generate images after line streaming so users can read all lyrics quickly.
          if (generateImages && pendingImageLines.length > 0) {
            const queue = [...pendingImageLines];
            const concurrency = Math.min(3, queue.length);

            const runWorker = async () => {
              while (queue.length > 0) {
                const current = queue.shift();
                if (!current) return;
                const { line, lineIndex } = current;

                try {
                  const imagePrompt = `Generate a single vivid image: ${line.visual}. 
Style: Surrealist music video aesthetic, ${line.mood} mood, ${line.palette.join(" and ")} color palette.
Cinematic 16:9, no text in image.`;

                  const imageResponse = await genAI.models.generateContent({
                    model: "gemini-3.1-flash-image-preview",
                    contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
                    config: { responseModalities: ["IMAGE", "TEXT"] },
                  });

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
                  console.error(`[director] Image generation failed for line ${lineIndex}:`, imgErr);
                  line.imageRateLimited = isRateLimitedImageError(imgErr);
                  line.imageError = getErrorMessage(imgErr);
                }

                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: "image-update",
                      payload: {
                        lineIndex,
                        chinese: line.chinese,
                        imageBase64: line.imageBase64,
                        imageMimeType: line.imageMimeType,
                        imageRateLimited: line.imageRateLimited,
                        imageError: line.imageError,
                      },
                    }) + "\n"
                  )
                );
              }
            }

            await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
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
