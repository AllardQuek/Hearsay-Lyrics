"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Film, Loader2, Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { HearsayLine } from "@/lib/gemini";
import { cn } from "@/lib/utils";

type ClipStatus = "starting" | "generating" | "done" | "error";

interface VideoClipProps {
  lines: HearsayLine[];
  onClose?: () => void;
  inline?: boolean;
  className?: string;
}

const LOADING_PHRASES = [
  "Veo 3 is storyboarding...",
  "Rendering your absurd universe...",
  "Lights, camera, AI...",
  "Inflating the bubble balloons...",
  "Adding cinematic color grading...",
  "Choreographing the chaos...",
  "Almost done directing...",
];

function isRateLimitErrorMessage(message: string): boolean {
  return /rate limit|quota|429|resource exhausted|insufficient quota/i.test(message);
}

export default function VideoClip({ lines, onClose, inline = false, className }: VideoClipProps) {
  const [status, setStatus] = useState<ClipStatus>("starting");
  const [scenePrompt, setScenePrompt] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const MAX_POLL_SECONDS = 180; // 3-minute hard timeout

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortedRef = useRef(false);
  const operationNameRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeLines = lines.filter((l) => l.candidates?.length > 0).slice(0, 5);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
  }, []);

  const pollStatus = useCallback(
    async (opName: string) => {
      if (abortedRef.current) return;
      try {
        const res = await fetch("/api/video/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationName: opName }),
        });
        if (abortedRef.current) return;

        const data = await res.json();

        if (data.error && !data.done) {
          stopPolling();
          setStatus("error");
          setIsRateLimited(Boolean(data.isRateLimit) || isRateLimitErrorMessage(String(data.error)));
          setErrorMsg(data.error);
          return;
        }

        if (data.done) {
          stopPolling();
          if (data.error) {
            setStatus("error");
            setIsRateLimited(Boolean(data.isRateLimit) || isRateLimitErrorMessage(String(data.error)));
            setErrorMsg(data.error);
          } else if (data.videoBase64) {
            setVideoSrc(`data:${data.mimeType || "video/mp4"};base64,${data.videoBase64}`);
            setStatus("done");
          } else if (data.videoUri) {
            setVideoSrc(data.videoUri);
            setStatus("done");
          } else {
            setStatus("error");
            setErrorMsg("No video data returned");
          }
        }
      } catch (err) {
        if (abortedRef.current) return;
        console.error("[VideoClip] Poll error:", err);
        // Don't fail on a single poll error — retry on next interval
      }
    },
    [stopPolling]
  );

  const startGeneration = useCallback(async () => {
    if (abortedRef.current) return;
    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: activeLines }),
      });
      if (abortedRef.current) return;

      const data = await res.json();
      if (data.error) {
        setStatus("error");
        setIsRateLimited(Boolean(data.isRateLimit) || isRateLimitErrorMessage(String(data.error)));
        setErrorMsg(data.error);
        return;
      }

      setScenePrompt(data.scenePrompt);
      operationNameRef.current = data.operationName;
      setStatus("generating");

      // Start polling every 6 seconds
      pollTimerRef.current = setInterval(() => pollStatus(data.operationName), 6000);
      // Also poll immediately once after a short delay
      setTimeout(() => pollStatus(data.operationName), 3000);
    } catch (err) {
      if (abortedRef.current) return;
      setStatus("error");
      const message = err instanceof Error ? err.message : "Failed to start video generation";
      setIsRateLimited(isRateLimitErrorMessage(message));
      setErrorMsg(message);
    }
  }, [activeLines, pollStatus]);

  // Kick off generation on mount
  useEffect(() => {
    abortedRef.current = false;
    // Defer to the next tick so generation runs outside the synchronous effect body
    const startTimer = setTimeout(() => void startGeneration(), 0);

    // Elapsed time counter — also enforces max timeout
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_POLL_SECONDS) {
          stopPolling();
          setStatus("error");
          setErrorMsg("Video generation timed out after 3 minutes. Please try again.");
        }
        return next;
      });
    }, 1000);

    // Cycle loading phrases
    const phraseInterval = setInterval(() => {
      setPhraseIndex((p) => (p + 1) % LOADING_PHRASES.length);
    }, 4000);

    return () => {
      clearTimeout(startTimer);
      abortedRef.current = true;
      stopPolling();
      clearInterval(phraseInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard close
  useEffect(() => {
    if (!onClose) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleRetry = () => {
    stopPolling();
    setStatus("starting");
    setScenePrompt(null);
    operationNameRef.current = null;
    setVideoSrc(null);
    setErrorMsg(null);
    setIsRateLimited(false);
    setElapsedSeconds(0);
    setPhraseIndex(0);
    abortedRef.current = false;
    startGeneration();

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  // Estimated progress: assume ~90s total generation time
  const estimatedProgress = Math.min((elapsedSeconds / 90) * 100, 95);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        inline
          ? "relative w-full rounded-2xl border border-white/10 bg-black min-h-[560px] flex flex-col overflow-hidden"
          : "fixed inset-0 z-50 bg-black flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-20">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: status === "done" ? "100%" : `${estimatedProgress}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>

      {/* Close */}
      {!inline && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm rounded-none"
        >
          <X size={20} />
        </button>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <AnimatePresence mode="wait">
          {/* Loading / Generating */}
          {(status === "starting" || status === "generating") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-6 max-w-xl text-center"
            >
              {/* Animated bg */}
              <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none rounded-2xl" />
              
              <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 bg-black/40 backdrop-blur-md border border-primary/30 flex items-center justify-center rounded-2xl shadow-xl animate-[pulse_4s_ease-in-out_infinite]">
                    <div className="">
                      <Film size={36} className="text-primary" />
                    </div>
                  </div>
                  <Loader2
                    size={80}
                    className="absolute inset-0 text-primary/50 animate-spin"
                    style={{ strokeWidth: 1.5 }}
                  />
                </div>

                <div className="space-y-2">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={phraseIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="text-sm font-sans font-bold uppercase tracking-widest text-primary"
                    >
                      {LOADING_PHRASES[phraseIndex]}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-white/40 text-xs font-mono uppercase tracking-widest">
                    {elapsedSeconds}s elapsed · Veo 3 · 8s clip
                  </p>
                </div>

                {scenePrompt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="max-w-md px-6 py-5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-lg text-left"
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary/80 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" /> Director&apos;s Vision
                    </p>
                    <p className="text-white/60 text-sm leading-relaxed">&ldquo;{scenePrompt}&rdquo;</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Error */}
          {status === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 max-w-md text-center p-8 bg-black/40 backdrop-blur-md rounded-3xl border border-red-500/20 shadow-xl"
            >
              <div className="w-16 h-16 rounded-full border border-red-500/50 bg-red-500/10 flex items-center justify-center shadow-inner">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <div>
                <p className="text-white/90 font-medium text-lg mb-2">
                  {isRateLimited ? "Video generation is temporarily unavailable" : "Video generation failed"}
                </p>
                <p className="text-white/50 text-sm">
                  {isRateLimited
                    ? "We have hit the current video quota/rate limit. Please try again later."
                    : errorMsg || "Something went wrong"}
                </p>
              </div>
              {!isRateLimited && (
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-sm font-medium transition-all shadow-sm"
                >
                  <RotateCcw size={16} /> Try again
                </button>
              )}
            </motion.div>
          )}

          {/* Done — Video player */}
          {status === "done" && videoSrc && (
            <motion.div
              key="video"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full max-w-3xl flex flex-col items-center gap-6"
            >
              {/* Video */}
              <div className="w-full bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl p-2 relative overflow-hidden group">
                <div className="absolute top-4 right-4 bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-3 py-1 flex items-center gap-1.5 text-primary text-xs font-medium z-10 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <Film size={12} />
                  <span>Veo 3</span>
                </div>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="w-full aspect-video rounded-2xl bg-black"
                />
              </div>

              {/* Scene prompt */}
              {scenePrompt && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-center max-w-xl"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent/80 mb-2 flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                    <Sparkles size={12} className="text-accent" /> Director&apos;s Vision
                  </p>
                  <p className="text-white/40 text-sm leading-relaxed">&ldquo;{scenePrompt}&rdquo;</p>
                </motion.div>
              )}

              {/* Lyric lines used */}
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mt-4">
                {activeLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.07 }}
                    className="px-4 py-2 rounded-full border border-white/10 bg-black/40 text-white/70 text-sm font-medium backdrop-blur-sm shadow-sm"
                  >
                    {line.candidates[0]?.text}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
