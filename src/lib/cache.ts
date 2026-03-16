import { DirectorLine } from "@/app/api/director/route";

export interface CachedSongAssets {
  songId: string;
  directorLines: DirectorLine[];
  videoClips?: {
    verseIndex: number;
    videoBase64: string;
    mimeType: string;
  }[];
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
  } catch (error) {
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
  videoClips?: { verseIndex: number; videoBase64: string; mimeType: string }[]
): string {
  const cacheData: CachedSongAssets = {
    songId,
    directorLines,
    videoClips,
    generatedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(cacheData, null, 2);
}
