This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

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
