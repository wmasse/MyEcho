import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";

type TimeRange = "short_term" | "medium_term" | "long_term";

type SpotifyImage = {
  url: string;
  height?: number | null;
  width?: number | null;
};

type SpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
  external_urls?: { spotify?: string };
};

type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: Pick<SpotifyArtist, "id" | "name">[];
  album: {
    name: string;
    images?: SpotifyImage[];
  };
  external_urls?: { spotify?: string };
};

type SpotifyPage<T> = {
  items: T[];
};

type SpotifyRecentlyPlayed = {
  items: {
    played_at: string;
    track: SpotifyTrack;
  }[];
};

type SpotifyCurrentlyPlaying = {
  is_playing?: boolean;
  item?: SpotifyTrack | null;
};

async function spotifyGet<T>(token: string, path: string) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status === 204) {
    return { ok: true as const, status: 204, data: null as T | null };
  }

  if (!response.ok) {
    return { ok: false as const, status: response.status, data: null };
  }

  return {
    ok: true as const,
    status: response.status,
    data: (await response.json()) as T,
  };
}

export async function GET(request: NextRequest) {
  const token = await getSpotifyAccessToken();

  if (!token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const requestedRange = request.nextUrl.searchParams.get("range");
  const range: TimeRange =
    requestedRange === "short_term" ||
    requestedRange === "long_term" ||
    requestedRange === "medium_term"
      ? requestedRange
      : "short_term";

  try {
    const [topTracks, topArtists, recentlyPlayed, currentlyPlaying] =
      await Promise.all([
        spotifyGet<SpotifyPage<SpotifyTrack>>(
          token,
          `/me/top/tracks?time_range=${range}&limit=10`
        ),
        spotifyGet<SpotifyPage<SpotifyArtist>>(
          token,
          `/me/top/artists?time_range=${range}&limit=10`
        ),
        spotifyGet<SpotifyRecentlyPlayed>(
          token,
          "/me/player/recently-played?limit=50"
        ),
        spotifyGet<SpotifyCurrentlyPlaying>(
          token,
          "/me/player/currently-playing"
        ),
      ]);

    const unavailable: string[] = [];
    if (!topTracks.ok) unavailable.push("topTracks");
    if (!topArtists.ok) unavailable.push("topArtists");
    if (!recentlyPlayed.ok) unavailable.push("recentlyPlayed");
    if (!currentlyPlaying.ok) unavailable.push("currentlyPlaying");

    const results = [
      topTracks,
      topArtists,
      recentlyPlayed,
      currentlyPlaying,
    ];
    const needsReauthorization = [topTracks, topArtists, recentlyPlayed].some(
      (result) => !result.ok && (result.status === 401 || result.status === 403)
    );
    const rateLimited = results.some(
      (result) => !result.ok && result.status === 429
    );
    const currentItem = currentlyPlaying.ok
      ? currentlyPlaying.data?.item
      : null;

    return NextResponse.json(
      {
        range,
        topTracks: topTracks.ok ? topTracks.data?.items ?? [] : [],
        topArtists: topArtists.ok ? topArtists.data?.items ?? [] : [],
        recentlyPlayed: recentlyPlayed.ok
          ? recentlyPlayed.data?.items ?? []
          : [],
        currentlyPlaying:
          currentItem && "album" in currentItem
            ? {
                is_playing: currentlyPlaying.data?.is_playing ?? false,
                item: currentItem,
              }
            : null,
        unavailable,
        needsReauthorization,
        needsCurrentlyPlayingAuthorization:
          !currentlyPlaying.ok &&
          (currentlyPlaying.status === 401 || currentlyPlaying.status === 403),
        rateLimited,
      }
    );
  } catch (error) {
    console.error("Spotify stats request failed:", error);
    return NextResponse.json(
      { error: "spotify_request_failed" },
      { status: 502 }
    );
  }
}
