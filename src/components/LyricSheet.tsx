"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Copy, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { HearsayLine } from "@/lib/gemini";

interface LyricLineProps {
  line: HearsayLine;
  index: number;
}

function LyricLineItem({ line, index }: LyricLineProps) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const currentCandidate = line.candidates[variantIndex % line.candidates.length];

  const handleCycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVariantIndex((prev) => prev + 1);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(currentCandidate.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group py-8 px-6 rounded-2xl hover:bg-white/5 transition-all duration-300 cursor-default border border-transparent hover:border-white/10"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12">
        {/* Original Text Reference */}
        <div className="w-full md:w-1/4 space-y-1 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
          <div className="text-sm font-medium text-primary tracking-wide">{line.chinese}</div>
          <div className="text-[10px] uppercase tracking-widest font-bold font-display italic">{line.pinyin}</div>
        </div>

        {/* Main Hearsay Lyric */}
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCandidate.text}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="relative"
            >
              <h3 className="text-3xl md:text-5xl font-display font-black tracking-tight text-white group-hover:text-gradient transition-all duration-500">
                {currentCandidate.text}
              </h3>
              <p className="text-xs text-muted mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Meaning: {line.meaning}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Inline Actions */}
        <div className={cn(
          "flex items-center gap-2 transition-all duration-300",
          isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
        )}>
          <button
            onClick={handleCycle}
            className="p-3 rounded-full glass hover:bg-primary hover:text-white transition-all group/btn"
            title="Try another variant"
          >
            <RefreshCw size={18} className={cn("group-active/btn:rotate-180 transition-transform duration-500")} />
          </button>
          <button
            onClick={handleCopy}
            className="p-3 rounded-full glass hover:bg-white hover:text-black transition-all"
            title="Copy this line"
          >
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Line Number / Subtle Indicator */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-4 opacity-0 group-hover:opacity-20 text-4xl font-black italic select-none pointer-events-none">
        {String(index + 1).padStart(2, '0')}
      </div>
    </motion.div>
  );
}

export default function LyricSheet({ lines }: { lines: HearsayLine[] }) {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-2">
      <div className="glass rounded-[2rem] p-4 md:p-12 shadow-2xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative divide-y divide-white/5">
          {lines.map((line, idx) => (
            <LyricLineItem key={idx} line={line} index={idx} />
          ))}
        </div>

        {/* Bottom utility bar if needed */}
        <div className="mt-12 pt-8 border-t border-white/5 flex justify-center">
            <div className="inline-flex items-center gap-2 text-muted/40 text-xs font-bold uppercase tracking-widest">
                <Sparkles size={12} />
                Hover a line to explore variants
                <Sparkles size={12} />
            </div>
        </div>
      </div>
    </div>
  );
}
