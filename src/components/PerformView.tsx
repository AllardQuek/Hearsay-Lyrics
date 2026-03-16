"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Image as ImageIcon,
  Film,
  Loader2,
  Sparkles,
} from "lucide-react";
import { HearsayLine } from "@/lib/gemini";
import { DirectorLine } from "@/app/api/director/route";
import { cn } from "@/lib/utils";

// Keywords that suggest a verse should have video instead of image
const MOTION_KEYWORDS = ["fly", "dance", "run", "jump", "spin", "flow", "chase", "race", "fall", "soar", "burst", "explode"];
const HIGH_MOTION_MOODS = ["energetic", "playful"];

interface VideoClip {
  verseIndex: number;
  videoBase64?: string;
  videoUrl?: string;
  mimeType?: string;
  status: "idle" | "generating" | "ready" | "error";
}

interface PerformViewProps {
  lines: HearsayLine[];
  directorLines?: DirectorLine[];
  audioSrc?: string;
  preloadedVideos?: VideoClip[];
}

export default function PerformView({
  lines,
  directorLines,
  audioSrc,
  preloadedVideos,
}: PerformViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showBackdrop, setShowBackdrop] = useState(true);
  const [videoClips, setVideoClips] = useState<VideoClip[]>(preloadedVideos || []);
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
  const directorIndex = directorLines?.findIndex((d) => d.chinese === activeLine?.chinese) ?? -1;

  // Check if current verse should show video
  const currentVideoClip = videoClips.find((v) => v.verseIndex === directorIndex && v.status === "ready");
  const shouldShowVideo = currentVideoClip && showBackdrop;

  // Determine which verses should get video treatment
  const getVideoVerseIndices = useCallback(() => {
    if (!directorLines) return [];
    
    return directorLines
      .map((line, idx) => {
        const isHighMotionMood = HIGH_MOTION_MOODS.includes(line.mood?.toLowerCase() || "");
        const hasMotionKeywords = MOTION_KEYWORDS.some(keyword => 
          line.visual?.toLowerCase().includes(keyword) ||
          line.hearsay?.toLowerCase().includes(keyword)
        );
        return { idx, score: (isHighMotionMood ? 2 : 0) + (hasMotionKeywords ? 1 : 0) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Top 3 most "motion-y" verses
      .map((item) => item.idx);
  }, [directorLines]);

  // Generate videos for high-motion verses
  const generateVideosForVerses = useCallback(async () => {
    const verseIndices = getVideoVerseIndices();
    if (verseIndices.length === 0 || !directorLines) return;

    setIsGeneratingVideos(true);

    // Initialize clips as generating
    setVideoClips(verseIndices.map(idx => ({ verseIndex: idx, status: "generating" })));

    for (const verseIdx of verseIndices) {
      const line = directorLines[verseIdx];
      if (!line) continue;

      try {
        // Call video generation API for this specific verse
        const res = await fetch("/api/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            lines: [{ 
              chinese: line.chinese,
              candidates: [{ text: line.hearsay }],
              meaning: line.meaning,
            }] 
          }),
        });

        if (!res.ok) throw new Error("Video generation failed");
        
        const data = await res.json();
        
        // Poll for completion
        if (data.operationName) {
          let attempts = 0;
          const maxAttempts = 30; // 3 minutes max
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 6000));
            
            const statusRes = await fetch("/api/video/status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operationName: data.operationName }),
            });
            
            const statusData = await statusRes.json();
            
            if (statusData.done) {
              if (statusData.videoBase64) {
                setVideoClips(prev => prev.map(clip => 
                  clip.verseIndex === verseIdx 
                    ? { ...clip, videoBase64: statusData.videoBase64, mimeType: statusData.mimeType, status: "ready" }
                    : clip
                ));
              } else {
                setVideoClips(prev => prev.map(clip => 
                  clip.verseIndex === verseIdx ? { ...clip, status: "error" } : clip
                ));
              }
              break;
            }
            attempts++;
          }
        }
      } catch (err) {
        console.error(`[PerformView] Video generation failed for verse ${verseIdx}:`, err);
        setVideoClips(prev => prev.map(clip => 
          clip.verseIndex === verseIdx ? { ...clip, status: "error" } : clip
        ));
      }
    }

    setIsGeneratingVideos(false);
  }, [directorLines, getVideoVerseIndices]);

  // Auto-generate videos on mount if none preloaded
  useEffect(() => {
    if (!preloadedVideos && directorLines && directorLines.length > 0 && videoClips.length === 0) {
      // Don't auto-generate for now - too expensive. Show indicator instead.
      const verseIndices = getVideoVerseIndices();
      setVideoClips(verseIndices.map(idx => ({ verseIndex: idx, status: "idle" })));
    }
  }, [directorLines, preloadedVideos, getVideoVerseIndices, videoClips.length]);

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

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [isPlaying, currentTime, duration]);

  // Sync video playback with audio
  useEffect(() => {
    if (videoRef.current && shouldShowVideo) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, shouldShowVideo]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-[2rem] overflow-hidden border border-white/10 bg-black min-h-[600px] flex flex-col"
    >
      {/* Background Visuals */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          {showBackdrop && shouldShowVideo && currentVideoClip?.videoBase64 ? (
            <motion.video
              key={`video-${directorIndex}`}
              ref={videoRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              src={`data:${currentVideoClip.mimeType || "video/mp4"};base64,${currentVideoClip.videoBase64}`}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
            />
          ) : showBackdrop && directorLine?.imageBase64 ? (
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

      {/* Video Generation Indicator */}
      {isGeneratingVideos && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full glass border border-accent/30">
          <Loader2 size={16} className="text-accent animate-spin" />
          <span className="text-xs text-accent font-bold">Generating video clips...</span>
        </div>
      )}

      {/* Top Controls */}
      <div className="relative z-10 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
          
          {/* Video indicators */}
          {videoClips.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-full glass border border-white/10">
              <Film size={14} className="text-accent" />
              <span className="text-xs text-muted">
                {videoClips.filter(v => v.status === "ready").length}/{videoClips.length} clips
              </span>
            </div>
          )}
        </div>

        {videoClips.some(v => v.status === "idle") && !isGeneratingVideos && (
          <button
            onClick={generateVideosForVerses}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 border border-accent/30 text-accent text-sm font-bold hover:bg-accent hover:text-white transition-all"
          >
            <Sparkles size={14} />
            Generate Video Clips
          </button>
        )}
      </div>

      {/* Main Lyrics Display */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 relative z-10">
        {/* Previous Line (faded) */}
        <AnimatePresence mode="popLayout">
          {prevLine && (
            <motion.div
              key={`prev-${prevLine.chinese}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 0.3, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center mb-6"
            >
              <p className="text-lg md:text-xl text-white/40">{prevLine.chinese}</p>
              <p className="text-xl md:text-2xl font-display font-bold text-white/30">
                {prevLine.candidates?.[0]?.text}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Line */}
        <AnimatePresence mode="wait">
          {activeLine ? (
            <motion.div
              key={activeLine.chinese}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -30 }}
              transition={{ type: "spring", bounce: 0.3 }}
              className="text-center"
            >
              <p className="text-xl md:text-3xl text-white/80 mb-3">{activeLine.chinese}</p>
              <p className="text-xs text-accent/80 font-mono mb-2">{activeLine.pinyin}</p>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-black text-gradient tracking-tight">
                {activeLine.candidates?.[0]?.text}
              </h1>
              <p className="text-base text-white/50 mt-4 italic">{activeLine.meaning}</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <p className="text-2xl text-white/40 font-display">
                {isPlaying ? "🎵 Music playing..." : "Press play to start"}
              </p>
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
              className="text-center mt-6"
            >
              <p className="text-lg md:text-xl text-white/20">{nextLine.chinese}</p>
              <p className="text-xl md:text-2xl font-display font-bold text-white/15">
                {nextLine.candidates?.[0]?.text}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="relative z-10 p-6">
        <div className="glass rounded-2xl p-5 border border-white/10">
          {/* Progress Bar */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-xs font-mono text-muted w-12">{formatTime(currentTime)}</span>
            <div className="flex-1 relative">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 appearance-none bg-white/10 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
              {/* Visual markers for video verses */}
              {videoClips.filter(v => v.status === "ready").map((clip) => {
                const lineTime = lines[clip.verseIndex]?.startTime;
                if (!lineTime || !duration) return null;
                const position = (lineTime / duration) * 100;
                return (
                  <div
                    key={clip.verseIndex}
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent"
                    style={{ left: `${position}%` }}
                    title="Video verse"
                  />
                );
              })}
            </div>
            <span className="text-xs font-mono text-muted w-12 text-right">{formatTime(duration)}</span>
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
              <RotateCcw size={18} />
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/30 hover:shadow-accent/50 transition-all hover:scale-105"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 rounded-full glass border border-white/10 hover:bg-white/10 transition-all"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
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
    </div>
  );
}
