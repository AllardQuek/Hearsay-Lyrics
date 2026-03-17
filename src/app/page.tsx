"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Sparkles, Package, Layers, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

import SongInput from "@/components/SongInput";
import LyricSheet from "@/components/LyricSheet";
import PerformView from "@/components/PerformView";
import LoadingState from "@/components/LoadingState";
import { type HearsayCandidate } from "@/lib/gemini";
import { type DirectorLine } from "@/app/api/director/route";
import { isCacheableSongId, type CacheMode } from "@/lib/cache";
import { formatHearsayForClipboard } from "@/lib/utils";
import {
  buildMediaSegments,
  type LineMediaStatus,
  type MediaSegment,
  type SegmentMediaType,
  type VideoClipAsset,
} from "@/lib/media-segments";

type HearsayLine = {
  original: string;
  pinyin: string;
  misheard: string;
  meaning: string;
  imageUrl?: string;
  startTime?: number;
  endTime?: number;
  chinese: string;
  candidates: HearsayCandidate[];
};

type DirectorPhase = "scripting" | "visualizing" | "complete";
type CacheRuntimeStatus = "idle" | "hit" | "miss" | "bypassed" | "refreshed" | "manual-update";

type SegmentOperation = {
  operationName: string;
  scenePrompt?: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitMessage(message: string): boolean {
  return /rate limit|quota|resource exhausted|429/i.test(message);
}

export default function Home() {
  const [hearsayResults, setHearsayResults] = useState<HearsayLine[]>([]);
  const [directorLines, setDirectorLines] = useState<DirectorLine[]>([]);
  const [directorPhase, setDirectorPhase] = useState<DirectorPhase>("complete");
  const [expectedTotalLines, setExpectedTotalLines] = useState(0);
  const [currentSongId, setCurrentSongId] = useState<string | undefined>(undefined);
  const [isSavingCache, setIsSavingCache] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const currentTime = 0;
  const [loading, setLoading] = useState(false);
  const [imageQuotaLimited, setImageQuotaLimited] = useState(false);
  const [cacheRuntimeStatus, setCacheRuntimeStatus] = useState<CacheRuntimeStatus>("idle");

  const [outputMode, setOutputMode] = useState<"studio" | "perform">("studio");
  const [segmentOverrides, setSegmentOverrides] = useState<Record<string, SegmentMediaType>>({});
  const [videoClips, setVideoClips] = useState<Record<string, VideoClipAsset>>({});
  const [lineMediaStatuses, setLineMediaStatuses] = useState<Record<number, LineMediaStatus>>({});
  const [showStudioDiagnostics, setShowStudioDiagnostics] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const outputSectionRef = useRef<HTMLDivElement | null>(null);
  const inFlightSegmentsRef = useRef<Set<string>>(new Set());
  const inFlightImageRecoveryRef = useRef<Set<number>>(new Set());
  const attemptedImageRecoveryRef = useRef<Set<number>>(new Set());
  const autoCacheSignatureRef = useRef("");
  const generationEpochRef = useRef(0);

  const isStudioMode = outputMode === "studio";
  const outputModeTitle = isStudioMode ? "Studio" : "Performance";
  const outputModeDescription = isStudioMode
    ? "Tune and refine your lyric sheet before showtime."
    : "Play back synced lyrics with cinematic visuals and controls.";

  const mediaSegments = useMemo(
    () => buildMediaSegments(hearsayResults, {
      targetSeconds: 4,
      minVideoSegments: 1,
      maxVideoSegments: 3,
      singleLineSegments: true,
      overrides: segmentOverrides,
    }),
    [hearsayResults, segmentOverrides]
  );

  const lineMediaSummary = useMemo(() => {
    const statuses = Object.values(lineMediaStatuses);
    return {
      recoveringCount: statuses.filter((item) => item.status === "image-recovering").length,
      failedCount: statuses.filter((item) => item.status === "image-failed").length,
    };
  }, [lineMediaStatuses]);

  const startSegmentVideoGeneration = useCallback(
    async (segment: MediaSegment, epoch: number) => {
      const relatedLines = segment.lineIndices
        .map((index) => hearsayResults[index])
        .filter(Boolean);

      const relatedDirectorLines = segment.lineIndices
        .map((index) => directorLines[index])
        .filter(Boolean);

      const mood = relatedDirectorLines.find((line) => line?.mood)?.mood;
      const palette = relatedDirectorLines.find((line) => line?.palette?.length)?.palette;

      const requestPayload = {
        segment: {
          segmentId: segment.id,
          startTime: segment.startTime,
          endTime: segment.endTime,
          durationSeconds: segment.durationSeconds,
          hearsayLines: relatedLines.map((line) => line.candidates?.[0]?.text).filter(Boolean),
          mood,
          palette,
        },
      };

      setVideoClips((prev) => ({
        ...prev,
        [segment.id]: {
          segmentId: segment.id,
          clipStart: segment.startTime,
          clipEnd: segment.endTime,
          status: "generating",
        },
      }));

      let operation: SegmentOperation;

      try {
        const initRes = await fetch("/api/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });
        const initData = (await initRes.json()) as SegmentOperation & { error?: string };

        if (!initRes.ok || initData.error || !initData.operationName) {
          throw new Error(initData.error || "Failed to start segment video generation");
        }

        operation = {
          operationName: initData.operationName,
          scenePrompt: initData.scenePrompt,
        };

        setVideoClips((prev) => {
          const existing = prev[segment.id];
          if (!existing || generationEpochRef.current !== epoch) return prev;
          return {
            ...prev,
            [segment.id]: {
              ...existing,
              operationName: operation.operationName,
              scenePrompt: operation.scenePrompt,
            },
          };
        });
      } catch (error) {
        inFlightSegmentsRef.current.delete(segment.id);
        const message = error instanceof Error ? error.message : "Failed to start segment video generation";
        setVideoClips((prev) => ({
          ...prev,
          [segment.id]: {
            segmentId: segment.id,
            clipStart: segment.startTime,
            clipEnd: segment.endTime,
            status: "failed",
            error: message,
          },
        }));
        return;
      }

      const maxPollAttempts = 30;
      for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
        if (generationEpochRef.current !== epoch) {
          inFlightSegmentsRef.current.delete(segment.id);
          return;
        }

        await wait(5000);

        try {
          const statusRes = await fetch("/api/video/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operationName: operation.operationName,
              segmentId: segment.id,
              startTime: segment.startTime,
              endTime: segment.endTime,
            }),
          });
          const statusData = (await statusRes.json()) as {
            done?: boolean;
            error?: string;
            mimeType?: string;
            videoBase64?: string;
            videoUri?: string;
          };

          if (!statusRes.ok || statusData.error) {
            throw new Error(statusData.error || "Segment video status check failed");
          }

          if (!statusData.done) {
            continue;
          }

          if (!statusData.videoBase64 && !statusData.videoUri) {
            throw new Error("Segment video payload missing media data");
          }

          inFlightSegmentsRef.current.delete(segment.id);
          setVideoClips((prev) => ({
            ...prev,
            [segment.id]: {
              segmentId: segment.id,
              clipStart: segment.startTime,
              clipEnd: segment.endTime,
              status: "ready",
              operationName: operation.operationName,
              scenePrompt: operation.scenePrompt,
              mimeType: statusData.mimeType || "video/mp4",
              videoBase64: statusData.videoBase64,
              videoUri: statusData.videoUri,
            },
          }));
          return;
        } catch (error) {
          inFlightSegmentsRef.current.delete(segment.id);
          const message = error instanceof Error ? error.message : "Segment video polling failed";
          setVideoClips((prev) => ({
            ...prev,
            [segment.id]: {
              segmentId: segment.id,
              clipStart: segment.startTime,
              clipEnd: segment.endTime,
              status: "failed",
              operationName: operation.operationName,
              scenePrompt: operation.scenePrompt,
              error: message,
            },
          }));
          return;
        }
      }

      inFlightSegmentsRef.current.delete(segment.id);
      setVideoClips((prev) => ({
        ...prev,
        [segment.id]: {
          segmentId: segment.id,
          clipStart: segment.startTime,
          clipEnd: segment.endTime,
          status: "failed",
          operationName: operation.operationName,
          scenePrompt: operation.scenePrompt,
          error: "Segment video generation timed out",
        },
      }));
    },
    [directorLines, hearsayResults]
  );

  const recoverLineImage = useCallback(
    async (lineIndex: number, epoch: number) => {
      const hearsayText = hearsayResults[lineIndex]?.candidates?.[0]?.text?.trim();
      if (!hearsayText) {
        inFlightImageRecoveryRef.current.delete(lineIndex);
        setLineMediaStatuses((prev) => ({
          ...prev,
          [lineIndex]: {
            status: "image-failed",
            message: "No hearsay text available for image generation.",
          },
        }));
        return;
      }

      try {
        const response = await fetch("/api/imagine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hearsayText }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { imageBase64?: string; mimeType?: string; error?: string; isRateLimit?: boolean }
          | null;

        if (!response.ok || !payload?.imageBase64) {
          const message = payload?.error || "Image regeneration failed";
          const isRateLimit = payload?.isRateLimit === true || isRateLimitMessage(message);
          throw Object.assign(new Error(message), { isRateLimit });
        }

        if (generationEpochRef.current !== epoch) {
          return;
        }

        const mimeType = payload.mimeType || "image/png";

        setDirectorLines((prev) => {
          if (!prev[lineIndex]) return prev;
          const next = [...prev];
          next[lineIndex] = {
            ...next[lineIndex],
            imageBase64: payload.imageBase64,
            imageMimeType: mimeType,
            imageRateLimited: false,
            imageError: undefined,
          };
          return next;
        });

        setHearsayResults((prev) => {
          if (!prev[lineIndex]) return prev;
          const next = [...prev];
          next[lineIndex] = {
            ...next[lineIndex],
            imageUrl: `data:${mimeType};base64,${payload.imageBase64}`,
          };
          return next;
        });

        setLineMediaStatuses((prev) => ({
          ...prev,
          [lineIndex]: { status: "image-ready" },
        }));
      } catch (error) {
        if (generationEpochRef.current !== epoch) {
          return;
        }

        const message = error instanceof Error ? error.message : "Image regeneration failed";
        const isRateLimit =
          typeof error === "object" &&
          error !== null &&
          "isRateLimit" in error &&
          (error as { isRateLimit?: boolean }).isRateLimit === true;

        if (isRateLimit) {
          setImageQuotaLimited(true);
        }

        setDirectorLines((prev) => {
          if (!prev[lineIndex]) return prev;
          const next = [...prev];
          next[lineIndex] = {
            ...next[lineIndex],
            imageRateLimited: isRateLimit,
            imageError: message,
          };
          return next;
        });

        setLineMediaStatuses((prev) => ({
          ...prev,
          [lineIndex]: {
            status: "image-failed",
            message,
            isRateLimit,
          },
        }));
      } finally {
        inFlightImageRecoveryRef.current.delete(lineIndex);
      }
    },
    [hearsayResults]
  );

  useEffect(() => {
    if (directorPhase !== "complete" || mediaSegments.length === 0) return;

    for (const segment of mediaSegments) {
      if (segment.mediaType !== "video") continue;

      const existing = videoClips[segment.id];
      if (existing && existing.status !== "queued") continue;
      if (inFlightSegmentsRef.current.has(segment.id)) continue;

      inFlightSegmentsRef.current.add(segment.id);
      void startSegmentVideoGeneration(segment, generationEpochRef.current);
    }
  }, [directorPhase, mediaSegments, startSegmentVideoGeneration, videoClips]);

  useEffect(() => {
    if (directorPhase !== "complete" || hearsayResults.length === 0) return;

    const lineToSegment = new Map<number, MediaSegment>();
    for (const segment of mediaSegments) {
      for (const lineIndex of segment.lineIndices) {
        lineToSegment.set(lineIndex, segment);
      }
    }

    const nextStatuses: Record<number, LineMediaStatus> = {};
    const recoveryQueue: number[] = [];

    for (let lineIndex = 0; lineIndex < hearsayResults.length; lineIndex++) {
      const segment = lineToSegment.get(lineIndex);
      const isCoveredByVideo = segment?.mediaType === "video";

      if (isCoveredByVideo) {
        nextStatuses[lineIndex] = { status: "covered-by-video" };
        continue;
      }

      const hasImage = Boolean(directorLines[lineIndex]?.imageBase64 || hearsayResults[lineIndex]?.imageUrl);
      if (hasImage) {
        nextStatuses[lineIndex] = { status: "image-ready" };
        continue;
      }

      if (inFlightImageRecoveryRef.current.has(lineIndex)) {
        nextStatuses[lineIndex] = { status: "image-recovering" };
        continue;
      }

      if (attemptedImageRecoveryRef.current.has(lineIndex)) {
        const message = directorLines[lineIndex]?.imageError || "Image generation failed for this line.";
        const isRateLimit = directorLines[lineIndex]?.imageRateLimited === true;
        nextStatuses[lineIndex] = {
          status: "image-failed",
          message,
          isRateLimit,
        };
        continue;
      }

      attemptedImageRecoveryRef.current.add(lineIndex);
      inFlightImageRecoveryRef.current.add(lineIndex);
      nextStatuses[lineIndex] = { status: "image-recovering" };
      recoveryQueue.push(lineIndex);
    }

    setLineMediaStatuses((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextStatuses);
      if (prevKeys.length !== nextKeys.length) return nextStatuses;

      for (const key of nextKeys) {
        const index = Number(key);
        const prevStatus = prev[index];
        const nextStatus = nextStatuses[index];

        if (!prevStatus ||
          prevStatus.status !== nextStatus.status ||
          prevStatus.message !== nextStatus.message ||
          prevStatus.isRateLimit !== nextStatus.isRateLimit) {
          return nextStatuses;
        }
      }

      return prev;
    });

    for (const lineIndex of recoveryQueue) {
      void recoverLineImage(lineIndex, generationEpochRef.current);
    }
  }, [directorLines, directorPhase, hearsayResults, mediaSegments, recoverLineImage]);

  useEffect(() => {
    const inFlightSegments = inFlightSegmentsRef.current;
    const inFlightImageRecovery = inFlightImageRecoveryRef.current;
    return () => {
      generationEpochRef.current += 1;
      inFlightSegments.clear();
      inFlightImageRecovery.clear();
    };
  }, []);

  const startDirectorStream = async (
    text: string,
    audio?: string,
    preComputed?: Array<Partial<HearsayLine>>,
    songId?: string,
    cacheMode: CacheMode = "prefer-cache",
    funnyWeight: number = 0.5
  ) => {
    setLoading(true);
    setAudioUrl(audio);
    setHearsayResults([]);
    setDirectorLines([]);
    setDirectorPhase("scripting");
    setExpectedTotalLines(0);
    setCurrentSongId(songId);
    setSaveSuccess(false);
    setImageQuotaLimited(false);
    setCacheRuntimeStatus("idle");
    setOutputMode("studio");
    setSegmentOverrides({});
    setVideoClips({});
    setLineMediaStatuses({});
    setShowStudioDiagnostics(false);
    autoCacheSignatureRef.current = "";
    generationEpochRef.current += 1;
    inFlightSegmentsRef.current.clear();
    inFlightImageRecoveryRef.current.clear();
    attemptedImageRecoveryRef.current.clear();
    requestAnimationFrame(() => {
      outputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const syncIndex = new Map<string, number>();
    for (const line of preComputed || []) {
      const key = typeof line.chinese === "string" ? line.chinese.trim() : undefined;
      if (!key) continue;
      if (typeof line.startTime === "number") {
        syncIndex.set(key, line.startTime);
      }
    }

    const applyImageUpdate = (payload: Record<string, unknown>) => {
      const lineIndex = typeof payload.lineIndex === "number" ? payload.lineIndex : undefined;
      const chinese = typeof payload.chinese === "string" ? payload.chinese : undefined;
      const imageBase64 = typeof payload.imageBase64 === "string" ? payload.imageBase64 : undefined;
      const imageMimeType = typeof payload.imageMimeType === "string" ? payload.imageMimeType : "image/png";
      const imageRateLimited = payload.imageRateLimited === true;
      const imageError = typeof payload.imageError === "string" ? payload.imageError : undefined;

      if (imageRateLimited) {
        setImageQuotaLimited(true);
      }

      setDirectorLines((prev) => {
        const next = [...prev];
        const targetIndex =
          typeof lineIndex === "number" && lineIndex >= 0 && lineIndex < next.length
            ? lineIndex
            : chinese
              ? next.findIndex((line) => line.chinese === chinese)
              : -1;

        if (targetIndex < 0) return prev;

        next[targetIndex] = {
          ...next[targetIndex],
          imageBase64,
          imageMimeType,
          imageRateLimited,
          imageError,
        };

        return next;
      });

      setHearsayResults((prev) => {
        const next = [...prev];
        const targetIndex =
          typeof lineIndex === "number" && lineIndex >= 0 && lineIndex < next.length
            ? lineIndex
            : chinese
              ? next.findIndex((line) => line.chinese === chinese)
              : -1;

        if (targetIndex < 0) return prev;

        next[targetIndex] = {
          ...next[targetIndex],
          imageUrl: imageBase64 ? `data:${imageMimeType};base64,${imageBase64}` : next[targetIndex].imageUrl,
        };

        return next;
      });

      if (typeof lineIndex === "number" && lineIndex >= 0) {
        setLineMediaStatuses((prev) => ({
          ...prev,
          [lineIndex]: imageBase64
            ? { status: "image-ready" }
            : imageError
              ? { status: "image-failed", message: imageError, isRateLimit: imageRateLimited }
              : prev[lineIndex] ?? { status: "image-recovering" },
        }));
      }
    };

    const appendDirectorLine = (payload: Record<string, unknown>) => {
      const chinese =
        (typeof payload.chinese === "string" && payload.chinese) ||
        (typeof payload.original === "string" && payload.original) ||
        "";
      const pinyin = typeof payload.pinyin === "string" ? payload.pinyin : "";
      const meaning = typeof payload.meaning === "string" ? payload.meaning : "";
      const hearsay =
        (typeof payload.hearsay === "string" && payload.hearsay) ||
        (typeof payload.misheard === "string" && payload.misheard) ||
        "";

      // Skip non-line events, e.g., error payloads or malformed chunks.
      if (!chinese && !hearsay) {
        return;
      }

      const imageBase64 = typeof payload.imageBase64 === "string" ? payload.imageBase64 : undefined;
      const imageMimeType = typeof payload.imageMimeType === "string" ? payload.imageMimeType : undefined;
      const imageRateLimited = payload.imageRateLimited === true;
      const imageError = typeof payload.imageError === "string" ? payload.imageError : undefined;
      const modelStartTime = typeof payload.startTime === "number" ? payload.startTime : undefined;
      const endTime = typeof payload.endTime === "number" ? payload.endTime : 0;
      const palette = Array.isArray(payload.palette)
        ? payload.palette.filter((value): value is string => typeof value === "string")
        : [];

      if (imageRateLimited) {
        setImageQuotaLimited(true);
      }

      const resolvedStartTime =
        modelStartTime ??
        syncIndex.get(chinese.trim());

      const directorLine: DirectorLine = {
        chinese,
        pinyin,
        meaning,
        hearsay,
        visual: typeof payload.visual === "string" ? payload.visual : "",
        mood: typeof payload.mood === "string" ? payload.mood : "",
        palette,
        imageBase64,
        imageMimeType,
        imageRateLimited,
        imageError,
        startTime: resolvedStartTime,
      };

      setDirectorLines((prev) => [...prev, directorLine]);
      setHearsayResults((prev) => [
        ...prev,
        {
          original: chinese,
          pinyin,
          misheard: hearsay,
          meaning,
          imageUrl: imageBase64 ? `data:${imageMimeType || "image/png"};base64,${imageBase64}` : undefined,
          startTime: resolvedStartTime,
          endTime,
          chinese,
          candidates: [{ text: hearsay, phonetic: 1, humor: 1 }],
        },
      ]);
    };

    const handleDirectorRecord = (data: Record<string, unknown>) => {
      if (data.type === "meta") {
        setExpectedTotalLines(typeof data.totalLines === "number" ? data.totalLines : 0);
        setDirectorPhase("visualizing");
        return;
      }

      if (data.type === "segment-overrides") {
        const payload = typeof data.payload === "object" && data.payload
          ? (data.payload as Record<string, unknown>)
          : data;

        const rawOverrides = payload.segmentOverrides;
        if (!rawOverrides || typeof rawOverrides !== "object") {
          return;
        }

        const normalizedOverrides = Object.entries(rawOverrides as Record<string, unknown>).reduce<Record<string, SegmentMediaType>>(
          (acc, [segmentId, mediaType]) => {
            if (mediaType === "image" || mediaType === "video") {
              acc[segmentId] = mediaType;
            }
            return acc;
          },
          {}
        );

        if (Object.keys(normalizedOverrides).length > 0) {
          setSegmentOverrides(normalizedOverrides);
        }
        return;
      }

      if (data.type === "video-clips") {
        const payload = typeof data.payload === "object" && data.payload
          ? (data.payload as Record<string, unknown>)
          : data;

        const rawVideoClips = Array.isArray(payload.videoClips)
          ? payload.videoClips
          : Array.isArray((data as { videoClips?: unknown[] }).videoClips)
            ? (data as { videoClips: unknown[] }).videoClips
            : [];

        if (rawVideoClips.length === 0) {
          return;
        }

        setVideoClips((prev) => {
          const next = { ...prev };

          for (const rawClip of rawVideoClips) {
            if (!rawClip || typeof rawClip !== "object") continue;

            const clip = rawClip as Record<string, unknown>;
            const segmentId = typeof clip.segmentId === "string" ? clip.segmentId : undefined;
            if (!segmentId) continue;

            const clipStart = typeof clip.clipStart === "number" ? clip.clipStart : 0;
            const clipEnd = typeof clip.clipEnd === "number" ? clip.clipEnd : clipStart;
            const mimeType = typeof clip.mimeType === "string" ? clip.mimeType : "video/mp4";
            const videoBase64 = typeof clip.videoBase64 === "string" ? clip.videoBase64 : undefined;
            const videoUri = typeof clip.videoUri === "string" ? clip.videoUri : undefined;

            if (!videoBase64 && !videoUri) continue;

            next[segmentId] = {
              segmentId,
              clipStart,
              clipEnd,
              status: "ready",
              mimeType,
              videoBase64,
              videoUri,
            };
          }

          return next;
        });
        return;
      }

      if (data.type === "image-update") {
        const payload = typeof data.payload === "object" && data.payload
          ? (data.payload as Record<string, unknown>)
          : data;
        applyImageUpdate(payload);
        return;
      }

      // Accept both legacy envelope format ({ type: "line", ... }) and
      // raw NDJSON line objects emitted by the current /api/director route.
      const payload = data.type === "line" && typeof data.payload === "object" && data.payload
        ? (data.payload as Record<string, unknown>)
        : data;

      appendDirectorLine(payload);
    };

    try {
      const response = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, preComputed, songId, cacheMode, funnyWeight }),
        signal: abortControllerRef.current.signal,
      });

      const cacheHeader = response.headers.get("X-Hearsay-Cache");
      if (cacheHeader === "hit" || cacheHeader === "miss" || cacheHeader === "bypassed" || cacheHeader === "refreshed") {
        setCacheRuntimeStatus(cacheHeader);
      }

      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as Record<string, unknown>;
            handleDirectorRecord(data);
          } catch (e) {
            console.error("Chunk parse error:", e);
          }
        }
      }

      // Parse any final trailing line left in the buffer.
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer) as Record<string, unknown>;
          handleDirectorRecord(data);
        } catch (e) {
          console.error("Final chunk parse error:", e);
        }
      }
      setDirectorPhase("complete");
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (hearsayResults.length === 0) return;
    const shareText = formatHearsayForClipboard(hearsayResults);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Hearsay Lyrics",
          text: shareText,
        });
        return;
      } catch {
        // Fall back to clipboard when sharing is cancelled or unavailable.
      }
    }

    await navigator.clipboard.writeText(shareText);
  };

  const handleSaveCache = async () => {
    if (directorLines.length === 0 || isSavingCache || !isCacheableSongId(currentSongId)) return;

    const segmentPlan = mediaSegments.reduce<Record<string, SegmentMediaType>>((acc, segment) => {
      acc[segment.id] = segment.mediaType;
      return acc;
    }, {});

    setIsSavingCache(true);
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: currentSongId,
          directorLines,
          videoClips: Object.values(videoClips)
            .filter((clip) => clip.status === "ready" && (clip.videoBase64 || clip.videoUri))
            .map((clip) => ({
              segmentId: clip.segmentId,
              clipStart: clip.clipStart,
              clipEnd: clip.clipEnd,
              mimeType: clip.mimeType || "video/mp4",
              videoBase64: clip.videoBase64,
              videoUri: clip.videoUri,
            })),
          segmentOverrides: segmentPlan,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to save cache");
      }

      setSaveSuccess(true);
      setCacheRuntimeStatus("manual-update");
    } catch (error) {
      console.error("[cache] Failed to persist cache:", error);
    } finally {
      setIsSavingCache(false);
    }
  };

  useEffect(() => {
    if (!isCacheableSongId(currentSongId)) return;
    if (directorPhase !== "complete") return;
    if (directorLines.length === 0) return;

    const readyClips = Object.values(videoClips)
      .filter((clip) => clip.status === "ready" && (clip.videoBase64 || clip.videoUri))
      .map((clip) => ({
        segmentId: clip.segmentId,
        clipStart: clip.clipStart,
        clipEnd: clip.clipEnd,
        mimeType: clip.mimeType || "video/mp4",
        videoBase64: clip.videoBase64,
        videoUri: clip.videoUri,
      }))
      .sort((a, b) => a.segmentId.localeCompare(b.segmentId));

    const segmentPlan = mediaSegments.reduce<Record<string, SegmentMediaType>>((acc, segment) => {
      acc[segment.id] = segment.mediaType;
      return acc;
    }, {});

    if (readyClips.length === 0 && Object.keys(segmentPlan).length === 0) return;

    const signature = JSON.stringify({
      songId: currentSongId,
      lineCount: directorLines.length,
      segmentPlan,
      clips: readyClips.map((clip) => ({
        segmentId: clip.segmentId,
        hasBase64: Boolean(clip.videoBase64),
        hasUri: Boolean(clip.videoUri),
      })),
    });

    if (autoCacheSignatureRef.current === signature) return;
    autoCacheSignatureRef.current = signature;

    let cancelled = false;

    const persistCache = async () => {
      try {
        const response = await fetch("/api/cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            songId: currentSongId,
            directorLines,
            videoClips: readyClips,
            segmentOverrides: segmentPlan,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Failed to auto-save cache");
        }

        if (!cancelled) {
          setCacheRuntimeStatus("manual-update");
        }
      } catch (error) {
        console.error("[cache] Failed to auto-persist cache:", error);
        if (!cancelled) {
          autoCacheSignatureRef.current = "";
        }
      }
    };

    void persistCache();

    return () => {
      cancelled = true;
    };
  }, [currentSongId, directorLines, directorPhase, mediaSegments, videoClips]);

  const handleToggleSegmentMedia = useCallback((segmentId: string) => {
    const targetSegment = mediaSegments.find((segment) => segment.id === segmentId);
    if (!targetSegment) return;

    const currentType = segmentOverrides[segmentId] ?? targetSegment.mediaType;
    const nextType: SegmentMediaType = currentType === "video" ? "image" : "video";

    setSegmentOverrides((prev) => ({
      ...prev,
      [segmentId]: nextType,
    }));

    setVideoClips((prev) => {
      if (nextType !== "video") {
        return prev;
      }

      return {
        ...prev,
        [segmentId]: {
          segmentId,
          clipStart: targetSegment.startTime,
          clipEnd: targetSegment.endTime,
          status: "queued",
        },
      };
    });
  }, [mediaSegments, segmentOverrides]);

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-black">
      <div className="fixed top-0 left-0 w-full h-1 bg-primary/20 z-50 overflow-hidden">
        {loading && (
          <motion.div 
            className="h-full bg-primary"
            initial={{ x: "-100%" }}
            animate={{ x: "0%" }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          />
        )}
      </div>

      <nav className="sticky top-0 left-0 w-full z-40 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 lg:gap-12">
            <div className="group cursor-default">
              <h1 className="text-xl font-display font-medium tracking-wide text-white leading-none sm:text-2xl">
                Hearsay<span className="text-primary italic font-serif">Lyrics</span>
              </h1>
              <div className="mt-1.5 hidden items-center gap-2 sm:flex opacity-70">
                <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(255,107,158,0.8)] animate-pulse" />
                <span className="text-[10px] text-muted tracking-widest font-light">
                  MANDARIN VOCAL STUDIO
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden flex-col items-end sm:flex opacity-70">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/50 tracking-wider">Mic</span>
                <span className="text-[10px] font-medium text-primary">12ms</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-white/50 tracking-wider">AI DJ</span>
                <span className="text-[10px] font-medium text-accent">Gemini-Pro</span>
              </div>
            </div>
            <div className="hidden h-6 w-px bg-white/10 sm:block" />
            <button className="text-white/60 hover:text-white p-2 transition-colors border-2 border-transparent hover:border-white/20">
              <Activity size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="relative space-y-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-14 lg:space-y-16"
          >
            {/* Hero Section */}
            <div className="w-full flex flex-col items-center text-center gap-8 py-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white font-medium tracking-wide text-xs">
                <Sparkles size={14} className="text-primary" />
                <span>AI-Powered Sing-Along</span>
              </div>

              <h1 className="text-5xl font-display font-bold tracking-tight text-white leading-[1.1] sm:text-6xl lg:text-7xl w-full max-w-4xl">
                Sing Chinese <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent italic font-serif">In English.</span>
              </h1>

              <p className="max-w-2xl text-base text-white/70 leading-relaxed sm:text-lg">
                Edutainment across cultures — singability-first hearsay lyrics with synced AI visuals and video, enabling everyone to sing along across cultures.
              </p>
            </div>
            <SongInput 
              onGenerate={startDirectorStream}
              loading={loading}
            />
          </motion.div>

          <motion.div
            ref={outputSectionRef}
            id="output"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="space-y-12 border-t border-white/10 pt-12"
          >
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-3xl font-display font-medium text-white tracking-tight">The <span className="text-primary italic font-serif">{outputModeTitle}</span></h2>
                <p className="text-xs text-white/50 tracking-wide font-light">{outputModeDescription}</p>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="flex p-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                  <button
                    onClick={() => setOutputMode("studio")}
                    className={cn(
                      "px-6 py-2.5 text-sm font-medium transition-all flex items-center gap-2 rounded-full",
                      outputMode === "studio" ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <Package size={16} />
                    Studio
                  </button>
                  <button
                    onClick={() => setOutputMode("perform")}
                    className={cn(
                      "px-6 py-2.5 text-sm font-medium transition-all flex items-center gap-2 rounded-full",
                      outputMode === "perform" ? "bg-primary text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <Play size={14} fill="currentColor" />
                    Perform
                  </button>
                </div>
                <p className="text-xs text-white/50 tracking-wide font-light">Switch between editing lyrics and belting them out.</p>
              </div>
            </div>

            {loading && hearsayResults.length === 0 && directorLines.length === 0 && (
              <LoadingState className="py-16" />
            )}

            {!loading && hearsayResults.length === 0 && directorLines.length === 0 && (
              <div className="rounded-2xl border border-white/10 py-16 px-8 flex flex-col items-center text-center bg-white/5 items-center justify-center">
                <div className="w-16 h-16 rounded-full mb-6 border border-white/20 flex items-center justify-center bg-black/50 shadow-inner">
                  <span className="text-2xl font-mono text-primary animate-pulse">_</span>
                </div>
                <h3 className="text-xl font-display font-bold uppercase tracking-tight text-white mb-2">System Offline</h3>
                <p className="text-sm font-mono text-white/50 tracking-wide uppercase">awaiting input... select a track or upload lyrics to initialize.</p>
              </div>
            )}

            {(hearsayResults.length > 0 || directorLines.length > 0) && outputMode === "studio" && (
              <div className="space-y-6">
                <div className="flex items-center justify-end">
                  <div className="flex flex-col items-end gap-2">
                    <p className="inline-flex items-center gap-2 text-[11px] font-mono tracking-wider uppercase text-white/65">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          directorPhase === "complete" ? "bg-emerald-400" : "bg-primary animate-pulse"
                        )}
                      />
                      {directorPhase === "complete" ? "Ready" : "Rendering"}
                      {expectedTotalLines > 0 ? (
                        <span className="ml-2 opacity-70">{directorLines.length}/{expectedTotalLines}</span>
                      ) : null}
                      {(imageQuotaLimited || lineMediaSummary.recoveringCount > 0 || lineMediaSummary.failedCount > 0) && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowStudioDiagnostics((prev) => !prev)}
                            className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/45 transition-colors hover:border-white/20 hover:text-white/65"
                          >
                            Dev
                          </button>
                          {showStudioDiagnostics && (
                            <span className="text-[9px] normal-case tracking-normal text-white/45">
                              {imageQuotaLimited ? "quota-limited" : "quota-ok"}
                              {lineMediaSummary.recoveringCount > 0 ? ` · recovering:${lineMediaSummary.recoveringCount}` : ""}
                              {lineMediaSummary.failedCount > 0 ? ` · failed:${lineMediaSummary.failedCount}` : ""}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                    {cacheRuntimeStatus !== "idle" && (
                      <p
                        className={cn(
                          "rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em]",
                          cacheRuntimeStatus === "hit" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
                          cacheRuntimeStatus === "miss" && "border-sky-400/40 bg-sky-400/10 text-sky-200",
                          cacheRuntimeStatus === "bypassed" && "border-white/20 bg-white/5 text-white/65",
                          (cacheRuntimeStatus === "refreshed" || cacheRuntimeStatus === "manual-update") && "border-primary/40 bg-primary/10 text-primary"
                        )}
                      >
                        {cacheRuntimeStatus === "hit" && "Cache Hit"}
                        {cacheRuntimeStatus === "miss" && "Cache Miss -> Generated"}
                        {cacheRuntimeStatus === "bypassed" && "Fresh Run (No Cache)"}
                        {cacheRuntimeStatus === "refreshed" && "Fresh Run + Cache Refreshed"}
                        {cacheRuntimeStatus === "manual-update" && "Cache Updated"}
                      </p>
                    )}
                  </div>
                </div>

                <LyricSheet
                  lines={hearsayResults}
                  currentTime={currentTime}
                  mediaSegments={mediaSegments}
                  videoClips={videoClips}
                  onToggleSegmentMedia={handleToggleSegmentMedia}
                />
              </div>
            )}

            {(loading || hearsayResults.length > 0 || directorLines.length > 0) && outputMode === "perform" && (
              <PerformView
                results={hearsayResults}
                directorLines={directorLines}
                directorPhase={directorPhase}
                expectedTotalLines={expectedTotalLines}
                onShare={handleShare}
                onSaveCache={handleSaveCache}
                audioUrl={audioUrl}
                currentTime={currentTime}
                isSavingCache={isSavingCache}
                saveSuccess={saveSuccess}
                currentSongId={currentSongId}
                visualsRateLimited={imageQuotaLimited}
                mediaSegments={mediaSegments}
                videoClips={videoClips}
                lineMediaStatuses={lineMediaStatuses}
              />
            )}
          </motion.div>
        </div>
      </div>

      <footer className="mt-8 border-t border-white/5 bg-background/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-4 py-4 text-[10px] font-mono font-bold text-muted/40 uppercase tracking-[0.3em] sm:px-6 md:flex-row md:items-center lg:px-8">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Layers size={12} />
              <span>Session: LIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 border border-primary/20 rotate-45" />
              <span>VIP Room: 042</span>
            </div>
            <a 
              href="https://github.com/AllardQuek/Hearsay-Lyrics" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer"
            >
              <Play size={12} />
              <span>GitHub</span>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>© HEARSAY RECORDS 2026</span>
            <span className="text-[8px] opacity-50 tracking-normal">Built for Gemini Live Agent Challenge</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
