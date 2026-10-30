import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";

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

async function findSpotifyMatch(
  token: string,
  candidate: LastFmTrack
) {
  if (!candidate.name || !candidate.artist) {
    return null;
  }

  const params = new URLSearchParams({
    q: `track:"${candidate.name}" artist:"${candidate.artist}"`,
    type: "track",
    limit: "5",
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
      return null;
    }

    const data = await response.json();
    const tracks: SpotifyTrack[] = data?.tracks?.items ?? [];
    const candidateName = normalize(candidate.name);
    const candidateArtist = normalize(candidate.artist);

    const match = tracks.find(
      (track) =>
        normalize(track.name) === candidateName &&
        track.artists.some(
          (artist) => normalize(artist.name) === candidateArtist
        )
    );

    if (!match?.id || !match.uri) {
      return null;
    }

    return {
      id: match.id,
      uri: match.uri,
      name: match.name,
      artist: match.artists.map((artist) => artist.name).join(", "),
      album: match.album?.name ?? "",
      image: match.album?.images?.[0]?.url ?? null,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  const token = await getSpotifyAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "not_authenticated" },
      { status: 401 }
    );
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "fallback_unavailable" },
      { status: 503 }
    );
  }

  const params = new URLSearchParams({
    method: "track.search",
    track: query,
    api_key: apiKey,
    limit: "3",
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
      return NextResponse.json({ tracks: [] });
    }

    const data = await response.json();
    const rawCandidates = data?.results?.trackmatches?.track;
    const candidates: LastFmTrack[] = Array.isArray(rawCandidates)
      ? rawCandidates
      : rawCandidates
        ? [rawCandidates]
        : [];

    const resolved = await Promise.all(
      candidates.map((candidate) => findSpotifyMatch(token, candidate))
    );

    const uniqueTracks = new Map(
      resolved
        .filter((track): track is NonNullable<typeof track> => track !== null)
        .map((track) => [track.id, track])
    );

    return NextResponse.json({ tracks: [...uniqueTracks.values()] });
  } catch (error) {
    console.error("Last.fm search fallback failed:", error);
    return NextResponse.json({ tracks: [] });
  }
}
