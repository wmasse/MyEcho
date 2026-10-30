import { NextRequest, NextResponse } from "next/server";

type AppleSong = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  const params = new URLSearchParams({
    term: query,
    country: "us",
    media: "music",
    entity: "song",
    limit: "25",
  });

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?${params.toString()}`,
      {
        headers: {
          "User-Agent": "Echo/0.1 music search",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Apple catalog search returned:", response.status);
      return NextResponse.json(
        { error: `Apple catalog search failed (HTTP ${response.status}).` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const songs: AppleSong[] = Array.isArray(data?.results)
      ? data.results
      : [];

    const tracks = songs
      .filter(
        (song) =>
          Number.isInteger(song.trackId) &&
          song.trackName &&
          song.artistName
      )
      .map((song) => ({
        id: `apple:${song.trackId}`,
        uri: `apple:track:${song.trackId}`,
        name: song.trackName!,
        artist: song.artistName!,
        album: song.collectionName ?? "",
        image: song.artworkUrl100?.replace("100x100", "600x600") ?? null,
        externalUrl:
          song.trackViewUrl ??
          `https://music.apple.com/us/search?term=${encodeURIComponent(
            `${song.trackName} ${song.artistName}`
          )}`,
      }));

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Apple catalog search failed:", error);
    return NextResponse.json(
      { error: "Apple catalog search could not be reached. Please try again." },
      { status: 502 }
    );
  }
}
