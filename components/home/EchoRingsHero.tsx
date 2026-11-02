"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { PopularAlbum } from "@/lib/home";

/*
 * The home page's signature image: a search box in the middle, with
 * album covers rippling outward on rings around it, smaller and fainter
 * the further out they sit. Farther rings are slightly blurred, like
 * they're out of focus. When the list rotates, each cover glides to the
 * next slot.
 *
 * Positions are percentages of a square stage, so it scales from phone
 * to desktop without media queries.
 */
type Slot = { radius: number; angle: number; size: number; opacity: number; blur: number };

const RINGS = [27, 38, 48]; // ring radius, % of the stage width

// Inner covers sit above and below the search box, never beside it.
const SLOTS: Slot[] = [
  { radius: RINGS[0], angle: -60, size: 13, opacity: 1, blur: 0 },
  { radius: RINGS[0], angle: -120, size: 13, opacity: 1, blur: 0 },
  { radius: RINGS[0], angle: 60, size: 13, opacity: 1, blur: 0 },
  { radius: RINGS[0], angle: 120, size: 13, opacity: 1, blur: 0 },
  { radius: RINGS[1], angle: -25, size: 10, opacity: 0.85, blur: 1 },
  { radius: RINGS[1], angle: 205, size: 10, opacity: 0.85, blur: 1 },
  { radius: RINGS[1], angle: 90, size: 10, opacity: 0.85, blur: 1 },
  { radius: RINGS[2], angle: 18, size: 7.5, opacity: 0.6, blur: 2 },
  { radius: RINGS[2], angle: 162, size: 7.5, opacity: 0.6, blur: 2 },
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
    "--cover-blur": `${slot.blur}px`,
  } as React.CSSProperties;
}

export default function EchoRingsHero({
  albums,
  onPausedChange,
  onSelect,
  onSearch,
  onSearchInViewChange,
}: {
  albums: PopularAlbum[];
  onPausedChange: (paused: boolean) => void;
  onSelect: (album: PopularAlbum) => void;
  onSearch: (query: string) => void;
  /** Lets the page hide its own search bar on phones while this one shows. */
  onSearchInViewChange?: (inView: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const onInViewRef = useRef(onSearchInViewChange);

  useEffect(() => {
    onInViewRef.current = onSearchInViewChange;
  }, [onSearchInViewChange]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(([entry]) =>
      onInViewRef.current?.(entry.isIntersecting)
    );
    observer.observe(form);

    return () => observer.disconnect();
  }, []);
  const shown = albums.slice(0, SLOTS.length);

  return (
    <section className="pb-14 pt-2 sm:pb-20 sm:pt-6">
      <h1 className="sr-only">
        Echo: start with one song and hear what echoes
      </h1>

      <div
        className="mx-auto w-full max-w-[360px] sm:max-w-[520px] lg:max-w-[600px]"
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
          {/* Rings */}
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
          </div>

          <ul aria-label="Popular albums to start a mix from">
            {shown.map((album, index) => (
              <li
                key={album.id}
                className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 transition-[left,top,width,opacity,filter] duration-[900ms] ease-[cubic-bezier(0.2,0.75,0.25,1)] motion-reduce:transition-none"
                style={slotStyle(SLOTS[index])}
              >
                <button
                  type="button"
                  onClick={() => onSelect(album)}
                  aria-label={`Start a mix from ${album.name} by ${album.artist}`}
                  title={`${album.name} · ${album.artist}`}
                  className="relative block h-full w-full overflow-hidden rounded-[22%] bg-zinc-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition [filter:blur(var(--cover-blur))] hover:scale-110 hover:[filter:none] focus-visible:[filter:none] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1DB954]"
                >
                  <Image
                    src={album.image}
                    alt=""
                    fill
                    loading="eager"
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>

          {/* SEARCH, the center of the echo */}
          <form
            ref={formRef}
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim()) onSearch(query.trim());
            }}
            className="absolute left-1/2 top-1/2 z-10 w-[84%] -translate-x-1/2 -translate-y-1/2 sm:w-[62%]"
          >
            <label htmlFor="hero-search" className="sr-only">
              Search for a song to start your mix
            </label>
            <div className="flex h-14 items-center gap-2 rounded-full border border-white/[0.12] bg-[#121212] pl-4 pr-1.5 sm:pl-5 shadow-[0_0_0_8px_#070707,0_20px_50px_rgba(0,0,0,0.6)] transition focus-within:border-[#1DB954]/60">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 shrink-0 text-zinc-500">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="hero-search"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a song"
                className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-500"
              />
              <button
                type="submit"
                aria-label="Search"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1DB954] text-black transition hover:bg-[#22cf63] disabled:opacity-40"
                disabled={!query.trim()}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        <p className="mt-2 text-center text-sm text-zinc-500">
          Select one to five songs. Or tap a cover to start from it.
        </p>
      </div>
    </section>
  );
}
