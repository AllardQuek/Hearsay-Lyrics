# UI/UX Revamp: Retro-Futurist / Cyber-Trad Plan

## 1. Aesthetic: Retro-Futurist "Cyber-Trad"
- **Typography**: 
  - Dual-language focus. Heavy, "Neo-Traditional" brush-stroke feel for Chinese (`Zhi Mang Xing` or similar via Google Fonts if possible, or fallback to extreme weights).
  - English: High-energy monospaced or brutalist display fonts (e.g., `Syne`, `Space Grotesk`, `JetBrains Mono`).
- **Colors**: 
  - **Base**: Extreme Dark (#020202) with grain/noise.
  - **Accents**: Cyber-Jade (#00FF9C), Electric Crimson (#FF0055), and Deep Indigo (#1A0B2E).
- **Details**: 
  - Vertical text headers (Traditional Chinese style).
  - Scanlines, CRT glow on hover, and paper-texture overlays.
  - "Grid-breaking" layouts where lyrics overlap images.

## 2. Structural Revamp (The "Cinema" Flow)
- **KTV Director Default**: No toggle. Hearsay is now a *Production*. Hearsay text generates instantly; Director visuals stream in as they ready.
- **Studio (The Forge)**:
  - Top section: Minimalist Input. High-impact "Paste" area.
  - "Step 1" text replaced with large, stylistic "01." numbers and kinetic headers.
- **Perform (The Premiere)**:
  - Automatic transition when the first visual is ready.
  - Full-screen "Director's Cut" mode (Storyboard) becomes the primary consumption method.
- **The "Toolbelt" (Unified Actions)**:
  - Storyboard, Share, and Save are no longer a static row. 
  - Storyboard is the primary "CTA". Share/Save are contextual "Exits".

## 3. Component Updates
- **SongInput.tsx**:
  - Remove "Optional: Karaoke Power-Ups." It's now just the path.
  - Increase text size for instruction headers. 
  - Use better visual cues (e.g. glowing borders) for selected catalog songs.
- **Home (page.tsx)**:
  - Modernize tab switching. Use a "Director's Log" style ticker for loading.
  - Group Storyboard/Share/Save into a "Production Control" panel.

## 4. Technical Strategy
1. **Globals.css**: Inject theme colors and utility classes for noise/glow.
2. **Typography**: Add `font-display` (Outfit) and `font-mono` (JetBrains Mono/Inter).
3. **Transition**: Ensure "Studio" to "Perform" feels like a camera zoom.
