"use client";

import { useState } from "react";
import { Sparkles, Upload, Loader2, PlayCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { HearsayLine } from "@/lib/gemini";

type SyncResult = Partial<HearsayLine> & {
  text?: string;
  original?: string;
};

export default function ExperimentalSync({ 
  lyrics, 
  audioUrl,
  onSyncComplete 
}: { 
  lyrics: string, 
  audioUrl?: string,
  onSyncComplete?: (results: SyncResult[]) => void
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SyncResult[] | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const runAutoSync = async () => {
    if (!lyrics) return;
    setLoading(true);

    try {
      let blob: Blob;
      
      if (file) {
        blob = file;
      } else if (audioUrl) {
        const res = await fetch(audioUrl);
        blob = await res.blob();
      } else {
        throw new Error("No audio source provided");
      }

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lyrics, audioData: base64Audio }),
        });

        if (!response.ok) throw new Error("Sync failed");
        const rawData: unknown = await response.json();
        if (!Array.isArray(rawData)) {
          throw new Error("Invalid sync response");
        }
        const data: SyncResult[] = rawData.map((item) => {
          if (!item || typeof item !== "object") {
            return { chinese: "" };
          }
          const line = item as {
            chinese?: string;
            text?: string;
            original?: string;
            startTime?: number;
          };
          return {
            chinese: line.chinese ?? line.text ?? line.original ?? "",
            text: line.text,
            original: line.original,
            startTime: line.startTime,
          };
        });
        setResults(data);
        setLoading(false);
      };
    } catch (err) {
      console.error(err);
      setError("AI Sync failed. This experimental feature requires a valid Gemini Pro 1.5 connection.");
      setLoading(false);
    }
  };

  const applyResults = () => {
    if (results && onSyncComplete) {
      onSyncComplete(results);
    }
  };
  
  const [error, setError] = useState<string | null>(null);

  return (
<div className="bg-black/40 backdrop-blur-md p-8 mt-12 rounded-3xl border border-primary/20 bg-primary/5 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="text-primary" />
        <h3 className="text-xl font-bold tracking-wide text-primary">Auto-Sync Prototype (Experimental)</h3>
      </div>

      <p className="text-white/60 text-sm mb-8 leading-relaxed font-medium">
        <strong>Missing an .LRC file?</strong> Without timing data, your lyrics won&apos;t sync to the music playback.
        Use this <strong className="text-white">Gemini 3.1 Pro</strong> tool to &quot;listen&quot; to your audio and automatically generate high-fidelity
        karaoke timestamps for any song.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-2xl border border-red-500/50 bg-red-500/10 text-red-500 text-sm font-medium shadow-inner">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 p-10 hover:border-primary/50 transition-colors bg-white/5 shadow-inner">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            id="audio-upload"
          />
          <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border border-primary/50 bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <Upload size={24} />
            </div>
            <div className="text-center">
              <span className="text-white/90 font-medium block">
                {file ? file.name : "Choose an MP3 file"}
              </span>
              <span className="text-white/40 text-xs font-semibold uppercase tracking-widest mt-2 block">
                Max 2 minutes recommended
              </span>
            </div>
          </label>
        </div>

        <button
          onClick={runAutoSync}
          disabled={!file || !lyrics || loading}
          className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 text-white rounded-full py-4 text-base font-semibold flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(244,63,94,0.4)] disabled:shadow-none hover:shadow-[0_0_30px_rgba(244,63,94,0.6)]"
        >
          {loading ? (
            <div className="flex items-center gap-2">
               <Loader2 className="animate-spin" /> Aligning Lyrics...
            </div>
          ) : (
            <>
              Generate AI Timestamps <PlayCircle size={22} />
            </>
          )}
        </button>

        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 pt-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-400 text-sm font-semibold uppercase tracking-widest">
                  <CheckCircle2 size={18} /> Sync Successful!
                </div>
                <button 
                  onClick={applyResults}
                  className="px-5 py-2.5 rounded-full border border-green-500/50 bg-green-500/10 text-green-400 hover:text-white text-sm font-medium hover:bg-green-500 transition-colors shadow-sm"
                >
                  Apply to Lyrics
                </button>
              </div>
              <div className="bg-black/60 backdrop-blur-sm rounded-xl p-5 text-xs text-primary/80 overflow-auto max-h-40 border border-white/10 shadow-inner font-mono">
                <pre>{JSON.stringify(results, null, 2)}</pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
