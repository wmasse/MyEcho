"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import {
  decodeSharedEchoFragment,
  normalizeSharedEcho,
  type SharedEcho,
} from "@/lib/shared-echo";
import CoverArt from "@/components/CoverArt";
import PageTransition from "@/components/PageTransition";

type SavedEcho = {
  id: string;
  name: string;
  createdAt: string;
  tracks: SharedEcho["tracks"];
  seeds: SharedEcho["tracks"];
};

export default function SharedEchoView({
  shareId,
}: {
  shareId?: string;
}) {
  const router = useRouter();
  // Remember which link the result belongs to, so switching links
  // shows the loading state again without resetting state in the effect.
  const [loaded, setLoaded] = useState<{
    shareId: string | undefined;
    echo: SharedEcho | null;
  } | null>(null);
  const loading = !loaded || loaded.shareId !== shareId;
  const echo = loading ? null : loaded.echo;
  const [remixing, setRemixing] = useState(false);
  const [remixError, setRemixError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEcho() {
      try {
        let sharedEcho: SharedEcho | null;

        if (shareId) {
          const response = await fetch(
            `/api/shared/${encodeURIComponent(shareId)}`,
            { cache: "no-store" }
          );

          if (!response.ok) {
            throw new Error("This shared Echo could not be opened.");
          }

          sharedEcho = normalizeSharedEcho(await response.json());
        } else {
          sharedEcho = await decodeSharedEchoFragment(
            window.location.hash
          );
        }

        if (!cancelled) {
          setLoaded({ shareId, echo: sharedEcho });
        }
      } catch (error) {
        console.error("Could not open shared Echo:", error);

        if (!cancelled) {
          setLoaded({ shareId, echo: null });
        }
      }
    }

    void loadEcho();

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  function remixEcho() {
    if (!echo || remixing) return;

    setRemixing(true);
    setRemixError("");

    try {
      const rawSavedEchoes = localStorage.getItem("echoSavedPlaylists");
      const parsedSavedEchoes = rawSavedEchoes
        ? JSON.parse(rawSavedEchoes)
        : [];

      if (!Array.isArray(parsedSavedEchoes)) {
        throw new Error("Saved Echoes are not available.");
      }

      const savedEchoes = parsedSavedEchoes as SavedEcho[];
      const remix: SavedEcho = {
        id: crypto.randomUUID(),
        name: `${echo.name} (Remix)`,
        createdAt: new Date().toISOString(),
        tracks: echo.tracks,
        seeds: echo.tracks.filter((track) => track.source === "seed"),
      };

      localStorage.setItem(
        "echoSavedPlaylists",
        JSON.stringify([remix, ...savedEchoes])
      );

      router.push(`/echo?saved=${encodeURIComponent(remix.id)}`);
    } catch (error) {
      console.error(error);
      setRemixError("Couldn’t save this remix in your browser. Try again.");
      setRemixing(false);
    }
  }

  return (
    <PageTransition>
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="echo-glow absolute inset-x-0 top-0 h-[520px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 pb-20 md:px-10">
        <SiteNav />

        {loading ? (
          <section className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-800 border-t-[#1DB954]" />
            <p className="mt-5 font-semibold">Opening shared Echo...</p>
          </section>
        ) : echo ? (
          <>
            <section className="pb-12 pt-10">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1DB954]">
                Shared Echo
              </p>
              <h1 className="mt-4 break-words text-5xl font-black tracking-[-0.05em] md:text-7xl">
                {echo.name}
              </h1>
              <p className="mt-5 text-zinc-500">
                {echo.tracks.length} songs, picked to sound right together.
              </p>
            </section>

            <section className="space-y-1">
              {echo.tracks.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  className="-mx-3 flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition hover:bg-white/[0.045] sm:mx-0 sm:gap-4 sm:py-3"
                >
                  <span className="hidden w-7 text-center text-sm text-zinc-700 sm:block">
                    {index + 1}
                  </span>
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-900 sm:h-14 sm:w-14">
                    {track.image && (
                      <CoverArt
                        src={track.image}
                        alt=""
                        className="h-full w-full object-cover"
                        size={56}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{track.name}</p>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {track.artist}
                    </p>
                  </div>
                  <span className="hidden rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 sm:block">
                    {track.source === "seed"
                      ? "Seed"
                      : track.source === "library"
                        ? "Liked"
                        : "New"}
                  </span>
                  <a
                    href={
                      track.externalUrl ??
                      `https://open.spotify.com/track/${encodeURIComponent(track.id)}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-600 transition hover:text-white"
                  >
                    {track.externalUrl?.includes("music.apple.com")
                      ? "Apple Music ↗"
                      : "Open ↗"}
                  </a>
                </div>
              ))}
            </section>

            <div className="mt-12 rounded-[28px] border border-white/[0.07] bg-[#111111] px-7 py-8">
              <p className="text-xl font-bold">Make it yours.</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Save an editable copy to your Echoes, then change the songs or name.
              </p>
              {remixError && (
                <p role="alert" className="mt-4 text-sm text-red-400">
                  {remixError}
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={remixEcho}
                  disabled={remixing || echo.tracks.length === 0}
                  className="inline-flex min-h-12 items-center rounded-full bg-[#1DB954] px-6 font-bold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {remixing ? "Saving remix..." : "Remix this Echo"}
                </button>
                <Link
                  href="/"
                  className="inline-flex min-h-12 items-center rounded-full border border-white/[0.1] px-6 font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Create an Echo
                </Link>
              </div>
            </div>
          </>
        ) : (
          <section className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1DB954]">
              Shared Echo
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">
              This link couldn’t be opened.
            </h1>
            <p className="mt-4 max-w-md text-zinc-500">
              It may be incomplete or too old. Ask the person who shared it to send a new link.
            </p>
            <Link
              href="/"
              className="mt-8 rounded-full bg-[#1DB954] px-6 py-3 font-bold text-black transition hover:scale-[1.02]"
            >
              Go to Echo
            </Link>
          </section>
        )}
      </div>
    </main>
    </PageTransition>
  );
}
