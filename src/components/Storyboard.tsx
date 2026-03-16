"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Film,
  Sparkles,
  Music,
  Palette,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DirectorLine } from "@/app/api/director/route";

interface StoryboardProps {
  lines: DirectorLine[];
  onClose: () => void;
  audioSrc?: string;
  onEnterKaraoke?: () => void;
}

export default function Storyboard({ lines, onClose, audioSrc, onEnterKaraoke }: StoryboardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const activeLines = lines.filter((l) => l.hearsay);
  const currentLine = activeLines[currentIndex];

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying || activeLines.length === 0) {
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
    }, 4000);
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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowRight") goTo(currentIndex + 1);
    if (e.key === "ArrowLeft") goTo(currentIndex - 1);
    if (e.key === " ") {
      e.preventDefault();
      setIsPlaying((p) => !p);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]); // eslint-disable-line

  // Get gradient colors from palette
  const getGradient = (palette?: string[]) => {
    if (!palette || palette.length < 2) return "from-primary/20 to-accent/20";
    return `from-[${palette[0]}]/30 to-[${palette[1]}]/30`;
  };

  const moodEmoji: Record<string, string> = {
    dreamy: "🌙",
    energetic: "⚡",
    romantic: "💕",
    melancholy: "🌧",
    playful: "✨",
  };

  if (!currentLine) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      >
        <p className="text-muted">No storyboard content available</p>
        <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white">
          <X size={32} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black overflow-hidden"
    >
      {/* Background Image with Ken Burns effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {currentLine.imageBase64 ? (
            <img
              src={`data:${currentLine.imageMimeType || "image/png"};base64,${currentLine.imageBase64}`}
              alt={currentLine.visual}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={cn("w-full h-full bg-gradient-to-br", getGradient(currentLine.palette))} />
          )}
          {/* Gradient overlays for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
        </motion.div>
      </AnimatePresence>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 p-3 rounded-full glass border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
      >
        <X size={24} />
      </button>

      {/* Main Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-16">
        {/* Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-8 left-8 flex items-center gap-3"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10">
            <Film size={16} className="text-accent" />
            <span className="text-sm font-display font-bold">KTV Director&apos;s Vision</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-full glass border border-white/10">
            <span>{moodEmoji[currentLine.mood] || "✨"}</span>
            <span className="text-xs uppercase tracking-wider text-muted">{currentLine.mood}</span>
          </div>
        </motion.div>

        {/* Lyrics Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.5 }}
            className="space-y-6 max-w-4xl"
          >
            {/* Chinese + Pinyin */}
            <div className="space-y-1">
              <p className="text-2xl md:text-3xl font-medium text-white/60">{currentLine.chinese}</p>
              <p className="text-sm text-white/40 font-mono">{currentLine.pinyin}</p>
            </div>

            {/* The Hearsay - Hero Text */}
            <div className="relative">
              <Quote className="absolute -left-8 -top-2 text-accent/30" size={32} />
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-black tracking-tight text-white leading-none">
                {currentLine.hearsay}
              </h1>
            </div>

            {/* Visual Description */}
            <div className="flex items-start gap-3 pt-4">
              <Palette size={18} className="text-accent mt-1 flex-shrink-0" />
              <p className="text-lg text-white/70 italic leading-relaxed">{currentLine.visual}</p>
            </div>

            {/* Original Meaning */}
            <p className="text-sm text-white/40 flex items-center gap-2">
              <Music size={14} />
              Original: &ldquo;{currentLine.meaning}&rdquo;
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Bottom Controls */}
        <div className="mt-12 flex items-center justify-between">
          {/* Navigation Dots */}
          <div className="flex items-center gap-2">
            {activeLines.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  idx === currentIndex
                    ? "w-8 bg-accent"
                    : idx < currentIndex
                    ? "bg-white/50"
                    : "bg-white/20"
                )}
              />
            ))}
          </div>

          {/* Play/Pause + Nav */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="p-3 rounded-full glass border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-all"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="p-4 rounded-full bg-accent text-white hover:bg-accent/80 transition-all shadow-lg shadow-accent/30"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
            </button>

            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === activeLines.length - 1}
              className="p-3 rounded-full glass border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Enter Karaoke Button */}
          {onEnterKaraoke && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEnterKaraoke}
              className="flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black font-display font-bold hover:bg-primary hover:text-white transition-all shadow-premium"
            >
              <Sparkles size={20} />
              Enter Karaoke Mode
            </motion.button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / activeLines.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Hidden Audio Element for ambient preview */}
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="metadata" />}
    </motion.div>
  );
}
