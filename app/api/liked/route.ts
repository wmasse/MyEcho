import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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

    return NextResponse.json(
      {
        error: "spotify_request_failed",
        details: error,
      },
      { status: response.status }
    );
  }

  const data = await response.json();

  const tracks = data.items
    .filter((item: any) => item.track)
    .map((item: any) => ({
      id: item.track.id,
      uri: item.track.uri,
      name: item.track.name,

      artist: item.track.artists
        .map((artist: any) => artist.name)
        .join(", "),

      album: item.track.album.name,

      image:
        item.track.album.images?.[0]?.url ?? null,

      addedAt: item.added_at,
    }));

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