"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "zokher-ui-scale";
const SCALES = [
  { label: "A−", value: 0.9, title: "Smaller" },
  { label: "A", value: 1, title: "Default" },
  { label: "A+", value: 1.15, title: "Larger" },
  { label: "A++", value: 1.3, title: "Largest" },
] as const;

function applyScale(scale: number) {
  // Only CSS variable — avoid data-* attrs that fight SSR hydration
  document.documentElement.style.setProperty("--ui-scale", String(scale));
}

export function UiScaleControl() {
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    const next = Number.isFinite(saved) && saved > 0 ? saved : 1;
    setScale(next);
    applyScale(next);
    setReady(true);
  }, []);

  function choose(next: number) {
    setScale(next);
    applyScale(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white/80 p-0.5"
      role="group"
      aria-label="Text and UI size"
    >
      {SCALES.map((option) => {
        const active = ready && Math.abs(scale - option.value) < 0.001;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-label={option.title}
            aria-pressed={active}
            onClick={() => choose(option.value)}
            className={`min-w-8 rounded-full px-2 py-1 text-xs font-bold transition ${
              active
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--ink)] hover:bg-[var(--accent-soft)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
