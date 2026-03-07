import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a list of hearsay lines for copying to the clipboard
 */
export function formatHearsayForClipboard(lines: { chinese: string; pinyin: string; meaning: string; candidates: { text: string }[] }[]): string {
  return lines
    .map((line) => {
      const bestCandidate = line.candidates[0].text;
      return `${line.chinese}\n${line.pinyin}\n"${bestCandidate}"\n(${line.meaning})\n`;
    })
    .join("\n");
}
