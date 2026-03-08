"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Share2, Github, Layout, Loader2, Mic2, ArrowUp, ChevronDown } from "lucide-react";
import SongInput from "@/components/SongInput";
import LyricSheet from "@/components/LyricSheet";
import LyricVisuals from "@/components/LyricVisuals";
import VideoClip from "@/components/VideoClip";
import AudioPlayer, { AudioPlayerRef } from "@/components/AudioPlayer";
import { HearsayLine } from "@/lib/gemini";
import { formatHearsayForClipboard } from "@/lib/utils";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HearsayLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [funnyWeight, setFunnyWeight] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSongId, setCurrentSongId] = useState<string | undefined>(undefined);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | undefined>(undefined);
  const [showExperimental, setShowExperimental] = useState(false);
  const [showVisuals, setShowVisuals] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [slideCount, setSlideCount] = useState(5);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const resultsHeaderRef = useRef<HTMLDivElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!loading) return;

      // Check if user is near bottom (within 150px)
      const threshold = 150;
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;

      if (!isAtBottom && isAutoScrollEnabled) {
        setIsAutoScrollEnabled(false);
      } else if (isAtBottom && !isAutoScrollEnabled) {
        setIsAutoScrollEnabled(true);
      }

      // Show back to top button after 800px
      setShowBackToTop(window.scrollY > 800);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, isAutoScrollEnabled]);

  // Auto-scroll when results grow
  useEffect(() => {
    if (results.length > 0 && loading && isAutoScrollEnabled) {
      resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
  }, [loading]);

  const handleGenerate = async (text: string, audioUrl?: string, preComputed?: HearsayLine[], songId?: string) => {
    setLoading(true);
    setIsAutoScrollEnabled(true);
    setCurrentTime(0);
    setError(null);
    setResults([]);
    setCurrentSongId(songId);
    setActiveAudioUrl(audioUrl);

    if (preComputed && preComputed.length > 0 && songId !== 'custom-upload') {
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
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, funnyWeight, audioUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Generation failed (Status ${response.status})`);
      }

      if (!response.body) {
        throw new Error("Response body is empty");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");

        // Keep the last part in buffer if it's incomplete
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.trim()) {
            try {
              const chunk: HearsayLine[] = JSON.parse(part);

              // Patch with timestamps if available from LRC
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

  const handleSyncComplete = (syncData: any[]) => {
    setResults(prev => prev.map(line => {
      // Find the matching line
      const matchingSync = syncData.find(s => s.chinese === line.chinese);
      if (matchingSync) {
        return { ...line, startTime: matchingSync.startTime };
      }
      return line;
    }));
    setShowExperimental(false);
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

          {/* Results Area */}
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8 scroll-mt-24"
            >
              <div
                ref={resultsHeaderRef}
                className="flex flex-col md:flex-row items-center justify-between gap-6 pt-12 border-t border-white/5"
              >
                <h2 className="text-3xl md:text-4xl font-display font-bold flex items-center gap-3">
                  <Music className="text-primary" /> The Hearsay Sheet
                </h2>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black font-display font-bold hover:bg-primary hover:text-white transition-all shadow-premium group"
                >
                  <Share2 size={18} className="group-hover:scale-110 transition-transform" />
                  Share Complete Lyrics
                </button>
              </div>

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
                onShowVisuals={(count) => { setSlideCount(count); setShowVisuals(true); }}                  onShowVideo={() => setShowVideo(true)}              />

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
          <p>&copy; 2026 Hearsay Lyrics. Built for Gemini 3 Hackathon Singapore.</p>
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
    </>
  );
}
