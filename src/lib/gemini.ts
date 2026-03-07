import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Using Flash-Lite for speed in hearsay generation
// Using Pro for multimodal or complex reasoning if needed
export const modelLite = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash-lite-preview-02-05", // Updated to latest lite
});

export const modelPro = genAI.getGenerativeModel({ 
  model: "gemini-1.5-pro", 
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
You are a creative "Hearsay Lyrics" generator. 
Your task is to take a Mandarin lyric line and generate singable English lyrics that phonetically approximate the sound and rhythm of the Mandarin words.

Rules:
1. MATCH THE RHYTHM: Use the same number of syllables as the original Mandarin line.
2. PHONETIC SIMILARITY: The English words should sound as close as possible to the Mandarin pronunciation (Pinyin).
3. CREATIVITY: Aim for "funny but plausible" mishearings.
4. RETURN JSON: Return a valid JSON object matching the requested structure.

Input Format:
{
  "chinese": "稻香",
  "pinyin": "dào xiāng"
}

Output Format:
{
  "chinese": "稻香",
  "pinyin": "dào xiāng",
  "meaning": "rice fragrance",
  "candidates": [
    {"text": "Dow song", "phonetic": 0.9, "humor": 0.7},
    {"text": "Toast young", "phonetic": 0.8, "humor": 0.8}
  ]
}

Provide 2 unique candidates per line.
`;
