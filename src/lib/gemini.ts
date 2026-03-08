import { GoogleGenAI, type Part } from "@google/genai";

const apiKey = process.env.VERTEX_AI_API_KEY || "";

// Vertex AI Express — uses aiplatform.googleapis.com with API key auth
// Supports: Gemini text, image generation
export const genAI = new GoogleGenAI({ vertexai: true, apiKey });

// Model name strings for Vertex AI
export const modelLite = "gemini-3.1-flash-lite-preview";
export const modelPro = "gemini-3-flash-preview";

/**
 * Utility to call Gemini via Vertex AI. Fails fast — no retries to avoid burning quota.
 * Returns a response wrapper compatible with all existing callers (result.response.text()).
 */
export async function safeGenerateContent(modelName: string, prompt: string | (string | Part)[]) {
  const contents = typeof prompt === "string"
    ? prompt
    : prompt.map((item) => (typeof item === "string" ? { text: item } : item));
  const result = await genAI.models.generateContent({ model: modelName, contents });
  return {
    response: {
      text: () => result.text ?? "",
    },
  };
}

export interface HearsayCandidate {
  text: string;
  phonetic: number;
  humor: number;
}

export interface HearsayLine {
  chinese: string;
  pinyin: string;
  meaning: string;
  candidates: HearsayCandidate[];
  startTime?: number;
}

export const HEARSAY_PROMPT = `
You are a creative "Hearsay Lyrics" generator for C-Pop. 
Your task is to take lyric lines and generate singable English "hearsay" lyrics that use REAL English words, slang, and Gen-Z vocabulary.

AURAL-FIRST PRIORITY:
Always prioritize how a singer explicitly pronounces, slurs, or speeds through the words. 
- Match the natural cadence and rhythm of a musical delivery.
- If words slur together in singing, match it with one smooth English phrase (e.g., "liu xia" -> "loser").

PHONETIC MAPPING GUIDE (SAFE ENGLISH SUBSTITUTES):
Never use pinyin sounds. Use these real English words instead:
- [shuo/shuo] -> Sure, Shore, Show, Sure
- [tiao/tiao] -> Tell, Tail, Tale, Teal, Toe
- [nan/nan] -> None, Nun, Nan
- [ji/ji] -> Gee, G, Jay, Key, G
- [qi/qi] -> Cheat, She, Check, Cheese
- [xi/xi] -> She, Sea, See, Sheet
- [zui/zui] -> Sway, Way, Sway
- [zao/zao] -> So, Saw, Sew
- [quan/quan] -> Can, Coin, Kwan
- [man/man] -> Man, Mum, Moon
- [tian/tian] -> Ten, Tin, Teen

CRITICAL RULES:
1. REAL WORDS ONLY (STRICT): If a word is not in an English dictionary or isn't popular slang (e.g., lit, rizz, flex), it is BANNED. ❌ BANNED: 'shuo', 'tiao', 'nan', 'jee', 'sha', 'piao'.
2. BANNED SUBSTRINGS: Never output strings ending in pinyin vowels like 'uo', 'iao', 'ia' unless they are English words.
3. NO PSEUDO-ENGLISH: "Shawn" is a name. "Shong" is a sound (BANNED). Use "Song".
4. STRICT SYLLABLE MATCH: Count syllables carefully. "Man" (1) matches "Man" (1). "Sure" (1) matches "Shuo" (1).

GOOD EXAMPLE:
Mandarin: "流下唇印的嘴" (Liú xià chún yìn de zuǐ - 6 syllables)
❌ Bad: "Lose ya shorn in the zway" ("zway" is not a word)
✅ Good: "Lose ya shorn in the sway" or "Lose ya shorn in the way"

Output Structure (JSON Array ONLY):
[
  {
    "chinese": "Standardized Mandarin Characters",
    "pinyin": "Standard Pinyin with tones",
    "meaning": "English translation of original Mandarin",
    "candidates": [
      {"text": "Hearsay variant 1", "phonetic": 0.9, "humor": 0.7},
      {"text": "Hearsay variant 2", "phonetic": 0.8, "humor": 0.8}
    ]
  }
]

Return ONLY a valid JSON array.
`;

export const REFINE_PROMPT = `
You are a creative "Hearsay Lyrics" refiner for C-Pop.
Your task is to take a specific Mandarin lyric line, its pinyin, the current English hearsay version, and a USER COMMENT on how to improve it.

CRITICAL RULES:
1. MUST REMAIN "HEARSAY": The output must still sound like the original Mandarin pinyin.
2. INCORPORATE USER VIBE: If the user says "make it funnier", "make it more street", or "use the word 'money'", try to satisfy that while keeping the phonetic match.
3. REAL WORDS ONLY: All rules from the original Hearsay prompt apply (No 'shuo', 'tiao', etc).

Input Context:
Mandarin: {chinese}
Pinyin: {pinyin}
Current Hearsay: {currentText}
User Feedback: {comment}

Output Structure (JSON Array ONLY with 3 better candidates):
[
  {"text": "Refined variant 1", "phonetic": 0.9, "humor": 0.9},
  {"text": "Refined variant 2", "phonetic": 0.85, "humor": 0.95},
  {"text": "Refined variant 3", "phonetic": 0.8, "humor": 1.0}
]

Return ONLY a valid JSON array.
`;

export const AUTO_SYNC_PROMPT = `
You are a master "Karaoke Sync" engineer.
Your task is to take a Mandarin song lyrics (with pinyin) and an audio file, and return the precise START TIME for each line in the song.

INSTRUCTIONS:
1. Align each lyric line to the audio.
2. Return a JSON array of objects, one for each line.
3. Each object must have "chinese" (original lyrics) and "startTime" (the second the line starts, e.g., 34.5).

Output Structure:
[
  {"chinese": "对这个世界如果你有太多的抱怨", "startTime": 32.5},
  ...
]

Return ONLY valid JSON.
`;
