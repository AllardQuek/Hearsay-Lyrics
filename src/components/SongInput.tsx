import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Sparkles, Upload, FileText, FileJson, X, Globe, Zap, Headphones, Loader2, PlayCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { EXAMPLE_SONGS } from "@/lib/catalog";
import { parseLRC } from "@/lib/sync-utils";

export default function SongInput({ 
  onGenerate, 
  loading 
}: { 
  onGenerate: (text: string, audioUrl?: string, preComputed?: any[], songId?: string) => void,
  loading: boolean
}) {
  const [pastedText, setPastedText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [currentPreComputed, setCurrentPreComputed] = useState<any[] | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  
  // Custom upload states
  const [customAudio, setCustomAudio] = useState<{name: string, url: string} | null>(null);
  const [customLrc, setCustomLrc] = useState<{name: string, content: any[]} | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);

  // AI Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleGenerate = () => {
    const effectiveText = customLrc ? customLrc.content.map(l => l.text).join('\n') : pastedText;
    const effectiveAudio = customAudio?.url || audioUrl;
    const effectiveSync = customLrc?.content || currentPreComputed;
    const effectiveId = (customAudio || customLrc) ? "custom-upload" : selectedId;

    if (effectiveText.trim() && !loading) {
      onGenerate(effectiveText, effectiveAudio, effectiveSync, effectiveId);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomAudio({ name: file.name, url });
      setAudioUrl(""); 
      setSelectedId(undefined); 
    }
  };

  const handleLrcUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      const parsed = parseLRC(text);
      setCustomLrc({ name: file.name, content: parsed });
      setPastedText(parsed.map((l: any) => l.text).join('\n'));
      setSelectedId(undefined); 
      setSyncStatus('idle'); // Reset sync status if manual file uploaded
    }
  };

  const handleAiSync = async () => {
    const effectiveAudioUrl = customAudio?.url || audioUrl;
    if (!pastedText.trim() || !effectiveAudioUrl || isSyncing) return;
    
    setIsSyncing(true);
    setSyncStatus('idle');
    
    try {
      const res = await fetch(effectiveAudioUrl);
      const blob = await res.blob();
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = async () => {
        try {
          const base64Audio = (reader.result as string).split(",")[1];
          
          const response = await fetch("/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lyrics: pastedText, audioData: base64Audio }),
          });

          if (!response.ok) throw new Error("Sync failed");
          const data = await response.json();
          
          setCustomLrc({ name: "✨ AI Synced Timestamps", content: data });
          setSyncStatus('success');
        } catch (err) {
          console.error(err);
          setSyncStatus('error');
        } finally {
          setIsSyncing(false);
        }
      };
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      setIsSyncing(false);
    }
  };

  const loadExample = (id: string) => {
    const example = EXAMPLE_SONGS.find((s) => s.id === id);
    if (example) {
      setPastedText(example.lyrics);
      setAudioUrl(example.audioUrl || "");
      setCurrentPreComputed(example.preComputedLines);
      setSelectedId(id);
      setCustomAudio(null);
      setCustomLrc(null);
    }
  };

  const LOADING_PHRASES = [
    "Mixing Hearsay...",
    "Vibe-checking syllables...",
    "Finding the flow...",
    "Rhyme-syncing...",
    "Translating energy...",
    "Polishing lyrics...",
  ];

  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading, LOADING_PHRASES.length]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-12">
      {/* 1. Catalog Presets */}
      <div className="space-y-4">
        <label className="text-[10px] font-display font-black text-muted/30 uppercase tracking-[0.3em] px-1 flex items-center gap-2">
          <Globe size={12} /> Fast Track
        </label>
        <div className="flex flex-wrap gap-3">
          {EXAMPLE_SONGS.map((song) => (
            <button
              key={song.id}
              onClick={() => loadExample(song.id)}
              className={cn(
                "glass px-5 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 group",
                selectedId === song.id 
                  ? "bg-primary text-white border-primary shadow-[0_0_25px_rgba(var(--primary-rgb),0.4)]" 
                  : "hover:border-white/30 text-muted hover:text-white hover:bg-white/5"
              )}
            >
              <Music size={14} className={cn("transition-colors", selectedId === song.id ? "text-white" : "text-muted group-hover:text-primary")} />
              <span>{song.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {/* 2. Primary Lyrics Input */}
        <div className="space-y-4">
          <label className="text-xs font-display font-bold text-muted flex items-center justify-between px-1">
            <span className="flex items-center gap-2">
              <Zap size={14} className="text-primary" /> 
              Step 1: Paste Mandarin Lyrics
            </span>
            {customLrc && <span className="text-[10px] text-accent uppercase font-black bg-accent/10 px-2 py-0.5 rounded-full">Auto-filled from LRC</span>}
          </label>
          <div className="relative group">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste Chinese characters, pinyin, or mixed text here..."
              className={cn(
                "w-full h-48 glass rounded-[2rem] p-8 focus:ring-2 outline-none transition-all resize-none text-lg leading-relaxed shadow-inner",
                (customLrc || selectedId) ? "border-white/20" : "focus:ring-primary/40 hover:border-white/20"
              )}
            />
            <div className="absolute bottom-6 right-8 text-muted/10 group-hover:text-primary/20 transition-colors">
              <FileText size={32} />
            </div>
          </div>
        </div>

        {/* 3. Optional Karaoke Enhancement */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-3 px-1">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
            <label className="text-[10px] font-display font-black text-muted uppercase tracking-[0.25em] flex items-center gap-2 whitespace-nowrap">
              <Headphones size={12} className="text-accent" /> Optional: Karaoke Power-Ups
            </label>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Audio Block */}
            <div 
              className={cn(
                "p-6 rounded-[1.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 bg-white/5 relative overflow-hidden group min-h-[160px]",
                customAudio || (audioUrl && selectedId) ? "border-primary bg-primary/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.07]"
              )}
            >
              <input type="file" ref={audioInputRef} onChange={handleAudioUpload} accept="audio/*" className="hidden" />
              
              {(customAudio || (audioUrl && selectedId)) ? (
                <div className="text-center w-full px-2 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary mx-auto mb-3 shadow-lg">
                    <Music size={24} />
                  </div>
                  <p className="text-sm font-bold text-white truncate w-full px-2">
                    {customAudio ? customAudio.name : "Catalog Audio Loaded"}
                  </p>
                  <button 
                    onClick={() => { setCustomAudio(null); setAudioUrl(""); setSelectedId(undefined); }}
                    className="mt-3 text-[10px] font-black text-white/40 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1 mx-auto"
                  >
                    <X size={10} /> Replace Audio
                  </button>
                </div>
              ) : (
                <div className="text-center group-hover:scale-105 transition-transform cursor-pointer" onClick={() => audioInputRef.current?.click()}>
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-muted group-hover:bg-primary/20 group-hover:text-primary transition-all mx-auto mb-3">
                    <Upload size={20} />
                  </div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Sync MP3 / WAV</p>
                  <p className="text-[9px] text-muted font-medium mt-1">Unlock audio analysis</p>
                </div>
              )}
            </div>

            {/* LRC / Sync Block */}
            {(() => {
              const hasAudio = !!(customAudio || audioUrl);
              const hasSyncData = !!(customLrc || (currentPreComputed && selectedId));

              return (
                <div
                  className={cn(
                    "rounded-[1.5rem] border-2 border-dashed transition-all bg-white/5 relative overflow-hidden",
                    !hasAudio && "opacity-40 cursor-not-allowed",
                    hasSyncData ? "border-accent bg-accent/5" : hasAudio ? "border-white/20" : "border-white/10"
                  )}
                  title={!hasAudio ? "Upload an audio file first to enable timing sync" : undefined}
                >
                  <input type="file" ref={lrcInputRef} onChange={handleLrcUpload} accept=".lrc" className="hidden" disabled={!hasAudio} />

                  {hasSyncData ? (
                    /* Sync data loaded state */
                    <div className="p-6 flex flex-col items-center justify-center gap-3 min-h-[160px]">
                      <div className="text-center w-full px-2 relative z-10">
                        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent mx-auto mb-3 shadow-lg">
                          <FileJson size={24} />
                        </div>
                        <p className="text-sm font-bold text-white truncate w-full px-2">
                          {customLrc ? customLrc.name : "Timing Data Loaded"}
                        </p>
                        <button
                          onClick={() => { setCustomLrc(null); setCurrentPreComputed(undefined); setSelectedId(undefined); setSyncStatus('idle'); }}
                          className="mt-3 text-[10px] font-black text-white/40 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1 mx-auto"
                        >
                          <X size={10} /> Replace Timing
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Two-option layout: Upload LRC | Magic AI Sync */
                    <div className="grid grid-cols-2 divide-x divide-white/10 min-h-[160px]">
                      {/* Option A: Upload LRC */}
                      <button
                        onClick={() => hasAudio && lrcInputRef.current?.click()}
                        disabled={!hasAudio}
                        className={cn(
                          "p-5 flex flex-col items-center justify-center gap-3 transition-all group/lrc",
                          hasAudio ? "hover:bg-white/5 cursor-pointer" : "cursor-not-allowed"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                          hasAudio ? "bg-white/5 text-muted group-hover/lrc:bg-accent/20 group-hover/lrc:text-accent" : "bg-white/5 text-muted/30"
                        )}>
                          <Upload size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white uppercase tracking-wider">Upload .LRC</p>
                          <p className="text-[9px] text-muted font-medium mt-0.5 italic">Precise timestamps</p>
                        </div>
                      </button>

                      {/* Option B: AI Magic Sync */}
                      <button
                        onClick={handleAiSync}
                        disabled={!hasAudio || isSyncing || !pastedText.trim()}
                        className={cn(
                          "p-5 flex flex-col items-center justify-center gap-3 transition-all group/ai",
                          hasAudio ? "cursor-pointer" : "cursor-not-allowed",
                          syncStatus === 'error' && "bg-red-500/5",
                          hasAudio && syncStatus !== 'error' && "hover:bg-accent/5"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                          !hasAudio ? "bg-white/5 text-muted/30" :
                          syncStatus === 'error' ? "bg-red-500/20 text-red-400" :
                          "bg-accent/10 text-accent group-hover/ai:bg-accent/20"
                        )}>
                          {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        </div>
                        <div>
                          <p className={cn(
                            "text-[10px] font-black uppercase tracking-wider",
                            !hasAudio ? "text-white/30" : syncStatus === 'error' ? "text-red-400" : "text-white"
                          )}>
                            {isSyncing ? "Syncing..." : syncStatus === 'error' ? "Retry Sync" : "Magic AI Sync"}
                          </p>
                          <p className="text-[9px] text-muted font-medium mt-0.5 italic">
                            {isSyncing ? "Gemini is listening..." : "Powered by Gemini 3.1"}
                          </p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Disabled overlay hint */}
                  {!hasAudio && (
                    <div className="absolute bottom-2 inset-x-0 flex justify-center">
                      <p className="text-[8px] text-muted/40 uppercase tracking-widest font-bold">Upload audio first</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!pastedText.trim() || loading}
          className={cn(
            "w-full py-5 rounded-full font-display font-bold text-xl shadow-premium transition-standard flex items-center justify-center gap-3 group min-h-[76px] relative overflow-hidden",
            "bg-primary hover:bg-primary-hover active:scale-[0.98] border-t border-white/20",
            "disabled:bg-muted/10 disabled:text-muted disabled:shadow-none disabled:active:scale-100 disabled:border-transparent"
          )}
        >
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <AnimatePresence mode="wait">
                <motion.span
                  key={loadingPhraseIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  {LOADING_PHRASES[loadingPhraseIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          ) : (
            <>
              <span className="relative z-10 uppercase tracking-[0.1em]">Generate Hearsay Magic</span>
              <Sparkles size={22} className="group-hover:rotate-12 transition-standard relative z-10 text-white" />
              {pastedText.trim() && !loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.15, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-white"
                />
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
