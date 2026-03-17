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
  Mic2,
  Sparkles,
} from "lucide-react";
import { HearsayLine } from "@/lib/gemini";
import { DirectorLine } from "@/app/api/director/route";
import { isCacheableSongId } from "@/lib/cache";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  type LineMediaStatus,
  type MediaSegment,
  resolveActiveSegment,
  type VideoClipAsset,
} from "@/lib/media-segments";

const PRE_SHOW_MESSAGES = [
  "Mic check complete. Crowd energy at 100%.",
  "Tonight's mission: sing first, overthink later.",
  "Main character mode unlocked. Hit play when ready.",
];

const START_SCREEN_THRESHOLD_SECONDS = 0.2;

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
  lineMediaStatuses?: Record<number, LineMediaStatus>;
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
  lineMediaStatuses = {},
}: PerformViewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dismissedIntroForKey, setDismissedIntroForKey] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const progress = expectedTotalLines > 0 ? (directorLines.length / expectedTotalLines) * 100 : 0;
  const hasAudio = Boolean(audioUrl);
  const audioSessionKey = audioUrl || "__none__";
  const introDismissed = dismissedIntroForKey === audioSessionKey;
  const canSaveCache = isCacheableSongId(currentSongId);
  const playbackProgress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const isPreShow = hasAudio && !introDismissed && !isPlaying && currentTime <= START_SCREEN_THRESHOLD_SECONDS;

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
  const firstLyric = useMemo(
    () => results.find((line) => line.candidates?.[0]?.text?.trim())?.candidates?.[0]?.text,
    [results]
  );
  const preShowMessage = useMemo(
    () => PRE_SHOW_MESSAGES[results.length % PRE_SHOW_MESSAGES.length],
    [results.length]
  );

  const activeDirectorLine = useMemo(() => {
    if (activeIndex < 0) return undefined;
    return directorLines[activeIndex] ?? directorLines.find((line) => line.chinese === activeLine?.chinese);
  }, [directorLines, activeIndex, activeLine?.chinese]);

  const activeLineMediaStatus = activeIndex >= 0 ? lineMediaStatuses[activeIndex] : undefined;

  const fallbackDirectorLine = useMemo(() => {
    if (directorLines.length === 0) return undefined;
    if (activeDirectorLine?.imageBase64) return activeDirectorLine;

    const hasImage = (line?: DirectorLine) => Boolean(line?.imageBase64);

    if (activeIndex >= 0) {
      for (let offset = 1; offset < directorLines.length; offset++) {
        const leftIndex = activeIndex - offset;
        const rightIndex = activeIndex + offset;

        const left = leftIndex >= 0 ? directorLines[leftIndex] : undefined;
        if (hasImage(left)) return left;

        const right = rightIndex < directorLines.length ? directorLines[rightIndex] : undefined;
        if (hasImage(right)) return right;
      }
    }

    return directorLines.find((line) => hasImage(line));
  }, [activeDirectorLine, activeIndex, directorLines]);

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

  const isUsingNearestImageFallback = Boolean(
    !activeVideoSrc &&
      fallbackDirectorLine?.imageBase64 &&
      activeDirectorLine &&
      fallbackDirectorLine !== activeDirectorLine
  );

  const lineFallbackMessage = useMemo(() => {
    if (isPreShow || !activeSegment) return null;

    if (activeSegment.mediaType === "video") {
      if (activeVideoClip?.status === "failed") {
        return activeVideoClip.error || "Video failed for this section. Showing image fallback.";
      }
      if (!activeVideoSrc) {
        return "Video syncing... using image fallback";
      }
      return null;
    }

    if (activeLineMediaStatus?.status === "image-recovering") {
      return "Generating image for this line...";
    }

    if (activeLineMediaStatus?.status === "image-failed") {
      if (fallbackDirectorLine?.imageBase64) {
        return activeLineMediaStatus.message || "Image failed for this line. Showing nearest generated visual.";
      }
      return activeLineMediaStatus.message || "Image failed for this line. No visual available.";
    }

    if (!activeDirectorLine?.imageBase64 && isUsingNearestImageFallback) {
      return "Using nearest generated visual for this line.";
    }

    return null;
  }, [
    activeDirectorLine,
    activeLineMediaStatus,
    activeSegment,
    activeVideoClip,
    activeVideoSrc,
    fallbackDirectorLine,
    isPreShow,
    isUsingNearestImageFallback,
  ]);

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
    if (time <= START_SCREEN_THRESHOLD_SECONDS) {
      setDismissedIntroForKey(null);
    }
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
                key={activeVideoSrc ? `video-${activeSegment?.id}` : fallbackDirectorLine?.chinese || "fallback"}
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
                ) : fallbackDirectorLine?.imageBase64 ? (
                  <Image
                    src={`data:${fallbackDirectorLine.imageMimeType || "image/png"};base64,${fallbackDirectorLine.imageBase64}`}
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

            <AnimatePresence>
              {isPreShow && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(245,158,11,0.14),transparent_45%),radial-gradient(circle_at_70%_0%,rgba(244,63,94,0.16),transparent_50%)]" />
                  <div className="absolute inset-0 bg-black/42 backdrop-blur-[2px]" />

                  <div className="relative flex h-full items-center justify-center px-5 py-8 sm:px-8">
                    <motion.div
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.08, duration: 0.42 }}
                      className="w-full max-w-2xl rounded-[28px] border border-white/18 bg-black/68 px-6 py-7 text-center shadow-[0_30px_70px_rgba(0,0,0,0.55)] backdrop-blur-md sm:px-8"
                    >
                      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/12 px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-primary/90">
                        <Sparkles size={13} />
                        Pre-Show Hype
                      </div>

                      <h3 className="mt-4 text-3xl font-display font-bold text-white sm:text-4xl">
                        Warm up and start singing
                      </h3>
                      <p className="mt-2 text-sm text-white/85 sm:text-base">{preShowMessage}</p>
                      {firstLyric && (
                        <p className="mt-3 text-base font-semibold text-amber-200/95 sm:text-lg">
                          First line: {firstLyric}
                        </p>
                      )}

                      <div className="mt-6 flex flex-col items-center gap-3">
                        <button
                          onClick={() => {
                            setDismissedIntroForKey(audioSessionKey);
                            handleTogglePlay();
                          }}
                          className="group inline-flex items-center gap-2 rounded-full border border-white/35 bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_12px_28px_rgba(255,255,255,0.24)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Mic2 size={16} />
                          Start Singing
                          <Play size={15} className="translate-x-0 transition-transform group-hover:translate-x-0.5" />
                        </button>
                        <button
                          onClick={() => setDismissedIntroForKey(audioSessionKey)}
                          className="text-xs font-mono uppercase tracking-wider text-white/70 transition-colors hover:text-white"
                        >
                          Just show me the stage
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isPreShow && lineFallbackMessage && (
              <div className="absolute left-4 top-4 z-20 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-white/70">
                {lineFallbackMessage}
              </div>
            )}

            <div className="relative z-10 flex min-h-[560px] flex-col p-6 sm:p-8">
              {!isPreShow && (
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
              )}
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
                {visualsRateLimited && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDiagnostics((prev) => !prev)}
                      className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/45 transition-colors hover:border-white/20 hover:text-white/65"
                    >
                      Dev
                    </button>
                    {showDiagnostics && (
                      <span className="hidden text-[10px] font-mono text-amber-200/70 sm:inline">
                        quota-limited
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

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
            onPlay={() => {
              setIsPlaying(true);
              setDismissedIntroForKey(audioSessionKey);
            }}
            onPause={() => {
              setIsPlaying(false);
            }}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
              setDismissedIntroForKey(null);
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
