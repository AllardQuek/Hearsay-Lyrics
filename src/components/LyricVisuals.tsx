"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Clapperboard, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { HearsayLine } from "@/lib/gemini";
import { cn } from "@/lib/utils";

interface ImageState {
  imageBase64: string | null;
  mimeType: string;
  visualPrompt: string | null;
  status: "idle" | "loading" | "done" | "error";
  errorMessage?: string;
  isRateLimit?: boolean;
}

interface LyricVisualsProps {
  lines: HearsayLine[];
  onClose: () => void;
  maxSlides?: number;
}

export default function LyricVisuals({ lines, onClose, maxSlides }: LyricVisualsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState<Record<number, ImageState>>({});
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortedRef = useRef(false);
  // Track which indices are already in-flight or done to prevent duplicate requests.
  // Using a ref avoids the stale-closure problem with the images state guard.
  // Track which indices have been requested to prevent duplicate fetches (e.g. retry guard).
  const requestedRef = useRef<Set<number>>(new Set());

  // Filter lines with actual hearsay content, limited to maxSlides
  const allActiveLines = lines.filter((l) => l.candidates?.length > 0);
  const activeLines = maxSlides ? allActiveLines.slice(0, maxSlides) : allActiveLines;

  const currentLine = activeLines[currentIndex];
  const currentImage = images[currentIndex];

  // Generate image for a given line index
  const generateImage = useCallback(
    async (index: number) => {
      const line = activeLines[index];
      // Guard: skip if no line or already requested/in-flight/done.
      if (!line || requestedRef.current.has(index)) return;
      requestedRef.current.add(index);

      setImages((prev) => ({
        ...prev,
        [index]: { imageBase64: null, mimeType: "image/png", visualPrompt: null, status: "loading" },
      }));

      try {
        const hearsayText = line.candidates[0]?.text || "";
        const res = await fetch("/api/imagine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hearsayText }),
        });

        if (abortedRef.current) return;

        const data = await res.json();
        if (!res.ok) throw Object.assign(new Error(data.error || "Image generation failed"), { isRateLimit: data.isRateLimit });

        setImages((prev) => ({
          ...prev,
          [index]: {
            imageBase64: data.imageBase64,
            mimeType: data.mimeType || "image/png",
            visualPrompt: data.visualPrompt,
            status: "done",
          },
        }));
      } catch (err) {
        if (abortedRef.current) return;
        // Allow retry on error by removing from the requested set
        requestedRef.current.delete(index);
        console.error("[LyricVisuals] Error generating image for line", index, err);
        const errorMessage = err instanceof Error ? err.message : "Could not generate image";
        const isRateLimit =
          typeof err === "object" &&
          err !== null &&
          "isRateLimit" in err &&
          (err as { isRateLimit?: boolean }).isRateLimit === true;
        setImages((prev) => ({
          ...prev,
          [index]: { imageBase64: null, mimeType: "image/png", visualPrompt: null, status: "error", errorMessage, isRateLimit },
        }));
      }
    },
    [activeLines]
  );

  // On mount, generate all slide images sequentially (one at a time) in order.
  // This avoids parallel requests and 429 rate limits — each image is generated exactly once.
  // The slideshow just displays whatever is ready; user navigation doesn't trigger new requests.
  // Must reset abortedRef to false here so React StrictMode's double-invoke doesn't
  // permanently poison it before the async loop completes.
  useEffect(() => {
    abortedRef.current = false;

    const generateAll = async () => {
      for (let i = 0; i < activeLines.length; i++) {
        if (abortedRef.current) break;
        await generateImage(i);
      }
    };

    generateAll();

    return () => {
      abortedRef.current = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= activeLines.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeLines.length]);

  const goTo = (idx: number) => {
    if (idx >= 0 && idx < activeLines.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentIndex(idx);
      setIsPlaying(true);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(currentIndex + 1);
      if (e.key === "ArrowLeft") goTo(currentIndex - 1);
    },
    [currentIndex, onClose] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isLoading = currentImage?.status === "loading" || !currentImage;
  const hasError = currentImage?.status === "error";
  const imageDataUri =
    currentImage?.status === "done" && currentImage.imageBase64
      ? `data:${currentImage.mimeType};base64,${currentImage.imageBase64}`
      : null;

  const progressPercent = activeLines.length > 1 ? (currentIndex / (activeLines.length - 1)) * 100 : 100;

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
          className="h-full bg-primary"
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Dot indicators */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {activeLines.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={cn(
              "rounded-full transition-all duration-300",
              i === currentIndex ? "w-6 h-1 bg-white" : "w-2 h-1 bg-white/30 hover:bg-white/60"
            )}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 border border-white/10 bg-black/40 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md shadow-sm"
      >
        <X size={20} />
      </button>

      {/* Main image area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key={`loading-${currentIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            >
              {/* Animated background while loading */}
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-none backdrop-blur-sm">
              </div>
              <div className="relative z-10 flex flex-col items-center gap-3 bg-black/40 backdrop-blur-md rounded-2xl shadow-xl border border-primary/20 p-8">
                <Loader2 size={32} className="text-primary animate-spin" />
                <div className="flex items-center gap-2 text-primary/80 text-sm font-medium tracking-wide">
                  <Sparkles size={14} className="text-primary" />
                  Generating visual...
                </div>
              </div>
            </motion.div>
          ) : hasError ? (
            <motion.div
              key={`error-${currentIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-red-900/5 pointer-events-none" />
              <div className="relative flex flex-col items-center gap-4 text-center p-8 rounded-2xl shadow-xl border border-red-500/20 bg-black/60 backdrop-blur-md">
                <p className="text-white/70 text-sm font-medium">
                  {currentImage?.isRateLimit
                    ? "Quota exceeded — wait a moment then retry"
                    : currentImage?.errorMessage || "Could not generate image"}
                </p>
                <button
                  onClick={() => generateImage(currentIndex)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-sm font-medium transition-all shadow-sm"
                >
                  <RotateCcw size={14} /> Retry
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`image-${currentIndex}`}
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUri!}
                alt={currentLine?.candidates[0]?.text || "lyric visual"}
                className="w-full h-full object-cover"
              />
              {/* Cinematic letterbox vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Director's note (visual prompt) */}
        {currentImage?.visualPrompt && (
          <div className="absolute top-12 left-4 z-20 max-w-xs">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[9px] text-white/25 font-mono leading-relaxed italic"
            >
              🎬 {currentImage.visualPrompt}
            </motion.div>
          </div>
        )}
      </div>

      {/* Subtitle overlay */}
      <div className="absolute bottom-0 left-0 right-0 pb-16 px-8 text-center z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          {currentLine && (
            <motion.div
              key={`subtitle-${currentIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="space-y-2"
            >
              {/* Original meaning (small, above) */}
              <p className="text-white/40 text-sm font-medium tracking-wide">
                {currentLine.meaning || currentLine.chinese}
              </p>

              {/* Hearsay text (large, main) */}
              <h2
                className="text-4xl md:text-6xl font-display font-black text-white leading-tight"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.7)" }}
              >
                {currentLine.candidates[0]?.text}
              </h2>

              {/* Chinese original (tiny, below) */}
              <p className="text-primary/60 text-xs font-medium tracking-widest uppercase">
                {currentLine.chinese}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 z-20 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-lg">
        <button
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
        >
          <ChevronLeft size={22} />
        </button>

        <span className="text-white/60 text-sm font-medium tabular-nums min-w-[3rem] text-center">
          {currentIndex + 1} / {activeLines.length}
        </span>

        <button
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === activeLines.length - 1}
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Brand watermark */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 text-white/30 text-xs font-medium tracking-wide z-20 mix-blend-overlay">
        <Clapperboard size={14} className="opacity-70" />
        <span className="opacity-70">Hearsay Visuals</span>
      </div>
    </motion.div>
  );
}
