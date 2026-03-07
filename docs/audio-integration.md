# Audio Integration Strategy

This document outlines the planned approach for integrating audio understanding into the Hearsay Lyrics project to achieve "Ultra Mode" generation.

## Recommended Approach: Google AI SDK (AI Studio)

While Vertex AI offers enterprise-grade features, we will use the **Google AI SDK (`@google/generative-ai`)** for the following reasons:

1.  **Direct Multimodal Support**: Gemini 1.5 and 2.0 models (Pro, Flash, and Flash-Lite) natively support audio. The model "hears" the song directly, which is crucial for capturing the slurring and phonetic nuances needed for humorous hearsay lyrics.
2.  **Low Friction**: It uses the same API key and SDK already integrated into the project. No complex Google Cloud IAM or project setup is required.
3.  **Speed & Efficiency**: Gemini 2.0 Flash is optimized for fast, multimodal interactions, keeping the "Generation" part of the app responsive.

## Implementation Roadmap

### 1. API & SDK Infrastructure
- **Model Selection**: Standardize on `gemini-2.0-flash-exp` or `gemini-1.5-flash` for audio processing tasks.
- **File Handling**: Implement the Gemini File API to upload temporary audio files or pass base64 audio data for short clips.
- **YouTube Support**: Use a lightweight server-side utility to extract audio streams from YouTube URLs before passing them to Gemini.

### 2. Backend Logic (`src/app/api/generate/route.ts`)
- **Combined Context**: The generation prompt will be updated to include both the text lyrics (for structural reference) and the audio stream.
- **Audio-Specific Instructions**: Update `HEARSAY_PROMPT` to instruct the AI to "listen for slurs, mumbled consonants, and pitch-based phonetic shifts" in the provided audio.

### 3. Frontend UI Updates
- **Input Field**: Add a new section in `SongInput.tsx` for "Audio Context (Optional)".
- **YouTube/File Toggle**: Allow users to paste a URL or upload a small MP3/WAV file.
- **Visual Feedback**: Transition the UI to an "Ultra Mode" state when audio is provided, indicating deeper analysis.

### 4. Refinement Loop
- **Audio-Aided Refine**: When a user asks to "make it sound more like the singer," the refinement API will prioritize the audio context of that specific timestamp.

---

*Note: This plan is deferred until the core text-based engine is fully stabilized.*
