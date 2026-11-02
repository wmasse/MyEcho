import CoverArt from "@/components/CoverArt";
import type { Track } from "@/lib/home";

export default function SeedTray({
  selected,
  onRemove,
  onContinue,
}: {
  selected: Track[];
  onRemove: (trackId: string) => void;
  onContinue: () => void;
}) {
  if (selected.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-24px)] max-w-6xl -translate-x-1/2">
      <div className="rounded-[28px] border border-white/[0.1] bg-[#171717]/95 p-4 shadow-2xl shadow-black/70 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
            {selected.map((track) => (
              <div
                key={track.id}
                className="flex min-w-[190px] max-w-[220px] shrink-0 items-center gap-3 rounded-[16px] bg-white/[0.05] p-2 pr-3"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                  {track.image && (
                    <CoverArt
                      src={track.image}
                      alt=""
                      className="h-full w-full object-cover"
                      size={48}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {track.name}
                  </p>

                  <p className="truncate text-xs text-zinc-500">
                    {track.artist}
                  </p>
                </div>

                <button
                  onClick={() => onRemove(track.id)}
                  className="text-lg text-zinc-600 transition hover:text-white"
                  aria-label={`Remove ${track.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="min-h-14 shrink-0 rounded-full bg-[#1DB954] px-8 font-bold text-black transition hover:scale-[1.02] hover:bg-[#22cf63] active:scale-[0.98]"
          >
            Continue to Echo →
          </button>
        </div>
      </div>
    </div>
  );
}
