"use client";

import { motion } from "framer-motion";
import { Zap, Sparkles, Orbit, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  phase?: "lyric-sync" | "conceptualizing" | "rendering" | "default";
  progress?: number;
  className?: string;
}

const PHASES = {
  "lyric-sync": {
    label: "Synchronizing Linguistic Anchors",
    icon: Sparkles,
    detail: "Calibrating phonetic timings across the spectrum..."
  },
  "conceptualizing": {
    label: "Neural Ideation Mapping",
    icon: Orbit,
    detail: "Synthesizing visual metaphors and semiotic clusters..."
  },
  "rendering": {
    label: "Chromatic Synthesis",
    icon: Cpu,
    detail: "Assembling aesthetic output from latent vectors..."
  },
  "default": {
    label: "Cueing The Studio",
    icon: Zap,
    detail: "Warming up your lyrics and beat alignment..."
  }
};

export default function LoadingState({ phase = "default", progress = 0, className }: LoadingStateProps) {
  const { label, icon: Icon, detail } = PHASES[phase] || PHASES.default;

  return (
    <div className={cn("w-full py-32 flex flex-col items-center justify-center space-y-12", className)}>
      {/* 1. Large Centerpiece Spinner (Cyber Jade) */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Outer Orbit */}
        <motion.div 
           className="absolute inset-0 rounded-full border-[3px] border-primary/20"
           animate={{ rotate: 360 }}
           transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
        {/* Busy Orbit */}
        <motion.div 
           className="absolute inset-0 rounded-full border-t-[3px] border-primary blur-[1px]"
           animate={{ rotate: -360 }}
           transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Icon Core */}
        <div className="relative z-10 p-6 bg-black/60 backdrop-blur-sm rounded-full border border-primary/40 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
           <Icon size={40} className="text-primary animate-pulse drop-shadow-md" />
        </div>
      </div>

      {/* 2. Textual Status with Brutalist Typography */}
      <div className="text-center space-y-4 max-w-md">
        <div className="space-y-1">
          <motion.h3 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-2xl font-semibold tracking-wide text-white"
          >
            {label}
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs font-semibold text-primary/80 uppercase tracking-widest"
          >
            Director Live
          </motion.p>
        </div>
        
        <p className="text-sm text-white/50 leading-relaxed font-medium px-8">
          {detail}
        </p>
      </div>

      {/* 3. Futuristic Progress Gauge */}
      {progress > 0 && (
        <div className="w-full max-w-xs space-y-3 p-5 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl">
          <div className="flex justify-between items-end mb-1">
             <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Transmission Integrity</span>
             <span className="text-sm font-semibold text-primary drop-shadow-md">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full bg-black/50 rounded-full shadow-inner relative overflow-hidden flex border border-white/5">
            <motion.div 
               className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               transition={{ duration: 0.5 }}
            />
            {/* Moving Scanning Light */}
            <motion.div 
               className="absolute top-0 bottom-0 w-8 bg-white/20 blur-sm"
               animate={{ left: ["-20%", "120%"] }}
               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </div>
      )}

      {/* 4. Peripheral Scanlines (Local to component) */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}
