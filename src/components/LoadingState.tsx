"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Mic2, Wand2 } from "lucide-react";

const STATUS_MESSAGES = [
  { text: "Tuning the audio spectrum...", icon: Music },
  { text: "Parsing phonetics & cadences...", icon: Mic2 },
  { text: "Applying humor layers...", icon: Sparkles },
  { text: "Syncing the hearsay magic...", icon: Wand2 },
  { text: "Finalizing your sing-along sheet...", icon: Sparkles },
];

export default function LoadingState() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = STATUS_MESSAGES[statusIndex].icon;

  return (
    <div className="w-full py-20 flex flex-col items-center justify-center space-y-12">
      {/* Central Animation */}
      <div className="relative">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="w-24 h-24 bg-primary/20 rounded-3xl flex items-center justify-center relative z-10 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40 animate-pulse" />
          <CurrentIcon size={40} className="text-white relative z-20" />
        </motion.div>
        
        {/* Orbiting Particles */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-0 -m-4"
          >
            <div 
              className="w-3 h-3 bg-primary rounded-full absolute top-0 left-1/2 -translate-x-1/2 blur-[2px]" 
              style={{ opacity: 0.5 - (i * 0.1) }}
            />
          </motion.div>
        ))}
      </div>

      {/* Status Text */}
      <div className="text-center space-y-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={statusIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-2xl font-display font-bold text-primary"
          >
            {STATUS_MESSAGES[statusIndex].text}
          </motion.p>
        </AnimatePresence>
        <p className="text-muted text-sm uppercase tracking-widest font-bold opacity-50">
          Gemini 3.1 is listening...
        </p>
      </div>

      {/* Skeleton Lyrics */}
      <div className="w-full max-w-xl space-y-6 opacity-20">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-1/3 bg-white/20 rounded-full animate-pulse" />
            <div className="h-10 w-full bg-white/10 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            <div className="h-4 w-1/4 bg-white/10 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
