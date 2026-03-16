"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Film,
  Zap
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DirectorLine } from "@/app/api/director/route";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface StoryboardProps {
  lines: DirectorLine[];
  onClose: () => void;
  audioSrc?: string;
  className?: string;
}

export default function Storyboard({ lines, onClose, audioSrc, className }: StoryboardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Automatic slideshow/playback logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && lines.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % lines.length);
      }, 5000); // 5s per scene fallback
    }
    return () => clearInterval(interval);
  }, [isPlaying, lines.length]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const currentLine = lines[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4 md:p-12 overflow-hidden",
        className
      )}
    >
      {/* 1. Global Scanline & Grain Overlays */}
      
      <div className="absolute inset-0 pointer-events-none z-10 noise opacity-[0.03]" />

      {/* 2. Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 p-8 flex items-center justify-between z-20">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Film size={20} className="text-primary" />
            <h2 className="text-xl font-display font-medium uppercase tracking-widest text-white">Project Premiere</h2>
          </div>
          <span className="text-[10px] font-medium text-white/40 tracking-wider">
            SCENE_{String(currentIndex + 1).padStart(3, '0')} / {String(lines.length).padStart(3, '0')}
          </span>
        </div>
        <button 
          onClick={onClose}
          className="p-3 bg-black/40 border border-white/20 hover:bg-white hover:text-black text-white transition-all rounded-full backdrop-blur-md"
        >
          <X size={24} />
        </button>
      </div>

      {/* 3. Main Stage: Image Projection & Dynamic Subtitles */}
      <div className="relative w-full max-w-7xl aspect-video bg-black rounded-3xl border border-white/10 overflow-hidden group shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ scale: 1.1, opacity: 0, filter: "blur(10px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            exit={{ scale: 0.95, opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 1.2, ease: "circOut" }}
            className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black"
          >
            {currentLine?.imageBase64 ? (
              <div className="relative w-full h-full grayscale opacity-80">
                <Image 
                  src={`data:${currentLine.imageMimeType || "image/png"};base64,${currentLine.imageBase64}`}
                  alt="Vision"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <Zap className="text-primary/10 animate-pulse" size={120} />
            )}
            
            {/* Dark Vignette Overlay */}
            <div className="absolute inset-0 bg-black/40 border-[16px] border-black/50" />
            
            {/* In-Scene Subtitles (Cyber-Trad Cinematic) */}
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="absolute bottom-12 left-12 right-12 text-center"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-mono font-bold text-primary tracking-widest uppercase">
                    {currentLine?.pinyin}
                  </p>
                  <p className="text-2xl font-sans font-bold text-white/80 uppercase">
                    {currentLine?.chinese}
                  </p>
                </div>
                <h1 className="text-5xl md:text-7xl font-display font-bold text-white uppercase tracking-tighter leading-none p-4 bg-black border-4 border-primary inline-block">
                  {currentLine?.hearsay}
                </h1>
                <p className="text-sm font-mono text-white/60 uppercase tracking-widest flex items-center gap-4 bg-black border border-white/20 px-6 py-2 mt-4 inline-flex">
                  {currentLine?.meaning}
                </p>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Playback Controls (Hover visible) */}
        <div className="absolute inset-0 flex items-center justify-between px-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none md:pointer-events-auto">
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev - 1 + lines.length) % lines.length); }}
            className="p-3 bg-black/40 border border-white/20 hover:bg-white hover:border-white hover:text-black pointer-events-auto text-white transition-all rounded-full backdrop-blur-md"
          >
            <SkipBack size={24} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => (prev + 1) % lines.length); }}
            className="p-3 bg-black/40 border border-white/20 hover:bg-white hover:border-white hover:text-black pointer-events-auto text-white transition-all rounded-full backdrop-blur-md"
          >
            <SkipForward size={24} />
          </button>
        </div>
      </div>

      {/* 4. Playback Controller & Progress Bar */}
      <div className="w-full max-w-4xl mt-12 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-12">
          {/* Controls Cluster */}
          <div className="flex items-center gap-6">
            <button 
              onClick={togglePlay}
              className="w-16 h-16 bg-white text-black flex items-center justify-center transition-all hover:bg-primary active:scale-95 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(244,63,94,0.4)]"
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-2" />}
            </button>
            <div className="hidden md:flex flex-col gap-1.5 mt-1">
              <span className="text-xs font-medium text-white/50 tracking-wide">Session Recap</span>
              <div className="flex items-center gap-4 text-white/80">
                <button onClick={() => setIsMuted(!isMuted)} className="hover:text-primary transition-colors">
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <div className="w-20 h-1.5 bg-black/50 overflow-hidden shadow-inner border border-white/5 rounded-full">
                  <div className="h-full bg-white/80 w-2/3 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Timeline / Scrubber */}
          <div className="flex-1 space-y-3">
             <div className="w-full h-2 bg-black/50 overflow-hidden shadow-inner group relative cursor-pointer border border-white/5 rounded-full">
               <div 
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 rounded-full"
                  style={{ width: `${((currentIndex + 1) / lines.length) * 100}%` }}
                />
             </div>
             <div className="flex justify-between font-mono text-[9px] text-white/20 uppercase tracking-[0.2em]">
               <span>Sequence Start</span>
               <span>Scene {currentIndex + 1} Fade Out</span>
             </div>
          </div>
        </div>
        
        {/* Film Strip Preview */}
        <div className="flex gap-3 h-20 overflow-x-auto scrollbar-hide py-2 px-1">
          {lines.map((l, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "flex-shrink-0 w-28 aspect-video rounded-xl transition-all overflow-hidden bg-black/20",
                i === currentIndex ? "ring-2 ring-primary border-transparent opacity-100 scale-105 shadow-[0_5px_15px_rgba(244,63,94,0.3)]" : "border border-white/10 opacity-40 hover:opacity-70"
              )}
            >
              {l.imageBase64 && (
                <div className="relative w-full h-full">
                  <Image 
                    src={`data:${l.imageMimeType};base64,${l.imageBase64}`} 
                    alt="" 
                    fill
                    unoptimized
                    className="object-cover" 
                  />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {audioSrc && (
        <audio 
          ref={audioRef} 
          src={audioSrc} 
          muted={isMuted} 
          onPlay={() => setIsPlaying(true)} 
          onPause={() => setIsPlaying(false)}
        />
      )}
    </motion.div>
  );
}
