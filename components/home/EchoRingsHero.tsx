import Image from "next/image";
import type { PopularAlbum } from "@/lib/home";

/*
 * The home page's signature image: one album in the middle, and the
 * albums that "echo" it rippling outward on rings, smaller and fainter
 * the further out they sit. When the list rotates, each cover glides
 * one slot inward, so a new album takes the center.
 *
 * Positions are percentages of a square stage, so it scales from
 * phone to desktop without media queries.
 */
type Slot = { radius: number; angle: number; size: number; opacity: number };

const RINGS = [22, 34, 45]; // ring radius, % of the stage width

const SLOTS: Slot[] = [
  { radius: 0, angle: 0, size: 27, opacity: 1 },
  { radius: RINGS[0], angle: -55, size: 14, opacity: 1 },
  { radius: RINGS[0], angle: 125, size: 14, opacity: 1 },
  { radius: RINGS[1], angle: 15, size: 11, opacity: 0.85 },
  { radius: RINGS[1], angle: 195, size: 11, opacity: 0.85 },
  { radius: RINGS[1], angle: 265, size: 11, opacity: 0.85 },
  { radius: RINGS[2], angle: -25, size: 8, opacity: 0.6 },
  { radius: RINGS[2], angle: 95, size: 8, opacity: 0.6 },
  { radius: RINGS[2], angle: 228, size: 8, opacity: 0.6 },
];

function slotStyle(slot: Slot) {
  const radians = (slot.angle * Math.PI) / 180;
  // Rounded so the server and browser produce the same style string.
  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    left: `${round(50 + slot.radius * Math.cos(radians))}%`,
    top: `${round(50 + slot.radius * Math.sin(radians))}%`,
    width: `${slot.size}%`,
    opacity: slot.opacity,
  };
}

export default function EchoRingsHero({
  albums,
  onPausedChange,
  onSelect,
  onStart,
}: {
  albums: PopularAlbum[];
  onPausedChange: (paused: boolean) => void;
  onSelect: (album: PopularAlbum) => void;
  onStart: () => void;
}) {
  const shown = albums.slice(0, SLOTS.length);
  const center = shown[0];

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 pb-16 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pb-24">
      {/* TEXT */}
      <div className="order-2 text-center lg:order-1 lg:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1DB954] sm:text-sm">
          Your music, reorganized
        </p>

        <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Start with one song.{" "}
          <span className="text-[#1DB954]">Hear what echoes.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-zinc-400 sm:text-lg lg:mx-0">
          Pick up to five songs you love. Echo builds a mix around their
          shared sound.
        </p>

        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
          <button
            type="button"
            onClick={onStart}
            className="min-h-12 rounded-full bg-[#1DB954] px-7 font-bold text-black transition hover:bg-[#22cf63] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954]"
          >
            Pick a song
          </button>

          {center && (
            <p className="text-sm text-zinc-500">
              Or tap a cover to start from it
            </p>
          )}
        </div>
      </div>

      {/* RINGS */}
      <div
        className="order-1 mx-auto w-full max-w-[340px] sm:max-w-[440px] lg:order-2 lg:max-w-[540px]"
        onMouseEnter={() => onPausedChange(true)}
        onMouseLeave={() => onPausedChange(false)}
        onFocusCapture={() => onPausedChange(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onPausedChange(false);
          }
        }}
      >
        <div className="relative aspect-square w-full">
          {/* Rings and a slow ripple from the center */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {RINGS.map((radius, index) => (
              <div
                key={radius}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{
                  width: `${radius * 2}%`,
                  height: `${radius * 2}%`,
                  borderColor: `rgb(29 185 84 / ${0.35 - index * 0.1})`,
                }}
              />
            ))}
            <div className="echo-ripple absolute left-1/2 top-1/2 h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1DB954]/50" />
          </div>

          <ul aria-label="Popular albums to start a mix from">
            {shown.map((album, index) => {
              const isCenter = index === 0;

              return (
                <li
                  key={album.id}
                  className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 transition-[left,top,width,opacity] duration-[900ms] ease-[cubic-bezier(0.2,0.75,0.25,1)] motion-reduce:transition-none"
                  style={{ ...slotStyle(SLOTS[index]), zIndex: SLOTS.length - index }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(album)}
                    aria-label={`Start a mix from ${album.name} by ${album.artist}`}
                    title={`${album.name} · ${album.artist}`}
                    className={`relative block h-full w-full overflow-hidden bg-zinc-900 transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1DB954] ${
                      isCenter
                        ? "rounded-[18%] shadow-[0_0_0_4px_#070707,0_0_0_5px_#1DB954,0_24px_60px_rgba(0,0,0,0.55)]"
                        : "rounded-[22%] shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
                    }`}
                  >
                    <Image
                      src={album.image}
                      alt=""
                      fill
                      loading="eager"
                      sizes={isCenter ? "(max-width: 639px) 92px, 150px" : "60px"}
                      className="object-cover"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {center && (
          <p className="mt-3 truncate text-center text-sm text-zinc-500" aria-live="polite">
            In the middle:{" "}
            <span className="font-semibold text-zinc-300">{center.name}</span>
            {" · "}
            {center.artist}
          </p>
        )}
      </div>
    </section>
  );
}
