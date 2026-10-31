"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EchoLogo from "@/components/EchoLogo";
import {
  SPOTIFY_PLAYLISTS_ENABLED,
  SPOTIFY_PLAYLISTS_UNAVAILABLE_MESSAGE,
} from "@/lib/spotify-playlists";

type Track = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;

  source?: "library" | "discovery";
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

export default function SavedPage() {
  const router = useRouter();

  const [playlists, setPlaylists] = useState<SavedEcho[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingSpotifyId, setSavingSpotifyId] =
    useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Function declarations are hoisted; browser storage is read after hydration.
    loadPlaylists();
  }, []);

  function loadPlaylists() {
    const raw = localStorage.getItem("echoSavedPlaylists");

    if (!raw) {
      setPlaylists([]);
      return;
    }

    try {
      setPlaylists(JSON.parse(raw));
    } catch {
      setPlaylists([]);
    }
  }

  function updateStorage(updated: SavedEcho[]) {
    setPlaylists(updated);

    localStorage.setItem(
      "echoSavedPlaylists",
      JSON.stringify(updated)
    );
  }

  function startRename(playlist: SavedEcho) {
    setEditingId(playlist.id);
    setEditingName(playlist.name);
  }

  function cancelRename() {
    setEditingId(null);
    setEditingName("");
  }

  function saveRename(id: string) {
    const name = editingName.trim();

    if (!name) return;

    const updated = playlists.map((playlist) =>
      playlist.id === id
        ? {
            ...playlist,
            name,
          }
        : playlist
    );

    updateStorage(updated);

    setEditingId(null);
    setEditingName("");
  }

  function deletePlaylist(id: string) {
    const updated = playlists.filter(
      (playlist) => playlist.id !== id
    );

    updateStorage(updated);
  }

  function openPlaylist(id: string) {
    router.push(`/echo?saved=${encodeURIComponent(id)}`);
  }

  async function sendToSpotify(playlist: SavedEcho) {
    if (!SPOTIFY_PLAYLISTS_ENABLED) return;

    setSavingSpotifyId(playlist.id);

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
          data.message || data.error || "Could not save to Spotify."
        );
      }

      window.open(
        data.playlist.url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not save to Spotify."
      );
    } finally {
      setSavingSpotifyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-450px] h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[#1DB954]/10 blur-[190px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-20 md:px-10 lg:px-14">
        {/* NAV */}
        <nav className="flex h-24 items-center justify-between">
          <EchoLogo />

          <div className="flex items-center gap-7 text-sm">
            <button
              onClick={() => router.push("/")}
              className="text-zinc-500 transition hover:text-white"
            >
              Create
            </button>

            <button
              onClick={() => router.push("/stats")}
              className="text-zinc-500 transition hover:text-white"
            >
              Stats
            </button>

            <span className="font-semibold text-white">
              Saved
            </span>
          </div>
        </nav>

        {/* HEADER */}
        <section className="pb-14 pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1DB954]">
            Your collection
          </p>

          <h1 className="mt-4 text-6xl font-black tracking-[-0.055em] md:text-8xl">
            Saved Echoes.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-500">
            Revisit the Echoes that worked, rename them, edit them, or share
            them as links.
          </p>
        </section>

        {/* EMPTY */}
        {playlists.length === 0 && (
          <section className="mt-10 rounded-[30px] border border-white/[0.07] bg-[#111111] px-8 py-20 text-center">
            <p className="text-2xl font-bold">
              Nothing saved yet.
            </p>

            <p className="mx-auto mt-3 max-w-md text-zinc-500">
              Build an Echo and save it when you find something worth
              keeping.
            </p>

            <button
              onClick={() => router.push("/")}
              className="mt-8 rounded-full bg-[#1DB954] px-8 py-4 font-bold text-black transition hover:scale-[1.02]"
            >
              Create an Echo
            </button>
          </section>
        )}

        {/* PLAYLISTS */}
        {playlists.length > 0 && (
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((playlist) => {
              const artwork = playlist.tracks
                .filter((track) => track.image)
                .slice(0, 4);

              const isEditing =
                editingId === playlist.id;

              return (
                <article
                  key={playlist.id}
                  className="group rounded-[28px] border border-white/[0.07] bg-[#111111] p-4 transition hover:border-white/[0.13]"
                >
                  {/* COVER */}
                  <button
                    onClick={() => openPlaylist(playlist.id)}
                    className="grid aspect-square w-full grid-cols-2 overflow-hidden rounded-[20px] bg-zinc-900"
                  >
                    {artwork.map((track, index) => (
                      <div
                        key={`${track.id}-${index}`}
                        className="overflow-hidden"
                      >
                        <img
                          src={track.image!}
                          alt=""
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                      </div>
                    ))}

                    {artwork.length === 0 && (
                      <div className="col-span-2 flex items-center justify-center text-5xl font-black text-zinc-800">
                        echo
                      </div>
                    )}
                  </button>

                  <div className="px-2 pb-2 pt-5">
                    {/* NAME */}
                    {isEditing ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              saveRename(playlist.id);
                            }

                            if (event.key === "Escape") {
                              cancelRename();
                            }
                          }}
                          className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 py-2 font-semibold outline-none focus:border-[#1DB954]/60"
                        />

                        <button
                          onClick={() =>
                            saveRename(playlist.id)
                          }
                          className="rounded-xl bg-[#1DB954] px-4 text-sm font-bold text-black"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() =>
                            openPlaylist(playlist.id)
                          }
                          className="min-w-0 text-left"
                        >
                          <h2 className="truncate text-xl font-bold">
                            {playlist.name}
                          </h2>
                        </button>

                        <button
                          onClick={() =>
                            startRename(playlist)
                          }
                          className="shrink-0 text-xs text-zinc-600 transition hover:text-white"
                        >
                          Rename
                        </button>
                      </div>
                    )}

                    <p className="mt-2 text-sm text-zinc-600">
                      {playlist.tracks.length} songs
                    </p>

                    <p className="mt-1 text-xs text-zinc-700">
                      {new Date(
                        playlist.createdAt
                      ).toLocaleDateString()}
                    </p>

                    {/* ACTIONS */}
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          openPlaylist(playlist.id)
                        }
                        className="rounded-full border border-white/[0.08] px-4 py-3 text-sm font-semibold transition hover:bg-white/[0.05]"
                      >
                        View
                      </button>

                      <button
                        onClick={() => sendToSpotify(playlist)}
                        disabled={!SPOTIFY_PLAYLISTS_ENABLED}
                        title={SPOTIFY_PLAYLISTS_UNAVAILABLE_MESSAGE}
                        className="rounded-full bg-[#1DB954] px-4 py-3 text-sm font-bold text-black transition hover:bg-[#22cf63] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {SPOTIFY_PLAYLISTS_ENABLED
                          ? savingSpotifyId === playlist.id
                            ? "Saving..."
                            : "Spotify"
                          : "Spotify paused"}
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        deletePlaylist(playlist.id)
                      }
                      className="mt-3 w-full text-center text-xs text-zinc-700 transition hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
