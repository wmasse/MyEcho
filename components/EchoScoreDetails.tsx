"use client";

import { useEffect, useState } from "react";

type EchoScoreDetailsProps = {
  trackName: string;
  score: number;
  matchedSeeds: number;
  source: "seed" | "library" | "discovery";
};

export default function EchoScoreDetails({
  trackName,
  score,
  matchedSeeds,
  source,
}: EchoScoreDetailsProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const sourceDescription =
    source === "library"
      ? "This song came from your Liked Songs and connected to your seed signals."
      : "Echo found this as a new track through its seed similarity signals.";

  if (source === "seed") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`View Echo score details for ${trackName}: ${score}% similarity`}
        className="inline-flex min-h-10 w-14 items-center justify-end gap-1 rounded-lg text-sm font-semibold text-[#1DB954] transition hover:bg-[#1DB954]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954]"
      >
        {score}%
        <span aria-hidden="true" className="text-[10px] text-zinc-500">
          ⓘ
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="echo-score-title"
            className="w-full max-w-md rounded-[28px] border border-white/[0.1] bg-[#111111] p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1DB954]">
                  Echo score breakdown
                </p>
                <h2
                  id="echo-score-title"
                  className="mt-3 text-2xl font-bold tracking-tight"
                >
                  {trackName}
                </h2>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                aria-label="Close score details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-zinc-500 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1DB954]"
              >
                ×
              </button>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold">Overall similarity</p>
                <p className="text-lg font-bold text-[#1DB954]">{score}%</p>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]"
                role="meter"
                aria-label="Overall similarity"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score}
              >
                <div
                  className="h-full rounded-full bg-[#1DB954] transition-[width]"
                  style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Relative to the strongest recommendation in this Echo.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold">Seed connections</p>
                <p className="text-sm font-bold text-white">
                  {matchedSeeds} {matchedSeeds === 1 ? "signal" : "signals"}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Similar-track or similar-artist signals from your seed songs that contributed to this match.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className="text-sm font-semibold">Why it’s here</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {sourceDescription}
              </p>
            </div>

            <p className="mt-5 text-xs leading-5 text-zinc-600">
              Mood, energy, genre, and era ratings aren’t available in the current music data. This breakdown shows the signals Echo can measure today.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
