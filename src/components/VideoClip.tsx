"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Film, Loader2, Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { HearsayLine } from "@/lib/gemini";

type ClipStatus = "starting" | "generating" | "done" | "error";

interface VideoClipProps {
  lines: HearsayLine[];
  onClose: () => void;
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

export default function VideoClip({ lines, onClose }: VideoClipProps) {
  const [status, setStatus] = useState<ClipStatus>("starting");
  const [scenePrompt, setScenePrompt] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
          setErrorMsg(data.error);
          return;
        }

        if (data.done) {
          stopPolling();
          if (data.error) {
            setStatus("error");
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
      setErrorMsg(err instanceof Error ? err.message : "Failed to start video generation");
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
      className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden"
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-20">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-accent"
          animate={{ width: status === "done" ? "100%" : `${estimatedProgress}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-all backdrop-blur-sm"
      >
        <X size={20} />
      </button>

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
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-black to-accent/15 animate-pulse pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center gap-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-primary/30 flex items-center justify-center">
                    <Film size={36} className="text-primary/60" />
                  </div>
                  <Loader2
                    size={80}
                    className="absolute inset-0 text-primary/40 animate-spin"
                    style={{ strokeWidth: 1 }}
                  />
                </div>

                <div className="space-y-2">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={phraseIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="text-sm font-display font-bold uppercase tracking-widest text-white/60"
                    >
                      {LOADING_PHRASES[phraseIndex]}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-white/20 text-xs font-mono">
                    {elapsedSeconds}s elapsed · Veo 3 · 8s clip
                  </p>
                </div>

                {scenePrompt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="max-w-md px-5 py-4 rounded-2xl border border-white/10 bg-white/5 text-left"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent/60 mb-2 flex items-center gap-1.5">
                      <Sparkles size={10} /> Director&apos;s Vision
                    </p>
                    <p className="text-white/50 text-sm italic leading-relaxed">&ldquo;{scenePrompt}&rdquo;</p>
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
              className="flex flex-col items-center gap-5 max-w-md text-center"
            >
              <div className="w-16 h-16 rounded-full border border-red-500/30 bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-display font-bold mb-1">Video generation failed</p>
                <p className="text-white/40 text-sm">{errorMsg || "Something went wrong"}</p>
              </div>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-white/10 text-white/70 hover:text-white hover:border-white/30 text-sm font-medium transition-all"
              >
                <RotateCcw size={14} /> Try again
              </button>
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
              <div className="w-full rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(var(--primary-rgb),0.3)] border border-white/10">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="w-full aspect-video bg-black"
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-accent/50 mb-2 flex items-center justify-center gap-1.5">
                    <Sparkles size={10} /> Director&apos;s Vision
                  </p>
                  <p className="text-white/35 text-xs italic leading-relaxed">&ldquo;{scenePrompt}&rdquo;</p>
                </motion.div>
              )}

              {/* Lyric lines used */}
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                {activeLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.07 }}
                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-display"
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
