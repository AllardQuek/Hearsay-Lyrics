import { HearsayLine } from "./gemini";

export interface LRCLine {
  text: string;
  startTime: number;
}

/**
 * Parses a standard LRC file content into a list of startTime and lyrics.
 */
export function parseLRC(content: string): LRCLine[] {
  const lines = content.split(/\r?\n/);
  const result: LRCLine[] = [];
  
  // Regex to match [mm:ss.xx] or [mm:ss:xx] or [mm:ss]
  const timeRegex = /\[(\d{2}):(\d{2})(?:[.:](\d{2}))?\](.*)/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = match[3] ? parseInt(match[3]) : 0;
      const lyrics = match[4].trim();
      
      // LRC ms is usually centiseconds (1/100th of a second)
      const startTime = mins * 60 + secs + (ms / 100);
      
      if (lyrics) {
        result.push({ text: lyrics, startTime });
      }
    }
  }

  return result.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Formats parsed LRC lines into the expected HearsayLine structure for the demo flow.
 */
export function mapLRCToHearsayLines(lrcLines: LRCLine[]): Partial<HearsayLine>[] {
  return lrcLines.map(line => ({
    chinese: line.text,
    startTime: line.startTime,
    // Note: pinyin, meaning, and candidates will be filled by the AI generation flow
    // unless this is a pure "import" flow.
  }));
}
