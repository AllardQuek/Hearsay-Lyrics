"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2,
  Save,
  Loader2,
  Check,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { HearsayLine } from "@/lib/gemini";
import { DirectorLine } from "@/app/api/director/route";
import { isCacheableSongId } from "@/lib/cache";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { type MediaSegment, resolveActiveSegment, type VideoClipAsset } from "@/lib/media-segments";

interface PerformViewProps {
  results: HearsayLine[];
  directorLines: DirectorLine[];
  directorPhase: "scripting" | "visualizing" | "complete";
  expectedTotalLines: number;
  onShare: () => void;
  onSaveCache: () => void;
  audioUrl?: string;
  currentTime: number;
  isSavingCache: boolean;
  saveSuccess: boolean;
  currentSongId?: string;
  visualsRateLimited?: boolean;
  mediaSegments?: MediaSegment[];
  videoClips?: Record<string, VideoClipAsset>;
}

export default function PerformView({
  results,
  directorLines,
  directorPhase,
  expectedTotalLines,
  onShare,
  onSaveCache,
  audioUrl,
  isSavingCache,
  saveSuccess,
  currentSongId,
  visualsRateLimited = false,
  mediaSegments = [],
  videoClips = {},
}: PerformViewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const progress = expectedTotalLines > 0 ? (directorLines.length / expectedTotalLines) * 100 : 0;
  const hasAudio = Boolean(audioUrl);
  const canSaveCache = isCacheableSongId(currentSongId);
  const playbackProgress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  const activeIndex = useMemo(() => {
    const timed = results
      .map((line, idx) => ({ idx, start: line.startTime }))
      .filter((item): item is { idx: number; start: number } => typeof item.start === "number")
      .sort((a, b) => a.start - b.start);

    if (timed.length === 0) {
      return results.length > 0 ? 0 : -1;
    }

    let active = timed[0].idx;
    for (const item of timed) {
      if (item.start <= currentTime) {
        active = item.idx;
      } else {
        break;
      }
    }
    return active;
  }, [results, currentTime]);

  const activeLine = activeIndex >= 0 ? results[activeIndex] : undefined;
  const previousLine = activeIndex > 0 ? results[activeIndex - 1] : undefined;
  const nextLine = activeIndex >= 0 && activeIndex < results.length - 1 ? results[activeIndex + 1] : undefined;

  const activeDirectorLine = useMemo(() => {
    if (activeIndex < 0) return undefined;
    return directorLines[activeIndex] ?? directorLines.find((line) => line.chinese === activeLine?.chinese);
  }, [directorLines, activeIndex, activeLine?.chinese]);

  const activeSegment = useMemo(
    () => resolveActiveSegment(mediaSegments, currentTime),
    [mediaSegments, currentTime]
  );

  const activeVideoClip = useMemo(() => {
    if (!activeSegment || activeSegment.mediaType !== "video") return undefined;
    return videoClips[activeSegment.id];
  }, [activeSegment, videoClips]);

  const activeVideoSrc = useMemo(() => {
    if (!activeVideoClip || activeVideoClip.status !== "ready") return undefined;
    if (activeVideoClip.videoBase64) {
      return `data:${activeVideoClip.mimeType || "video/mp4"};base64,${activeVideoClip.videoBase64}`;
    }
    return activeVideoClip.videoUri;
  }, [activeVideoClip]);

  const handleTogglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      return;
    }
    void audioRef.current.play();
  }, [isPlaying]);

  const handleSeek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingContext = Boolean(
        target && (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        )
      );

      if (isTypingContext || !hasAudio) return;

      if (event.code === "Space") {
        event.preventDefault();
        handleTogglePlay();
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        handleSeek(Math.max(0, currentTime - 5));
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        handleSeek(Math.min(duration || 0, currentTime + 5));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasAudio, currentTime, duration, handleSeek, handleTogglePlay]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">

      {/* 2. Karaoke Surface: Full Media Backdrop + Synced Lyric Overlay */}
      {results.length > 0 ? (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black min-h-[560px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeVideoSrc ? `video-${activeSegment?.id}` : activeDirectorLine?.chinese || "fallback"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0"
              >
                {activeVideoSrc ? (
                  <video
                    src={activeVideoSrc}
                    autoPlay
                    muted
                    playsInline
                    loop
                    className="h-full w-full object-cover"
                  />
                ) : activeDirectorLine?.imageBase64 ? (
                  <Image
                    src={`data:${activeDirectorLine.imageMimeType || "image/png"};base64,${activeDirectorLine.imageBase64}`}
                    alt="Generated scene"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-black" />
                )}
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.24)_78%)]" />

            {activeSegment?.mediaType === "video" && !activeVideoSrc && (
              <div className="absolute left-4 top-4 z-20 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-white/70">
                Video syncing... using image fallback
              </div>
            )}

            <div className="relative z-10 flex min-h-[560px] flex-col p-6 sm:p-8">
              <div className="mt-auto mx-auto w-full max-w-4xl space-y-3 pb-1">
                {previousLine && (
                  <p
                    className="text-center text-sm text-white/70 drop-shadow-[0_3px_12px_rgba(0,0,0,0.75)]"
                    style={{ textShadow: "0 4px 18px rgba(0, 0, 0, 0.65)" }}
                  >
                    {previousLine.candidates?.[0]?.text}
                  </p>
                )}

                {activeLine && (
                  <div className="text-center px-3 sm:px-4 py-1">
                    <h3
                      className="text-4xl font-display font-bold leading-tight text-white sm:text-5xl"
                      style={{ textShadow: "0 12px 34px rgba(0, 0, 0, 0.9)" }}
                    >
                      {activeLine.candidates?.[0]?.text}
                    </h3>
                    <p className="mt-2 text-xl font-semibold text-white/95 drop-shadow-[0_5px_16px_rgba(0,0,0,0.9)] sm:text-2xl">{activeLine.chinese}</p>
                    <p className="mt-1 text-sm italic text-white/90 drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)]">{activeLine.meaning}</p>
                  </div>
                )}

                {nextLine && (
                  <p
                    className="text-center text-sm text-white/65 drop-shadow-[0_3px_12px_rgba(0,0,0,0.72)]"
                    style={{ textShadow: "0 4px 16px rgba(0, 0, 0, 0.62)" }}
                  >
                    {nextLine.candidates?.[0]?.text}
                  </p>
                )}
              </div>
            </div>

            {!hasAudio && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-black/10 p-3 text-center text-xs text-white/88">
                Add or upload an audio track in Studio to enable synced sing-along playback.
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-black/10 p-3 sm:p-4 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    directorPhase === "complete" ? "bg-primary" : "bg-accent"
                  )} />
                  <p className="truncate text-sm font-medium text-white">KTV Stage</p>
                  <span className="text-xs text-white/60">
                    {directorPhase === "complete" ? "Production Ready" : `Assembling ${directorPhase}...`}
                  </span>
                </div>
                {directorPhase !== "complete" && (
                  <div className="mt-2 h-1 w-36 overflow-hidden rounded-full border border-white/10 bg-black/30 sm:w-48">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onShare}
                  className="p-2.5 bg-white/5 border border-white/10 hover:border-white/30 text-white/70 hover:text-white rounded-full transition-all flex items-center justify-center hover:bg-white/10"
                  title="Copy to Clipboard"
                >
                  <Share2 size={18} />
                </button>
                <button
                  onClick={onSaveCache}
                  disabled={isSavingCache || !canSaveCache}
                  className={cn(
                    "p-2.5 rounded-full border transition-all flex items-center justify-center bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed",
                    saveSuccess ? "text-primary border-primary/50 shadow-[0_0_10px_rgba(244,63,94,0.3)] bg-primary/10" : "border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  )}
                  title={canSaveCache ? "Update Production Cache" : "Cache save available for demo songs"}
                >
                  {isSavingCache ? <Loader2 size={18} className="animate-spin" /> : saveSuccess ? <Check size={18} /> : <Save size={18} />}
                </button>
              </div>
            </div>

            {visualsRateLimited && (
              <p className="mb-3 text-xs text-amber-200/90">Image quota reached: some backgrounds unavailable</p>
            )}

            <div className="mb-4 flex items-center gap-3 sm:gap-4">
              <span className="w-12 text-xs font-mono text-white/90">{formatTime(currentTime)}</span>
              <div className="relative h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/10">
                <div
                  className="pointer-events-none h-full bg-gradient-to-r from-primary via-rose-400 to-accent"
                  style={{ width: `${playbackProgress}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={Math.min(currentTime, duration || 100)}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  disabled={!hasAudio}
                  className="absolute inset-0 h-full w-full opacity-0"
                />
              </div>
              <span className="w-12 text-right text-xs font-mono text-white/90">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-center gap-4 sm:gap-5">
              <button
                onClick={() => handleSeek(0)}
                disabled={!hasAudio}
                className="rounded-full border border-white/10 bg-black/5 p-3 text-white/95 shadow-sm transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                <RotateCcw size={20} />
              </button>
              <button
                onClick={handleTogglePlay}
                disabled={!hasAudio}
                className="rounded-full bg-white px-5 py-3 text-black shadow-[0_0_20px_rgba(255,255,255,0.35)] transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
              <button
                onClick={() => setIsMuted((prev) => !prev)}
                disabled={!hasAudio}
                className="rounded-full border border-white/10 bg-black/5 p-3 text-white/95 shadow-sm transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            muted={isMuted}
            onTimeUpdate={() => {
              if (!audioRef.current) return;
              setCurrentTime(audioRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (!audioRef.current) return;
              setDuration(audioRef.current.duration || 0);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => {
              setIsPlaying(false);
            }}
            onEnded={() => {
              setIsPlaying(false);
            }}
          />
        </div>
      ) : (
        <div className={cn("border border-white/10 bg-black/40 rounded-2xl p-10 text-center") }>
          <Loader2 className="mx-auto mb-4 animate-spin text-primary" size={28} />
          <p className="text-sm text-white/70">Setting the stage and rehearsing scenes...</p>
        </div>
      )}
    </div>
  );
}
