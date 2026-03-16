"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Film,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { HearsayLine } from "@/lib/gemini";
import { DirectorLine } from "@/app/api/director/route";
import { cn } from "@/lib/utils";

interface KaraokeModeProps {
  lines: HearsayLine[];
  directorLines?: DirectorLine[];
  audioSrc?: string;
  onClose: () => void;
}

export interface KaraokeModeRef {
  play: () => void;
  pause: () => void;
}

const KaraokeMode = forwardRef<KaraokeModeRef, KaraokeModeProps>(
  ({ lines, directorLines, audioSrc, onClose }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showBackdrop, setShowBackdrop] = useState(true);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      play: () => audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
    }));

    // Get active line based on current time
    const activeIndex = lines.reduce((acc, line, idx) => {
      if (line.startTime !== undefined && line.startTime <= currentTime) {
        return idx;
      }
      return acc;
    }, -1);

    const activeLine = lines[activeIndex];
    const prevLine = lines[activeIndex - 1];
    const nextLine = lines[activeIndex + 1];

    // Get corresponding director line for backdrop
    const directorLine = directorLines?.find((d) => d.chinese === activeLine?.chinese);

    // Update image index when active line changes
    useEffect(() => {
      if (directorLines && activeLine) {
        const idx = directorLines.findIndex((d) => d.chinese === activeLine.chinese);
        if (idx !== -1) setCurrentImageIndex(idx);
      }
    }, [activeIndex, activeLine, directorLines]);

    const togglePlay = () => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!isFullscreen) {
        containerRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    };

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Keyboard controls
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === " ") {
          e.preventDefault();
          togglePlay();
        }
        if (e.key === "ArrowLeft" && audioRef.current) {
          audioRef.current.currentTime = Math.max(0, currentTime - 5);
        }
        if (e.key === "ArrowRight" && audioRef.current) {
          audioRef.current.currentTime = Math.min(duration, currentTime + 5);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPlaying, currentTime, duration, onClose]);

    const formatTime = (time: number) => {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col"
      >
        {/* Background Visuals */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            {showBackdrop && directorLine?.imageBase64 ? (
              <motion.img
                key={directorLine.chinese}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 0.6, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.8 }}
                src={`data:${directorLine.imageMimeType || "image/png"};base64,${directorLine.imageBase64}`}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full bg-gradient-to-br from-primary/20 via-black to-accent/20"
              />
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-3 rounded-full glass border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={24} />
        </button>

        {/* Top Controls */}
        <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
          <button
            onClick={() => setShowBackdrop(!showBackdrop)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full glass border transition-all",
              showBackdrop ? "border-accent text-accent" : "border-white/10 text-white/50"
            )}
          >
            <ImageIcon size={16} />
            <span className="text-sm font-bold">Backdrop</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full glass border border-white/10 text-white/50 hover:text-white transition-all"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>

        {/* Main Lyrics Display */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
          {/* Previous Line (faded) */}
          <AnimatePresence mode="popLayout">
            {prevLine && (
              <motion.div
                key={`prev-${prevLine.chinese}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 0.3, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center mb-8"
              >
                <p className="text-xl md:text-2xl text-white/40">{prevLine.chinese}</p>
                <p className="text-2xl md:text-3xl font-display font-bold text-white/30">
                  {prevLine.candidates?.[0]?.text}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Line */}
          <AnimatePresence mode="wait">
            {activeLine && (
              <motion.div
                key={activeLine.chinese}
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -30 }}
                transition={{ type: "spring", bounce: 0.3 }}
                className="text-center"
              >
                <p className="text-2xl md:text-4xl text-white/80 mb-4">{activeLine.chinese}</p>
                <p className="text-sm text-accent/80 font-mono mb-2">{activeLine.pinyin}</p>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-black text-gradient tracking-tight">
                  {activeLine.candidates?.[0]?.text}
                </h1>
                <p className="text-lg text-white/50 mt-4 italic">{activeLine.meaning}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Next Line (faded) */}
          <AnimatePresence mode="popLayout">
            {nextLine && (
              <motion.div
                key={`next-${nextLine.chinese}`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 0.2, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="text-center mt-8"
              >
                <p className="text-xl md:text-2xl text-white/20">{nextLine.chinese}</p>
                <p className="text-2xl md:text-3xl font-display font-bold text-white/15">
                  {nextLine.candidates?.[0]?.text}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Controls */}
        <div className="relative z-10 p-8">
          <div className="max-w-4xl mx-auto glass rounded-2xl p-6 border border-white/10">
            {/* Progress Bar */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm font-mono text-muted">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-2 appearance-none bg-white/10 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <span className="text-sm font-mono text-muted">{formatTime(duration)}</span>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                  }
                }}
                className="p-3 rounded-full glass border border-white/10 hover:bg-white/10 transition-all"
              >
                <RotateCcw size={20} />
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/30 hover:shadow-accent/50 transition-all hover:scale-105"
              >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-3 rounded-full glass border border-white/10 hover:bg-white/10 transition-all"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={audioSrc}
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </motion.div>
    );
  }
);

KaraokeMode.displayName = "KaraokeMode";

export default KaraokeMode;
