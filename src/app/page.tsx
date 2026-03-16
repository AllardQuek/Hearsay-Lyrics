"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Share2, Github, Layout, Loader2, Mic2, ArrowUp, ChevronDown, Film, Wand2, Play, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import SongInput from "@/components/SongInput";
import LyricSheet from "@/components/LyricSheet";
import LyricVisuals from "@/components/LyricVisuals";
import VideoClip from "@/components/VideoClip";
import Storyboard from "@/components/Storyboard";
import DirectorLoading from "@/components/DirectorLoading";
import KaraokeMode from "@/components/KaraokeMode";
import PerformView from "@/components/PerformView";
import AudioPlayer, { AudioPlayerRef } from "@/components/AudioPlayer";
import { HearsayLine } from "@/lib/gemini";
import { DirectorLine } from "@/app/api/director/route";
import { formatHearsayForClipboard } from "@/lib/utils";
import { loadCachedAssets, CachedSongAssets, exportAssetsForCache } from "@/lib/cache";

// Expose cache export helper for development
declare global {
  interface Window {
    __exportCache?: () => string;
  }
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HearsayLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [funnyWeight, setFunnyWeight] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSongId, setCurrentSongId] = useState<string | undefined>(undefined);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | undefined>(undefined);
  const [showVisuals, setShowVisuals] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [showKaraokeMode, setShowKaraokeMode] = useState(false);
  const [slideCount, setSlideCount] = useState(5);
  
  // Compose/Perform tab toggle
  const [activeTab, setActiveTab] = useState<"compose" | "perform">("compose");
  
  // Director mode - unified generation with interleaved output
  const [directorMode, setDirectorMode] = useState(true);
  const [directorLines, setDirectorLines] = useState<DirectorLine[]>([]);
  const [directorPhase, setDirectorPhase] = useState<"scripting" | "visualizing" | "complete">("scripting");
  const [currentDirectorLine, setCurrentDirectorLine] = useState<DirectorLine | undefined>(undefined);
  
  // Cached assets for demo performance
  const [cachedVideoClips, setCachedVideoClips] = useState<{ verseIndex: number; videoBase64: string; mimeType: string }[]>([]);
  
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const resultsHeaderRef = useRef<HTMLDivElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  // Track whether a scroll was triggered by our own code so we don't
  // accidentally disable auto-scroll mid-animation.
  const isProgrammaticScroll = useRef(false);
  // Mirror state in a ref so the scroll handler always reads the latest value
  // without needing to be re-registered every time it changes.
  const isAutoScrollEnabledRef = useRef(true);
  useEffect(() => { isAutoScrollEnabledRef.current = isAutoScrollEnabled; }, [isAutoScrollEnabled]);

  // Development helper: Expose cache export function to window
  useEffect(() => {
    window.__exportCache = () => {
      if (!currentSongId || directorLines.length === 0) {
        console.error("[cache] No song or director lines to export");
        return "";
      }
      const json = exportAssetsForCache(currentSongId, directorLines, cachedVideoClips);
      console.log("[cache] Export ready! Copy this JSON to public/cache/" + currentSongId + ".json");
      return json;
    };
    return () => { delete window.__exportCache; };
  }, [currentSongId, directorLines, cachedVideoClips]);

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const handleScroll = () => {
      // Back-to-top button is independent of loading state
      setShowBackToTop(window.scrollY > 800);

      if (!loading) return;
      // Ignore scrolls that we triggered ourselves
      if (isProgrammaticScroll.current) return;

      // User is near bottom if within 300px — generous to avoid false positives
      const threshold = 300;
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;

      if (!isAtBottom && isAutoScrollEnabledRef.current) {
        setIsAutoScrollEnabled(false);
      } else if (isAtBottom && !isAutoScrollEnabledRef.current) {
        setIsAutoScrollEnabled(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading]); // only re-register when loading changes; refs handle the rest

  // Auto-scroll when results grow
  useEffect(() => {
    if (results.length > 0 && loading && isAutoScrollEnabled) {
      isProgrammaticScroll.current = true;
      resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      // Clear the flag after the smooth-scroll animation has had time to finish
      const t = setTimeout(() => { isProgrammaticScroll.current = false; }, 1000);
      return () => clearTimeout(t);
    }
  }, [results, loading, isAutoScrollEnabled]);

  // When generation finishes, scroll to the top of results for review
  useEffect(() => {
    if (!loading && results.length > 0) {
      // Delay slightly to ensure DOM is ready and any final animations have started
      const timer = setTimeout(() => {
        resultsHeaderRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, results.length]);

  const handleGenerate = async (text: string, audioUrl?: string, preComputed?: HearsayLine[], songId?: string) => {
    setLoading(true);
    setIsAutoScrollEnabled(true);
    setCurrentTime(0);
    setError(null);
    setResults([]);
    setDirectorLines([]);
    setCachedVideoClips([]);
    setCurrentSongId(songId);
    setActiveAudioUrl(audioUrl);
    setDirectorPhase("scripting");
    setCurrentDirectorLine(undefined);
    setActiveTab("compose"); // Start on compose tab

    // Try to load cached assets for catalog songs
    if (songId && songId !== 'custom-upload') {
      const cached = await loadCachedAssets(songId);
      if (cached && cached.directorLines.length > 0) {
        // Use cached director lines (with images)
        setDirectorLines(cached.directorLines);
        setCachedVideoClips(cached.videoClips || []);
        setDirectorPhase("complete");
        
        // Convert director lines to hearsay lines for compatibility
        const hearsayLines: HearsayLine[] = cached.directorLines.map(line => ({
          chinese: line.chinese,
          pinyin: line.pinyin,
          meaning: line.meaning,
          candidates: [{ text: line.hearsay, phonetic: 0.9, humor: 0.9 }],
          startTime: preComputed?.find(p => p.chinese === line.chinese)?.startTime,
        }));
        
        setResults(hearsayLines);
        setLoading(false);
        setIsAutoScrollEnabled(false);
        
        setTimeout(() => {
          resultsHeaderRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return;
      }
    }

    if (preComputed && preComputed.length > 0 && songId !== 'custom-upload' && !directorMode) {
      // Demo Mode: Fast-path for pre-computed catalog songs
      setResults(preComputed);
      setLoading(false);
      setIsAutoScrollEnabled(false);

      // Explicitly scroll to top for catalog songs after state updates
      setTimeout(() => {
        resultsHeaderRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return;
    }

    try {
      if (directorMode) {
        // KTV Director Mode: Unified generation with interleaved text + images
        const response = await fetch("/api/director", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, funnyWeight, generateImages: true }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Director generation failed`);
        }

        if (!response.body) throw new Error("Response body is empty");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const lines: DirectorLine[] = [];
        let hasSeenImage = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (part.trim()) {
              try {
                const line: DirectorLine = JSON.parse(part);
                lines.push(line);
                setDirectorLines([...lines]);
                setCurrentDirectorLine(line);
                
                // Update phase based on content
                if (line.imageBase64 && !hasSeenImage) {
                  hasSeenImage = true;
                  setDirectorPhase("visualizing");
                }

                // Also update results for karaoke mode compatibility
                const hearsayLine: HearsayLine = {
                  chinese: line.chinese,
                  pinyin: line.pinyin,
                  meaning: line.meaning,
                  candidates: [{ text: line.hearsay, phonetic: 0.9, humor: 0.9 }],
                  startTime: preComputed?.find(p => p.chinese === line.chinese)?.startTime,
                };
                setResults((prev) => [...prev, hearsayLine]);
              } catch (err) {
                console.error("Error parsing director line:", err);
              }
            }
          }
        }
        
        setDirectorPhase("complete");
        // Scroll to results header when complete
        setTimeout(() => {
          resultsHeaderRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 500);
        
      } else {
        // Classic mode: Text-only generation
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, funnyWeight, audioUrl }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Generation failed (Status ${response.status})`);
        }

        if (!response.body) throw new Error("Response body is empty");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (part.trim()) {
              try {
                const chunk: HearsayLine[] = JSON.parse(part);
                const patched = chunk.map(line => {
                  const match = preComputed?.find(p => p.chinese === line.chinese);
                  return match ? { ...line, startTime: match.startTime } : line;
                });
                setResults((prev) => [...prev, ...patched]);
              } catch (err) {
                console.error("Error parsing NDJSON chunk:", err);
              }
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (results.length === 0) return;
    const text = formatHearsayForClipboard(results);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Hearsay Lyrics",
          text: text,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert("Full lyrics copied to clipboard!");
    }
  };



  const LOADING_PHRASES = [
    "Mixing next verses...",
    "Vibe-checking syllables...",
    "Translating the energy...",
    "Finding the perfect slang...",
    "Matching the rhythm...",
    "Rhyme-syncing in progress...",
    "Polishing the hearsay...",
  ];

  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading, LOADING_PHRASES.length]);

  return (
    <>
      <main className="min-h-screen relative overflow-x-hidden flex flex-col items-center py-20 px-4 md:px-8">
        {/* Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-accent/10 blur-[120px] rounded-full pointer-events-none opacity-30" />

        {/* Hero Section */}
        <div className="relative z-10 text-center space-y-6 max-w-4xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-accent font-display text-sm font-bold uppercase tracking-wider"
          >
            <Sparkles size={16} />
            <span>Gemini 3.1 Powered</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-black tracking-tighter leading-tight"
          >
            Sing Mandarin in <span className="text-gradient">English</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted text-lg md:text-2xl max-w-3xl mx-auto font-medium leading-relaxed"
          >
            Whether you&apos;re at KTV, singing for fun, or just want to feel like a native speaker, generate singable English &quot;misheard&quot; lyrics that sound exactly like the original.
          </motion.p>
        </div>

        {/* Main Action Area */}
        <div className="w-full max-w-5xl mx-auto relative z-10 space-y-12">
          {/* Vibe Slider */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="max-w-md mx-auto space-y-4"
          >
            <div className="flex justify-between items-end px-2">
              <span className="text-sm font-display font-bold text-muted flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Faithful
              </span>
              <div className="text-center">
                <span className="text-xs uppercase tracking-widest text-muted/50 font-bold">Vibe Control</span>
              </div>
              <span className="text-sm font-display font-bold text-accent flex items-center gap-1.5">
                Hilarious <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              </span>
            </div>
            <div className="relative group">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={funnyWeight}
                onChange={(e) => setFunnyWeight(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </motion.div>

          {/* Director Mode Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="flex justify-center"
          >
            <button
              onClick={() => setDirectorMode(!directorMode)}
              className={`flex items-center gap-3 px-6 py-3 rounded-full border transition-all ${
                directorMode
                  ? "bg-accent/20 border-accent text-accent"
                  : "bg-white/5 border-white/10 text-muted hover:border-white/30"
              }`}
            >
              <Film size={18} />
              <span className="font-display font-bold">KTV Director Mode</span>
              <div className={`w-10 h-5 rounded-full transition-all relative ${
                directorMode ? "bg-accent" : "bg-white/20"
              }`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  directorMode ? "left-5" : "left-0.5"
                }`} />
              </div>
            </button>
          </motion.div>

          {directorMode && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-muted/60 text-sm -mt-4"
            >
              <Sparkles size={14} className="inline mr-1 text-accent" />
              Generates lyrics + AI visuals in one unified stream
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <SongInput onGenerate={handleGenerate} loading={loading} />
          </motion.div>

          {/* Error State */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 glass border-red-500/30 text-red-500 rounded-premium text-center"
            >
              {error}
            </motion.div>
          )}

          {/* Director Loading State */}
          <AnimatePresence>
            {loading && directorMode && directorLines.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <DirectorLoading
                  currentLine={currentDirectorLine}
                  totalLines={directorLines.length + 3}
                  completedLines={directorLines.length}
                  phase={directorPhase}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Area */}
          {results.length > 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8 scroll-mt-24"
            >
              {/* Tab Toggle Header */}
              <div
                ref={resultsHeaderRef}
                className="flex flex-col items-center gap-6 pt-12 border-t border-white/5"
              >
                {/* Compose / Perform Tabs */}
                <div className="flex items-center gap-2 p-1.5 rounded-full glass border border-white/10">
                  <button
                    onClick={() => setActiveTab("compose")}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-full font-display font-bold transition-all",
                      activeTab === "compose" 
                        ? "bg-white text-black shadow-lg" 
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    <Pencil size={18} />
                    Compose
                  </button>
                  <button
                    onClick={() => setActiveTab("perform")}
                    disabled={!results.some(line => line.startTime !== undefined)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-full font-display font-bold transition-all",
                      activeTab === "perform"
                        ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/30"
                        : "text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    )}
                  >
                    <Play size={18} fill="currentColor" />
                    Perform
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  {directorLines.length > 0 && (
                    <button
                      onClick={() => setShowStoryboard(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-accent/30 text-accent text-sm font-display font-bold hover:bg-accent hover:text-white transition-all"
                    >
                      <Film size={16} />
                      Storyboard
                    </button>
                  )}
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-white/20 text-white/70 text-sm font-display font-bold hover:bg-white hover:text-black transition-all"
                  >
                    <Share2 size={16} />
                    Share
                  </button>
                </div>
              </div>

              {/* COMPOSE TAB CONTENT */}
              <AnimatePresence mode="wait">
                {activeTab === "compose" && (
                  <motion.div
                    key="compose"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-8"
                  >
                    {/* Audio Player for Karaoke Sync */}
                    {results.some(line => line.startTime !== undefined) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl mx-auto"
                      >
                        <AudioPlayer
                          ref={audioPlayerRef}
                          onTimeUpdate={setCurrentTime}
                          src={
                            currentSongId === 'love-confession' ? '/audio/love-confession.mp3' :
                              currentSongId === 'dao-xiang' ? '/audio/dao-xiang.mp3' :
                                activeAudioUrl
                          }
                        />
                      </motion.div>
                    )}

                    <LyricSheet
                      lines={results}
                      currentTime={currentTime}
                      onLineClick={(time) => audioPlayerRef.current?.seekTo(time)}
                      onShowVisuals={(count) => { setSlideCount(count); setShowVisuals(true); }}
                      onShowVideo={() => setShowVideo(true)}
                    />
                  </motion.div>
                )}

                {/* PERFORM TAB CONTENT */}
                {activeTab === "perform" && results.some(line => line.startTime !== undefined) && (
                  <motion.div
                    key="perform"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PerformView
                      lines={results}
                      directorLines={directorLines}
                      audioSrc={
                        currentSongId === 'love-confession' ? '/audio/love-confession.mp3' :
                        currentSongId === 'dao-xiang' ? '/audio/dao-xiang.mp3' :
                        activeAudioUrl
                      }
                      preloadedVideos={cachedVideoClips.length > 0 ? cachedVideoClips.map(v => ({ ...v, status: "ready" as const })) : undefined}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* In-Progress Indicator (Sticky at bottom during stream) */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="sticky bottom-8 left-1/2 -translate-x-1/2 z-50 glass px-6 py-4 rounded-full border-primary/30 flex items-center gap-4 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="relative">
                      <Loader2 size={20} className="text-primary animate-spin" />
                      <Mic2 size={10} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-display font-bold">Hearsay Studio Live</span>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={loadingPhraseIndex}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="text-[10px] text-muted/70 uppercase tracking-widest font-black"
                        >
                          {LOADING_PHRASES[loadingPhraseIndex]}
                        </motion.span>
                      </AnimatePresence>
                    </div>

                    {!isAutoScrollEnabled && (
                      <motion.button
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => {
                          setIsAutoScrollEnabled(true);
                          resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="ml-4 px-4 py-2 rounded-full bg-primary text-white text-[10px] font-bold uppercase hover:bg-white hover:text-black transition-all flex items-center gap-2 shadow-lg"
                      >
                        <ChevronDown size={14} /> Resume Sync
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={resultsEndRef} className="h-20" />
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-auto pt-20 pb-10 w-full text-center text-muted/50 text-sm font-medium">
          <div className="flex items-center justify-center gap-6 mb-4">
            <a href="#" className="hover:text-white transition-standard flex items-center gap-1">
              <Github size={16} /> GitHub
            </a>
            <a href="#" className="hover:text-white transition-standard flex items-center gap-1">
              <Layout size={16} /> Portfolio
            </a>
          </div>
          <p>&copy; 2026 Hearsay Lyrics.</p>
        </footer>

        {/* Floating Action Button - Back to Top */}
        <AnimatePresence>
          {showBackToTop && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-8 right-8 z-[60] p-4 rounded-full glass border-white/20 shadow-premium text-primary hover:bg-white hover:text-black transition-standard group"
              title="Back to top"
            >
              <ArrowUp size={24} className="group-hover:-translate-y-1 transition-transform" />
            </motion.button>
          )}
        </AnimatePresence>
      </main>

      {/* LyricVisuals Overlay */}
      <AnimatePresence>
        {showVisuals && results.length > 0 && (
          <LyricVisuals lines={results} maxSlides={slideCount} onClose={() => setShowVisuals(false)} />
        )}
      </AnimatePresence>

      {/* VideoClip Overlay */}
      <AnimatePresence>
        {showVideo && results.length > 0 && (
          <VideoClip lines={results} onClose={() => setShowVideo(false)} />
        )}
      </AnimatePresence>

      {/* Storyboard Overlay (Director Mode) */}
      <AnimatePresence>
        {showStoryboard && directorLines.length > 0 && (
          <Storyboard
            lines={directorLines}
            audioSrc={
              currentSongId === 'love-confession' ? '/audio/love-confession.mp3' :
              currentSongId === 'dao-xiang' ? '/audio/dao-xiang.mp3' :
              activeAudioUrl
            }
            onClose={() => setShowStoryboard(false)}
            onEnterKaraoke={() => {
              setShowStoryboard(false);
              setShowKaraokeMode(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Full Karaoke Mode */}
      <AnimatePresence>
        {showKaraokeMode && results.length > 0 && (
          <KaraokeMode
            lines={results}
            directorLines={directorLines}
            audioSrc={
              currentSongId === 'love-confession' ? '/audio/love-confession.mp3' :
              currentSongId === 'dao-xiang' ? '/audio/dao-xiang.mp3' :
              activeAudioUrl
            }
            onClose={() => setShowKaraokeMode(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
