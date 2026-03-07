"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Music, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

import { EXAMPLE_SONGS } from "@/lib/catalog";

export default function SongInput({ onGenerate }: { onGenerate: (text: string, audioUrl?: string) => void }) {
  const [pastedText, setPastedText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const handleGenerate = () => {
    if (pastedText.trim()) {
      onGenerate(pastedText, audioUrl);
    }
  };

  const loadExample = (id: string) => {
    const example = EXAMPLE_SONGS.find((s) => s.id === id);
    if (example) {
      setPastedText(example.lyrics);
      setAudioUrl(example.audioUrl || "");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Featured Examples */}
      <div className="space-y-3">
        <label className="text-xs font-display font-bold text-muted/50 uppercase tracking-widest px-1">
          Try an Example
        </label>
        <div className="flex flex-wrap gap-3">
          {EXAMPLE_SONGS.map((song) => (
            <button
              key={song.id}
              onClick={() => loadExample(song.id)}
              className="glass px-4 py-2 rounded-full text-sm font-medium hover:border-primary/50 transition-standard flex items-center gap-2 group"
            >
              <Music size={14} className="group-hover:text-primary transition-colors" />
              <span>{song.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste Mandarin, Pinyin, or mixed lyrics here..."
            className="w-full h-56 glass rounded-premium p-6 focus:ring-2 focus:ring-primary/50 outline-none transition-standard resize-none text-lg leading-relaxed"
          />
          <div className="absolute top-4 right-4 text-muted/30">
            <FileText size={32} />
          </div>
        </div>

        {/* Optional Audio Context */}
        <div className="glass p-6 rounded-premium space-y-3 border-dashed border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-sm font-display font-bold text-muted flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              Add Audio Link (Optional)
            </label>
            <div className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
              Ultra Mode
            </div>
          </div>
          <input
            type="text"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="Paste YouTube Link for rhythm & flow analysis..."
            className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-standard"
          />
          <p className="text-[10px] text-muted/50 px-2 italic">
            *Helps Gemini hear the singer&apos;s cadence and slurring.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!pastedText.trim()}
          className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted/20 disabled:text-muted py-4 rounded-full font-display font-bold text-lg shadow-premium transition-standard flex items-center justify-center gap-3 group"
        >
          Generate Hearsay Magic <Sparkles size={20} className="group-hover:rotate-12 transition-standard" />
        </button>
      </div>
    </div>
  );
}
