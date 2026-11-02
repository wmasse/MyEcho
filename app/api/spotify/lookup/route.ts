import { NextResponse } from "next/server";
import { getSpotifyAppToken } from "@/lib/spotify-app-token";
import { upstreamTimeout } from "@/lib/upstream";

/*
 * Turns pasted Spotify song IDs into tracks,
 * without the visitor signing in. Spotify
 * blocks the batch lookup for apps in
 * Development Mode, so each song is looked
 * up on its own, a few at a time. The page
 * sends small batches so it can show progress.
 */
const MAX_IDS_PER_REQUEST = 25;
const CONCURRENCY = 5;
const TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images?: { url: string }[] };
};

class RateLimited extends Error {
  constructor(public retryAfter: number) {
    super("rate_limited");
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter(
        (id: unknown): id is string =>
          typeof id === "string" && TRACK_ID_PATTERN.test(id)
      )
    : [];

  if (ids.length === 0 || ids.length > MAX_IDS_PER_REQUEST) {
    return NextResponse.json(
      {
        error: "invalid_ids",
        message: `Send between 1 and ${MAX_IDS_PER_REQUEST} song IDs.`,
      },
      { status: 400 }
    );
  }

  const token = await getSpotifyAppToken();

  if (!token) {
    return NextResponse.json(
      {
        error: "spotify_unavailable",
        message: "Spotify isn't available right now. Try again in a minute.",
      },
      { status: 503 }
    );
  }

  async function lookUp(id: string) {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: upstreamTimeout(),
    });

    if (response.status === 429) {
      throw new RateLimited(Number(response.headers.get("retry-after")) || 5);
    }

    if (!response.ok) {
      return null;
    }

    const track = (await response.json()) as SpotifyTrack;

    return {
      id: track.id,
      uri: track.uri,
      name: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      album: track.album.name,
      image: track.album.images?.[0]?.url ?? null,
    };
  }

  const found: NonNullable<Awaited<ReturnType<typeof lookUp>>>[] = [];
  const missing: string[] = [];

  try {
    for (let index = 0; index < ids.length; index += CONCURRENCY) {
      const group = ids.slice(index, index + CONCURRENCY);
      const results = await Promise.all(
        group.map((id) => lookUp(id).catch((error) => {
          if (error instanceof RateLimited) throw error;
          return null;
        }))
      );

      results.forEach((track, offset) => {
        if (track) found.push(track);
        else missing.push(group[offset]);
      });
    }
  } catch (error) {
    if (error instanceof RateLimited) {
      // The page waits and resends this batch.
      return NextResponse.json(
        { error: "rate_limited", retryAfter: Math.min(error.retryAfter, 30) },
        { status: 429 }
      );
    }

    throw error;
  }

  return NextResponse.json({ tracks: found, missing });
}
