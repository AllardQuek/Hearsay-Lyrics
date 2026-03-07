# Plan: Hearsay Lyrics — Hackathon Build

## TL;DR
A Gemini-powered web app that generates singable English "misheard" lyrics for any Mandarin song. Core: paste Mandarin lyrics → Gemini returns phonetic English candidates → karaoke display. Primary input is lyrics paste (any song); pre-built catalog (2 songs) is a shortcut for demo reliability. M3 bonus: Gemini Live coach + auto-timestamp via Gemini audio multimodal.

---

## Milestone 1 — Core: Any Song Lyrics → Misheard English (60%)

1. **Song input** — Two modes:
   - Catalog picker (Jay Chou 稻香, Teresa Teng 月亮代表我的心) — pre-loaded, fast, demo-reliable
   - Paste Mandarin lyrics (any song) — the "any song" differentiator; important for judging

2. **Pinyin conversion** — Convert pasted Chinese → pinyin. Options:
   - Use Gemini itself to return pinyin alongside hearsay candidates (simplest, avoids extra lib)
   - OR integrate `pinyin` npm package / Python `pypinyin` for reliability

3. **Gemini hearsay generation** — Per-line prompt returning candidates. Model: use **Gemini 3.1 Flash-Lite** (preview) for industry-leading speed (45% faster than Flash). This ensures even long songs generate "hearsay" almost instantly.

4. **Slider personalisation** — Faithful ↔ Funny = `funny_weight` param in prompt/scoring formula.

5. **Lyric display** — Cards per line: Chinese | pinyin | misheard English (big) | meaning (small). Tap ↺ to cycle variants.

6. **Copy to share** — Copy full misheard lyrics to clipboard.

---

## Milestone 2 — Karaoke Sync (20%)

7. **Pre-built demo songs**: manually prep or use LRC timestamp files (available online for Jay Chou/Teresa Teng) to get line-level timestamps → karaoke highlight player.

8. **Audio source for demo songs**: Use **YouTube Iframe API**. Overlay custom lyrics UI on top of the video player for a seamless "caption translation" feel.

9. **Karaoke player**: Use `lrc-kit` or similar to parse LRC files. Sync display to `player.getCurrentTime()`.

10. **Pronunciation Guide (TTS)**: Integrate **Gemini 2.5 Pro TTS**. Add a "Listen" icon next to each hearsay line so the user can hear the intended pronunciation before the sync starts.

---

**Bonus Tier (pick based on "Wow" potential):**

**Option A — Visual Wow: Veo 3.1 Video Backgrounds**
- Prompt Veo 3.1 with the overall "meaning" and "vibe" of the song (already extracted by Gemini).
- Generate a 5-10s looping background video for the karaoke view.
- Massive visual differentiator from standard Blue/Black karaoke screens.

**Option B — Audio Wow: Lyria AI Singing Guide**
- Feed hearsay lyrics to Lyria with weighted prompts matching the artist's genre.
- Generate a reference audio clip of the *English* lyrics being sung musically.

**Option C — Auto-timestamp via Gemini 3.1 Pro**
- Multimodal audio alignment for any uploaded file.

---

## Demo Script (3 min judging slot)

| Time | Action |
|------|--------|
| 0:20 | Hook: "Non-Chinese speakers can't sing C-pop at KTV — until now." |
| 0:30 | Live paste of Mandarin lyrics from a DIFFERENT song (not catalog) → Generate → misheard appears in real-time. Proves "any song". |
| 0:45 | Switch to catalog song (稻香) → Karaoke mode → audio plays → English lyrics highlight in sync. |
| 0:20 | Adjust slider Faithful→Funny → re-generate → show variant swap. |
| 0:15 | Copy to share / (if M3) sing into mic → Gemini Live feedback. |

---

## Relevant Files / APIs

- Frontend: React/Next.js (App Router)
- Styling: Tailwind CSS + Framer Motion (for premium feel)
- Backend: Next.js Server Actions (Primary) / FastAPI (Secondary for complex audio)
- Gemini API: `gemini-3.1-flash-lite` (Hearsay), `gemini-3.1-pro` (Audio/Sync), `gemini-2.5-pro-preview-tts` (Guide)
- Advanced: `veo-3.1-fast-generate-preview` (Video), `lyria-realtime-exp` (Audio Magic)
- Pinyin: `pinyin-pro` (JS) for baseline + Gemini for refinement
- $20 API credit: estimate per-song token cost before building (multi-candidate per line can add up)

---

## Scope Exclusions

- ❌ No user accounts / persistence
- ❌ No English-to-English lyrics
- ❌ Voice coach is stretch, not core
- ❌ Audio copyright not a blocker for hackathon

---

## Open Issues

- Model string: confirm exact Gemini model name from AI Studio today
- LRC timestamp files: verify availability for 稻香 and 月亮代表我的心 before committing to M2
- Token budget: estimate cost of multi-candidate generation per song before $20 credit runs out
