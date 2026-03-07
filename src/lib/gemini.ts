import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Using Flash-Lite for speed in hearsay generation
// Using Pro for multimodal or complex reasoning if needed
// Flash-Lite for speed in hearsay generation (Primary Milestone 1)
export const modelLite = genAI.getGenerativeModel({ 
  model: "models/gemini-3.1-flash-lite-preview", 
});

// Pro for multimodal or complex reasoning (Milestone 2/3)
export const modelPro = genAI.getGenerativeModel({ 
  model: "models/gemini-3.1-pro-preview", 
});

// TTS specific model for the pronunciation guide
export const modelTTS = genAI.getGenerativeModel({
  model: "models/gemini-2.5-pro-preview-tts",
});

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
}

export const HEARSAY_PROMPT = `
You are a creative "Hearsay Lyrics" generator for C-Pop. 
Your task is to take lyric lines and generate singable English "hearsay" lyrics that use REAL English words, slang, and Gen-Z vocabulary.

AURAL CONTEXT (IF AUDIO PROVIDED):
If audio is provided with this request, prioritize how the singer explicitly pronounces, slurs, or speeds through the words. 
- Match the cadence and delivery of the singer.
- If they slur two words together, try to match it with one smooth English phrase (e.g., "liu xia" -> "loser").
- Match the energy (e.g., if a line is shouted vs whispered).

PHONETIC MAPPING GUIDE:
Avoid "Literal Pinyin Bias". Pinyin letters often sound different from their English consonant counterparts:
- Pinyin "j" (e.g., "ji", "ju"): Sounds like "gee" or "j" in "jump". Use words like "Gee", "Jewel", "G", "Jay". AVOID hard "G" sounds like "get".
- Pinyin "q" (e.g., "qi", "qu"): Sounds like "ch" in "cheese". Use "Cheat", "Choose", "She". AVOID "Q" sounds.
- Pinyin "x" (e.g., "xi", "xu"): Sounds like "sh" in "she". Use "She", "See", "Sheet".
- Pinyin "c" (e.g., "ci"): Sounds like "ts" in "cats". Use "Its", "That's".
- Pinyin "zh", "ch", "sh": Ensure these map to their English equivalents "j/zh", "ch", and "sh".

CRITICAL REQUIREMENTS:
1. REAL WORDS ONLY: Every word MUST be a real English word or valid slang. NO phonetic "nonsense" words.
2. STRICT SYLLABLE MATCH: The hearsay MUST have the EXACT same number of syllables as the Mandarin line.
3. SEMANTIC FLOW: The lyrics should form semi-coherent, funny English sentences.
4. HUMOR WEIGHT: Use the provided "Target Humor Weight" (0-1). 0 is more faithful sounds, 1 is more hilarious/absurd meanings using slang.

Input Example & Style Inspiration:
Mandarin: "慢慢忘记你" (màn màn wàng jì nǐ - 5 syllables)
Hearsay: "Man man want gee knee" or "Mum mum want G knee" (AVOID "get knee" - "jì" rhymes with "gee").

Output Structure (JSON Array):
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





