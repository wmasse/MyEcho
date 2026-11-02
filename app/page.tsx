"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import EchoRingsHero from "@/components/home/EchoRingsHero";
import LibraryStart from "@/components/home/LibraryStart";
import LoadMore from "@/components/home/LoadMore";
import SeedTray from "@/components/home/SeedTray";
import TrackCard from "@/components/home/TrackCard";
import {
  GENRES,
  POPULAR_ALBUMS,
  artistKey,
  formatSpotifyCountdown,
  normalizeSearchText,
  parseRetryAfterSeconds,
  primaryArtist,
  shuffledPopularAlbums,
  type Genre,
  type GenreMap,
  type PopularAlbum,
  type SortMode,
  type Track,
} from "@/lib/home";

const TRACKS_PER_BATCH = 60;

export default function Home() {
  const router = useRouter();

  const [
    heroAlbums,
    setHeroAlbums,
  ] = useState<PopularAlbum[]>(
    POPULAR_ALBUMS
  );

  const [heroPaused, setHeroPaused] = useState(false);

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
    appleResults,
    setAppleResults,
  ] = useState<Track[]>([]);

  const [
    searchingSpotify,
    setSearchingSpotify,
  ] = useState(false);

  const [
    searchingApple,
    setSearchingApple,
  ] = useState(false);

  const [
    spotifySearchError,
    setSpotifySearchError,
  ] = useState("");

  const [
    spotifyRetryUntil,
    setSpotifyRetryUntil,
  ] = useState<number | null>(null);

  const [
    spotifyCountdownNow,
    setSpotifyCountdownNow,
  ] = useState(0);

  const [
    appleSearchError,
    setAppleSearchError,
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

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // On phones, only one search box shows at a time: the hero's while it's
  // on screen, then the sticky bar's once it has scrolled away.
  const [
    heroSearchInView,
    setHeroSearchInView,
  ] = useState(true);
  const tracksRef = useRef(tracks);

  function handleSearchChange(value: string) {
    setSearch(value);
    setSpotifyResults([]);
    setAppleResults([]);
    setSpotifySearchError("");
    setAppleSearchError("");
    setSpotifySearchNeedsConnection(false);
    setSearchingApple(false);
    setSearchingSpotify(Boolean(value.trim()));
  }

  /*
   * Search from the hero (its search box or a cover). New visitors who
   * haven't picked a start option yet are treated as "Just search", so
   * the results area is on screen. Then jump to the results.
   */
  function startSearch(query: string) {
    const resultsVisible =
      connected || librarySkipped || tracks.length > 0;

    if (!resultsVisible) {
      continueWithoutLoading();
    }

    if (search !== query) {
      handleSearchChange(query);
    }

    // Wait a frame so the results area exists before scrolling to it.
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      document.getElementById("start")?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });

      // On phones, leave the keyboard closed so the results show.
      if (window.matchMedia("(min-width: 640px)").matches) {
        searchInputRef.current?.focus({ preventScroll: true });
      }
    });
  }

  function searchPopularAlbum(album: PopularAlbum) {
    startSearch(album.name);
  }

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    if (spotifyRetryUntil === null) {
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      setSpotifyCountdownNow(now);

      if (now >= spotifyRetryUntil) {
        setSpotifyRetryUntil(null);
      }
    };

    const interval = window.setInterval(
      updateCountdown,
      1000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [spotifyRetryUntil]);

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

    // eslint-disable-next-line react-hooks/immutability -- Function declarations are hoisted; this effect runs after the render that creates it.
    loadCachedLibrary();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep server and first client render deterministic, then randomize after hydration.
    setHeroAlbums(
      shuffledPopularAlbums()
    );

    const controller = new AbortController();

    async function loadPopularAlbums() {
      try {
        const response = await fetch(
          "/api/popular-albums",
          { signal: controller.signal }
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          albums?: PopularAlbum[];
        };

        if (data.albums?.length) {
          setHeroAlbums(
            shuffledPopularAlbums(data.albums)
          );
        }
      } catch {
        // Keep the curated albums if the chart is unavailable.
      }
    }

    void loadPopularAlbums();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (
      heroPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setHeroAlbums((albums) => [
        ...albums.slice(1),
        albums[0],
      ]);
    }, 5200);

    return () => window.clearInterval(interval);
  }, [heroPaused]);

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

    // eslint-disable-next-line react-hooks/immutability -- Function declarations are hoisted; this effect uses the current render's tracks.
    void loadGenres();
  }, [loading, tracks]);

  /*
   * GLOBAL SPOTIFY SEARCH
   */
  useEffect(() => {
    const query =
      search.trim();

    if (!query) {
      return;
    }

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        async () => {
          let spotifyRateLimited = false;

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
              if (response.status === 429) {
                spotifyRateLimited = true;

                const retryAfterSeconds =
                  parseRetryAfterSeconds(
                    response.headers.get("Retry-After")
                  );

                if (
                  retryAfterSeconds !== null &&
                  retryAfterSeconds > 0
                ) {
                  const now = Date.now();
                  setSpotifyRetryUntil(
                    now + retryAfterSeconds * 1000
                  );
                  setSpotifyCountdownNow(now);
                }

                throw new Error("Spotify search rate limited.");
              }

              if (
                response.status ===
                401
              ) {
                setSpotifySearchNeedsConnection(
                  true
                );
              }

              throw new Error(
                response.status ===
                  401
                  ? "Connect Spotify to search songs and build blends."
                  : "Spotify search failed. Please try again."
              );
            }

            setSpotifyRetryUntil(null);
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
              !hasCachedMatches &&
              !controller.signal.aborted
            ) {
              setSearchingApple(true);

              try {
                const fallbackResponse = await fetch(
                  `/api/apple/search?q=${encodeURIComponent(query)}`,
                  {
                    cache: "no-store",
                    signal: controller.signal,
                  }
                );

                const fallbackData = await fallbackResponse.json();
                if (fallbackResponse.ok) {
                  setAppleResults(fallbackData.tracks ?? []);
                } else {
                  setAppleSearchError(
                    typeof fallbackData.error === "string"
                      ? fallbackData.error
                      : "Apple catalog search could not be completed. Please try again."
                  );
                }
              } catch (fallbackError) {
                if (
                  !(fallbackError instanceof DOMException) ||
                  fallbackError.name !== "AbortError"
                ) {
                  console.error("Apple catalog search fallback failed:", fallbackError);
                  setAppleSearchError(
                    "Apple catalog search could not be reached. Please try again."
                  );
                }
              } finally {
                if (!controller.signal.aborted) {
                  setSearchingApple(false);
                }
              }
            }

            setSpotifySearchError(
              spotifyRateLimited
                ? "Spotify is temporarily rate limiting searches."
                : err instanceof Error
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
          const retryAfterSeconds =
            parseRetryAfterSeconds(
              response.headers.get("Retry-After")
            );

          if (
            retryAfterSeconds !== null &&
            retryAfterSeconds > 0
          ) {
            const now = Date.now();
            setSpotifyRetryUntil(
              now + retryAfterSeconds * 1000
            );
            setSpotifyCountdownNow(now);
          }

          throw new Error(
            "Spotify's development quota has been reached. Your existing cached library has not been changed."
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
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

  /*
   * Songs pasted from the Spotify app become
   * the library, cached the same way as liked
   * songs so the mix page can use them.
   */
  function applyImportedSongs(pasted: Omit<Track, "addedAt">[]) {
    // Keep the pasted order: the first song counts as the most recently added.
    const now = Date.now();
    const imported: Track[] = pasted.map((track, index) => ({
      ...track,
      addedAt: new Date(now - index * 1000).toISOString(),
    }));

    try {
      localStorage.setItem(
        "echoSpotifyLibrary",
        JSON.stringify(imported)
      );
      localStorage.setItem(
        "echoSpotifyLibraryCachedAt",
        Date.now().toString()
      );
    } catch {
      // Storage can be full or blocked; the songs still work for this visit.
    }

    setTracks(imported);
    setLoadedCount(imported.length);
    setTotalCount(imported.length);
    setLibrarySkipped(false);
    setLibraryLoadFailed(false);
    setError("");
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
      const result =
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
          : appleResults
        : spotifyResults
      : libraryTracks;

  const spotifyRetrySeconds =
    spotifyRetryUntil !== null &&
    spotifyCountdownNow > 0
      ? Math.max(
          0,
          Math.ceil(
            (spotifyRetryUntil - spotifyCountdownNow) / 1000
          )
        )
      : 0;

  const spotifyRetryCountdown =
    formatSpotifyCountdown(spotifyRetrySeconds);

  const showingLibrarySearchFallback =
    Boolean(search.trim()) &&
    Boolean(spotifySearchError) &&
    cachedSearchResults.length > 0;

  const showingAppleSearchFallback =
    Boolean(search.trim()) &&
    Boolean(spotifySearchError) &&
    cachedSearchResults.length === 0 &&
    appleResults.length > 0;

  /*
   * Big libraries render in batches, so a
   * phone isn't building thousands of cards
   * up front. The count resets whenever the
   * list itself changes.
   */
  const listKey = `${genreFilter}|${sortMode}|${search}`;

  const [
    shownLimit,
    setShownLimit,
  ] = useState({ key: listKey, count: TRACKS_PER_BATCH });

  const shownCount =
    shownLimit.key === listKey
      ? shownLimit.count
      : TRACKS_PER_BATCH;

  const shownTracks =
    visibleTracks.slice(0, shownCount);

  function showMoreTracks() {
    setShownLimit({
      key: listKey,
      count: shownCount + TRACKS_PER_BATCH,
    });
  }

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
        <div className="echo-glow absolute inset-x-0 top-0 h-[520px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 md:px-10 lg:px-14">
        {/* NAV */}
        <SiteNav
          current="create"
          library={
            connected
              ? {
                  summary: librarySkipped
                    ? "Library not loaded"
                    : loading
                      ? `Loading ${loadedCount.toLocaleString()} of ${totalCount.toLocaleString()} songs`
                      : `${tracks.length.toLocaleString()} liked songs`,
                  refreshLabel: loading
                    ? "Refreshing…"
                    : tracks.length > 0
                      ? "Refresh library"
                      : "Load library",
                  refreshing: loading,
                  onRefresh: librarySkipped
                    ? undefined
                    : () => {
                        void refreshLibrary();
                      },
                }
              : undefined
          }
        />

        {/* HERO */}
        <EchoRingsHero
          albums={heroAlbums}
          onPausedChange={setHeroPaused}
          onSelect={searchPopularAlbum}
          onSearch={startSearch}
          onSearchInViewChange={setHeroSearchInView}
        />

        {/* ERROR */}
        {error && (
          <section className="mb-8 rounded-[24px] border border-red-500/20 bg-red-500/[0.06] p-5">
            <p className="text-sm text-red-400">
              {error}
            </p>
            {spotifyRetrySeconds > 0 && (
              <p className="mt-2 text-sm text-red-300">
                Spotify should be available again in {spotifyRetryCountdown}.
              </p>
            )}
          </section>
        )}

        {/* LIBRARY LOAD FAILED */}
        {!loading &&
          libraryLoadFailed &&
          tracks.length > 0 && (
            <section className="mb-8 flex flex-col gap-6 rounded-[30px] border border-white/[0.07] bg-[#111111] p-6 sm:p-8 md:flex-row md:items-center md:justify-between md:p-10">
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

        {/* START: no library yet */}
        {!loading &&
          tracks.length === 0 &&
          !librarySkipped &&
          (connected === null || libraryLoadFailed) && (
            <LibraryStart
              onLoadLiked={() => {
                void refreshLibrary();
              }}
              onSkip={continueWithoutLoading}
              onImported={applyImportedSongs}
            />
          )}

        {(connected ||
          librarySkipped ||
          tracks.length >
            0) && (
          <>
            {/* SEARCH BAR */}
            <section id="start" className="sticky top-0 z-20 -mx-6 border-y border-white/[0.06] bg-[#070707]/90 px-6 py-3 backdrop-blur-xl sm:py-5 md:-mx-10 md:px-10 lg:-mx-14 lg:px-14">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-baseline justify-between gap-3 md:block">
                  <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                    Choose your
                    sound
                  </h2>

                  <p className="text-sm text-zinc-500 md:mt-1">
                    {selected.length === 0
                      ? "Select one to five songs"
                      : `${selected.length} of 5 selected`}
                  </p>
                </div>

                <div
                  className={`flex w-full min-w-0 flex-col gap-3 sm:flex-row md:max-w-[460px] max-sm:absolute max-sm:inset-x-0 max-sm:top-full max-sm:border-b max-sm:border-white/[0.06] max-sm:bg-[#070707]/95 max-sm:px-6 max-sm:pb-3 max-sm:backdrop-blur-xl ${
                    heroSearchInView ? "max-sm:hidden" : ""
                  }`}
                >
                  <div className="w-full min-w-0 flex-1">
                    <input
                      id="song-search"
                      ref={searchInputRef}
                      value={
                        search
                      }
                      onChange={(
                        event
                      ) =>
                        handleSearchChange(
                          event
                            .target
                            .value
                        )
                      }
                      placeholder="Search for any song..."
                      className="h-12 w-full rounded-full border border-white/[0.08] bg-white/[0.05] px-5 text-base text-white sm:text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#1DB954]/50 focus:bg-white/[0.07]"
                    />
                  </div>

                  {selected.length >
                    0 && (
                    <button
                      type="button"
                      onClick={
                        findEcho
                      }
                      className="hidden min-h-12 shrink-0 rounded-full bg-[#1DB954] px-6 font-bold text-black transition hover:bg-[#22cf63] sm:block sm:px-5"
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
                          : showingAppleSearchFallback
                            ? "Apple Music"
                          : "Spotify"
                        : librarySkipped
                          ? "Library skipped"
                          : "Your library"}
                    </p>

                    <h2 className="mt-2 text-4xl font-bold tracking-tight">
                      {search
                        ? searchingSpotify
                          ? searchingApple
                            ? "Searching Apple Music..."
                            : "Searching Spotify..."
                          : showingLibrarySearchFallback
                            ? "Saved library matches"
                            : showingAppleSearchFallback
                              ? "Apple Music matches"
                            : "Spotify results"
                        : librarySkipped
                          ? "Search for songs you love"
                          : "Songs you love"}
                    </h2>
                  </div>

                  {search && (
                    <button
                      onClick={() =>
                        handleSearchChange(
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
                      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
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
                              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
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
                      <div className="-mx-6 flex items-center gap-2 overflow-x-auto px-6 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                        <span className="mr-2 shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700">
                          Sort
                        </span>

                        <button
                          onClick={() =>
                            setSortMode(
                              "recent"
                            )
                          }
                          className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
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
                          className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
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
                          className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                            sortMode ===
                            "artist"
                              ? "bg-white text-black"
                              : "border border-white/[0.08] text-zinc-500 hover:bg-white/[0.05] hover:text-white"
                          }`}
                        >
                          Artist A–Z
                        </button>

                        <span className="ml-auto shrink-0 whitespace-nowrap pl-2 text-sm text-zinc-700">
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

              {(spotifySearchError ||
                spotifyRetrySeconds > 0) && (
                <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-zinc-300">
                  {spotifySearchError && (
                    <p>
                      {spotifySearchError}
                    </p>
                  )}

                  {spotifyRetrySeconds > 0 && (
                    <p className="mt-2 text-zinc-500">
                      Spotify search should be available again in{" "}
                      {spotifyRetryCountdown}.
                    </p>
                  )}

                  {showingLibrarySearchFallback && (
                    <p className="mt-2 text-zinc-500">
                      Showing matching songs from your saved library. Select a match to build an Echo.
                    </p>
                  )}

                  {showingAppleSearchFallback && (
                    <p className="mt-2 text-zinc-500">
                      Found in Apple Music’s catalog. Select these songs as seeds; Echo can find related tracks from Apple Music or Spotify.
                    </p>
                  )}

                  {appleSearchError && (
                    <p className="mt-2 text-zinc-500">
                      {appleSearchError}
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
                        {searchingApple
                          ? "Searching Apple Music..."
                          : "Searching Spotify..."}
                      </p>
                    </div>
                  </div>
                )}

              {/* TRACK GRID */}
              {!searchingSpotify && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {shownTracks.map(
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
                        <TrackCard
                          key={track.id}
                          track={track}
                          isSelected={isSelected}
                          disabled={maxReached}
                          showLikedBadge={Boolean(search) && isLiked}
                          genre={
                            !search && genre !== "All"
                              ? genre
                              : undefined
                          }
                          onToggle={toggleTrack}
                        />
                      );
                    }
                  )}
                </div>
              )}

              {!searchingSpotify &&
                visibleTracks.length > shownCount && (
                  <LoadMore
                    remaining={visibleTracks.length - shownCount}
                    onLoadMore={showMoreTracks}
                  />
                )}

              {/* EMPTY */}
              {!searchingSpotify &&
                visibleTracks.length ===
                  0 && (
                  <div className="py-24 text-center">
                    <p className="font-semibold text-zinc-500">
                      {search
                        ? spotifySearchError
                          ? appleSearchError
                            ? "Apple Music could not provide matches. See the error above."
                            : "No Spotify or Apple Music matches found."
                          : "No Spotify results found."
                        : librarySkipped
                          ? "Search for songs above to choose your first Echo seed."
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
      <SeedTray
        selected={selected}
        onRemove={removeTrack}
        onContinue={findEcho}
      />
    </main>
  );
}
