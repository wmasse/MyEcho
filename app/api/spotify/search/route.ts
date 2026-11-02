import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";
import { upstreamTimeout } from "@/lib/upstream";

type SpotifySearchResponse = {
  tracks?: {
    items?: {
      id?: string;
      uri: string;
      name: string;
      artists?: { name: string }[];
      album?: {
        name?: string;
        images?: { url: string }[];
      };
    }[];
  };
};

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
      signal: upstreamTimeout(),
    }
  );

  if (!response.ok) {
    const error = await response.text();

    console.error(
      "Spotify search failed:",
      error
    );

    const headers = new Headers();
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      headers.set("Retry-After", retryAfter);
    }

    return NextResponse.json(
      {
        error:
          response.status === 429
            ? "spotify_rate_limited"
            : "spotify_search_failed",
      },
      {
        status: response.status,
        headers,
      }
    );
  }

  const data = (await response.json()) as SpotifySearchResponse;

  const tracks =
    data?.tracks?.items
      ?.filter((track) => track?.id)
      .map((track) => ({
        id: track.id,
        uri: track.uri,
        name: track.name,

        artist: track.artists
          ?.map((artist) => artist.name)
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
