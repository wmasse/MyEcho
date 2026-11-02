import { NextResponse } from "next/server";
import { getSpotifyAppToken } from "@/lib/spotify-app-token";
import { trackIdentityKey } from "@/lib/track-identity";
import { upstreamTimeout } from "@/lib/upstream";

/*
 * Finds the Spotify version of songs that came from Apple Music, so a
 * mix can still be saved to Spotify. Uses Echo's own key, so it works
 * for visitors who aren't signed in. Songs with no clear match come
 * back as null and are left out of the playlist.
 */
const MAX_TRACKS = 50;
const CONCURRENCY = 5;

type Wanted = { name: string; artist: string };

type SpotifySearchResponse = {
  tracks?: {
    items?: { uri: string; name: string; artists: { name: string }[] }[];
  };
};

async function findOnSpotify(token: string, wanted: Wanted) {
  const primaryArtist = wanted.artist.split(",")[0].trim();
  const params = new URLSearchParams({
    q: `track:"${wanted.name}" artist:"${primaryArtist}"`,
    type: "track",
    limit: "5",
  });

  const response = await fetch(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: upstreamTimeout(),
    }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as SpotifySearchResponse;
  const wantedKey = trackIdentityKey(wanted.name, wanted.artist);

  // Same song and same main artist, ignoring "Remastered" and similar tags.
  const match = data.tracks?.items?.find(
    (item) =>
      trackIdentityKey(item.name, item.artists[0]?.name ?? "") === wantedKey
  );

  return match?.uri ?? null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const tracks: Wanted[] = Array.isArray(body?.tracks)
    ? body.tracks.filter(
        (track: unknown): track is Wanted =>
          typeof (track as Wanted)?.name === "string" &&
          typeof (track as Wanted)?.artist === "string"
      )
    : [];

  if (tracks.length === 0 || tracks.length > MAX_TRACKS) {
    return NextResponse.json(
      { error: "invalid_tracks", message: `Send between 1 and ${MAX_TRACKS} songs.` },
      { status: 400 }
    );
  }

  const token = await getSpotifyAppToken();

  if (!token) {
    return NextResponse.json(
      { error: "spotify_unavailable", message: "Spotify isn't available right now. Try again in a minute." },
      { status: 503 }
    );
  }

  const uris: (string | null)[] = [];

  for (let index = 0; index < tracks.length; index += CONCURRENCY) {
    const group = tracks.slice(index, index + CONCURRENCY);
    uris.push(
      ...(await Promise.all(
        group.map((track) => findOnSpotify(token, track).catch(() => null))
      ))
    );
  }

  return NextResponse.json({ uris });
}
