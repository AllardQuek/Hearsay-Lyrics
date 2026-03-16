"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Film, Sparkles, Music, Palette, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DirectorLine } from "@/app/api/director/route";
import Image from "next/image";

interface DirectorLoadingProps {
  currentLine?: DirectorLine;
  totalLines: number;
  completedLines: number;
  phase: "scripting" | "visualizing" | "complete";
}

export default function DirectorLoading({
  currentLine,
  totalLines,
  completedLines,
  phase,
}: DirectorLoadingProps) {
  const progress = totalLines > 0 ? (completedLines / totalLines) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative overflow-hidden bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 p-8 md:p-12 shadow-2xl"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="w-full h-full opacity-30" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(244,63,94,0.15) 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-center gap-4 mb-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="p-3 bg-primary/10 rounded-full border border-primary/20 shadow-inner"
        >
          <Film className="text-primary drop-shadow-md" size={24} />
        </motion.div>
        <h2 className="text-2xl font-bold tracking-wider text-primary drop-shadow-md">KTV Director</h2>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="p-3 bg-primary/10 rounded-full border border-primary/20 shadow-inner"
        >
          <Sparkles className="text-primary drop-shadow-md" size={24} />
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
                className="relative mx-auto w-48 h-28 rounded-xl border border-primary/40 overflow-hidden p-1 bg-black/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] backdrop-blur-sm"
              >
                <div className="absolute top-0 right-0 w-2 h-2 rounded-bl-sm bg-primary border-l border-b border-primary/50 z-10" />
                <Image
                  src={`data:${currentLine.imageMimeType || "image/png"};base64,${currentLine.imageBase64}`}
                  alt="Scene preview"
                  fill
                  unoptimized
                  className="object-cover opacity-80 rounded-lg"
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      <div className="relative z-10 mt-12 space-y-4">
        <div className="flex justify-between text-sm uppercase tracking-widest font-mono font-bold">
          <span className="text-white/60 flex items-center gap-2">
            <Music size={14} className="text-primary"/>
            {phase === "scripting" && "Writing singable lyrics..."}
            {phase === "visualizing" && "Generating visual scenes..."}
            {phase === "complete" && "Ready!"}
          </span>
          <span className="font-mono text-primary">
            {completedLines}/{totalLines} lines
          </span>
        </div>

        <div className="h-2 bg-black/50 rounded-full border border-white/5 shadow-inner overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
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
          ].map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex flex-col items-center gap-2 transition-all",
                phase === step.id ? "text-primary" : "text-white/40"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm border",
                  phase === step.id
                    ? "border-primary/50 text-white bg-primary shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                    : "border-white/10 bg-black/40 backdrop-blur-sm hover:bg-white/5"
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
