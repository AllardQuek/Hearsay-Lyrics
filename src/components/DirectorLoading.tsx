"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Film, Sparkles, Music, Palette, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DirectorLine } from "@/app/api/director/route";

interface DirectorLoadingProps {
  currentLine?: DirectorLine;
  totalLines: number;
  completedLines: number;
  phase: "scripting" | "visualizing" | "complete";
}

const DIRECTOR_PHRASES = [
  "KTV Director is scripting your experience...",
  "Translating sounds to singable English...",
  "Visualizing surreal scenes...",
  "Adding cinematic flair...",
  "Preparing your karaoke masterpiece...",
  "Syncing syllables to the rhythm...",
];

export default function DirectorLoading({
  currentLine,
  totalLines,
  completedLines,
  phase,
}: DirectorLoadingProps) {
  const progress = totalLines > 0 ? (completedLines / totalLines) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-primary/5 via-black to-accent/5 p-8 md:p-12"
    >
      {/* Animated Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: ["-20%", "20%", "-20%"],
            y: ["-10%", "10%", "-10%"],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            x: ["20%", "-20%", "20%"],
            y: ["10%", "-10%", "10%"],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent/20 blur-[100px] rounded-full"
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-center gap-3 mb-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          <Film className="text-accent" size={28} />
        </motion.div>
        <h2 className="text-3xl font-display font-black">KTV Director</h2>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="text-primary" size={24} />
        </motion.div>
      </div>

      {/* Current Processing Line */}
      <AnimatePresence mode="wait">
        {currentLine && (
          <motion.div
            key={currentLine.chinese}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 text-center space-y-6 min-h-[200px] flex flex-col justify-center"
          >
            {/* Chinese + Pinyin */}
            <div>
              <p className="text-2xl text-white/80 font-medium">{currentLine.chinese}</p>
              <p className="text-sm text-muted font-mono">{currentLine.pinyin}</p>
            </div>

            {/* The Hearsay */}
            {currentLine.hearsay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-2"
              >
                <p className="text-4xl md:text-5xl font-display font-black text-gradient">
                  &ldquo;{currentLine.hearsay}&rdquo;
                </p>
              </motion.div>
            )}

            {/* Visual Description */}
            {currentLine.visual && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-2 text-muted"
              >
                <Palette size={16} className="text-accent" />
                <p className="text-sm italic">{currentLine.visual}</p>
              </motion.div>
            )}

            {/* Image Preview */}
            {currentLine.imageBase64 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="mx-auto w-48 h-28 rounded-xl overflow-hidden border border-white/20 shadow-2xl"
              >
                <img
                  src={`data:${currentLine.imageMimeType || "image/png"};base64,${currentLine.imageBase64}`}
                  alt="Scene preview"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      <div className="relative z-10 mt-12 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted flex items-center gap-2">
            <Music size={14} />
            {phase === "scripting" && "Writing singable lyrics..."}
            {phase === "visualizing" && "Generating visual scenes..."}
            {phase === "complete" && "Ready!"}
          </span>
          <span className="font-mono text-accent">
            {completedLines}/{totalLines} lines
          </span>
        </div>

        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Phase Indicator */}
        <div className="flex justify-center gap-8 pt-4">
          {[
            { id: "scripting", icon: Wand2, label: "Script" },
            { id: "visualizing", icon: Palette, label: "Visualize" },
            { id: "complete", icon: Sparkles, label: "Complete" },
          ].map((step, idx) => (
            <div
              key={step.id}
              className={cn(
                "flex flex-col items-center gap-2 transition-all",
                phase === step.id ? "text-accent" : "text-muted/30"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border transition-all",
                  phase === step.id
                    ? "border-accent bg-accent/20"
                    : "border-white/10"
                )}
              >
                <step.icon size={18} />
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold">
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
