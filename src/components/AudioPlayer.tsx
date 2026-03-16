import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, RotateCcw, Music } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src?: string;
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

export interface AudioPlayerRef {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
}

const AudioPlayer = forwardRef<AudioPlayerRef, AudioPlayerProps>(({ src, onTimeUpdate, className }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying((prev) => !prev);
  }, [isPlaying]);

  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        if (!isPlaying) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
    },
    play: () => audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
  }));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't toggle playback if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" || 
        target.tagName === "TEXTAREA" || 
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault(); // Prevent page scroll
        togglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  const reset = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-6 relative z-10">
        {/* Play/Pause Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={togglePlay}
          className="w-14 h-14 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] hover:shadow-[0_0_25px_rgba(244,63,94,0.6)] transition-all"
        >
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
        </motion.button>

        <div className="flex-1 space-y-3">
          <div className="flex justify-between items-end">
            <div>
              <h4 className="text-white/90 text-sm font-medium tracking-wide flex items-center gap-2">
                <Music size={14} className="text-primary" />
                Demo Playback
              </h4>
              <p className="text-xs text-white/50 tracking-wide mt-1">
                Stable Audio Source
              </p>
            </div>
            <div className="text-xs font-medium text-white/60 tabular-nums bg-black/40 rounded-full px-3 py-1 border border-white/5 shadow-inner">
              {formatTime(currentTime)} <span className="text-white/30 mx-1">/</span> {formatTime(duration)}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/5 shadow-inner">
            <motion.div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(duration > 0 ? (currentTime / duration) : 0) * 100}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.1 }}
            />
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.1, rotate: -45 }}
          whileTap={{ scale: 0.95 }}
          onClick={reset}
          title="Reset"
          className="p-3 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <RotateCcw size={20} />
        </motion.button>
      </div>
    </div>
  );
});

AudioPlayer.displayName = "AudioPlayer";

export default AudioPlayer;
