import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { exportAssetsForCache, isCacheableSongId, type CachedVideoClip } from "@/lib/cache";
import type { DirectorLine } from "@/app/api/director/route";

const CACHE_DIR = path.join(process.cwd(), "public", "cache");

function isDirectorLine(value: unknown): value is DirectorLine {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { chinese?: unknown; hearsay?: unknown };
  return typeof candidate.chinese === "string" && typeof candidate.hearsay === "string";
}

export async function POST(req: Request) {
  try {
    const { songId, directorLines, videoClips } = await req.json();

    if (!isCacheableSongId(songId)) {
      return NextResponse.json(
        { error: "Caching is only enabled for demo songs right now." },
        { status: 400 }
      );
    }

    if (!Array.isArray(directorLines)) {
      return NextResponse.json({ error: "directorLines must be an array" }, { status: 400 });
    }

    const normalizedLines = directorLines.filter(isDirectorLine);
    if (normalizedLines.length === 0) {
      return NextResponse.json({ error: "No valid director lines provided" }, { status: 400 });
    }

    const normalizedVideoClips: CachedVideoClip[] = Array.isArray(videoClips)
      ? videoClips
          .filter((clip): clip is CachedVideoClip => Boolean(clip && typeof clip === "object"))
          .filter((clip) => Boolean(clip.videoBase64 || clip.videoUri))
          .map((clip) => ({
            verseIndex: typeof clip.verseIndex === "number" ? clip.verseIndex : undefined,
            segmentId: typeof clip.segmentId === "string" ? clip.segmentId : undefined,
            clipStart: typeof clip.clipStart === "number" ? clip.clipStart : undefined,
            clipEnd: typeof clip.clipEnd === "number" ? clip.clipEnd : undefined,
            mimeType: typeof clip.mimeType === "string" ? clip.mimeType : "video/mp4",
            videoBase64: typeof clip.videoBase64 === "string" ? clip.videoBase64 : undefined,
            videoUri: typeof clip.videoUri === "string" ? clip.videoUri : undefined,
          }))
      : [];

    const filePath = path.join(CACHE_DIR, `${songId}.json`);
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(
      filePath,
      exportAssetsForCache(songId, normalizedLines, normalizedVideoClips),
      "utf8"
    );

    return NextResponse.json({
      ok: true,
      songId,
      lineCount: normalizedLines.length,
      videoClipCount: normalizedVideoClips.length,
    });
  } catch (error) {
    console.error("[cache] Failed to save cache:", error);
    return NextResponse.json({ error: "Failed to write cache file" }, { status: 500 });
  }
}
