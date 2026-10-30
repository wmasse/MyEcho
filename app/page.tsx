"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type Track = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;
  addedAt?: string;
};

type LibraryResponse = {
  tracks: Track[];
  total: number;
  nextOffset: number | null;
};

const GENRES = [
  "All",
  "Indie / Alternative",
  "Rock",
  "Hip-Hop / Rap",
  "R&B / Soul",
  "Pop",
  "Electronic",
  "Metal / Punk",
  "Dreamy / Ambient",
  "Folk / Country",
  "Jazz / Classical",
  "Other",
] as const;

type Genre = (typeof GENRES)[number];

type SortMode =
  | "recent"
  | "title"
  | "artist";

type GenreMap = Record<string, Genre>;

function primaryArtist(artist: string) {
  return artist
    .split(",")[0]
    .trim();
}

function artistKey(artist: string) {
  return primaryArtist(artist)
    .toLowerCase();
}

export default function Home() {
  const router = useRouter();

  /*
   * SPOTIFY LIBRARY
   */
  const [tracks, setTracks] =
    useState<Track[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [connected, setConnected] =
    useState<boolean | null>(null);

  const [loadedCount, setLoadedCount] =
    useState(0);

  const [totalCount, setTotalCount] =
    useState(0);

  const [error, setError] =
    useState("");

  /*
   * GLOBAL SEARCH
   */
  const [search, setSearch] =
    useState("");

  const [
    spotifyResults,
    setSpotifyResults,
  ] = useState<Track[]>([]);

  const [
    searchingSpotify,
    setSearchingSpotify,
  ] = useState(false);

  /*
   * SEEDS
   */
  const [selected, setSelected] =
    useState<Track[]>([]);

  /*
   * GENRES
   */
  const [
    genreFilter,
    setGenreFilter,
  ] = useState<Genre>("All");

  const [
    artistGenres,
    setArtistGenres,
  ] = useState<GenreMap>({});

  const [
    genresLoading,
    setGenresLoading,
  ] = useState(false);

  const [
    genresProcessed,
    setGenresProcessed,
  ] = useState(0);

  const [
    genresTotal,
    setGenresTotal,
  ] = useState(0);

  /*
   * SORT
   */
  const [sortMode, setSortMode] =
    useState<SortMode>("recent");

  /*
   * EFFECT GUARDS
   */
  const libraryStarted =
    useRef(false);

  const genresStarted =
    useRef(false);

  /*
   * LOAD LIBRARY ONCE
   */
  useEffect(() => {
    if (libraryStarted.current) {
      return;
    }

    libraryStarted.current = true;

    loadLibrary();
  }, []);

  /*
   * LOAD / BUILD GENRE CACHE
   *
   * This only starts after the entire
   * Spotify library has finished loading.
   */
  useEffect(() => {
    if (
      loading ||
      tracks.length === 0 ||
      genresStarted.current
    ) {
      return;
    }

    genresStarted.current = true;

    loadGenres();
  }, [loading, tracks]);

  /*
   * GLOBAL SPOTIFY SEARCH
   */
  useEffect(() => {
    const query =
      search.trim();

    if (!query) {
      setSpotifyResults([]);
      setSearchingSpotify(false);

      return;
    }

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        async () => {
          setSearchingSpotify(true);

          try {
            const response =
              await fetch(
                `/api/spotify/search?q=${encodeURIComponent(
                  query
                )}`,
                {
                  cache: "no-store",
                  signal:
                    controller.signal,
                }
              );

            const data =
              await response.json();

            if (!response.ok) {
              throw new Error(
                data.error ||
                  "Spotify search failed."
              );
            }

            setSpotifyResults(
              data.tracks ?? []
            );
          } catch (err) {
            if (
              err instanceof DOMException &&
              err.name ===
                "AbortError"
            ) {
              return;
            }

            console.error(err);

            setSpotifyResults([]);
          } finally {
            if (
              !controller.signal
                .aborted
            ) {
              setSearchingSpotify(
                false
              );
            }
          }
        },
        350
      );

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  /*
   * LOAD LIKED SONGS
   */
  async function loadLibrary() {
    setLoading(true);
    setError("");

    let offset = 0;
    let allTracks: Track[] = [];

    try {
      while (true) {
        const response =
          await fetch(
            `/api/liked?offset=${offset}`,
            {
              cache: "no-store",
            }
          );

        if (
          response.status === 401
        ) {
          setConnected(false);
          setTracks([]);

          return;
        }

        if (!response.ok) {
          throw new Error(
            `Spotify library request failed: ${response.status}`
          );
        }

        const data: LibraryResponse =
          await response.json();

        setConnected(true);
        setTotalCount(data.total);

        allTracks = [
          ...allTracks,
          ...data.tracks,
        ];

        setTracks([
          ...allTracks,
        ]);

        setLoadedCount(
          allTracks.length
        );

        if (
          data.nextOffset ===
          null
        ) {
          break;
        }

        offset =
          data.nextOffset;
      }
    } catch (err) {
      console.error(err);

      setError(
        "Echo had trouble loading your Spotify library."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * LOAD GENRES
   *
   * 1. Read cached artists immediately.
   * 2. Find artists still missing.
   * 3. Send them to one batch endpoint
   *    in groups instead of one request
   *    per artist.
   * 4. Save results locally.
   */
  async function loadGenres() {
    let cache: GenreMap = {};

    try {
      const saved =
        localStorage.getItem(
          "echoArtistGenres"
        );

      if (saved) {
        cache =
          JSON.parse(saved);

        setArtistGenres({
          ...cache,
        });
      }
    } catch {
      cache = {};
    }

    const uniqueArtists =
      Array.from(
        new Set(
          tracks.map((track) =>
            primaryArtist(
              track.artist
            )
          )
        )
      );

    const missing =
      uniqueArtists.filter(
        (artist) =>
          !cache[
            artistKey(artist)
          ]
      );

    setGenresTotal(
      missing.length
    );

    if (
      missing.length === 0
    ) {
      setGenresLoading(false);
      return;
    }

    setGenresLoading(true);
    setGenresProcessed(0);

    /*
     * Browser makes only one request
     * for every 25 artists.
     */
    const batchSize = 25;

    for (
      let i = 0;
      i < missing.length;
      i += batchSize
    ) {
      const batch =
        missing.slice(
          i,
          i + batchSize
        );

      try {
        const response =
          await fetch(
            "/api/genre/batch",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  artists: batch,
                }),
            }
          );

        const data =
          await response.json();

        if (
          response.ok &&
          data.genres
        ) {
          cache = {
            ...cache,
            ...data.genres,
          };

          setArtistGenres({
            ...cache,
          });

          localStorage.setItem(
            "echoArtistGenres",
            JSON.stringify(cache)
          );
        }
      } catch (err) {
        console.error(
          "Genre batch failed:",
          err
        );
      }

      setGenresProcessed(
        Math.min(
          i +
            batch.length,
          missing.length
        )
      );

      /*
       * Small pause between batches.
       *
       * Keeps Last.fm + local dev
       * server happy.
       */
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            250
          )
      );
    }

    setGenresLoading(false);
  }

  /*
   * SEED SELECTION
   */
  function toggleTrack(
    track: Track
  ) {
    const alreadySelected =
      selected.some(
        (item) =>
          item.id === track.id
      );

    if (alreadySelected) {
      setSelected(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              track.id
          )
      );

      return;
    }

    if (
      selected.length >= 5
    ) {
      return;
    }

    setSelected(
      (current) => [
        ...current,
        track,
      ]
    );
  }

  function removeTrack(
    id: string
  ) {
    setSelected(
      (current) =>
        current.filter(
          (track) =>
            track.id !== id
        )
    );
  }

  /*
   * OPEN ECHO BUILDER
   */
  function findEcho() {
    if (
      selected.length === 0
    ) {
      return;
    }

    sessionStorage.setItem(
      "echoSeeds",
      JSON.stringify(
        selected
      )
    );

    sessionStorage.setItem(
      "echoLibrary",
      JSON.stringify(
        tracks
      )
    );

    router.push("/echo");
  }

  /*
   * FILTER + SORT LIKED SONGS
   */
  const libraryTracks =
    useMemo(() => {
      let result =
        genreFilter === "All"
          ? [...tracks]
          : tracks.filter(
              (track) =>
                artistGenres[
                  artistKey(
                    track.artist
                  )
                ] ===
                genreFilter
            );

      if (
        sortMode === "title"
      ) {
        result.sort(
          (a, b) =>
            a.name.localeCompare(
              b.name,
              undefined,
              {
                sensitivity:
                  "base",
              }
            )
        );
      }

      if (
        sortMode === "artist"
      ) {
        result.sort(
          (a, b) => {
            const artistCompare =
              a.artist.localeCompare(
                b.artist,
                undefined,
                {
                  sensitivity:
                    "base",
                }
              );

            if (
              artistCompare !== 0
            ) {
              return artistCompare;
            }

            return a.name.localeCompare(
              b.name,
              undefined,
              {
                sensitivity:
                  "base",
              }
            );
          }
        );
      }

      /*
       * "recent" preserves Spotify's
       * Liked Songs ordering.
       */
      return result;
    }, [
      tracks,
      artistGenres,
      genreFilter,
      sortMode,
    ]);

  /*
   * Search results replace the library
   * browser while searching.
   */
  const visibleTracks =
    search.trim()
      ? spotifyResults
      : libraryTracks;

  const libraryIds =
    useMemo(
      () =>
        new Set(
          tracks.map(
            (track) =>
              track.id
          )
        ),
      [tracks]
    );

  return (
    <main className="min-h-screen bg-[#070707] pb-44 text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-400px] h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[#1DB954]/10 blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 md:px-10 lg:px-14">
        {/* NAV */}
        <nav className="flex h-24 items-center justify-between">
          <button
            onClick={() =>
              router.push("/")
            }
            className="text-2xl font-black tracking-[-0.05em]"
          >
            echo
          </button>

          <div className="flex items-center gap-7">
            {connected && (
              <span className="hidden text-sm text-zinc-600 sm:block">
                {loading
                  ? `${loadedCount.toLocaleString()} / ${totalCount.toLocaleString()}`
                  : `${tracks.length.toLocaleString()} songs`}
              </span>
            )}

            <button
              onClick={() =>
                router.push(
                  "/saved"
                )
              }
              className="text-sm text-zinc-500 transition hover:text-white"
            >
              Saved
            </button>
          </div>
        </nav>

        {/* HERO */}
        <section className="pb-16 pt-16 md:pb-20 md:pt-24">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#1DB954]">
            Your music, reorganized
          </p>

          <h1 className="max-w-5xl text-6xl font-black leading-[0.92] tracking-[-0.06em] sm:text-7xl md:text-8xl lg:text-[96px]">
            Find the songs
            <br />
            that{" "}
            <span className="text-[#1DB954]">
              feel the same.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-400 md:text-xl">
            Pick up to five songs from anywhere on Spotify.
            Echo builds a playlist around their shared sound.
          </p>
        </section>

        {/* NOT CONNECTED */}
        {!loading &&
          !connected && (
            <section className="mb-20 rounded-[30px] border border-white/[0.07] bg-[#111111] p-8 md:p-12">
              <h2 className="text-4xl font-bold tracking-tight">
                Open up your library.
              </h2>

              <p className="mt-4 max-w-xl text-lg text-zinc-400">
                Connect Spotify so Echo can use your Liked Songs
                and search the full Spotify catalog.
              </p>

              <a
                href="/api/spotify/login"
                className="mt-8 inline-flex min-h-16 items-center justify-center rounded-full bg-[#1DB954] px-10 text-lg font-bold text-black transition hover:scale-[1.02] hover:bg-[#22cf63]"
              >
                Connect Spotify
              </a>
            </section>
          )}

        {connected && (
          <>
            {/* SEARCH BAR */}
            <section className="sticky top-0 z-20 -mx-6 border-y border-white/[0.06] bg-[#070707]/90 px-6 py-5 backdrop-blur-xl md:-mx-10 md:px-10 lg:-mx-14 lg:px-14">
              <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    Choose your sound
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {selected.length}/5 selected
                  </p>
                </div>

                <div className="w-full md:max-w-md">
                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search any song on Spotify..."
                    className="h-12 w-full rounded-full border border-white/[0.08] bg-white/[0.05] px-5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#1DB954]/50 focus:bg-white/[0.07]"
                  />
                </div>
              </div>
            </section>

            {/* LIBRARY LOAD BAR */}
            {loading &&
              !search && (
                <section className="py-8">
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full bg-[#1DB954] transition-all duration-300"
                      style={{
                        width:
                          totalCount > 0
                            ? `${
                                (loadedCount /
                                  totalCount) *
                                100
                              }%`
                            : "0%",
                      }}
                    />
                  </div>

                  <p className="mt-3 text-sm text-zinc-600">
                    Loading{" "}
                    {loadedCount.toLocaleString()}{" "}
                    of{" "}
                    {totalCount.toLocaleString()}{" "}
                    songs
                  </p>
                </section>
              )}

            {/* TRACK BROWSER */}
            <section className="py-14">
              <div className="mb-8">
                <div className="flex items-end justify-between gap-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-600">
                      {search
                        ? "Spotify"
                        : "Your library"}
                    </p>

                    <h2 className="mt-2 text-4xl font-bold tracking-tight">
                      {search
                        ? searchingSpotify
                          ? "Searching Spotify..."
                          : "Spotify results"
                        : "Songs you love"}
                    </h2>
                  </div>

                  {search && (
                    <button
                      onClick={() =>
                        setSearch("")
                      }
                      className="text-sm text-zinc-600 transition hover:text-white"
                    >
                      Back to Liked Songs
                    </button>
                  )}
                </div>

                {/* LIBRARY CONTROLS */}
                {!search && (
                  <div className="mt-7 space-y-5">
                    {/* GENRE FILTERS */}
                    <div className="flex flex-wrap gap-2">
                      {GENRES.map(
                        (genre) => (
                          <button
                            key={genre}
                            onClick={() =>
                              setGenreFilter(
                                genre
                              )
                            }
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                              genreFilter ===
                              genre
                                ? "bg-[#1DB954] text-black"
                                : "border border-white/[0.08] bg-white/[0.03] text-zinc-500 hover:bg-white/[0.07] hover:text-white"
                            }`}
                          >
                            {genre}
                          </button>
                        )
                      )}
                    </div>

                    {/* SORT */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700">
                        Sort
                      </span>

                      <button
                        onClick={() =>
                          setSortMode(
                            "recent"
                          )
                        }
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          sortMode ===
                          "recent"
                            ? "bg-white text-black"
                            : "border border-white/[0.08] text-zinc-500 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        Recently liked
                      </button>

                      <button
                        onClick={() =>
                          setSortMode(
                            "title"
                          )
                        }
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          sortMode ===
                          "title"
                            ? "bg-white text-black"
                            : "border border-white/[0.08] text-zinc-500 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        Song A–Z
                      </button>

                      <button
                        onClick={() =>
                          setSortMode(
                            "artist"
                          )
                        }
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          sortMode ===
                          "artist"
                            ? "bg-white text-black"
                            : "border border-white/[0.08] text-zinc-500 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        Artist A–Z
                      </button>

                      <span className="ml-auto text-sm text-zinc-700">
                        {libraryTracks.length} songs
                      </span>
                    </div>

                    {/* GENRE PROGRESS */}
                    {genresLoading && (
                      <div>
                        <div className="h-[2px] overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full bg-[#1DB954]/60 transition-all duration-300"
                            style={{
                              width:
                                genresTotal >
                                0
                                  ? `${
                                      (genresProcessed /
                                        genresTotal) *
                                      100
                                    }%`
                                  : "0%",
                            }}
                          />
                        </div>

                        <p className="mt-2 text-xs text-zinc-700">
                          Sorting genres{" "}
                          {genresProcessed.toLocaleString()}
                          {" / "}
                          {genresTotal.toLocaleString()}{" "}
                          artists
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SEARCH LOADER */}
              {search &&
                searchingSpotify && (
                  <div className="flex min-h-[280px] items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#1DB954]" />

                      <p className="mt-4 text-sm text-zinc-600">
                        Searching Spotify...
                      </p>
                    </div>
                  </div>
                )}

              {/* TRACK GRID */}
              {!searchingSpotify && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {visibleTracks.map(
                    (track) => {
                      const isSelected =
                        selected.some(
                          (item) =>
                            item.id ===
                            track.id
                        );

                      const maxReached =
                        selected.length >=
                          5 &&
                        !isSelected;

                      const isLiked =
                        libraryIds.has(
                          track.id
                        );

                      const genre =
                        artistGenres[
                          artistKey(
                            track.artist
                          )
                        ];

                      return (
                        <button
                          key={track.id}
                          onClick={() =>
                            toggleTrack(
                              track
                            )
                          }
                          disabled={
                            maxReached
                          }
                          className={`group text-left transition ${
                            maxReached
                              ? "cursor-default opacity-35"
                              : ""
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
                              <img
                                src={
                                  track.image
                                }
                                alt={`${track.name} album cover`}
                                className={`h-full w-full object-cover transition duration-300 ${
                                  isSelected
                                    ? "scale-[0.97] opacity-75"
                                    : "group-hover:scale-[1.035]"
                                }`}
                              />
                            )}

                            {isSelected && (
                              <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#1DB954] text-sm font-black text-black">
                                ✓
                              </div>
                            )}

                            {search &&
                              isLiked &&
                              !isSelected && (
                                <div className="absolute bottom-3 left-3 rounded-full bg-black/75 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
                                  Liked
                                </div>
                              )}
                          </div>

                          <p
                            className={`mt-4 truncate font-semibold ${
                              isSelected
                                ? "text-[#1DB954]"
                                : "text-white"
                            }`}
                          >
                            {track.name}
                          </p>

                          <p className="mt-1 truncate text-sm text-zinc-500">
                            {track.artist}
                          </p>

                          {!search &&
                            genre &&
                            genre !==
                              "All" && (
                              <p className="mt-1 truncate text-xs text-zinc-700">
                                {genre}
                              </p>
                            )}
                        </button>
                      );
                    }
                  )}
                </div>
              )}

              {/* EMPTY */}
              {!searchingSpotify &&
                visibleTracks.length ===
                  0 && (
                  <div className="py-24 text-center">
                    <p className="font-semibold text-zinc-500">
                      {search
                        ? "No Spotify results found."
                        : genresLoading
                        ? "Echo is still sorting this category."
                        : "No songs found in this category."}
                    </p>
                  </div>
                )}
            </section>
          </>
        )}

        {error && (
          <p className="pb-10 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* SEED TRAY */}
      {selected.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-24px)] max-w-6xl -translate-x-1/2">
          <div className="rounded-[28px] border border-white/[0.1] bg-[#171717]/95 p-4 shadow-2xl shadow-black/70 backdrop-blur-2xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
                {selected.map(
                  (track) => (
                    <div
                      key={track.id}
                      className="flex min-w-[190px] max-w-[220px] shrink-0 items-center gap-3 rounded-[16px] bg-white/[0.05] p-2 pr-3"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                        {track.image && (
                          <img
                            src={
                              track.image
                            }
                            alt=""
                            className="h-full w-full object-cover"
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
                        onClick={() =>
                          removeTrack(
                            track.id
                          )
                        }
                        className="text-lg text-zinc-600 transition hover:text-white"
                        aria-label={`Remove ${track.name}`}
                      >
                        ×
                      </button>
                    </div>
                  )
                )}
              </div>

              <button
                onClick={findEcho}
                className="min-h-14 shrink-0 rounded-full bg-[#1DB954] px-8 font-bold text-black transition hover:scale-[1.02] hover:bg-[#22cf63] active:scale-[0.98]"
              >
                Find the Echo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}