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
    .filter((line) => line.length > 0)
    .map((line) => ({
      chinese: line,
      pinyin: getPinyin(line),
    }));
}
