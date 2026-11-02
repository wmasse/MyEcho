import { NextResponse } from "next/server";
import { upstreamTimeout } from "@/lib/upstream";

type AppleAlbum = {
  id?: string | number;
  name?: string;
  artistName?: string;
  artworkUrl100?: string;
};

type AppleAlbumsResponse = {
  feed?: {
    results?: AppleAlbum[];
  };
};

export async function GET() {
  try {
    const response = await fetch(
      "https://rss.marketingtools.apple.com/api/v2/us/music/most-played/100/albums.json",
      { next: { revalidate: 21600 }, signal: upstreamTimeout() }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "popular_albums_unavailable" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as AppleAlbumsResponse;
    const seen = new Set<string>();
    const albums = (data.feed?.results ?? []).flatMap((album) => {
      const id = String(album.id ?? "");
      const name = album.name?.trim();
      const artist = album.artistName?.trim();
      const artworkUrl = album.artworkUrl100
        ?.replace(/\/\d+x\d+bb(?=\.[^/?]+(?:\?|$))/i, "/600x600bb")
        .split("?")[0];

      if (
        !id ||
        !name ||
        !artist ||
        !artworkUrl ||
        seen.has(id)
      ) {
        return [];
      }

      try {
        const imageUrl = new URL(artworkUrl);

        if (
          imageUrl.protocol !== "https:" ||
          !imageUrl.hostname.endsWith(".mzstatic.com") ||
          !imageUrl.pathname.startsWith("/image/")
        ) {
          return [];
        }
      } catch {
        return [];
      }

      seen.add(id);

      return [
        {
          id,
          name,
          artist,
          image: artworkUrl,
        },
      ];
    });

    return NextResponse.json({ albums });
  } catch {
    return NextResponse.json(
      { error: "popular_albums_unavailable" },
      { status: 502 }
    );
  }
}
