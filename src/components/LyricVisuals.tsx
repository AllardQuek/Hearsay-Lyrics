"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Clapperboard, Loader2, Sparkles } from "lucide-react";
import { HearsayLine } from "@/lib/gemini";
import { cn } from "@/lib/utils";

interface ImageState {
  imageBase64: string | null;
  mimeType: string;
  visualPrompt: string | null;
  status: "idle" | "loading" | "done" | "error";
}

interface LyricVisualsProps {
  lines: HearsayLine[];
  onClose: () => void;
}

export default function LyricVisuals({ lines, onClose }: LyricVisualsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState<Record<number, ImageState>>({});
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortedRef = useRef(false);

  // Filter lines with actual hearsay content
  const activeLines = lines.filter((l) => l.candidates?.length > 0);

  const currentLine = activeLines[currentIndex];
  const currentImage = images[currentIndex];

  // Generate image for a given line index
  const generateImage = useCallback(
    async (index: number) => {
      const line = activeLines[index];
      if (!line || images[index]?.status === "done" || images[index]?.status === "loading") return;

      setImages((prev) => ({
        ...prev,
        [index]: { imageBase64: null, mimeType: "image/png", visualPrompt: null, status: "loading" },
      }));

      try {
        const hearsayText = line.candidates[0]?.text || "";
        const res = await fetch("/api/imagine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hearsayText,
            meaning: line.meaning,
            chinese: line.chinese,
          }),
        });

        if (abortedRef.current) return;

        if (!res.ok) throw new Error("Image generation failed");
        const data = await res.json();

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
        console.error("[LyricVisuals] Error generating image for line", index, err);
        setImages((prev) => ({
          ...prev,
          [index]: { imageBase64: null, mimeType: "image/png", visualPrompt: null, status: "error" },
        }));
      }
    },
    [activeLines, images]
  );

  // Prefetch current + next image
  useEffect(() => {
    generateImage(currentIndex);
    if (currentIndex + 1 < activeLines.length) {
      generateImage(currentIndex + 1);
    }
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start generating first image on mount
  useEffect(() => {
    generateImage(0);
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
          className="h-full bg-gradient-to-r from-primary to-accent"
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
              i === currentIndex ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"
            )}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-all backdrop-blur-sm"
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
              {/* Animated gradient background while loading */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-black to-accent/20 animate-pulse" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <Loader2 size={32} className="text-white/60 animate-spin" />
                <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-widest font-bold">
                  <Sparkles size={12} />
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
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-900/30 via-black to-purple-900/30" />
              <p className="relative text-white/40 text-sm">Could not generate image</p>
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
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
        <button
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition-all backdrop-blur-sm"
        >
          <ChevronLeft size={20} />
        </button>

        <span className="text-white/40 text-xs font-bold uppercase tracking-widest tabular-nums">
          {currentIndex + 1} / {activeLines.length}
        </span>

        <button
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === activeLines.length - 1}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition-all backdrop-blur-sm"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Brand watermark */}
      <div className="absolute bottom-5 right-5 flex items-center gap-1.5 text-white/20 text-[10px] font-black uppercase tracking-widest z-20">
        <Clapperboard size={12} />
        Hearsay Visuals
      </div>
    </motion.div>
  );
}
