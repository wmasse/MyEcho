import CoverArt from "@/components/CoverArt";
import type { Genre, Track } from "@/lib/home";

export default function TrackCard({
  track,
  isSelected,
  disabled,
  showLikedBadge,
  genre,
  onToggle,
}: {
  track: Track;
  isSelected: boolean;
  /** True once five seeds are picked and this isn't one of them. */
  disabled: boolean;
  showLikedBadge: boolean;
  genre?: Genre;
  onToggle: (track: Track) => void;
}) {
  return (
    <div className="group">
      <button
        onClick={() => onToggle(track)}
        disabled={disabled}
        className={`w-full text-left transition ${
          disabled ? "cursor-default opacity-35" : ""
        }`}
      >
        <div
          className={`relative aspect-square overflow-hidden rounded-[18px] bg-zinc-900 transition duration-200 ${
            isSelected
              ? "ring-2 ring-[#1DB954] ring-offset-4 ring-offset-[#070707]"
              : "group-hover:-translate-y-1"
          }`}
        >
          {track.image && (
            <CoverArt
              src={track.image}
              alt={`${track.name} album cover`}
              className={`h-full w-full object-cover transition duration-300 ${
                isSelected
                  ? "scale-[0.97] opacity-75"
                  : "group-hover:scale-[1.035]"
              }`}
              size={300}
            />
          )}

          {isSelected && (
            <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954] text-sm font-black text-black">
              ✓
            </div>
          )}

          {showLikedBadge && !isSelected && (
            <div className="absolute bottom-3 left-3 rounded-full bg-black/75 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
              Liked
            </div>
          )}
        </div>

        <p
          className={`mt-4 truncate font-semibold ${
            isSelected ? "text-[#1DB954]" : "text-white"
          }`}
        >
          {track.name}
        </p>

        <p className="mt-1 truncate text-sm text-zinc-500">
          {track.artist}
        </p>

        {genre && (
          <p className="mt-1 truncate text-xs text-zinc-700">
            {genre}
          </p>
        )}
      </button>
      {track.externalUrl && (
        <a
          href={track.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex rounded-full border border-white/[0.1] px-3 py-1 text-[10px] font-semibold text-zinc-500 transition hover:border-white/25 hover:text-white"
        >
          Open in Apple Music ↗
        </a>
      )}
    </div>
  );
}
