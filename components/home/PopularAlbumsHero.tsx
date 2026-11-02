import Image from "next/image";
import type { PopularAlbum } from "@/lib/home";

export default function PopularAlbumsHero({
  albums,
  onPausedChange,
  onSelect,
}: {
  albums: PopularAlbum[];
  onPausedChange: (paused: boolean) => void;
  onSelect: (album: PopularAlbum) => void;
}) {
  return (
    <div
      aria-label="Rotating selection of popular album covers"
      role="list"
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-5 md:gap-x-7"
      onMouseEnter={() => onPausedChange(true)}
      onMouseLeave={() => onPausedChange(false)}
      onFocusCapture={() => onPausedChange(true)}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget as Node | null
          )
        ) {
          onPausedChange(false);
        }
      }}
    >
      {albums.slice(0, 4).map((album, index) => (
        <article
          key={album.id}
          role="listitem"
          className={`group min-w-0 ${
            index % 2 === 1 ? "sm:translate-y-5" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => onSelect(album)}
            aria-label={`Search songs from ${album.name} by ${album.artist}`}
            className="group block w-full min-w-0 cursor-pointer rounded-[22px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1DB954]"
          >
            <div className="album-card-turn relative aspect-square overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition duration-500 group-hover:-translate-y-1">
              <Image
                src={album.image}
                alt=""
                fill
                sizes="(max-width: 639px) 42vw, (max-width: 1279px) 22vw, 270px"
                className="object-cover"
              />
            </div>

            <p className="mt-3 truncate text-sm font-semibold text-white">
              {album.name}
            </p>

            <p className="mt-1 truncate text-sm text-zinc-500">
              {album.artist}
            </p>
          </button>
        </article>
      ))}
    </div>
  );
}
