import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Upload, FileText, FileJson, Zap, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { EXAMPLE_SONGS } from "@/lib/catalog";
import { parseLRC } from "@/lib/sync-utils";
import { type HearsayLine } from "@/lib/gemini";
import { isCacheableSongId, type CacheMode } from "@/lib/cache";

type SyncLine = Partial<HearsayLine> & {
  text?: string;
  original?: string;
};

function getSyncLineText(line: SyncLine): string {
  return line.chinese || line.original || line.text || "";
}

const LOADING_STAGES = [
  "Scouting locations...",
  "Casting voices...",
  "Setting the stage...",
  "Rehearsing lines...",
  "Lights, camera, hearsay...",
  "Assembling final cut...",
];

export default function SongInput({
  onGenerate,
  loading,
  generateMedia,
  onToggleMedia,
}: {
  onGenerate: (text: string, audioUrl?: string, preComputed?: SyncLine[], songId?: string, cacheMode?: CacheMode, funnyWeight?: number) => void,
  loading: boolean
  generateMedia: boolean
  onToggleMedia: (v: boolean) => void
}) {
  const [pastedText, setPastedText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [currentPreComputed, setCurrentPreComputed] = useState<SyncLine[] | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [processingMode, setProcessingMode] = useState<"line" | "full">("full");
  const [preferCache, setPreferCache] = useState(true);
  const [funnyWeight, setFunnyWeight] = useState(0.5);
  
  const [loadingStageIdx, setLoadingStageIdx] = useState(0);

  useEffect(() => {
    if (!loading) {
      setLoadingStageIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStageIdx((prev) => (prev + 1) % LOADING_STAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);
  
  // Custom upload states
  const [customAudio, setCustomAudio] = useState<{name: string, url: string} | null>(null);
  const [customLrc, setCustomLrc] = useState<{name: string, content: SyncLine[]} | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);

  // AI Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleGenerate = () => {
    let effectiveText = customLrc ? customLrc.content.map(getSyncLineText).join('\n') : pastedText;
    
    // Quick testing: If "line" mode, only process the first non-empty line
    if (processingMode === "line") {
      const lines = effectiveText.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        effectiveText = lines[0];
      }
    }

    const effectiveAudio = customAudio?.url || audioUrl;
    const effectiveSync = customLrc?.content || currentPreComputed;
    const effectiveId = (customAudio || customLrc) ? "custom-upload" : selectedId;
    const effectiveCacheMode: CacheMode = isCacheableSongId(effectiveId)
      ? (preferCache ? "prefer-cache" : "bypass-cache")
      : "bypass-cache";

    if (effectiveText.trim() && !loading) {
      onGenerate(effectiveText, effectiveAudio, effectiveSync, effectiveId, effectiveCacheMode, funnyWeight);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomAudio({ name: file.name, url });
      setAudioUrl(""); 
      setSelectedId(undefined);
      setPreferCache(false);
    }
  };

  const handleLrcUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      const parsed: SyncLine[] = parseLRC(text).map((line) => ({
        chinese: line.text,
        text: line.text,
        startTime: line.startTime,
      }));
      setCustomLrc({ name: file.name, content: parsed });
      setPastedText(parsed.map(getSyncLineText).join('\n'));
      setSelectedId(undefined); 
      setPreferCache(false);
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
          const rawData: unknown = await response.json();
          if (!Array.isArray(rawData)) {
            throw new Error("Invalid sync response");
          }
          const data: SyncLine[] = rawData.map((item) => {
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
      setPreferCache(isCacheableSongId(id));
      setCustomAudio(null);
      setCustomLrc(null);
    }
  };

  const PRIMARY_ACTION_LABEL = "Direct\u00A0\u00A0MV";
  const isCacheControlEnabled = isCacheableSongId(selectedId);

  return (
    <div className="w-full space-y-14 py-4 lg:space-y-16">
      {/* 1. Catalog Presets - Premium Style */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-display font-medium text-white/10 leading-none select-none tracking-tight">01</span>
            <label className="text-sm font-medium text-white/80 tracking-wide mb-1">
              Hit Singles
            </label>
          </div>
          <p className="text-xs font-light text-white/40 leading-relaxed pl-12">
            Pick a fan favorite to instantly load up the lyrics and audio.
          </p>
        </div>
        
        <div className="lg:col-span-9 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EXAMPLE_SONGS.map((song) => (
            <button
              key={song.id}
              onClick={() => loadExample(song.id)}
              className={cn(
                "group relative overflow-hidden p-5 rounded-2xl border transition-all text-left glass shadow-sm",
                selectedId === song.id 
                  ? "bg-primary/10 border-primary/50 text-white shadow-primary/20" 
                  : "border-white/10 hover:border-white/30 text-white/60 hover:text-white bg-black/40 hover:bg-black/60"
              )}
            >
              <div className="relative z-10 flex flex-col h-full gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-full transition-colors",
                    selectedId === song.id ? "bg-primary text-white" : "bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white"
                  )}>
                    <Music size={14} />
                  </div>
                  <span className="text-sm font-medium tracking-wide block truncate">{song.title}</span>
                </div>
              </div>
              {selectedId === song.id && (
                <motion.div 
                  layoutId="catalog-glow"
                  className="absolute inset-0 bg-primary/10 blur-xl group-hover:blur-2xl transition-all"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-10 lg:space-y-12">
        {/* 2. Primary Lyrics Input - Cyber-Trad Typography */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-end gap-3">
              <span className="text-4xl font-display font-medium text-white/10 leading-none select-none tracking-tight">02</span>
              <label className="text-sm font-medium text-white/80 tracking-wide mb-1">
                Mandarin Core
              </label>
            </div>
            
            <div className="pl-12 space-y-3">
              <p className="text-xs font-light text-white/40 leading-relaxed">
                Raw linguistic data. Characters or Pinyin accepted.
              </p>
              
              <div className="flex bg-black/40 p-1 rounded-full border border-white/10 w-fit glass shadow-sm">
                <button 
                  onClick={() => setProcessingMode("full")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                    processingMode === "full" ? "bg-primary text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                >
                  Full Song
                </button>
                <button 
                  onClick={() => setProcessingMode("line")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                    processingMode === "line" ? "bg-primary/20 text-primary shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                >
                  Single Line
                </button>
              </div>
            </div>
            
            {customLrc && (
              <div className="pl-12 pt-2">
                <span className="text-[10px] text-primary font-mono border border-primary/20 px-3 py-1 bg-primary/5 rounded-full block w-fit">
                  LRC_SYNC_ACTIVE
                </span>
              </div>
            )}
          </div>

          <div className="lg:col-span-9 relative group">
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste Chinese lyrics here..."
              className={cn(
                "w-full h-72 sm:h-80 bg-black/40 border border-white/10 p-6 sm:p-8 outline-none transition-all resize-none text-lg rounded-2xl glass shadow-inner font-sans placeholder:text-white/20 whitespace-pre-wrap leading-relaxed",
                (customLrc || selectedId) ? "border-primary/50 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]" : "hover:border-primary/30 focus:border-primary/50"
              )}
            />
            
            <div className="absolute top-8 right-8 text-white/5 opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none">
              <FileText size={48} strokeWidth={1} />
            </div>
          </div>
        </div>

        {/* 3. Multimedia Uplink - Premium Style */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-end gap-3">
              <span className="text-4xl font-display font-medium text-white/10 leading-none select-none tracking-tight">03</span>
              <label className="text-sm font-medium text-white/80 tracking-wide mb-1">
                Media & Sync
              </label>
            </div>
            <p className="text-xs font-light text-white/40 leading-relaxed pl-12">
              Connect auditory payloads and temporal markers.
            </p>
          </div>

          <div className="lg:col-span-9 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <div className="space-y-4">
              <label className="text-xs font-medium text-white/60 block">Backing Track</label>
              <div className="space-y-3">
                <input
                  type="text"
                  value={audioUrl}
                  onChange={(e) => {
                    setAudioUrl(e.target.value);
                    setCustomAudio(null);
                    setSelectedId(undefined);
                  }}
                  placeholder="Paste URL..."
                  className={cn(
                    "w-full bg-black/40 px-5 py-4 text-sm border border-white/10 focus:border-primary/50 outline-none rounded-2xl transition-all shadow-inner placeholder:text-white/20",
                    (selectedId && audioUrl) && "border-primary/40 text-primary shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]"
                  )}
                />
                
                <button 
                  onClick={() => audioInputRef.current?.click()}
                  className={cn(
                    "w-full py-4 border border-dashed rounded-2xl transition-all flex items-center justify-center gap-3 group bg-black/20",
                    (customAudio || (selectedId && audioUrl))
                      ? "border-primary/40 bg-primary/5 text-primary shadow-sm" 
                      : "border-white/10 hover:border-white/30 text-white/60 hover:text-white"
                  )}
                >
                  {(customAudio || (selectedId && audioUrl)) ? <CheckCircle2 size={18} /> : <Upload size={18} className="group-hover:-translate-y-1 transition-transform" />}
                  <span className="text-sm font-medium">
                    {customAudio ? customAudio.name : (selectedId && audioUrl) ? "Demo Audio Attached" : "Upload Local File"}
                  </span>
                  <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-medium text-white/60 block">Lyric Timing (LRC)</label>
              <div className="grid grid-cols-2 gap-3 h-[116px]">
                <button
                  onClick={handleAiSync}
                  disabled={isSyncing || !pastedText.trim() || !(customAudio?.url || audioUrl)}
                  className={cn(
                    "h-full bg-black/40 border border-white/10 hover:border-white/30 hover:bg-black/60 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all overflow-hidden relative group shadow-sm",
                    (syncStatus === 'success' || (selectedId && currentPreComputed)) && "border-primary/50 text-white bg-primary/10 shadow-[inner_0_0_20px_rgba(244,63,94,0.1)]",
                    (isSyncing || !pastedText.trim() || !(customAudio?.url || audioUrl)) && "opacity-50 pointer-events-none"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-full mb-1 transition-colors",
                    (syncStatus === 'success' || (selectedId && currentPreComputed)) ? "bg-primary text-white" : "bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white"
                  )}>
                    {isSyncing ? <Loader2 size={20} className="animate-spin" /> : 
                    (syncStatus === 'success' || (selectedId && currentPreComputed)) ? <CheckCircle2 size={20} /> : <Zap size={20} className="group-hover:scale-110 transition-transform" />}
                  </div>
                  <span className="text-xs font-medium text-center">
                    {(selectedId && currentPreComputed) ? "Demo Sync" : syncStatus === 'success' ? "AI Sync Done" : "AI Sync"}
                  </span>
                  {syncStatus === 'success' && <div className="absolute top-0 right-0 w-12 h-12 bg-primary/20 blur-xl" />}
                </button>
                
                <button
                  onClick={() => lrcInputRef.current?.click()}
                  className={cn(
                    "h-full bg-black/40 border border-white/10 hover:border-white/30 hover:bg-black/60 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group shadow-sm",
                    customLrc && "border-primary/50 text-white bg-primary/10"
                  )}
                >
                   <div className={cn(
                    "p-3 rounded-full mb-1 transition-colors",
                    customLrc ? "bg-primary text-white" : "bg-white/5 text-white/60 group-hover:bg-white/10 group-hover:text-white"
                  )}>
                    {customLrc ? <CheckCircle2 size={20} /> : <FileJson size={20} className="group-hover:scale-110 transition-transform" />}
                  </div>
                  <span className="text-xs font-medium text-center">{customLrc ? "LRC Uploaded" : "Manual LRC"}</span>
                  <input ref={lrcInputRef} type="file" accept=".lrc" onChange={handleLrcUpload} className="hidden" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Compact controls: Creative bias + Cache toggle (same row) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3" />
          <div className="lg:col-span-9 flex flex-col items-center">
            <div className="w-full max-w-[960px]">
              <div className="flex items-center justify-between gap-4 w-full">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 px-3 py-2 bg-transparent">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-white/70">Creative bias</div>
                      <div className="text-[11px] text-white/70 w-[44px] text-right">{Math.round(funnyWeight * 100)}%</div>
                    </div>
                    <div className="flex items-center gap-3 w-full max-w-[360px]">
                      <span className="text-[11px] text-white/40">Faithful</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={funnyWeight}
                        onChange={(e) => setFunnyWeight(parseFloat(e.target.value))}
                        aria-label="Creative bias: Faithful to Funny"
                        className="flex-1 h-1 bg-white/5 rounded-lg accent-primary"
                      />
                      <span className="text-[11px] text-white/40">Funny</span>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-full border px-3 py-2",
                      isCacheControlEnabled ? "border-white/15 bg-white/[0.02]" : "border-white/10 bg-transparent"
                    )}
                  >
                    <p className={cn("text-sm font-medium m-0", isCacheControlEnabled ? "text-white" : "text-white/45")}>Use cache</p>
                    <button
                      onClick={() => setPreferCache((prev) => !prev)}
                      disabled={!isCacheControlEnabled}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-50",
                        preferCache
                          ? "border-primary/50 bg-primary/30"
                          : "border-white/20 bg-white/10"
                      )}
                      aria-label="Toggle cache preference"
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                          preferCache ? "translate-x-5" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Full-width centered CTA (not part of steps) */}
      <div className="w-full flex flex-col items-center">
        <div className="w-full flex justify-center mt-6">
          <button
            onClick={handleGenerate}
            disabled={loading || !pastedText.trim()}
            className={cn(
              "group relative isolate w-full max-w-[400px] h-[72px] overflow-hidden rounded-2xl transition-all duration-500",
              loading
                ? "bg-zinc-900 border border-white/5 cursor-wait"
                : "bg-primary hover:brightness-110 active:scale-[0.98] cursor-pointer shadow-[0_20px_50px_-15px_rgba(244,63,94,0.5)] hover:shadow-[0_25px_60px_-10px_rgba(244,63,94,0.7)]"
            )}
            aria-label="Direct hearsay media"
          >
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
            <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
            <div className="relative z-10 flex items-center justify-center gap-4 px-8">
              {loading ? (
                <div className="flex items-center gap-4 w-full justify-center">
                  <div className="relative flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-white opacity-80" />
                    <div className="absolute inset-0 bg-white/20 blur-md rounded-full animate-pulse" />
                  </div>
                  <div className="h-6 overflow-hidden relative w-48">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={loadingStageIdx}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.5, ease: "circOut" }}
                        className="absolute inset-0 font-display text-base font-bold tracking-wide uppercase text-white/90 whitespace-nowrap"
                      >
                        {LOADING_STAGES[loadingStageIdx]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative flex items-center justify-center">
                    <Zap size={26} className="text-white fill-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)] transition-all duration-500 group-hover:scale-110 group-hover:rotate-12" />
                  </div>
                  <span className="font-display text-2xl font-black tracking-normal uppercase italic text-white antialiased drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                    {PRIMARY_ACTION_LABEL}
                  </span>
                </>
              )}
            </div>
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            type="button"
            role="switch"
            aria-checked={generateMedia}
            onClick={() => onToggleMedia(!generateMedia)}
            className={cn(
              "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-white/10 transition-colors duration-200",
              generateMedia ? "bg-primary/60" : "bg-white/10"
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 mt-[0.5px]",
              generateMedia ? "translate-x-3" : "translate-x-0.5"
            )} />
          </button>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium select-none">
            Generate media
          </span>
        </div>

        {!pastedText.trim() && !loading && (
          <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/20 font-medium text-center">
            Awaiting script input
          </p>
        )}
      </div>
    </div>
  );
}
