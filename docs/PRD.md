# Hearsay Lyrics: Sing C‑Pop in English (Updated Product Brief + Hackathon PRD)

***

Refer to hackathon details here: https://cerebralvalley.ai/e/gemini-3-singapore-hackathon/details

## 1. Product Brief

**Product name**  
**Hearsay Lyrics**

**Tagline**  
"Sing your favourite Mandarin songs using English lyrics that sound just like Chinese."

**One‑liner**  
A Gemini-powered web app that generates singable English "misheard" lyrics for Mandarin songs, so non-Chinese speakers can join KTV sessions and enjoy C-pop more deeply.

**Target user**  
Alex, 28, Singapore office worker:  
- Loves Jay Chou/JJ Lin but can't follow lyrics or sing confidently at KTV.  
- Knows basic Mandarin from school, no pinyin fluency.  
- Wants to feel included when friends sing C-pop.

**Core problem**  
Non-Chinese speakers feel left out during Mandarin karaoke because lyrics are opaque; they hum along but can't participate fully or understand what's being sung.

**Solution**  
For popular Mandarin songs:  
- Generate English lines that approximate Chinese sounds and rhythm (稻香 → "Dow song").  
- Karaoke-style display: Chinese → misheard English → true meaning.  
- Personalisation: "funny vs faithful" slider + per-line variants.

**Hackathon demo (3 minutes)**  
1. Paste Mandarin lyrics from *any* song → "Generate" → misheard lyrics appear live. Proves any-song support.  
2. Switch to catalog song (Jay Chou 稻香) → Karaoke mode → real audio plays, English highlights in sync.  
3. Drag slider Faithful → Funny → see variants change per line.  
4. Copy lyrics to share.

**Why Gemini**  
- **Gemini 3.1 Flash-Lite**: Ultra-fast hearsay generation (low-latency logic).
- **Gemini 3.1 Pro**: High-quality multimodal audio timestamping (any-song sync).
- **Gemini 2.5 Pro TTS**: Seamless pronunciation previews for non-speakers.
- **Veo 3.1**: Generative karaoke background visuals based on lyric sentiment.
- **Lyria**: Experimental AI-generated singing guides for hearsay lyrics.

***

## 2. Competitive Landscape & Moat

### **What exists (and why we're different)**

| Existing tools | What they do | Why we're different |
|---|---|---|
| **Generic misheard generators** | English song → funny English parody | **Cross-language**: Mandarin → singable English |
| **Zhuyin translators** | Chinese → funny Zhuyin (Taiwan phonetics) | **Cross-language + karaoke sync**, not phonetic notation |
| **Lyric translators** | Chinese → literal English meaning | **Phonetic approximation + rhythm matching**, not semantic |
| **Language learning apps** | Teach Chinese first → enjoy music later | **Enjoy music first → learn Chinese as byproduct** |
| **ChatGPT prompts** | One-off funny rewrites | **Production karaoke UX + personalisation + variants** |

**Core moat**: **Cross-language phonetic karaoke**—no one packages mishearing as a deliberate sing-along bridge with real audio sync.

**What we're NOT**:
- ❌ English-to-English lyrics generator
- ❌ Literal translation app  
- ❌ Generic language flashcards
- ❌ Text-only gimmick (we sync to real audio)
- ❌ Open-ended chatbot tutor

***

## 3. Hackathon PRD (v0.1)

### 3.1 Goals & Milestones

**Must-haves (Text + Karaoke)**  
```
Song → misheard English lyrics → karaoke sync with original audio
```

**Milestones**:
1. **Text + Any Song**: Lyrics paste + personalization (M1)
2. **Karaoke**: YouTube sync + line highlighting (M2)
3. **Pronunciation Guide**: Gemini 2.5 Pro TTS "Listen" button per line (M2)
4. **Premium Bonus — The "Wow" Factor** (M3):
   - **Visuals**: Veo 3.1 generates a 5s background loop matching the song's vibe.
   - **Audio**: Lyria generates a hearsay "reference track" singing the English lyrics.
   - **Auto-sync**: Gemini 3.1 Pro identifies timestamps for any uploaded clip.

### 3.2 User Stories (prioritised)

1. **Paste any Mandarin lyrics → get English sing-along lyrics** (M1)
2. **Pick from catalog (Jay Chou, Teresa Teng) → instant results** (M1)
3. **Adjust "faithful vs funny" → see personalised version** (M1)
4. **"Try another version" per line** (M1)
5. **Copy lyrics to share** (M1)
6. **Karaoke view: catalog song plays, English lyrics highlight in sync** (M2)
7. **Upload any audio → auto-generate timestamps → full karaoke for any song** (M3-A)
8. **Sing misheard lyrics → Gemini Live pronunciation feedback** (M3-B)

### 3.3 Technical Architecture

```
Frontend (React/Next.js)
├── Song input — two modes:
│   ├── Catalog picker (Jay Chou 稻香, Teresa Teng 月亮代表我的心)
│   └── Paste any Mandarin lyrics (textarea)
├── Customisation ("Faithful ↔ Funny" slider)
├── Lyric cards + variant cycling
├── Karaoke player (audio + timestamp sync) — catalog songs
├── Progressive display (no audio) — pasted-only songs
├── (M3-A) Audio upload → auto-timestamp → any-song karaoke
├── (M3-B) Mic input → Gemini Live → pronunciation feedback
└── Copy-to-clipboard

Backend (Next.js Server Actions / FastAPI)
├── /songs → catalog metadata + YouTube IDs + LRC timestamps
├── /generate-hearsay → {lyrics[], funny_weight} → Gemini 3.1 Flash-Lite → per-line candidates + pinyin + scores
├── /generate-tts → {text} → Gemini 2.5 Pro TTS → audio stream (M2)
├── /generate-visuals → {meaning} → Veo 3.1 → background video loop (M3)
└── /generate-guide → {hearsay_lyrics} → Lyria → AI singing clip (M3)
```

### 3.4 Core Features

#### **Song Input** — Two Modes

**Mode 1 — Catalog** (demo-reliable, pre-loaded):
```
Jay Chou - 稻香 (Dao Xiang)
Teresa Teng - 月亮代表我的心
```
Per catalog song: Chinese lyrics, 30s audio clip, LRC timestamps (sourced from public LRC files).

**Mode 2 — Paste any Mandarin lyrics** (any-song differentiator):
- User pastes raw Chinese text from any lyrics site
- No audio required for M1/M2; optional audio upload in M3-A
- Pinyin derived by Gemini in the same generation call (no extra library)

#### **Hearsay Generation** (Gemini prompt)

Gemini handles phonetic refinement, while libraries like `pinyin-pro` (JS) provide a reliable baseline.

```
Input per line:
{
  "chinese": "稻香",
  "syllables": 2
}

Gemini (3.1 Flash-Lite) returns:
{
  "pinyin": "dào xiāng",
  "meaning": "rice fragrance",
  "candidates": [
    {"text": "Dow song", "phonetic": 0.9, "sense": 0.3, "humor": 0.7},
    {"text": "Toast young", "phonetic": 0.8, "sense": 0.2, "humor": 0.8}
  ],
  "recommended": 0
}
```

**Slider logic**: `recommended = argmax(0.5*phonetic + funny_weight*humor + 0.2*sense)`

#### **Karaoke UX**
- **Overlay Strategy**: Custom lyric component overlaid on **YouTube Iframe API** (catalog songs).
- **Sync Logic**: `lrc-kit` parses LRC files; syncs to `player.getCurrentTime()` with millisecond precision.

```
[▶️ Jay Chou - 稻香 (YouTube Embed)]

稻香        ← current line highlight
dào xiāng
"Dow song"  ← big bold English (tap ↺ for "Toast young")
(rice fragrance)
```

### 3.5 Demo Script (3 minutes — judging format)

```
[0:20] Hook: "Non-Chinese speakers can't sing C-pop at KTV — until now."
        Introduce Alex: Singapore office worker, loves Jay Chou, can't sing along.

[0:30] LIVE: Paste Mandarin lyrics from a song NOT in catalog → hit Generate
        → misheard lyrics appear line by line. "Works for any Mandarin song."

[0:45] Switch to catalog → Jay Chou 稻香 → Karaoke mode
        → 30s audio plays → English highlights sync in real time.

[0:20] Drag slider Faithful → Funny → variants change per line. Tap ↺ to swap.

[0:15] Copy to share. (Optional: sing into mic → Gemini Live feedback, if M3-B built)
```

### 3.6 Hackathon Judging Alignment [cerebralvalley](https://cerebralvalley.ai/e/gemini-3-singapore-hackathon/details)

| Criterion | Score | Why |
|---|---|---|
| **Live demo (45%)** | ⭐⭐⭐⭐⭐ | Any-song paste + karaoke sync + variant swap — all live |
| **Creativity (35%)** | ⭐⭐⭐⭐⭐ | Cross-language phonetic karaoke = genuinely new; not on banned list |
| **Impact (20%)** | ⭐⭐⭐⭐ | C-pop inclusion → millions of non-Chinese speakers globally |

**Anti-project safe**: Music enhancer, not education chatbot or image analyzer.

***

**Ready to build.** Core moat = **cross-language karaoke insight + polished demo**. No direct competition. Ship it.