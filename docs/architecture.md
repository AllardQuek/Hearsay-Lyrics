# System Architecture

This document shows how Hearsay Lyrics connects the frontend, backend APIs, Gemini models, video generation, and cache storage.

## Architecture Diagram

```mermaid
flowchart TB
  user[User in Browser]

  subgraph frontend[Next.js Frontend]
    ui[UI Components\nSongInput, LyricSheet, PerformView]
    page[Client Orchestrator\nsrc/app/page.tsx]
  end

  subgraph backend[Next.js API Layer]
    apiGenerate[/POST /api/generate/]
    apiRefine[/POST /api/refine/]
    apiDirector[/POST /api/director\nNDJSON stream/]
    apiImagine[/POST /api/imagine/]
    apiSync[/POST /api/sync/]
    apiVideo[/POST /api/video/]
    apiVideoStatus[/POST /api/video/status/]
    apiCache[/POST /api/cache/]
  end

  subgraph ai[Google AI Services]
    geminiText[Gemini Text Models\nvia @google/genai + Vertex AI]
    geminiImage[Gemini Image Model\ngemini-3.1-flash-image-preview]
    veo[Veo Video Model\nVertex AI REST API]
  end

  subgraph storage[Storage Layer]
    cacheFiles[(JSON Cache Files\npublic/cache/*.json)]
  end

  user --> ui
  ui --> page

  page --> apiGenerate
  page --> apiRefine
  page --> apiDirector
  page --> apiImagine
  page --> apiSync
  page --> apiVideo
  page --> apiVideoStatus
  page --> apiCache

  apiGenerate --> geminiText
  apiRefine --> geminiText
  apiSync --> geminiText
  apiDirector --> geminiText
  apiDirector --> geminiImage
  apiImagine --> geminiText
  apiImagine --> geminiImage

  apiVideo --> veo
  apiVideoStatus --> veo

  apiDirector <--> cacheFiles
  apiCache --> cacheFiles
  page -.->|reads prebuilt cache via GET /cache/{songId}.json| cacheFiles
```

## Key Connections

- Frontend to backend: the browser client in `src/app/page.tsx` calls Next.js route handlers under `src/app/api/*`.
- Backend to Gemini: shared integration in `src/lib/gemini.ts` sends generation requests through Vertex AI (`@google/genai`).
- Backend to video model: `src/app/api/video/route.ts` and `src/app/api/video/status/route.ts` call Vertex AI Veo endpoints with a service-account token.
- Backend to storage: `src/app/api/director/route.ts` and `src/app/api/cache/route.ts` write/read cached assets from `public/cache/*.json`.

## Notes on Database/Storage

- Current persistence is file-based JSON cache (`public/cache`) for demo songs and generated director assets.
- There is no external relational/NoSQL database in the current architecture.
- If needed, this storage layer can be replaced by Cloud Storage, Firestore, or SQL without changing the frontend contract.