import { pinyin } from "pinyin-pro";

/**
 * Converts Mandarin text to Pinyin with tones.
 * Uses pinyin-pro for reliability.
 */
export function getPinyin(text: string): string {
  return pinyin(text, { toneType: "symbol" });
}

/**
 * Splits text into lines and gets pinyin for each.
 */
export function getLineLevelPinyin(text: string): { chinese: string; pinyin: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      // Filter out empty lines
      if (line.length === 0) return false;
      
      // Filter out headers like [Verse 1]
      if (line.startsWith("[") && line.endsWith("]")) return false;
      
      // Filter out common metadata phrases
      const lowercaseLine = line.toLowerCase();
      if (lowercaseLine === "you might also like") return false;
      if (lowercaseLine.includes("(jay chou)") || lowercaseLine.includes("(confession balloon)")) return false;
      
      // Filter out strictly parenthetical metadata
      if (line.includes("(") && line.includes(")")) {
        const cleanLine = line.replace(/\(.*\)/, "").trim();
        if (cleanLine.length === 0) return false;
      }
      
      return true;
    })
    .map((line) => ({
      chinese: line,
      pinyin: getPinyin(line),
    }));
}
