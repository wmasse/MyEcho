import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type SpotifySavedTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images?: { url: string }[];
  };
};

type SpotifyLikedResponse = {
  items: {
    added_at: string;
    track: SpotifySavedTrack | null;
  }[];
  total: number;
};

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const token = cookieStore.get("spotify_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "not_authenticated" },
      { status: 401 }
    );
  }

  const offset = Number(
    request.nextUrl.searchParams.get("offset") || "0"
  );

  const response = await fetch(
    `https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const error = await response.text();

    console.error("Spotify API error:", error);

    const headers = new Headers();
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      headers.set("Retry-After", retryAfter);
    }

    return NextResponse.json(
      {
        error: "spotify_request_failed",
        details: error,
      },
      {
        status: response.status,
        headers,
      }
    );
  }

  const data = (await response.json()) as SpotifyLikedResponse;

  const tracks = data.items.flatMap(({ track, added_at }) =>
    track
      ? [{
      id: track.id,
      uri: track.uri,
      name: track.name,

      artist: track.artists
        .map((artist) => artist.name)
        .join(", "),

      album: track.album.name,

      image:
        track.album.images?.[0]?.url ?? null,

      addedAt: added_at,
    }]
      : []
  );

  const nextOffset =
    offset + 50 < data.total
      ? offset + 50
      : null;

  return NextResponse.json({
    tracks,
    total: data.total,
    nextOffset,
  });
}
