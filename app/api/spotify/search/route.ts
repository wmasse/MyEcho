import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const token = await getSpotifyAccessToken();

  if (!token) {
    return NextResponse.json(
      { error: "not_authenticated" },
      { status: 401 }
    );
  }

  const query =
    request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({
      tracks: [],
    });
  }

  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "10",
  });

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
    const error = await response.text();

    console.error(
      "Spotify search failed:",
      error
    );

    return NextResponse.json(
      {
        error: "spotify_search_failed",
      },
      {
        status: response.status,
      }
    );
  }

  const data = await response.json();

  const tracks =
    data?.tracks?.items
      ?.filter((track: any) => track?.id)
      .map((track: any) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,

        artist: track.artists
          ?.map((artist: any) => artist.name)
          .join(", "),

        album:
          track.album?.name ?? "",

        image:
          track.album?.images?.[0]?.url ??
          null,
      })) ?? [];

  return NextResponse.json({
    tracks,
  });
}