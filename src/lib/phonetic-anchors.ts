/**
 * Phonetic Anchors: A specialized dictionary of Mandarin sounds (pinyin) 
 * and their high-quality English hearsay "anchors".
 * 
 * These serve as creative suggestions for the AI Editor to ensure 
 * 100% dictionary-compliant English without being repetitive.
 */

export const PHONETIC_ANCHORS = {
  // Common vowels and finals
  "uo": ["sure", "show", "shore", "sure", "show her", "go", "door"],
  "iao": ["tell", "tail", "tale", "toe", "teal", "pale", "power", "towel"],
  "ia": ["yeah", "ya", "yah", "ear", "air"],
  "ou": ["oh", "go", "know", "low", "show", "old"],
  "ei": ["may", "bay", "pay", "day", "gray", "ray"],
  "ai": ["eye", "I", "sigh", "high", "buy", "tie"],
  "an": ["none", "nun", "nan", "on", "can", "fan"],
  "ang": ["song", "long", "sung", "young", "tongue"],
  "ing": ["in", "ink", "wing", "sing", "thing"],
  "i": ["gee", "g", "she", "see", "key", "me", "tea"],
  
  // Specific common syllables
  "shuo": ["sure", "shore", "show", "show her"],
  "tiao": ["tell", "tail", "tile", "teal"],
  "nan": ["none", "nun", "nan", "known"],
  "ji": ["gee", "g", "jay", "key"],
  "qi": ["cheat", "she", "check", "cheese", "G"],
  "xi": ["she", "sea", "see", "sheet"],
  "zui": ["sway", "way", "joy", "jury"],
  "zao": ["so", "saw", "sew", "sewn"],
  "quan": ["can", "coin", "kwan", "corn"],
  "man": ["man", "mum", "moon", "morn"],
  "tian": ["ten", "tin", "teen", "teen"],
  "wo": ["war", "wall", "what", "walk"],
  "ni": ["knee", "need", "near", "neat"]
};

export const BANNED_PATTERNS = [
  "shuo", "tiao", "nan", "jee", "sha", "piao", "wha", "dang", "zway", "shet", "chee", "zao", "jui", "ing", "shuo"
];
