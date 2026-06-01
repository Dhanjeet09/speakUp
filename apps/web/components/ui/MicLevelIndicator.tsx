"use client";

import { useEffect, useRef, useState } from "react";

export default function MicLevelIndicator() {
  const [level, setLevel] = useState(0);
  const ref = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        ref.current = analyser;
      } catch {
      }
    }
    init();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const analyser = ref.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      analyser!.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(Math.min(avg / 128, 1));
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }, []);

  const bars = 5;
  const active = Math.round(level * bars);

  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`Microphone level: ${Math.round(level * 100)}%`}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={`h-3 w-1 rounded-full transition-colors duration-100 ${
            i < active ? "bg-primary" : "bg-gray-300"
          }`}
        />
      ))}
    </div>
  );
}
