"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Share2, Github, Layout } from "lucide-react";
import SongInput from "@/components/SongInput";
import LyricSheet from "@/components/LyricSheet";
import { HearsayLine } from "@/lib/gemini";
import { formatHearsayForClipboard } from "@/lib/utils";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HearsayLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [funnyWeight, setFunnyWeight] = useState(0.5);

  const handleGenerate = async (text: string, audioUrl?: string) => {
    setLoading(true);
    setError(null);
    setResults([]);

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

      const data = await response.json();
      setResults(data.lines);
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

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col items-center py-20 px-4 md:px-8">
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
          className="text-6xl md:text-8xl font-display font-black tracking-tighter"
        >
          Sing C-Pop in <span className="text-gradient">English</span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted text-xl md:text-2xl max-w-2xl mx-auto font-medium"
        >
          Join your friends at KTV with singable English &quot;misheard&quot; lyrics that sound just like Mandarin.
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
          <SongInput onGenerate={handleGenerate} />
        </motion.div>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 pt-12"
            >
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-xl font-display font-medium text-primary animate-pulse">
                Generating Hearsay Magic...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

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
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
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
            
            <LyricSheet lines={results} />
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
    </main>
  );
}
