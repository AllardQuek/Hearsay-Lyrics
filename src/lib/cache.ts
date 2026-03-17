import type { DirectorLine } from "@/app/api/director/route";

export interface CachedVideoClip {
  // Legacy shape
  verseIndex?: number;

  // Segment-aware shape
  segmentId?: string;
  clipStart?: number;
  clipEnd?: number;

  mimeType: string;
  videoBase64?: string;
  videoUri?: string;
}

const CACHEABLE_SONG_IDS = ["love-confession"] as const;

export type CacheableSongId = (typeof CACHEABLE_SONG_IDS)[number];
export type CacheMode = "prefer-cache" | "bypass-cache" | "refresh-cache";

export function isCacheableSongId(songId: unknown): songId is CacheableSongId {
  return typeof songId === "string" && (CACHEABLE_SONG_IDS as readonly string[]).includes(songId);
}

export function isCacheMode(value: unknown): value is CacheMode {
  return value === "prefer-cache" || value === "bypass-cache" || value === "refresh-cache";
}

export interface CachedSongAssets {
  songId: string;
  directorLines: DirectorLine[];
  videoClips?: CachedVideoClip[];
  generatedAt: string;
}

/**
 * Load pre-cached assets for a song from public/cache/
 * Returns null if no cache exists or fails to load
 */
export async function loadCachedAssets(songId: string): Promise<CachedSongAssets | null> {
  try {
    const response = await fetch(`/cache/${songId}.json`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return data as CachedSongAssets;
  } catch {
    console.log(`[cache] No cached assets for ${songId}`);
    return null;
  }
}

/**
 * Check if cached assets exist for a song
 */
export async function hasCachedAssets(songId: string): Promise<boolean> {
  try {
    const response = await fetch(`/cache/${songId}.json`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Serialize current director lines and video clips to a format suitable for caching
 * Use this during development to generate cache files
 */
export function exportAssetsForCache(
  songId: string,
  directorLines: DirectorLine[],
  videoClips?: CachedVideoClip[]
): string {
  const cacheData: CachedSongAssets = {
    songId,
    directorLines,
    videoClips,
    generatedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(cacheData, null, 2);
}
