"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Copy, Check, Sparkles, Pencil, Save, X, Send, Loader2, Clapperboard, Video } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { HearsayLine } from "@/lib/gemini";

interface LyricLineProps {
  line: HearsayLine;
  index: number;
  isActive?: boolean;
  onClick?: (time: number) => void;
}

function ActionButton({ 
  onClick, 
  icon: Icon, 
  variant = 'white', 
  title, 
  className 
}: { 
  onClick: (e: React.MouseEvent) => void;
  icon: any;
  variant?: 'white' | 'primary' | 'accent' | 'success';
  title: string;
  className?: string;
}) {
  const variants = {
    white: "hover:bg-white hover:text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]",
    primary: "hover:bg-primary hover:text-white hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]",
    accent: "hover:bg-accent hover:text-white hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.5)]",
    success: "bg-green-500/10 text-green-500 border-green-500/50 hover:bg-green-500 hover:text-white"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      title={title}
      className={cn(
        "p-3 rounded-full glass border border-white/10 transition-all duration-200 group/btn",
        variants[variant],
        className
      )}
    >
      <Icon size={18} className="group-hover/refresh:rotate-180 transition-transform duration-500" />
    </motion.button>
  );
}

function LyricLineItem({ line: initialLine, index, isActive, onClick }: LyricLineProps) {
  const [line, setLine] = useState(initialLine);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive]);
  const [variantIndex, setVariantIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // New states for Refinement and Editing
  const [isEditing, setIsEditing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [refineComment, setRefineComment] = useState("");
  const [loading, setLoading] = useState(false);
  const REFINE_PHRASES = [
    "Refining AI variants based on your feedback...",
    "Re-mixing for better vibes...",
    "Adjusting the flow...",
    "Infusing requested flavor...",
    "Recalibrating syllables...",
  ];

  const [refinePhraseIndex, setRefinePhraseIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setRefinePhraseIndex((prev) => (prev + 1) % REFINE_PHRASES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading, REFINE_PHRASES.length]);

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

  const handleEdit = () => {
    setEditValue(currentCandidate.text);
    setIsEditing(true);
    setIsRefining(false);
  };

  const handleSaveEdit = () => {
    const updatedLine = { ...line };
    // Create a new candidate for the edit or replace current?
    // Let's create a new candidate and put it at the front
    const newCandidate = { text: editValue, phonetic: 1, humor: 1 };
    updatedLine.candidates = [newCandidate, ...updatedLine.candidates];
    setLine(updatedLine);
    setVariantIndex(0);
    setIsEditing(false);
  };

  const handleRefine = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chinese: line.chinese,
          pinyin: line.pinyin,
          currentText: currentCandidate.text,
          comment: refineComment
        }),
      });

      if (!response.ok) throw new Error("Refinement failed");
      const data = await response.json();
      
      const updatedLine = { ...line, candidates: data.candidates };
      setLine(updatedLine);
      setVariantIndex(0);
      setIsRefining(false);
      setRefineComment("");
    } catch (err) {
      console.error(err);
      alert("Failed to refine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => line.startTime !== undefined && onClick?.(line.startTime)}
      className={cn(
        "relative group py-8 px-6 rounded-2xl transition-all duration-300 cursor-pointer border border-transparent",
        isActive ? "bg-white/10 border-white/20 scale-[1.02] shadow-[0_0_40px_rgba(255,255,255,0.05)]" : "hover:bg-white/5 hover:border-white/10"
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-12">
        {/* Original Text Reference */}
        <div className="w-full md:w-1/4 space-y-1 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
          <div className="text-sm font-medium text-primary tracking-wide">{line.chinese}</div>
          <div className="text-[10px] uppercase tracking-widest font-bold font-display italic">{line.pinyin}</div>
        </div>

        {/* Main Hearsay Lyric */}
        <div className="flex-1 relative min-h-[100px] flex items-center">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div
                key="edit-box"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full space-y-3"
              >
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-3xl font-display font-black text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase transition-all hover:scale-105"
                  >
                    <Save size={14} /> Save Edit
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold uppercase transition-all hover:bg-white/20"
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
              </motion.div>
            ) : isRefining ? (
              <motion.div
                key="refine-box"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full space-y-3"
              >
                <div className="relative">
                  <input
                    autoFocus
                    placeholder="E.g. 'make it sound more like a rapper' or 'use the word money'"
                    value={refineComment}
                    onChange={(e) => setRefineComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && handleRefine()}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-lg font-medium text-white focus:outline-none focus:border-accent/50 transition-colors pr-12"
                  />
                  <button
                    onClick={handleRefine}
                    disabled={loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-accent hover:scale-110 transition-transform disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={refinePhraseIndex}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-[10px] text-muted uppercase tracking-widest font-bold"
                    >
                      {loading ? REFINE_PHRASES[refinePhraseIndex] : "Type a hint and press Enter"}
                    </motion.p>
                  </AnimatePresence>
                  <button
                    onClick={() => setIsRefining(false)}
                    className="text-xs text-muted hover:text-white transition-colors flex items-center gap-1"
                  >
                    <X size={12} /> Close
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={currentCandidate.text}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="relative"
              >
                <h3 className={cn(
                  "text-3xl md:text-5xl font-display font-black tracking-tight transition-all duration-500",
                  isActive ? "text-gradient scale-110 origin-left" : "text-white opacity-40 group-hover:opacity-100"
                )}>
                  {currentCandidate.text}
                </h3>
                <p className="text-xs text-muted mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Meaning: {line.meaning}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Inline Actions */}
        <div className={cn(
          "flex items-center gap-2 transition-all duration-300",
          (isHovered || isEditing || isRefining) ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
        )}>
          {!isEditing && !isRefining && (
            <div className="flex items-center gap-2">
              <ActionButton
                onClick={() => setIsRefining(true)}
                icon={Sparkles}
                variant="accent"
                title="Refine with AI (add comment)"
              />
              <ActionButton
                onClick={handleEdit}
                icon={Pencil}
                variant="white"
                title="Edit manually"
              />
              <ActionButton
                onClick={handleCycle}
                icon={RefreshCw}
                variant="primary"
                title="Try another variant"
                className="group/refresh"
              />
              <ActionButton
                onClick={handleCopy}
                icon={copied ? Check : Copy}
                variant={copied ? "success" : "white"}
                title="Copy line"
              />
            </div>
          )}
        </div>
      </div>

      {/* Line Number / Subtle Indicator */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-4 opacity-0 group-hover:opacity-20 text-4xl font-black italic select-none pointer-events-none">
        {String(index + 1).padStart(2, '0')}
      </div>
    </motion.div>
  );
}

export default function LyricSheet({ lines, currentTime = 0, onLineClick, onShowVisuals, onShowVideo }: { lines: HearsayLine[], currentTime?: number, onLineClick?: (time: number) => void, onShowVisuals?: () => void, onShowVideo?: () => void }) {
  // Find the index of the active line: the last line where startTime <= currentTime
  const activeIndex = lines.reduce((acc, line, idx) => {
    if (line.startTime !== undefined && line.startTime <= currentTime) {
      return idx;
    }
    return acc;
  }, -1);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-2">
      <div className="glass rounded-[2rem] p-4 md:p-12 shadow-2xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="relative divide-y divide-white/5">
          {lines.map((line, idx) => (
            <LyricLineItem key={idx} line={line} index={idx} isActive={idx === activeIndex} onClick={onLineClick} />
          ))}
        </div>

        {/* Bottom utility bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 text-muted/40 text-xs font-bold uppercase tracking-widest">
            <Sparkles size={12} />
            Hover a line to explore variants
            <Sparkles size={12} />
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-end">
            {onShowVisuals && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onShowVisuals}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-accent text-white font-display font-bold text-sm shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)] transition-all"
              >
                <Clapperboard size={16} />
                Image Slideshow
              </motion.button>
            )}
            {onShowVideo && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onShowVideo}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-display font-bold text-sm shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all"
              >
                <Video size={16} />
                Video Clip
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
