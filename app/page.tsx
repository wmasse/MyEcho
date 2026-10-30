"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Image from "next/image";
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

type GenreMap = Record<string, Genre>;

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

type PopularAlbum = {
  id: string;
  name: string;
  artist: string;
  image: string;
};

const POPULAR_ALBUMS: PopularAlbum[] = [
  {
    id: "midnights",
    name: "Midnights",
    artist: "Taylor Swift",
    image:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fa747621a53c8e2cc436dee0",
  },
  {
    id: "after-hours",
    name: "After Hours",
    artist: "The Weeknd",
    image:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028863bc11d2aa12b54f5aeb36",
  },
  {
    id: "sour",
    name: "SOUR",
    artist: "Olivia Rodrigo",
    image:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02a91c10fe9472d9bd89802e5a",
  },
  {
    id: "un-verano-sin-ti",
    name: "Un Verano Sin Ti",
    artist: "Bad Bunny",
    image:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0249d694203245f241a1bcaa72",
  },
  {
    id: "starboy",
    name: "Starboy",
    artist: "The Weeknd",
    image:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e024718e2b124f79258be7bc452",
  },
  {
    id: "damn",
    name: "DAMN.",
    artist: "Kendrick Lamar",
    image:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028b52c6b9bc4e43d873869699",
  },
  {
    id: "happier-than-ever",
    name: "Happier Than Ever",
    artist: "Billie Eilish",
    image:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e022a038d3bf875d23e4aeaa84e",
  },
];

function randomPopularAlbums() {
  const albums = [...POPULAR_ALBUMS];

  for (
    let index = albums.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() * (index + 1)
      );

    [
      albums[index],
      albums[randomIndex],
    ] = [
      albums[randomIndex],
      albums[index],
    ];
  }

  return albums.slice(0, 4);
}

function primaryArtist(
  artist: string
) {
  return artist
    .split(",")[0]
    .trim();
}

function artistKey(
  artist: string
) {
  return primaryArtist(
    artist
  ).toLowerCase();
}

function normalizeSearchText(
  value: string
) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Home() {
  const router = useRouter();

  const [
    heroAlbums,
    setHeroAlbums,
  ] = useState<PopularAlbum[]>(
    POPULAR_ALBUMS.slice(0, 4)
  );

  /*
   * SPOTIFY LIBRARY
   */
  const [
    tracks,
    setTracks,
  ] = useState<Track[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    connected,
    setConnected,
  ] = useState<boolean | null>(
    null
  );

  const [
    loadedCount,
    setLoadedCount,
  ] = useState(0);

  const [
    totalCount,
    setTotalCount,
  ] = useState(0);

  const [
    error,
    setError,
  ] = useState("");

  const [
    libraryLoadFailed,
    setLibraryLoadFailed,
  ] = useState(false);

  const [
    librarySkipped,
    setLibrarySkipped,
  ] = useState(false);

  /*
   * GLOBAL SEARCH
   */
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    spotifyResults,
    setSpotifyResults,
  ] = useState<Track[]>([]);

  const [
    lastFmResults,
    setLastFmResults,
  ] = useState<Track[]>([]);

  const [
    searchingSpotify,
    setSearchingSpotify,
  ] = useState(false);

  const [
    searchingLastFm,
    setSearchingLastFm,
  ] = useState(false);

  const [
    spotifySearchError,
    setSpotifySearchError,
  ] = useState("");

  const [
    spotifySearchNeedsConnection,
    setSpotifySearchNeedsConnection,
  ] = useState(false);

  /*
   * SEEDS
   */
  const [
    selected,
    setSelected,
  ] = useState<Track[]>([]);

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
  const [
    sortMode,
    setSortMode,
  ] = useState<SortMode>(
    "recent"
  );

  /*
   * EFFECT GUARDS
   */
  const libraryStarted =
    useRef(false);

  const genresStarted =
    useRef(false);

  const libraryLoadController =
    useRef<AbortController | null>(
      null
    );

  const tracksRef = useRef(tracks);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  /*
   * LOAD CACHE ONCE
   *
   * IMPORTANT:
   * This does NOT contact Spotify.
   */
  useEffect(() => {
    if (
      libraryStarted.current
    ) {
      return;
    }

    libraryStarted.current =
      true;

    loadCachedLibrary();
  }, []);

  useEffect(() => {
    setHeroAlbums(
      randomPopularAlbums()
    );
  }, []);

  /*
   * LOAD / BUILD GENRE CACHE
   */
  useEffect(() => {
    if (
      loading ||
      tracks.length === 0 ||
      genresStarted.current
    ) {
      return;
    }

    genresStarted.current =
      true;

    void loadGenres();
  }, [loading, tracks]);

  /*
   * GLOBAL SPOTIFY SEARCH
   */
  useEffect(() => {
    const query =
      search.trim();

    if (!query) {
      setSpotifyResults([]);
      setLastFmResults([]);
      setSearchingSpotify(
        false
      );
      setSearchingLastFm(false);
      setSpotifySearchError(
        ""
      );
      setSpotifySearchNeedsConnection(
        false
      );

      return;
    }

    setSpotifyResults([]);
    setLastFmResults([]);
    setSpotifySearchError("");
    setSpotifySearchNeedsConnection(false);
    setSearchingSpotify(true);

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        async () => {
          let shouldTryLastFm = true;

          try {
            setSpotifySearchError(
              ""
            );

            setSpotifySearchNeedsConnection(
              false
            );

            const response =
              await fetch(
                `/api/spotify/search?q=${encodeURIComponent(
                  query
                )}`,
                {
                  cache:
                    "no-store",
                  signal:
                    controller.signal,
                }
              );

            const data =
              await response.json();

            if (!response.ok) {
              if (
                response.status ===
                401
              ) {
                shouldTryLastFm = false;
                setSpotifySearchNeedsConnection(
                  true
                );
              }

              if (
                response.status === 403 ||
                response.status === 429
              ) {
                shouldTryLastFm = false;
              }

              throw new Error(
                response.status ===
                  401
                  ? "Connect Spotify to search songs and build blends."
                  : "Spotify search failed. Please try again."
              );
            }

            setConnected(true);

            const spotifyTracks = data.tracks ?? [];

            if (spotifyTracks.length === 0) {
              throw new Error("No Spotify matches found.");
            }

            setSpotifyResults(spotifyTracks);
          } catch (err) {
            if (
              err instanceof
                DOMException &&
              err.name ===
                "AbortError"
            ) {
              return;
            }

            console.error(
              err
            );

            setSpotifyResults(
              []
            );

            const normalizedQuery =
              normalizeSearchText(query);

            const hasCachedMatches =
              tracksRef.current.some((track) =>
                normalizeSearchText(
                  `${track.name} ${track.artist} ${track.album}`
                ).includes(normalizedQuery)
              );

            if (
              shouldTryLastFm &&
              !hasCachedMatches &&
              !controller.signal.aborted
            ) {
              setSearchingLastFm(true);

              try {
                const fallbackResponse = await fetch(
                  `/api/spotify/search/fallback?q=${encodeURIComponent(query)}`,
                  {
                    cache: "no-store",
                    signal: controller.signal,
                  }
                );

                if (fallbackResponse.ok) {
                  const fallbackData = await fallbackResponse.json();
                  setLastFmResults(fallbackData.tracks ?? []);
                }
              } catch (fallbackError) {
                if (
                  !(fallbackError instanceof DOMException) ||
                  fallbackError.name !== "AbortError"
                ) {
                  console.error("Last.fm search fallback failed:", fallbackError);
                }
              } finally {
                if (!controller.signal.aborted) {
                  setSearchingLastFm(false);
                }
              }
            }

            setSpotifySearchError(
              err instanceof Error
                ? err.message
                : "Spotify search failed."
            );
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
      clearTimeout(
        timeout
      );
      controller.abort();
    };
  }, [search]);

  /*
   * LOAD CACHED LIBRARY
   *
   * Cache does not expire.
   * No Spotify API request happens here.
   */
  function loadCachedLibrary() {
    setLoading(true);

    setError("");

    setLibraryLoadFailed(
      false
    );

    try {
      const cached =
        localStorage.getItem(
          "echoSpotifyLibrary"
        );

      if (cached) {
        const cachedTracks: Track[] =
          JSON.parse(cached);

        setTracks(
          cachedTracks
        );

        setLoadedCount(
          cachedTracks.length
        );

        setTotalCount(
          cachedTracks.length
        );

        setConnected(true);
      } else {
        setTracks([]);

        setLoadedCount(0);

        setTotalCount(0);

        /*
         * We don't know yet whether
         * Spotify is connected because
         * we intentionally haven't
         * contacted Spotify.
         */
        setConnected(null);
      }
    } catch (err) {
      console.error(
        "Library cache error:",
        err
      );

      setTracks([]);
      setLoadedCount(0);
      setTotalCount(0);
      setConnected(null);
    } finally {
      setLoading(false);
    }
  }

  /*
   * MANUAL LIBRARY REFRESH
   *
   * This is the only function here
   * that calls /api/liked.
   */
  async function refreshLibrary() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    setLibraryLoadFailed(
      false
    );

    setLibrarySkipped(
      false
    );

    let offset = 0;

    let allTracks: Track[] =
      [];

    const controller =
      new AbortController();

    libraryLoadController.current =
      controller;

    try {
      while (true) {
        const response =
          await fetch(
            `/api/liked?offset=${offset}`,
            {
              cache:
                "no-store",
              signal:
                controller.signal,
            }
          );

        /*
         * AUTH EXPIRED
         */
        if (
          response.status ===
          401
        ) {
          if (
            tracks.length ===
            0
          ) {
            setConnected(
              false
            );

            setLibraryLoadFailed(
              true
            );
          }

          throw new Error(
            "Spotify needs to be reconnected before your library can refresh."
          );
        }

        setConnected(true);

        const data =
          await response.json();

        /*
         * DEVELOPMENT QUOTA
         */
        if (
          response.status ===
          429
        ) {
          throw new Error(
            "Spotify's development quota has been reached. Your existing cached library has not been changed."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.details ||
              data?.error ||
              `Spotify library request failed: ${response.status}`
          );
        }

        setTotalCount(
          data.total
        );

        allTracks = [
          ...allTracks,
          ...(data.tracks ??
            []),
        ];

        setLoadedCount(
          allTracks.length
        );

        /*
         * Show progress while refreshing.
         */
        setTracks([
          ...allTracks,
        ]);

        if (
          data.nextOffset ===
          null
        ) {
          break;
        }

        offset =
          data.nextOffset;

        /*
         * Small pause between pages.
         */
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              300
            )
        );
      }

      /*
       * ONLY overwrite the cache
       * after the full refresh succeeds.
       */
      localStorage.setItem(
        "echoSpotifyLibrary",
        JSON.stringify(
          allTracks
        )
      );

      localStorage.setItem(
        "echoSpotifyLibraryCachedAt",
        Date.now().toString()
      );

      setTracks(
        allTracks
      );

      setLoadedCount(
        allTracks.length
      );

      setTotalCount(
        allTracks.length
      );

      /*
       * Let genres process any new artists.
       */
      genresStarted.current =
        false;
    } catch (err) {
      if (
        err instanceof
          DOMException &&
        err.name ===
          "AbortError"
      ) {
        return;
      }

      console.error(err);

      /*
       * Restore old cache after
       * any failed refresh.
       */
      try {
        const cached =
          localStorage.getItem(
            "echoSpotifyLibrary"
          );

        if (cached) {
          const cachedTracks: Track[] =
            JSON.parse(cached);

          setTracks(
            cachedTracks
          );

          setLoadedCount(
            cachedTracks.length
          );

          setTotalCount(
            cachedTracks.length
          );

          setConnected(true);
        } else {
          setTracks([]);

          setLoadedCount(0);

          setTotalCount(0);

          setLibraryLoadFailed(
            true
          );
        }
      } catch {
        setLibraryLoadFailed(
          true
        );
      }

      setError(
        err instanceof Error
          ? err.message
          : "Echo had trouble refreshing your Spotify library."
      );
    } finally {
      if (
        libraryLoadController.current ===
        controller
      ) {
        libraryLoadController.current =
          null;
      }

      setLoading(false);
    }
  }

  function continueWithoutLoading() {
    libraryLoadController.current?.abort();

    setLibrarySkipped(
      true
    );

    setLibraryLoadFailed(
      false
    );

    setTracks([]);

    setLoadedCount(0);

    setTotalCount(0);

    setError("");
  }

  /*
   * LOAD GENRES
   */
  async function loadGenres() {
    let cache: GenreMap =
      {};

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
          tracks.map(
            (track) =>
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
            artistKey(
              artist
            )
          ]
      );

    setGenresTotal(
      missing.length
    );

    if (
      missing.length === 0
    ) {
      setGenresLoading(
        false
      );

      return;
    }

    setGenresLoading(
      true
    );

    setGenresProcessed(
      0
    );

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
                  artists:
                    batch,
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
            JSON.stringify(
              cache
            )
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

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            250
          )
      );
    }

    setGenresLoading(
      false
    );
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
          item.id ===
          track.id
      );

    if (
      alreadySelected
    ) {
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
      selected.length >=
      5
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
            track.id !==
            id
        )
    );
  }

  /*
   * OPEN ECHO BUILDER
   */
  function findEcho() {
    if (
      selected.length ===
      0
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

    router.push(
      "/echo"
    );
  }

  /*
   * FILTER + SORT LIKED SONGS
   */
  const libraryTracks =
    useMemo(() => {
      let result =
        genreFilter ===
        "All"
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
        sortMode ===
        "title"
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
        sortMode ===
        "artist"
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
              artistCompare !==
              0
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

      return result;
    }, [
      tracks,
      artistGenres,
      genreFilter,
      sortMode,
    ]);

  const cachedSearchResults =
    useMemo(() => {
      const query =
        normalizeSearchText(search);

      if (!query) {
        return [];
      }

      return tracks.filter((track) => {
        const searchableText =
          normalizeSearchText(
            `${track.name} ${track.artist} ${track.album}`
          );

        return searchableText.includes(query);
      });
    }, [search, tracks]);

  const visibleTracks =
    search.trim()
      ? spotifySearchError
        ? cachedSearchResults.length > 0
          ? cachedSearchResults
          : lastFmResults
        : spotifyResults
      : libraryTracks;

  const showingLibrarySearchFallback =
    Boolean(search.trim()) &&
    Boolean(spotifySearchError) &&
    cachedSearchResults.length > 0;

  const showingLastFmSearchFallback =
    Boolean(search.trim()) &&
    Boolean(spotifySearchError) &&
    cachedSearchResults.length === 0 &&
    lastFmResults.length > 0;

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
              router.push(
                "/"
              )
            }
            className="text-2xl font-black tracking-[-0.05em]"
          >
            echo
          </button>

          <div className="flex items-center gap-7">
            {connected &&
              !librarySkipped && (
                <span className="hidden text-sm text-zinc-600 sm:block">
                  {loading
                    ? `${loadedCount.toLocaleString()} / ${totalCount.toLocaleString()}`
                    : `${tracks.length.toLocaleString()} songs`}
                </span>
              )}

            {librarySkipped && (
              <span className="hidden text-sm text-zinc-600 sm:block">
                Library skipped
              </span>
            )}

            {!librarySkipped && (
              <button
                type="button"
                onClick={() => {
                  void refreshLibrary();
                }}
                disabled={
                  loading
                }
                className="text-sm text-zinc-500 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Refreshing..."
                  : tracks.length >
                      0
                    ? "Refresh library"
                    : "Load library"}
              </button>
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
        <section className="pb-16 pt-14 md:pb-20 md:pt-16">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#1DB954]">
            Your music, reorganized
          </p>

          <h1 className="sr-only">
            Popular albums to inspire your next blend
          </h1>

          <div
            aria-label="A random selection of popular album covers"
            role="list"
            className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-5 md:gap-x-7"
          >
            {heroAlbums.map(
              (
                album,
                index
              ) => (
                <article
                  key={
                    album.id
                  }
                  role="listitem"
                  className={`group min-w-0 ${
                    index %
                      2 ===
                    1
                      ? "sm:translate-y-5"
                      : ""
                  }`}
                >
                  <div className="relative aspect-square overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition duration-500 group-hover:-translate-y-1">
                    <Image
                      src={
                        album.image
                      }
                      alt={`${album.name} by ${album.artist} album cover`}
                      fill
                      sizes="(max-width: 639px) 42vw, (max-width: 1279px) 22vw, 270px"
                      className="object-cover"
                    />
                  </div>

                  <p className="mt-3 truncate text-sm font-semibold text-white">
                    {
                      album.name
                    }
                  </p>

                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {
                      album.artist
                    }
                  </p>
                </article>
              )
            )}
          </div>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-400 md:text-xl">
            Pick up to five
            songs from anywhere
            on Spotify. Echo
            builds a playlist
            around their shared
            sound.
          </p>
        </section>

        {/* ERROR */}
        {error && (
          <section className="mb-8 rounded-[24px] border border-red-500/20 bg-red-500/[0.06] p-5">
            <p className="text-sm text-red-400">
              {error}
            </p>
          </section>
        )}

        {/* LIBRARY LOAD FAILED */}
        {!loading &&
          libraryLoadFailed && (
            <section className="mb-8 flex flex-col gap-6 rounded-[30px] border border-white/[0.07] bg-[#111111] p-8 md:flex-row md:items-center md:justify-between md:p-10">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Your library
                  couldn’t load.
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                  Your existing
                  cached library
                  will remain
                  untouched. You
                  can reconnect
                  Spotify or
                  continue without
                  loading it.
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <a
                  href="/api/spotify/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.12] px-6 font-semibold text-white transition hover:bg-white/[0.06]"
                >
                  Connect Spotify
                </a>

                <button
                  type="button"
                  onClick={
                    continueWithoutLoading
                  }
                  className="min-h-12 rounded-full bg-[#1DB954] px-6 font-bold text-black transition hover:bg-[#22cf63]"
                >
                  Continue without
                  loading
                </button>
              </div>
            </section>
          )}

        {/* NO CACHE YET */}
        {!loading &&
          connected === null &&
          tracks.length ===
            0 &&
          !librarySkipped && (
            <section className="mb-20 rounded-[30px] border border-white/[0.07] bg-[#111111] p-8 md:p-12">
              <h2 className="text-4xl font-bold tracking-tight">
                Open up your
                library.
              </h2>

              <p className="mt-4 max-w-xl text-lg text-zinc-400">
                Echo will not
                fetch your Liked
                Songs
                automatically.
                Load them once,
                then your cached
                library stays on
                this device until
                you choose to
                refresh it.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void refreshLibrary();
                  }}
                  disabled={
                    loading
                  }
                  className="inline-flex min-h-16 items-center justify-center rounded-full bg-[#1DB954] px-10 text-lg font-bold text-black transition hover:scale-[1.02] hover:bg-[#22cf63] disabled:opacity-40"
                >
                  {loading
                    ? "Loading..."
                    : "Load library"}
                </button>

                <a
                  href="/api/spotify/login"
                  className="inline-flex min-h-16 items-center justify-center rounded-full border border-white/[0.12] px-8 text-lg font-semibold text-white transition hover:bg-white/[0.06]"
                >
                  Connect Spotify
                </a>

                <button
                  type="button"
                  onClick={
                    continueWithoutLoading
                  }
                  className="inline-flex min-h-16 items-center justify-center rounded-full border border-white/[0.08] px-8 text-lg font-semibold text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Continue without
                  library
                </button>
              </div>
            </section>
          )}

        {(connected ||
          librarySkipped ||
          tracks.length >
            0) && (
          <>
            {/* SEARCH BAR */}
            <section className="sticky top-0 z-20 -mx-6 border-y border-white/[0.06] bg-[#070707]/90 px-6 py-5 backdrop-blur-xl md:-mx-10 md:px-10 lg:-mx-14 lg:px-14">
              <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    Choose your
                    sound
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {
                      selected.length
                    }
                    /5 selected
                  </p>
                </div>

                <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row md:max-w-[460px]">
                  <div className="w-full min-w-0 flex-1">
                    <input
                      value={
                        search
                      }
                      onChange={(
                        event
                      ) =>
                        setSearch(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Search any song on Spotify..."
                      className="h-12 w-full rounded-full border border-white/[0.08] bg-white/[0.05] px-5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#1DB954]/50 focus:bg-white/[0.07]"
                    />
                  </div>

                  {selected.length >
                    0 && (
                    <button
                      type="button"
                      onClick={
                        findEcho
                      }
                      className="min-h-12 shrink-0 rounded-full bg-[#1DB954] px-6 font-bold text-black transition hover:bg-[#22cf63] sm:px-5"
                    >
                      Continue to
                      Echo →
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* LIBRARY LOAD BAR */}
            {loading &&
              !librarySkipped &&
              !search && (
                <section className="py-8">
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full bg-[#1DB954] transition-all duration-300"
                      style={{
                        width:
                          totalCount >
                          0
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
                        ? showingLibrarySearchFallback
                          ? "Saved library"
                          : showingLastFmSearchFallback
                            ? "Last.fm matches"
                          : "Spotify"
                        : librarySkipped
                          ? "Library skipped"
                          : "Your library"}
                    </p>

                    <h2 className="mt-2 text-4xl font-bold tracking-tight">
                      {search
                        ? searchingSpotify
                          ? searchingLastFm
                            ? "Searching Last.fm..."
                            : "Searching Spotify..."
                          : showingLibrarySearchFallback
                            ? "Saved library matches"
                            : showingLastFmSearchFallback
                              ? "Last.fm matches"
                            : "Spotify results"
                        : librarySkipped
                          ? "Search for songs you love"
                          : "Songs you love"}
                    </h2>
                  </div>

                  {search && (
                    <button
                      onClick={() =>
                        setSearch(
                          ""
                        )
                      }
                      className="text-sm text-zinc-600 transition hover:text-white"
                    >
                      Back to Liked
                      Songs
                    </button>
                  )}
                </div>

                {/* LIBRARY CONTROLS */}
                {!search &&
                  !librarySkipped &&
                  tracks.length >
                    0 && (
                    <div className="mt-7 space-y-5">
                      {/* GENRE FILTERS */}
                      <div className="flex flex-wrap gap-2">
                        {GENRES.map(
                          (
                            genre
                          ) => (
                            <button
                              key={
                                genre
                              }
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
                              {
                                genre
                              }
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
                          Recently
                          liked
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
                          {
                            libraryTracks.length
                          }{" "}
                          songs
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
                            Sorting
                            genres{" "}
                            {genresProcessed.toLocaleString()}
                            {" / "}
                            {genresTotal.toLocaleString()}{" "}
                            artists
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {!search &&
                  librarySkipped && (
                    <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500">
                      Search Spotify
                      to choose up
                      to five songs,
                      then build a
                      blend around
                      them.
                    </p>
                  )}
              </div>

              {spotifySearchError && (
                <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-zinc-300">
                  <p>
                    {
                      spotifySearchError
                    }
                  </p>

                  {showingLibrarySearchFallback && (
                    <p className="mt-2 text-zinc-500">
                      Showing matching songs from your saved library. Select a match to build an Echo.
                    </p>
                  )}

                  {showingLastFmSearchFallback && (
                    <p className="mt-2 text-zinc-500">
                      Found through Last.fm and matched to Spotify, so these songs are ready to use in your Echo.
                    </p>
                  )}

                  {(!connected ||
                    spotifySearchNeedsConnection) && (
                    <a
                      href="/api/spotify/login"
                      className="mt-3 inline-flex font-semibold text-[#1DB954] transition hover:text-[#22cf63]"
                    >
                      Connect Spotify
                    </a>
                  )}
                </div>
              )}

              {/* SEARCH LOADER */}
              {search &&
                searchingSpotify && (
                  <div className="flex min-h-[280px] items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-[#1DB954]" />

                      <p className="mt-4 text-sm text-zinc-600">
                        Searching
                        Spotify...
                      </p>
                    </div>
                  </div>
                )}

              {/* TRACK GRID */}
              {!searchingSpotify && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {visibleTracks.map(
                    (
                      track
                    ) => {
                      const isSelected =
                        selected.some(
                          (
                            item
                          ) =>
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
                          key={
                            track.id
                          }
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
                            {
                              track.name
                            }
                          </p>

                          <p className="mt-1 truncate text-sm text-zinc-500">
                            {
                              track.artist
                            }
                          </p>

                          {!search &&
                            genre &&
                            genre !==
                              "All" && (
                              <p className="mt-1 truncate text-xs text-zinc-700">
                                {
                                  genre
                                }
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
                        ? spotifySearchError
                          ? tracks.length > 0
                            ? "No matching songs found in your saved library or Last.fm."
                            : "Spotify search failed and no Last.fm matches are available."
                          : "No Spotify results found."
                        : librarySkipped
                          ? "Search Spotify above to choose your first song."
                          : genresLoading
                            ? "Echo is still sorting this category."
                            : "No songs found in this category."}
                    </p>
                  </div>
                )}
            </section>
          </>
        )}
      </div>

      {/* SEED TRAY */}
      {selected.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-24px)] max-w-6xl -translate-x-1/2">
          <div className="rounded-[28px] border border-white/[0.1] bg-[#171717]/95 p-4 shadow-2xl shadow-black/70 backdrop-blur-2xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
                {selected.map(
                  (
                    track
                  ) => (
                    <div
                      key={
                        track.id
                      }
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
                          {
                            track.name
                          }
                        </p>

                        <p className="truncate text-xs text-zinc-500">
                          {
                            track.artist
                          }
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
                type="button"
                onClick={
                  findEcho
                }
                className="min-h-14 shrink-0 rounded-full bg-[#1DB954] px-8 font-bold text-black transition hover:scale-[1.02] hover:bg-[#22cf63] active:scale-[0.98]"
              >
                Continue to Echo →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
