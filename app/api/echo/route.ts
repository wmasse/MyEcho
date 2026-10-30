import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";

type Track = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;
};

type LastFmTrack = {
  name: string;
  match?: string;

  artist?: {
    name?: string;
  };
};

type LastFmArtist = {
  name: string;
  match?: string;
};

type Candidate = {
  name: string;
  artist: string;
  score: number;
  matchedSeeds: number;
};

type RankedTrack = {
  track: Track;
  score: number;
  matchedSeeds: number;
};

type ArtistSignal = {
  name: string;
  score: number;
  matchedSeeds: number;
};

type SpotifySearchTrack = {
  id: string;
  uri: string;
  name: string;

  artists: {
    name: string;
  }[];

  album: {
    name: string;

    images?: {
      url: string;
    }[];
  };
};

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(
      /\([^)]*(feat|featuring|remaster|remastered|version|edit|mix|live)[^)]*\)/g,
      ""
    )
    .replace(
      /\[[^\]]*(feat|featuring|remaster|remastered|version|edit|mix|live)[^\]]*\]/g,
      ""
    )
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function primaryArtist(artist: string) {
  return artist.split(",")[0].trim();
}

function trackKey(
  name: string,
  artist: string
) {
  return `${normalize(
    primaryArtist(artist)
  )}::${normalize(name)}`;
}

function normalizeLastFmMatch(
  value?: string
) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  if (number <= 1) {
    return clamp(number, 0, 1);
  }

  /*
   * Some Last.fm responses can use values
   * larger than 1.
   */
  return clamp(
    number / 100,
    0,
    1
  );
}

function spotifyTrackToTrack(
  track: SpotifySearchTrack
): Track {
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,

    artist: track.artists
      .map((artist) => artist.name)
      .join(", "),

    album:
      track.album?.name ?? "",

    image:
      track.album?.images?.[0]
        ?.url ?? null,
  };
}

/*
 * LEVEL 1
 *
 * Get direct track similarities from Last.fm.
 */
async function getSimilarTracks(
  seed: Track,
  apiKey: string
): Promise<Candidate[]> {
  const params =
    new URLSearchParams({
      method: "track.getsimilar",

      artist:
        primaryArtist(seed.artist),

      track: seed.name,

      api_key: apiKey,

      autocorrect: "1",

      limit: "100",

      format: "json",
    });

  try {
    const response =
      await fetch(
        `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
        {
          headers: {
            "User-Agent":
              "Echo/0.1 personal-music-project",
          },

          cache: "no-store",
        }
      );

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    const tracks: LastFmTrack[] =
      data?.similartracks?.track ??
      [];

    return tracks
      .filter(
        (track) =>
          track.name &&
          track.artist?.name
      )
      .map((track, index) => {
        const rankStrength =
          1 -
          index /
            Math.max(
              tracks.length,
              1
            );

        const matchStrength =
          normalizeLastFmMatch(
            track.match
          );

        return {
          name: track.name,

          artist:
            track.artist!.name!,

          score:
            rankStrength * 0.75 +
            matchStrength * 0.25,

          matchedSeeds: 1,
        };
      });
  } catch (error) {
    console.error(
      "Last.fm track similarity error:",
      seed.name,
      error
    );

    return [];
  }
}

/*
 * LEVEL 2
 *
 * Find similar artists for a seed artist.
 */
async function getSimilarArtists(
  artist: string,
  apiKey: string
): Promise<ArtistSignal[]> {
  const params =
    new URLSearchParams({
      method: "artist.getsimilar",

      artist,

      api_key: apiKey,

      autocorrect: "1",

      limit: "20",

      format: "json",
    });

  try {
    const response =
      await fetch(
        `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
        {
          headers: {
            "User-Agent":
              "Echo/0.1 personal-music-project",
          },

          cache: "no-store",
        }
      );

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    const artists: LastFmArtist[] =
      data?.similarartists?.artist ??
      [];

    return artists
      .filter(
        (item) => item.name
      )
      .map((item, index) => {
        const rankStrength =
          1 -
          index /
            Math.max(
              artists.length,
              1
            );

        const matchStrength =
          normalizeLastFmMatch(
            item.match
          );

        return {
          name: item.name,

          /*
           * Artist fallback is intentionally
           * weaker than exact track similarity.
           */
          score:
            0.35 +
            rankStrength * 0.25 +
            matchStrength * 0.25,

          matchedSeeds: 1,
        };
      });
  } catch (error) {
    console.error(
      "Last.fm artist similarity error:",
      artist,
      error
    );

    return [];
  }
}

/*
 * Resolve a named Last.fm track to Spotify.
 */
async function findSpotifyTrack(
  token: string,
  candidate: Candidate
): Promise<Track | null> {
  const query =
    `track:"${candidate.name}" ` +
    `artist:"${candidate.artist}"`;

  const params =
    new URLSearchParams({
      q: query,
      type: "track",
      limit: "5",
    });

  try {
    const response =
      await fetch(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          cache: "no-store",
        }
      );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    const results: SpotifySearchTrack[] =
      data?.tracks?.items ?? [];

    if (results.length === 0) {
      return null;
    }

    const wantedName =
      normalize(candidate.name);

    const wantedArtist =
      normalize(candidate.artist);

    const exact =
      results.find((track) => {
        const nameMatches =
          normalize(track.name) ===
          wantedName;

        const artistMatches =
          track.artists.some(
            (artist) =>
              normalize(
                artist.name
              ) === wantedArtist
          );

        return (
          nameMatches &&
          artistMatches
        );
      });

    return spotifyTrackToTrack(
      exact ?? results[0]
    );
  } catch (error) {
    console.error(
      "Spotify track search error:",
      candidate.name,
      error
    );

    return null;
  }
}

/*
 * LEVEL 3 / LEVEL 4
 *
 * Search Spotify for tracks by an artist.
 */
async function searchArtistTracks(
  token: string,
  artist: string
): Promise<Track[]> {
  const params =
    new URLSearchParams({
      q: `artist:"${artist}"`,
      type: "track",
      limit: "10",
    });

  try {
    const response =
      await fetch(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          cache: "no-store",
        }
      );

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    const results: SpotifySearchTrack[] =
      data?.tracks?.items ?? [];

    const wantedArtist =
      normalize(artist);

    /*
     * Prefer tracks where Spotify actually
     * lists the requested artist.
     */
    const exactArtistResults =
      results.filter((track) =>
        track.artists.some(
          (item) =>
            normalize(
              item.name
            ) === wantedArtist
        )
      );

    const chosen =
      exactArtistResults.length > 0
        ? exactArtistResults
        : results;

    return chosen.map(
      spotifyTrackToTrack
    );
  } catch (error) {
    console.error(
      "Spotify artist search error:",
      artist,
      error
    );

    return [];
  }
}

/*
 * Resolve direct Last.fm track recommendations.
 */
async function resolveDirectDiscoveries(
  token: string,
  candidates: Candidate[],
  maxNeeded: number,
  libraryIds: Set<string>,
  libraryKeys: Set<string>,
  seedIds: Set<string>,
  seedKeys: Set<string>
): Promise<RankedTrack[]> {
  if (maxNeeded <= 0) {
    return [];
  }

  const resolved: RankedTrack[] =
    [];

  const seen =
    new Set<string>();

  const candidateLimit =
    Math.min(
      candidates.length,
      Math.max(
        maxNeeded * 4,
        25
      ),
      80
    );

  const candidatesToTry =
    candidates.slice(
      0,
      candidateLimit
    );

  const batchSize = 5;

  for (
    let i = 0;
    i < candidatesToTry.length;
    i += batchSize
  ) {
    const batch =
      candidatesToTry.slice(
        i,
        i + batchSize
      );

    const matches =
      await Promise.all(
        batch.map(
          async (candidate) => ({
            candidate,

            track:
              await findSpotifyTrack(
                token,
                candidate
              ),
          })
        )
      );

    for (const {
      candidate,
      track,
    } of matches) {
      if (!track) continue;

      const key =
        trackKey(
          track.name,
          track.artist
        );

      if (
        seedIds.has(track.id) ||
        seedKeys.has(key) ||
        libraryIds.has(track.id) ||
        libraryKeys.has(key) ||
        seen.has(track.id)
      ) {
        continue;
      }

      seen.add(track.id);

      resolved.push({
        track,
        score: candidate.score,
        matchedSeeds:
          candidate.matchedSeeds,
      });

      if (
        resolved.length >=
        maxNeeded
      ) {
        return resolved;
      }
    }
  }

  return resolved;
}

export async function POST(
  request: NextRequest
) {
  const lastFmApiKey =
    process.env.LASTFM_API_KEY;

  if (!lastFmApiKey) {
    return NextResponse.json(
      {
        error:
          "Missing LASTFM_API_KEY.",
      },
      {
        status: 500,
      }
    );
  }

  const spotifyToken =
    await getSpotifyAccessToken();

  if (!spotifyToken) {
    return NextResponse.json(
      {
        error:
          "Spotify authentication expired.",
      },
      {
        status: 401,
      }
    );
  }

  const body =
    await request.json();

  const seeds: Track[] =
    body.seeds ?? [];

  const library: Track[] =
    body.library ?? [];

  const playlistSize =
    clamp(
      Number(
        body.playlistSize ?? 25
      ),
      5,
      50
    );

  const libraryPercent =
    clamp(
      Number(
        body.libraryPercent ?? 70
      ),
      0,
      100
    );

  const includeDiscovery =
    body.includeDiscovery !==
    false;

  if (
    seeds.length < 1 ||
    seeds.length > 5
  ) {
    return NextResponse.json(
      {
        error:
          "Choose between 1 and 5 seed songs.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * LIBRARY INDEX
   */
  const libraryIndex =
    new Map<string, Track>();

  const libraryIds =
    new Set<string>();

  const libraryKeys =
    new Set<string>();

  for (const track of library) {
    const key =
      trackKey(
        track.name,
        track.artist
      );

    libraryIndex.set(
      key,
      track
    );

    libraryIds.add(
      track.id
    );

    libraryKeys.add(
      key
    );
  }

  const seedIds =
    new Set(
      seeds.map(
        (seed) => seed.id
      )
    );

  const seedKeys =
    new Set(
      seeds.map(
        (seed) =>
          trackKey(
            seed.name,
            seed.artist
          )
      )
    );

  /*
   * STRICT REQUESTED MIX
   */
  const requestedLibrary =
    includeDiscovery
      ? Math.round(
          playlistSize *
            (libraryPercent / 100)
        )
      : playlistSize;

  const requestedDiscovery =
    includeDiscovery
      ? playlistSize -
        requestedLibrary
      : 0;

  /*
   * -------------------------------------------------
   * LEVEL 1:
   * DIRECT SIMILAR TRACKS
   * -------------------------------------------------
   */
  const trackNeighborhoods =
    await Promise.all(
      seeds.map((seed) =>
        getSimilarTracks(
          seed,
          lastFmApiKey
        )
      )
    );

  const candidateMap =
    new Map<string, Candidate>();

  for (
    const neighborhood of trackNeighborhoods
  ) {
    const seenForSeed =
      new Set<string>();

    for (
      const candidate of neighborhood
    ) {
      const key =
        trackKey(
          candidate.name,
          candidate.artist
        );

      if (
        seenForSeed.has(key)
      ) {
        continue;
      }

      seenForSeed.add(key);

      const existing =
        candidateMap.get(key);

      if (existing) {
        existing.score +=
          candidate.score;

        existing.matchedSeeds +=
          1;
      } else {
        candidateMap.set(
          key,
          {
            ...candidate,
          }
        );
      }
    }
  }

  const directCandidates =
    Array.from(
      candidateMap.values()
    )
      .map(
        (candidate) => ({
          ...candidate,

          score:
            candidate.score +
            Math.max(
              candidate.matchedSeeds -
                1,
              0
            ) *
              0.8,
        })
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  /*
   * Signals from direct track results.
   */
  const directArtistSignals =
    new Map<
      string,
      ArtistSignal
    >();

  for (
    const candidate of directCandidates
  ) {
    const key =
      normalize(
        primaryArtist(
          candidate.artist
        )
      );

    const current =
      directArtistSignals.get(
        key
      );

    if (
      !current ||
      candidate.score >
        current.score
    ) {
      directArtistSignals.set(
        key,
        {
          name:
            candidate.artist,

          score:
            candidate.score,

          matchedSeeds:
            candidate.matchedSeeds,
        }
      );
    }
  }

  /*
   * -------------------------------------------------
   * BUILD INITIAL LIBRARY CANDIDATES
   * -------------------------------------------------
   */
  const libraryCandidateMap =
    new Map<
      string,
      RankedTrack
    >();

  function addLibraryCandidate(
    candidate: RankedTrack
  ) {
    if (
      seedIds.has(
        candidate.track.id
      )
    ) {
      return;
    }

    const current =
      libraryCandidateMap.get(
        candidate.track.id
      );

    if (
      !current ||
      candidate.score >
        current.score
    ) {
      libraryCandidateMap.set(
        candidate.track.id,
        candidate
      );
    }
  }

  /*
   * Exact liked-track matches.
   */
  for (
    const candidate of directCandidates
  ) {
    const key =
      trackKey(
        candidate.name,
        candidate.artist
      );

    const track =
      libraryIndex.get(key);

    if (!track) continue;

    addLibraryCandidate({
      track,
      score:
        candidate.score,

      matchedSeeds:
        candidate.matchedSeeds,
    });
  }

  /*
   * Other liked tracks by artists appearing
   * strongly in direct recommendations.
   */
  for (const track of library) {
    if (
      seedIds.has(track.id)
    ) {
      continue;
    }

    const artistKey =
      normalize(
        primaryArtist(
          track.artist
        )
      );

    const signal =
      directArtistSignals.get(
        artistKey
      );

    if (!signal) continue;

    addLibraryCandidate({
      track,

      score:
        signal.score *
        0.68,

      matchedSeeds:
        signal.matchedSeeds,
    });
  }

  /*
   * -------------------------------------------------
   * INITIAL DISCOVERY RESULTS
   * -------------------------------------------------
   */
  const discoveryCandidates =
    directCandidates.filter(
      (candidate) =>
        !libraryKeys.has(
          trackKey(
            candidate.name,
            candidate.artist
          )
        )
    );

  let selectedDiscovery =
    await resolveDirectDiscoveries(
      spotifyToken,
      discoveryCandidates,
      requestedDiscovery,
      libraryIds,
      libraryKeys,
      seedIds,
      seedKeys
    );

  /*
   * -------------------------------------------------
   * LEVEL 2:
   * SIMILAR ARTISTS
   *
   * Only broaden if we're missing something.
   * -------------------------------------------------
   */
  const relatedArtistSignals =
    new Map<
      string,
      ArtistSignal
    >();

  const initialLibraryCount =
    libraryCandidateMap.size;

  const needBroaderFallback =
    initialLibraryCount <
      requestedLibrary ||
    selectedDiscovery.length <
      requestedDiscovery;

  if (needBroaderFallback) {
    const uniqueSeedArtists =
      Array.from(
        new Set(
          seeds.map((seed) =>
            primaryArtist(
              seed.artist
            )
          )
        )
      );

    const artistNeighborhoods =
      await Promise.all(
        uniqueSeedArtists.map(
          (artist) =>
            getSimilarArtists(
              artist,
              lastFmApiKey
            )
        )
      );

    for (
      const neighborhood of artistNeighborhoods
    ) {
      for (
        const artist of neighborhood
      ) {
        const key =
          normalize(
            artist.name
          );

        const current =
          relatedArtistSignals.get(
            key
          );

        if (current) {
          current.score +=
            artist.score;

          current.matchedSeeds +=
            1;
        } else {
          relatedArtistSignals.set(
            key,
            {
              ...artist,
            }
          );
        }
      }
    }

    /*
     * Similar artists also provide weaker
     * Liked Song candidates.
     */
    for (const track of library) {
      if (
        seedIds.has(track.id)
      ) {
        continue;
      }

      const artistKey =
        normalize(
          primaryArtist(
            track.artist
          )
        );

      const signal =
        relatedArtistSignals.get(
          artistKey
        );

      if (!signal) continue;

      addLibraryCandidate({
        track,

        score:
          signal.score *
          0.55,

        matchedSeeds:
          signal.matchedSeeds,
      });
    }
  }

  /*
   * -------------------------------------------------
   * LEVEL 3:
   * SPOTIFY TRACKS BY SIMILAR ARTISTS
   * -------------------------------------------------
   */
  const discoveryMap =
    new Map<
      string,
      RankedTrack
    >();

  for (
    const item of selectedDiscovery
  ) {
    discoveryMap.set(
      item.track.id,
      item
    );
  }

  function canUseAsDiscovery(
    track: Track
  ) {
    const key =
      trackKey(
        track.name,
        track.artist
      );

    return !(
      seedIds.has(track.id) ||
      seedKeys.has(key) ||
      libraryIds.has(track.id) ||
      libraryKeys.has(key) ||
      discoveryMap.has(
        track.id
      )
    );
  }

  if (
    selectedDiscovery.length <
      requestedDiscovery &&
    relatedArtistSignals.size >
      0
  ) {
    const relatedArtists =
      Array.from(
        relatedArtistSignals.values()
      ).sort(
        (a, b) =>
          b.score -
          a.score
      );

    /*
     * Search the strongest related artists first.
     */
    for (
      const artistSignal of relatedArtists.slice(
        0,
        15
      )
    ) {
      if (
        discoveryMap.size >=
        requestedDiscovery
      ) {
        break;
      }

      const artistTracks =
        await searchArtistTracks(
          spotifyToken,
          artistSignal.name
        );

      artistTracks.forEach(
        (track, index) => {
          if (
            !canUseAsDiscovery(
              track
            )
          ) {
            return;
          }

          discoveryMap.set(
            track.id,
            {
              track,

              /*
               * Clearly lower than an exact
               * track recommendation.
               */
              score:
                artistSignal.score *
                (0.58 -
                  index * 0.02),

              matchedSeeds:
                artistSignal.matchedSeeds,
            }
          );
        }
      );
    }
  }

  /*
   * -------------------------------------------------
   * LEVEL 4:
   * OTHER TRACKS BY ORIGINAL SEED ARTISTS
   *
   * This is the last resort.
   * -------------------------------------------------
   */
  if (
    discoveryMap.size <
    requestedDiscovery
  ) {
    const seedArtists =
      Array.from(
        new Set(
          seeds.map((seed) =>
            primaryArtist(
              seed.artist
            )
          )
        )
      );

    for (
      const artist of seedArtists
    ) {
      if (
        discoveryMap.size >=
        requestedDiscovery
      ) {
        break;
      }

      const artistTracks =
        await searchArtistTracks(
          spotifyToken,
          artist
        );

      artistTracks.forEach(
        (track, index) => {
          if (
            !canUseAsDiscovery(
              track
            )
          ) {
            return;
          }

          discoveryMap.set(
            track.id,
            {
              track,

              /*
               * Lowest-confidence fallback.
               */
              score:
                0.24 -
                index * 0.01,

              matchedSeeds: 1,
            }
          );
        }
      );
    }

    /*
     * Seed artists can also fill sparse
     * library requests.
     */
    const seedArtistKeys =
      new Set(
        seedArtists.map(
          normalize
        )
      );

    for (const track of library) {
      if (
        seedIds.has(track.id)
      ) {
        continue;
      }

      const artistKey =
        normalize(
          primaryArtist(
            track.artist
          )
        );

      if (
        !seedArtistKeys.has(
          artistKey
        )
      ) {
        continue;
      }

      addLibraryCandidate({
        track,
        score: 0.22,
        matchedSeeds: 1,
      });
    }
  }

  /*
   * -------------------------------------------------
   * CHOOSE LIKED SONGS
   * -------------------------------------------------
   */
  const rankedLibrary =
    Array.from(
      libraryCandidateMap.values()
    ).sort(
      (a, b) =>
        b.score -
        a.score
    );

  const selectedLibrary:
    RankedTrack[] = [];

  const selectedLibraryIds =
    new Set<string>();

  const artistCounts =
    new Map<
      string,
      number
    >();

  /*
   * First pass:
   * Encourage variety.
   */
  for (
    const item of rankedLibrary
  ) {
    if (
      selectedLibrary.length >=
      requestedLibrary
    ) {
      break;
    }

    const artistKey =
      normalize(
        primaryArtist(
          item.track.artist
        )
      );

    const count =
      artistCounts.get(
        artistKey
      ) ?? 0;

    if (count >= 4) {
      continue;
    }

    selectedLibrary.push(
      item
    );

    selectedLibraryIds.add(
      item.track.id
    );

    artistCounts.set(
      artistKey,
      count + 1
    );
  }

  /*
   * Second pass:
   * If we still need Liked Songs,
   * relax the artist diversity limit.
   */
  if (
    selectedLibrary.length <
    requestedLibrary
  ) {
    for (
      const item of rankedLibrary
    ) {
      if (
        selectedLibrary.length >=
        requestedLibrary
      ) {
        break;
      }

      if (
        selectedLibraryIds.has(
          item.track.id
        )
      ) {
        continue;
      }

      selectedLibrary.push(
        item
      );

      selectedLibraryIds.add(
        item.track.id
      );
    }
  }

  /*
   * Final discovery list.
   */
  selectedDiscovery =
    Array.from(
      discoveryMap.values()
    )
      .sort(
        (a, b) =>
          b.score -
          a.score
      )
      .slice(
        0,
        requestedDiscovery
      );

  /*
   * Preserve requested category limits.
   */
  const combined = [
    ...selectedLibrary.map(
      (item) => ({
        ...item,
        source:
          "library" as const,
      })
    ),

    ...selectedDiscovery.map(
      (item) => ({
        ...item,
        source:
          "discovery" as const,
      })
    ),
  ].sort(
    (a, b) =>
      b.score -
      a.score
  );

  /*
   * Relative Echo score.
   */
  const bestScore =
    combined[0]?.score ?? 1;

  const results =
    combined.map(
      (item) => ({
        ...item.track,

        source:
          item.source,

        matchedSeeds:
          item.matchedSeeds,

        echoScore:
          Math.max(
            1,
            Math.min(
              100,
              Math.round(
                (item.score /
                  bestScore) *
                  100
              )
            )
          ),
      })
    );

  const actualLibraryCount =
    results.filter(
      (track) =>
        track.source ===
        "library"
    ).length;

  const actualDiscoveryCount =
    results.filter(
      (track) =>
        track.source ===
        "discovery"
    ).length;

  return NextResponse.json({
    results,

    mix: {
      requestedLibraryPercent:
        includeDiscovery
          ? libraryPercent
          : 100,

      requestedLibraryCount:
        requestedLibrary,

      requestedDiscoveryCount:
        requestedDiscovery,

      libraryCount:
        actualLibraryCount,

      discoveryCount:
        actualDiscoveryCount,

      total:
        results.length,
    },

    seedsUsed:
      seeds.length,

    directCandidates:
      directCandidates.length,

    relatedArtists:
      relatedArtistSignals.size,

    shortfall:
      Math.max(
        0,
        playlistSize -
          results.length
      ),
  });
}
