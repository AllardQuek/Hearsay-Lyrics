"use client";

import { useState } from "react";
import { Sparkles, Upload, Loader2, PlayCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ExperimentalSync({ 
  lyrics, 
  audioUrl,
  onSyncComplete 
}: { 
  lyrics: string, 
  audioUrl?: string,
  onSyncComplete?: (results: any[]) => void 
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

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
        const data = await response.json();
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
    <div className="glass rounded-[2rem] p-8 mt-12 border border-accent/20 bg-accent/5">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="text-accent" />
        <h3 className="text-2xl font-display font-bold">Auto-Sync Prototype (Experimental)</h3>
      </div>

      <p className="text-muted text-sm mb-8 leading-relaxed">
        <strong>Missing an .LRC file?</strong> Without timing data, your lyrics won&apos;t sync to the music playback. 
        Use this **Gemini 3.1 Pro** tool to &quot;listen&quot; to your audio and automatically generate high-fidelity 
        karaoke timestamps for any song.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-10 hover:border-accent/40 transition-colors bg-white/5">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
            id="audio-upload"
          />
          <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent">
              <Upload size={24} />
            </div>
            <div className="text-center">
              <span className="text-white font-bold block">
                {file ? file.name : "Choose an MP3 file"}
              </span>
              <span className="text-muted text-[10px] uppercase tracking-widest font-black mt-1">
                Max 2 minutes recommended
              </span>
            </div>
          </label>
        </div>

        <button
          onClick={runAutoSync}
          disabled={!file || !lyrics || loading}
          className="w-full bg-accent hover:bg-accent/80 disabled:bg-muted/20 py-4 rounded-full font-display font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)]"
        >
          {loading ? (
            <div className="flex items-center gap-2">
               <Loader2 className="animate-spin" /> Alingning Lyrics...
            </div>
          ) : (
            <>
              Generate AI Timestamps <PlayCircle size={20} />
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
                <div className="flex items-center gap-2 text-green-500 text-sm font-bold">
                  <CheckCircle2 size={16} /> Sync Successful!
                </div>
                <button 
                  onClick={applyResults}
                  className="px-4 py-2 rounded-lg bg-green-500 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-600 transition-colors"
                >
                  Apply to Lyrics
                </button>
              </div>
              <div className="bg-black/40 rounded-xl p-4 font-mono text-[10px] text-accent/80 overflow-auto max-h-40 border border-white/5">
                <pre>{JSON.stringify(results, null, 2)}</pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
