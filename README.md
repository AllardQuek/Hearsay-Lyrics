# Hearsay Lyrics

**An AI-powered KTV companion that generates singable, phonetic English "misheard" lyrics for any Mandarin song.**

Hearsay Lyrics syncs English phonetic approximations to the original audio and generates immersive background visuals — enabling non-Chinese speakers to seamlessly join karaoke sessions and bridging cultural gaps through music and laughter.

---

## Features

- **Instant Phonetic Generation** — Paste in Mandarin lyrics and instantly get singable English approximations that match the sound and rhythm of the original, not just the meaning.
- **Faithful ↔ Hilarious Slider** — Drag a slider live to shift the AI's output anywhere from strict phonetic accuracy to full comedic "misheard" chaos.
- **AI Refine** — Pick any line, enter a prompt (e.g. "make this sound cooler"), and the AI rewrites it instantly.
- **Alternative Cycles** — Hit the ↺ button to cycle through alternative AI-generated options for any line.
- **Manual Editing** — Every line is directly editable in the UI. If you come up with something uniquely funny or poetic, just type it in. Nothing is locked in.
- **Experimental AI Audio Sync** — Skip the LRC file entirely. Upload a raw MP3 and Gemini listens to the audio and figures out timestamps on its own, so the English highlights track the original Chinese vocals in real-time.
- **AI Image Slideshow** — As soon as lyrics are generated, a background image slideshow is automatically created to match the emotional vibe of the song.
- **AI Video Backdrop** — Go further and generate a cohesive AI video backdrop that reacts to the emotional arc of the lyrics, turning any opaque Chinese track into a full immersive KTV experience anyone can join.

---

## Why Hearsay Lyrics?

While there are thousands of literal translation apps and language learning tools, Hearsay Lyrics tackles a completely novel problem: **cross-language phonetic approximation**. We aren't translating *meaning* (which you can't sing) — we're translating *sound and rhythm* into English, which has never been packaged as a deliberate, interactive sing-along bridge.

Beyond KTV, the core technology has applications for international fans of M-Pop, K-Pop, and J-Pop, and offers a fun, low-friction entry point for language learners to engage with foreign media without needing to read native scripts first.

---

## Getting Started

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🎙️ Audio Context (Ultra Mode) — WIP Roadmap

Currently, the "Add Audio Link" feature uses **Aural-First Prompt Engineering** to encourage Gemini to generate lyrics that match general singing cadences and common slurs in C-Pop.

### Current Implementation (M1)
- **Prompt Injection**: The system always includes an `AUDIO CONTEXT` instruction to the Gemini 3.1 Flash-Lite model.
- **Goal**: Forces the model to prioritize singability and phonetics over literal translation.

### Future Multimodal Integration (M2/M3)
To achieve true audio-informed generation, the following steps are planned:

1.  **Audio Extraction**: Integrate `yt-dlp` or a similar library to extract audio streams from YouTube URLs.
2.  **File Hosting**: Temporary storage (e.g., Google Cloud Storage or local `/tmp`) to hold the audio buffer.
3.  **Gemini Multimodal API**: Use the **Google AI File Manager API** to upload audio files.
4.  **Audio-to-Hearsay Pipeline**:
    *   Send the `fileUri` along with the lyrics to **Gemini 1.5 Pro**.
    *   Instruct the model to timestamp pauses, match vowel elongations, and identify specific singer slurs that differ from standard Pinyin.
5.  **Synchronization**: Automated LRC (Lyric) timestamping using Gemini's ability to "hear" when words begin and end.

### Potential APIs
- **Google Generative AI SDK**: For `model.generateContent([filePart, textPart])`.
- **YouTube Data API**: To fetch metadata (title, artist) automatically.
- **Punctuation & Rhythm Extraction**: Specialized audio analysis libraries (like `librosa` or `Essentia`) could assist in identifying beats per minute (BPM) to further refine syllable matching.
