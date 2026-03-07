"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Music, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CATALOG_SONGS = [
  { id: "dao-xiang", title: "稻香 (Dao Xiang)", artist: "Jay Chou" },
  { id: "yue-liang", title: "月亮代表我的心", artist: "Teresa Teng" },
];

export default function SongInput({ onGenerate }: { onGenerate: (text: string) => void }) {
  const [mode, setMode] = useState<"catalog" | "paste">("catalog");
  const [pastedText, setPastedText] = useState("");

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="flex p-1 glass rounded-full w-full max-w-sm mx-auto">
        <button
          onClick={() => setMode("catalog")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full transition-standard font-display text-sm",
            mode === "catalog" ? "bg-primary text-white shadow-premium" : "hover:text-primary"
          )}
        >
          <Search size={16} />
          Catalog
        </button>
        <button
          onClick={() => setMode("paste")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full transition-standard font-display text-sm",
            mode === "paste" ? "bg-primary text-white shadow-premium" : "hover:text-primary"
          )}
        >
          <FileText size={16} />
          Paste Lyrics
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === "catalog" ? (
          <motion.div
            key="catalog"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {CATALOG_SONGS.map((song) => (
              <button
                key={song.id}
                onClick={() => onGenerate(song.title)}
                className="glass p-6 rounded-premium text-left hover:border-primary/50 transition-standard group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-standard">
                  <Music size={40} />
                </div>
                <h3 className="text-xl font-display font-bold mb-1">{song.title}</h3>
                <p className="text-muted text-sm">{song.artist}</p>
                <div className="mt-4 flex items-center gap-2 text-primary group-hover:gap-3 transition-standard text-sm font-medium">
                  Select Song <Sparkles size={14} />
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="paste"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="relative">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste Mandarin lyrics here..."
                className="w-full h-48 glass rounded-premium p-6 focus:ring-2 focus:ring-primary/50 outline-none transition-standard resize-none text-lg leading-relaxed"
              />
              <div className="absolute top-4 right-4 text-muted/30">
                <FileText size={32} />
              </div>
            </div>
            <button
              onClick={() => onGenerate(pastedText)}
              disabled={!pastedText.trim()}
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted/20 disabled:text-muted py-4 rounded-full font-display font-bold text-lg shadow-premium transition-standard flex items-center justify-center gap-3 group"
            >
              Generate Hearsay <Sparkles size={20} className="group-hover:rotate-12 transition-standard" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
