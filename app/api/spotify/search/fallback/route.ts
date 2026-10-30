import { NextRequest, NextResponse } from "next/server";
import { getSpotifyCatalogAccessToken } from "@/lib/spotify";

type LastFmTrack = {
  name?: string;
  artist?: string;
};

type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: {
    name?: string;
    images?: { url: string }[];
  };
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeArtist(value: string) {
  return normalize(value.split(/\b(?:feat(?:uring)?|ft)\b/i)[0]);
}

type SpotifyMatch = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;
};

async function findSpotifyMatch(
  token: string,
  candidate: LastFmTrack
): Promise<{ track: SpotifyMatch | null; error?: string }> {
  if (!candidate.name || !candidate.artist) {
    return { track: null };
  }

  const params = new URLSearchParams({
    q: `${candidate.name} ${candidate.artist}`,
    type: "track",
    limit: "10",
  });

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return {
        track: null,
        error: `Spotify catalog search returned HTTP ${response.status}.`,
      };
    }

    const data = await response.json();
    const tracks: SpotifyTrack[] = data?.tracks?.items ?? [];
    const candidateName = normalize(candidate.name);
    const candidateArtist = normalizeArtist(candidate.artist);

    const match = tracks.find(
      (track) =>
        normalize(track.name) === candidateName &&
        track.artists.some(
          (artist) => {
            const spotifyArtist = normalizeArtist(artist.name);
            return (
              spotifyArtist === candidateArtist ||
              candidateArtist.startsWith(`${spotifyArtist} `) ||
              spotifyArtist.startsWith(`${candidateArtist} `)
            );
          }
        )
    );

    if (!match?.id || !match.uri) {
      return { track: null };
    }

    return {
      track: {
        id: match.id,
        uri: match.uri,
        name: match.name,
        artist: match.artists.map((artist) => artist.name).join(", "),
        album: match.album?.name ?? "",
        image: match.album?.images?.[0]?.url ?? null,
      },
    };
  } catch (error) {
    console.error("Spotify catalog match failed:", error);
    return {
      track: null,
      error: "Spotify catalog search could not be reached.",
    };
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Last.fm search is unavailable: LASTFM_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const params = new URLSearchParams({
    method: "track.search",
    track: query,
    api_key: apiKey,
    limit: "5",
    format: "json",
  });

  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
      {
        headers: {
          "User-Agent": "Echo/0.1 personal-music-project",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Last.fm track search returned:", response.status);
      return NextResponse.json(
        { error: `Last.fm search failed (HTTP ${response.status}).` },
        { status: 502 }
      );
    }

    const data = await response.json();
    if (data?.error) {
      const message =
        typeof data.message === "string"
          ? data.message.slice(0, 200)
          : "The Last.fm API rejected the request.";
      console.error("Last.fm API error:", data.error, message);
      return NextResponse.json(
        { error: `Last.fm search failed: ${message}` },
        { status: 502 }
      );
    }

    const rawCandidates = data?.results?.trackmatches?.track;
    const candidates: LastFmTrack[] = Array.isArray(rawCandidates)
      ? rawCandidates
      : rawCandidates
        ? [rawCandidates]
        : [];

    if (candidates.length === 0) {
      return NextResponse.json({ tracks: [] });
    }

    const token = await getSpotifyCatalogAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "Last.fm found candidates, but Spotify catalog matching is unavailable. Check Spotify app credentials." },
        { status: 503 }
      );
    }

    const resolved = await Promise.all(
      candidates.map((candidate) => findSpotifyMatch(token, candidate))
    );

    const uniqueTracks = new Map(
      resolved
        .map((result) => result.track)
        .filter((track): track is SpotifyMatch => track !== null)
        .map((track) => [track.id, track])
    );

    if (uniqueTracks.size === 0) {
      const searchError = resolved.find((result) => result.error)?.error;
      if (searchError) {
        return NextResponse.json(
          { error: `Last.fm found matches, but ${searchError}` },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ tracks: [...uniqueTracks.values()] });
  } catch (error) {
    console.error("Last.fm search fallback failed:", error);
    return NextResponse.json(
      { error: "Last.fm search could not be reached. Please try again." },
      { status: 502 }
    );
  }
}
