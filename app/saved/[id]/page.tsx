"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import EchoScoreDetails from "@/components/EchoScoreDetails";
import {
  SPOTIFY_PLAYLISTS_ENABLED,
  SPOTIFY_PLAYLISTS_UNAVAILABLE_MESSAGE,
} from "@/lib/spotify-playlists";
import CoverArt from "@/components/CoverArt";

type Track = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;
  externalUrl?: string;

  source?: "seed" | "library" | "discovery";
  echoScore?: number;
  matchedSeeds?: number;
};

type SavedEcho = {
  id: string;
  name: string;
  createdAt: string;
  tracks: Track[];
  seeds: Track[];
};

export default function SavedEchoPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <SavedEchoContent />
    </Suspense>
  );
}

function SavedEchoContent() {
  const router = useRouter();
  const params = useParams();

  const id =
    typeof params.id === "string"
      ? params.id
      : params.id?.[0];

  const [playlist, setPlaylist] = useState<SavedEcho | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  const [savingSpotify, setSavingSpotify] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      router.push("/saved");
      return;
    }

    const raw = localStorage.getItem("echoSavedPlaylists");

    if (!raw) {
      router.push("/saved");
      return;
    }

    try {
      const playlists: SavedEcho[] = JSON.parse(raw);

      const found = playlists.find(
        (item) => item.id === id
      );

      if (!found) {
        router.push("/saved");
        return;
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate the selected playlist from browser storage after hydration.
      setPlaylist(found);
      setName(found.name);
    } catch (err) {
      console.error(err);
      router.push("/saved");
    }
  }, [id, router]);

  function updateStoredPlaylist(updatedPlaylist: SavedEcho) {
    const raw = localStorage.getItem("echoSavedPlaylists");

    if (!raw) return;

    try {
      const playlists: SavedEcho[] = JSON.parse(raw);

      const updated = playlists.map((item) =>
        item.id === updatedPlaylist.id
          ? updatedPlaylist
          : item
      );

      localStorage.setItem(
        "echoSavedPlaylists",
        JSON.stringify(updated)
      );

      setPlaylist(updatedPlaylist);
    } catch (err) {
      console.error(err);
    }
  }

  function renamePlaylist() {
    if (!playlist) return;

    const cleanName = name.trim();

    if (!cleanName) return;

    const updatedPlaylist = {
      ...playlist,
      name: cleanName,
    };

    updateStoredPlaylist(updatedPlaylist);
    setEditingName(false);
  }

  function removeTrack(trackId: string) {
    if (!playlist) return;

    const updatedPlaylist = {
      ...playlist,

      tracks: playlist.tracks.filter(
        (track) => track.id !== trackId
      ),
    };

    updateStoredPlaylist(updatedPlaylist);
  }

  async function saveToSpotify() {
    if (
      !SPOTIFY_PLAYLISTS_ENABLED ||
      !playlist ||
      playlist.tracks.length === 0
    ) {
      return;
    }

    setSavingSpotify(true);
    setError("");

    try {
      const response = await fetch("/api/spotify/playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playlist.name,
          description: "Created with Echo.",
          uris: playlist.tracks.map((track) => track.uri),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Could not save playlist to Spotify."
        );
      }

      window.open(
        data.playlist.url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not save playlist to Spotify."
      );
    } finally {
      setSavingSpotify(false);
    }
  }

  if (!playlist) {
    return <LoadingPage />;
  }

  const likedCount = playlist.tracks.filter(
    (track) => track.source === "library"
  ).length;

  const newCount = playlist.tracks.filter(
    (track) => track.source === "discovery"
  ).length;

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="echo-glow absolute inset-x-0 top-0 h-[520px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pb-24 md:px-10">
        {/* NAV */}
        <SiteNav current="saved" />

        {/* HEADER */}
        <section className="pb-12 pt-12">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1DB954]">
            Saved Echo
          </p>

          {editingName ? (
            <div className="mt-4 flex max-w-4xl items-center gap-4">
              <input
                autoFocus
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    renamePlaylist();
                  }

                  if (event.key === "Escape") {
                    setName(playlist.name);
                    setEditingName(false);
                  }
                }}
                className="min-w-0 flex-1 border-b border-white/[0.1] bg-transparent pb-3 text-5xl font-black tracking-[-0.05em] outline-none focus:border-[#1DB954] md:text-7xl"
              />

              <button
                onClick={renamePlaylist}
                className="rounded-full bg-[#1DB954] px-6 py-3 font-bold text-black"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <h1 className="text-5xl font-black tracking-[-0.05em] md:text-7xl">
                {playlist.name}
              </h1>

              <button
                onClick={() => setEditingName(true)}
                className="text-sm text-zinc-600 transition hover:text-white"
              >
                Rename
              </button>
            </div>
          )}

          {/* PLAYLIST INFO */}
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-zinc-500">
            <span>
              {playlist.tracks.length} songs
            </span>

            {likedCount > 0 && (
              <span>
                {likedCount} liked
              </span>
            )}

            {newCount > 0 && (
              <span className="text-[#1DB954]">
                {newCount} new
              </span>
            )}

            <span>
              Saved{" "}
              {new Date(
                playlist.createdAt
              ).toLocaleDateString()}
            </span>
          </div>

          <button
            onClick={saveToSpotify}
            disabled={!SPOTIFY_PLAYLISTS_ENABLED}
            title={SPOTIFY_PLAYLISTS_UNAVAILABLE_MESSAGE}
            className="mt-8 rounded-full bg-[#1DB954] px-8 py-4 font-bold text-black transition hover:scale-[1.02] hover:bg-[#22cf63] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {SPOTIFY_PLAYLISTS_ENABLED
              ? savingSpotify
                ? "Saving..."
                : "Save to Spotify"
              : "Spotify playlists paused"}
          </button>

          {!SPOTIFY_PLAYLISTS_ENABLED && (
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {SPOTIFY_PLAYLISTS_UNAVAILABLE_MESSAGE}
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}
        </section>

        {/* SEEDS */}
        {playlist.seeds.length > 0 && (
          <section className="border-t border-white/[0.07] py-10">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
              Built from
            </p>

            <div className="flex flex-wrap gap-3">
              {playlist.seeds.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.04] py-2 pl-2 pr-4"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800">
                    {track.image && (
                      <CoverArt
                        src={track.image}
                        alt=""
                        className="h-full w-full object-cover"
                        size={40}
                      />
                    )}
                  </div>

                  <div>
                    <p className="max-w-[180px] truncate text-sm font-semibold">
                      {track.name}
                    </p>

                    <p className="max-w-[180px] truncate text-xs text-zinc-600">
                      {track.artist}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TRACK LIST */}
        <section className="border-t border-white/[0.07] py-10">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
              Tracks
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {playlist.tracks.length} songs
            </h2>
          </div>

          <div className="space-y-1">
            {playlist.tracks.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                className="group -mx-3 flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition hover:bg-white/[0.045] sm:mx-0 sm:gap-4 sm:py-3"
              >
                {/* NUMBER */}
                <div className="hidden w-7 text-center text-sm text-zinc-700 sm:block">
                  {index + 1}
                </div>

                {/* ART */}
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

                {/* INFO */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {track.name}
                  </p>

                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {track.artist}
                  </p>
                </div>

                {/* SOURCE */}
                {track.source && (
                  <span
                    className={`hidden rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] sm:block ${
                      track.source === "seed"
                        ? "bg-white text-black"
                        : track.source === "library"
                          ? "bg-white/[0.06] text-zinc-500"
                          : "bg-[#1DB954]/10 text-[#1DB954]"
                    }`}
                  >
                    {track.source === "seed"
                      ? "Seed"
                      : track.source === "library"
                        ? "Liked"
                        : "New"}
                  </span>
                )}

                {/* SCORE */}
                {track.echoScore !== undefined && (
                  <EchoScoreDetails
                    trackName={track.name}
                    score={track.echoScore}
                    matchedSeeds={track.matchedSeeds ?? 0}
                    source={track.source ?? "discovery"}
                  />
                )}

                {/* OPEN TRACK */}
                <a
                  href={
                    track.externalUrl ??
                    `https://open.spotify.com/track/${track.id}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="hidden text-xs text-zinc-600 transition hover:text-white sm:block"
                >
                  {track.externalUrl
                    ? "Apple Music ↗"
                    : "Open"}
                </a>

                {/* REMOVE */}
                <button
                  onClick={() => removeTrack(track.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-zinc-700 transition hover:bg-white/[0.07] hover:text-red-400"
                  aria-label={`Remove ${track.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {playlist.tracks.length === 0 && (
            <div className="rounded-[28px] border border-white/[0.07] bg-[#111111] py-16 text-center">
              <p className="font-semibold">
                This Echo is empty.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function LoadingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070707] text-white">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-zinc-800 border-t-[#1DB954]" />

        <p className="mt-4 text-sm text-zinc-500">
          Loading Echo...
        </p>
      </div>
    </main>
  );
}
