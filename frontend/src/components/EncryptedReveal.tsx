"use client";

import { useEffect, useRef, useState } from "react";

const CIPHER_CHARS = "0123456789ABCDEF░▒▓█▪▫";

/**
 * Displays a string that "decrypts" on mount — each character cycles through
 * random ciphertext before settling on its true glyph, staggered across the
 * string. Reinforces the "this was FHE-encrypted, now revealed just for you" story.
 */
export function EncryptedReveal({
  value,
  duration = 800,
  delay = 0,
  className = "",
}: {
  value: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState(value);
  const rafRef = useRef<number>(0);
  const startedRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const target = value;

    const tick = (now: number) => {
      if (cancelled) return;
      if (startedRef.current === null) startedRef.current = now + delay;
      const elapsed = now - startedRef.current;
      if (elapsed < 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      const chars = target.split("").map((ch, i) => {
        const settleAt = i / Math.max(target.length, 1);
        if (progress >= settleAt + 0.02) return ch;
        if (ch === " " || ch === "." || ch === "/") return ch;
        return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
      });
      setDisplayed(chars.join(""));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(target);
      }
    };

    startedRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, delay]);

  return (
    <span className={`font-mono tabular ${className}`.trim()}>
      {displayed}
    </span>
  );
}
