"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ShareEchoButton from "@/components/ShareEchoButton";

type Track = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;
};

type EchoResult = Track & {
  source: "seed" | "library" | "discovery";
  echoScore: number;
  matchedSeeds: number;
};

type Mix = {
  requestedLibraryPercent: number;
  requestedLibraryCount: number;
  requestedDiscoveryCount: number;
  libraryCount: number;
  discoveryCount: number;
  seedCount?: number;
  total: number;
};

type SavedEcho = {
  id: string;
  name: string;
  createdAt: string;
  tracks: EchoResult[];
  seeds: Track[];
};

export default function EchoPage() {
  const router = useRouter();

  const [seeds, setSeeds] = useState<Track[]>([]);
  const [library, setLibrary] = useState<Track[]>([]);

  const [results, setResults] = useState<EchoResult[]>([]);
  const [mix, setMix] = useState<Mix | null>(null);

  const [playlistSize, setPlaylistSize] = useState(25);
  const [libraryPercent, setLibraryPercent] = useState(70);

  const [includeDiscovery, setIncludeDiscovery] = useState(true);
  const [includeSeeds, setIncludeSeeds] = useState(true);

  const [playlistName, setPlaylistName] = useState("My Echo");

  const [finding, setFinding] = useState(true);
  const [savingSpotify, setSavingSpotify] = useState(false);
  const [savingEcho, setSavingEcho] = useState(false);

  const [error, setError] = useState("");

  const [savedSpotifyUrl, setSavedSpotifyUrl] = useState<string | null>(
    null
  );

  useEffect(() => {
    const savedSeeds = sessionStorage.getItem("echoSeeds");
    const savedLibrary = sessionStorage.getItem("echoLibrary");

    if (!savedSeeds || !savedLibrary) {
      router.push("/");
      return;
    }

    try {
      const parsedSeeds: Track[] = JSON.parse(savedSeeds);
      const parsedLibrary: Track[] = JSON.parse(savedLibrary);

      setSeeds(parsedSeeds);
      setLibrary(parsedLibrary);

      generateEcho(
        parsedSeeds,
        parsedLibrary,
        25,
        70,
        true,
        true
      );
    } catch (err) {
      console.error(err);
      router.push("/");
    }
  }, []);

  async function generateEcho(
    seedTracks = seeds,
    libraryTracks = library,
    size = playlistSize,
    percent = libraryPercent,
    discovery = includeDiscovery,
    seedInclusion = includeSeeds
  ) {
    if (seedTracks.length === 0) return;

    setFinding(true);
    setError("");
    setSavedSpotifyUrl(null);

    try {
      const response = await fetch("/api/echo", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          seeds: seedTracks,
          library: libraryTracks,
          playlistSize: seedInclusion
            ? Math.max(
                5,
                size - seedTracks.length
              )
            : size,
          libraryPercent: discovery ? percent : 100,
          includeDiscovery: discovery,
          includeSeeds: seedInclusion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Echo couldn't build this playlist."
        );
      }

      const seedIds = new Set(
        seedTracks.map((track) => track.id)
      );
      const includedSeedResults: EchoResult[] =
        seedInclusion
          ? seedTracks.map((track) => ({
              ...track,
              source: "seed",
              echoScore: 100,
              matchedSeeds: 1,
            }))
          : [];
      const recommendationSlots = Math.max(
        0,
        size - includedSeedResults.length
      );
      const recommendationResults: EchoResult[] = (
        data.results ?? []
      )
        .filter((track: EchoResult) => !seedIds.has(track.id))
        .slice(0, recommendationSlots);

      setResults([
        ...includedSeedResults,
        ...recommendationResults,
      ]);
      setMix(data.mix ?? null);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Echo couldn't build this playlist."
      );
    } finally {
      setFinding(false);
    }
  }

  function removeResult(id: string) {
    setResults((current) =>
      current.filter((track) => track.id !== id)
    );
  }

  function saveToEcho() {
    if (results.length === 0) return;

    setSavingEcho(true);
    setError("");

    try {
      const raw =
        localStorage.getItem("echoSavedPlaylists");

      let existing: SavedEcho[] = [];

      try {
        existing = raw ? JSON.parse(raw) : [];
      } catch {
        existing = [];
      }

      const savedPlaylist: SavedEcho = {
        id: crypto.randomUUID(),

        name:
          playlistName.trim() ||
          "My Echo",

        createdAt:
          new Date().toISOString(),

        tracks: results,
        seeds,
      };

      const updated = [
        savedPlaylist,
        ...existing,
      ];

      localStorage.setItem(
        "echoSavedPlaylists",
        JSON.stringify(updated)
      );

      router.push("/saved");
    } catch (err) {
      console.error(err);

      setError(
        "Could not save this Echo."
      );

      setSavingEcho(false);
    }
  }

  async function saveToSpotify() {
    if (results.length === 0) return;

    setSavingSpotify(true);
    setError("");
    setSavedSpotifyUrl(null);

    try {
      const response = await fetch(
        "/api/spotify/playlist",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name:
              playlistName.trim() ||
              "My Echo",

            description:
              "Created with Echo.",

            uris: results.map(
              (track) => track.uri
            ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not save playlist to Spotify."
        );
      }

      setSavedSpotifyUrl(
        data.playlist.url
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

  const likedPercent =
    includeDiscovery
      ? libraryPercent
      : 100;

  const discoveryPercent =
    100 - likedPercent;

  const seedCount =
    results.filter(
      (track) =>
        track.source === "seed"
    ).length;

  const likedCount =
    results.filter(
      (track) =>
        track.source === "library"
    ).length;

  const newCount =
    results.filter(
      (track) =>
        track.source === "discovery"
    ).length;

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-500px] h-[750px] w-[1200px] -translate-x-1/2 rounded-full bg-[#1DB954]/10 blur-[190px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-6 pb-20 md:px-10 lg:px-14">
        {/* NAV */}
        <nav className="flex h-24 items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-2xl font-black tracking-[-0.05em]"
          >
            echo
          </button>

          <div className="flex items-center gap-7 text-sm">
            <button
              onClick={() => router.push("/")}
              className="text-zinc-500 transition hover:text-white"
            >
              ← Change songs
            </button>

            <button
              onClick={() => router.push("/saved")}
              className="text-zinc-500 transition hover:text-white"
            >
              Saved
            </button>
          </div>
        </nav>

        {/* HEADER */}
        <section className="pb-14 pt-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1DB954]">
            Your Echo
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] md:text-7xl">
            This feels right.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-500">
            Adjust the balance between songs you already love and
            music you haven't discovered yet.
          </p>

          {/* SEEDS */}
          <div className="mt-8 flex flex-wrap gap-3">
            {seeds.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.04] py-2 pl-2 pr-4"
              >
                <div className="h-9 w-9 overflow-hidden rounded-full bg-zinc-800">
                  {track.image && (
                    <img
                      src={track.image}
                      alt=""
                      className="h-full w-full object-cover"
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

        {/* MAIN */}
        <section className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_390px]">
          {/* RESULTS */}
          <div>
            {finding ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-zinc-800 border-t-[#1DB954]" />

                  <p className="mt-5 font-semibold">
                    Finding your Echo...
                  </p>

                  <p className="mt-2 text-sm text-zinc-600">
                    Searching around the songs you chose.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* SUMMARY */}
                <div className="mb-8">
                  <p className="text-sm text-zinc-600">
                    {results.length} songs
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    {seedCount > 0 && (
                      <>
                        <span className="text-white">
                          {seedCount}{" "}
                          seed
                          {seedCount === 1
                            ? ""
                            : "s"}
                        </span>

                        {" · "}
                      </>
                    )}

                    {likedCount} liked
                    {" · "}

                    <span className="text-[#1DB954]">
                      {newCount} new
                    </span>
                  </p>
                </div>

                {/* TRACK LIST */}
                <div className="space-y-1">
                  {results.map(
                    (track, index) => (
                      <div
                        key={track.id}
                        className="group flex items-center gap-4 rounded-[18px] px-3 py-3 transition hover:bg-white/[0.045]"
                      >
                        <div className="w-7 text-center text-sm text-zinc-700">
                          {index + 1}
                        </div>

                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                          {track.image && (
                            <img
                              src={track.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">
                            {track.name}
                          </p>

                          <p className="mt-1 truncate text-sm text-zinc-500">
                            {track.artist}
                          </p>
                        </div>

                        {/* SOURCE LABEL */}
                        <span
                          className={`hidden rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] sm:block ${
                            track.source ===
                            "seed"
                              ? "bg-white text-black"
                              : track.source ===
                                "library"
                              ? "bg-white/[0.06] text-zinc-500"
                              : "bg-[#1DB954]/10 text-[#1DB954]"
                          }`}
                        >
                          {track.source ===
                          "seed"
                            ? "Seed"
                            : track.source ===
                              "library"
                            ? "Liked"
                            : "New"}
                        </span>

                        {/* SCORE */}
                        <div className="hidden w-14 text-right md:block">
                          <p className="text-sm font-semibold text-[#1DB954]">
                            {track.echoScore}%
                          </p>
                        </div>

                        {/* OPEN */}
                        <a
                          href={`https://open.spotify.com/track/${track.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hidden text-xs text-zinc-600 transition hover:text-white lg:block"
                        >
                          Open
                        </a>

                        {/* REMOVE */}
                        <button
                          onClick={() =>
                            removeResult(
                              track.id
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-zinc-700 transition hover:bg-white/[0.08] hover:text-white"
                          aria-label={`Remove ${track.name}`}
                        >
                          ×
                        </button>
                      </div>
                    )
                  )}
                </div>

                {results.length === 0 && (
                  <div className="rounded-[28px] border border-white/[0.07] bg-[#111111] px-8 py-16 text-center">
                    <p className="text-xl font-bold">
                      No matches found.
                    </p>

                    <p className="mt-3 text-sm text-zinc-500">
                      Try changing your seeds or playlist settings.
                    </p>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="mt-8 text-sm text-red-400">
                {error}
              </p>
            )}
          </div>

          {/* CONTROLS */}
          <aside>
            <div className="sticky top-8 rounded-[30px] border border-white/[0.08] bg-[#111111] p-7 shadow-2xl shadow-black/40">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
                Build your Echo
              </p>

              {/* NAME */}
              <input
                value={playlistName}
                onChange={(event) =>
                  setPlaylistName(
                    event.target.value
                  )
                }
                className="mt-6 w-full border-b border-white/[0.08] bg-transparent pb-3 text-2xl font-bold outline-none transition focus:border-[#1DB954]/60"
              />

              {/* SIZE */}
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-400">
                    Playlist size
                  </p>

                  <p className="font-semibold">
                    {playlistSize}
                  </p>
                </div>

                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={playlistSize}
                  onChange={(event) =>
                    setPlaylistSize(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className="mt-4 w-full accent-[#1DB954]"
                />
              </div>

              {/* DISCOVERY */}
              <div className="mt-8 border-t border-white/[0.07] pt-8">
                <button
                  type="button"
                  onClick={() =>
                    setIncludeDiscovery(
                      (current) =>
                        !current
                    )
                  }
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="pr-6">
                    <p className="font-semibold">
                      Discover new music
                    </p>

                    <p className="mt-1 text-sm leading-5 text-zinc-600">
                      Include songs outside your Liked Songs.
                    </p>
                  </div>

                  <div
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      includeDiscovery
                        ? "bg-[#1DB954]"
                        : "bg-zinc-800"
                    }`}
                  >
                    <div
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                        includeDiscovery
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  </div>
                </button>
              </div>

              {/* MIX */}
              <div
                className={`mt-8 transition ${
                  includeDiscovery
                    ? ""
                    : "pointer-events-none opacity-30"
                }`}
              >
                <div className="flex justify-between">
                  <div>
                    <p className="text-xl font-bold">
                      {likedPercent}%
                    </p>

                    <p className="text-xs text-zinc-600">
                      Liked
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-[#1DB954]">
                      {discoveryPercent}%
                    </p>

                    <p className="text-xs text-zinc-600">
                      New
                    </p>
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={libraryPercent}
                  disabled={!includeDiscovery}
                  onChange={(event) =>
                    setLibraryPercent(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className="mt-4 w-full accent-[#1DB954]"
                />
              </div>

              {/* INCLUDE SEEDS */}
              <div className="mt-8 border-t border-white/[0.07] pt-8">
                <button
                  type="button"
                  disabled={finding}
                  onClick={() => {
                    const nextIncludeSeeds = !includeSeeds;
                    setIncludeSeeds(nextIncludeSeeds);
                    void generateEcho(
                      seeds,
                      library,
                      playlistSize,
                      libraryPercent,
                      includeDiscovery,
                      nextIncludeSeeds
                    );
                  }}
                  className="flex w-full items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="pr-6">
                    <p className="font-semibold">
                      Include seed songs
                    </p>

                    <p className="mt-1 text-sm leading-5 text-zinc-600">
                      Put the songs you chose directly into the final playlist.
                    </p>
                  </div>

                  <div
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      includeSeeds
                        ? "bg-[#1DB954]"
                        : "bg-zinc-800"
                    }`}
                  >
                    <div
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                        includeSeeds
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  </div>
                </button>
              </div>

              {/* REGENERATE */}
              <button
                onClick={() =>
                  generateEcho()
                }
                disabled={finding}
                className="mt-9 min-h-14 w-full rounded-full border border-white/[0.1] font-semibold transition hover:bg-white/[0.06] disabled:opacity-40"
              >
                {finding
                  ? "Finding..."
                  : "Regenerate Echo"}
              </button>

              {/* SAVE TO ECHO */}
              <button
                onClick={saveToEcho}
                disabled={
                  savingEcho ||
                  finding ||
                  results.length === 0
                }
                className="mt-3 min-h-14 w-full rounded-full border border-white/[0.1] font-bold transition hover:bg-white/[0.06] disabled:opacity-40"
              >
                {savingEcho
                  ? "Saving..."
                  : "Save to Echo"}
              </button>

              {/* SHARE */}
              <ShareEchoButton
                name={
                  playlistName.trim() ||
                  "My Echo"
                }
                tracks={results}
                seeds={seeds}
                disabled={
                  finding ||
                  results.length === 0
                }
                className="mt-3 min-h-14 w-full rounded-full border border-white/[0.1] font-bold transition hover:bg-white/[0.06] disabled:opacity-40"
              />

              {/* SPOTIFY */}
              <button
                onClick={saveToSpotify}
                disabled={
                  savingSpotify ||
                  finding ||
                  results.length === 0
                }
                className="mt-3 min-h-14 w-full rounded-full bg-[#1DB954] font-bold text-black transition hover:scale-[1.01] hover:bg-[#22cf63] disabled:opacity-40"
              >
                {savingSpotify
                  ? "Saving..."
                  : "Save to Spotify"}
              </button>

              {savedSpotifyUrl && (
                <a
                  href={savedSpotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200"
                >
                  Open in Spotify ↗
                </a>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
