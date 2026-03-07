"use client";

import { motion } from "framer-motion";
import { RefreshCw, Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Candidate {
  text: string;
  phonetic: number;
  humor: number;
}

interface LyricLine {
  chinese: string;
  pinyin: string;
  meaning: string;
  candidates: Candidate[];
}

export default function LyricCard({ line, index }: { line: LyricLine; index: number }) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentCandidate = line.candidates[variantIndex % line.candidates.length];

  const handleCycle = () => {
    setVariantIndex((prev) => prev + 1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCandidate.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="glass rounded-premium p-8 relative group overflow-hidden"
    >
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h4 className="text-3xl font-display font-bold tracking-tight">{line.chinese}</h4>
          <p className="text-primary/70 font-medium text-sm tracking-wide uppercase italic">{line.pinyin}</p>
        </div>

        <div className="relative">
          <motion.h2 
            key={currentCandidate.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-display font-black text-gradient leading-tight"
          >
            &quot;{currentCandidate.text}&quot;
          </motion.h2>
          <p className="text-muted text-lg mt-2 font-medium">({line.meaning})</p>
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={handleCycle}
            className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-white/10 transition-standard text-xs font-bold uppercase tracking-wider"
          >
            <RefreshCw size={14} className={cn(variantIndex > 0 && "animate-spin-slow")} />
            Try Variant
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-full glass hover:bg-white/10 transition-standard text-xs font-bold uppercase tracking-wider"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 right-0 p-4 opacity-10 pointer-events-none text-8xl font-black italic select-none">
        {index + 1}
      </div>
    </motion.div>
  );
}
