import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";
import {
  SPOTIFY_PLAYLISTS_ENABLED,
  SPOTIFY_PLAYLISTS_UNAVAILABLE_MESSAGE,
} from "@/lib/spotify-playlists";
import { upstreamTimeout } from "@/lib/upstream";

export async function POST(request: NextRequest) {
  if (!SPOTIFY_PLAYLISTS_ENABLED) {
    return NextResponse.json(
      {
        error: "spotify_playlist_creation_unavailable",
        message:
          SPOTIFY_PLAYLISTS_UNAVAILABLE_MESSAGE,
      },
      { status: 503 }
    );
  }

  const token = await getSpotifyAccessToken();

  if (!token) {
    return NextResponse.json(
      {
        error: "not_authenticated",
        message: "Connect Spotify to save this playlist.",
      },
      { status: 401 }
    );
  }

  const body = await request.json();

  const name =
    body.name?.trim() || "My Echo";

  const description =
    body.description?.trim() ||
    "Made with Echo.";

  const uris: string[] = Array.isArray(body.uris)
    ? Array.from(new Set(body.uris))
    : [];

  if (uris.length === 0) {
    return NextResponse.json(
      { error: "No songs supplied." },
      { status: 400 }
    );
  }

  if (
    uris.some(
      (uri) =>
        typeof uri !== "string" ||
        !/^spotify:track:[A-Za-z0-9]+$/.test(uri)
    )
  ) {
    return NextResponse.json(
      {
        error:
          "This playlist includes tracks that are not available on Spotify.",
      },
      { status: 400 }
    );
  }

  // Create playlist
  const createResponse = await fetch(
    "https://api.spotify.com/v1/me/playlists",
    {
      method: "POST",
      signal: upstreamTimeout(),

      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        name,
        description,
        public: false,
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();

    console.error(
      "Spotify playlist creation failed:",
      error
    );

    return NextResponse.json(
      {
        error: "playlist_creation_failed",
        message: "Spotify couldn't create the playlist. Try again in a minute.",
      },
      {
        status: createResponse.status,
      }
    );
  }

  const playlist =
    await createResponse.json();

  /*
   * Spotify allows up to 100 URIs per add-items
   * request. Echo will normally make much smaller
   * playlists, but chunking makes this future-proof.
   */
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);

    const addResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist.id}/items`,
      {
        method: "POST",
        signal: upstreamTimeout(),

        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          uris: chunk,
        }),
      }
    );

    if (!addResponse.ok) {
      const error = await addResponse.text();

      console.error(
        "Spotify add-items failed:",
        error
      );

      return NextResponse.json(
        {
          error: "playlist_items_failed",
          message:
            "Spotify created the playlist but couldn't add the songs. Try again in a minute.",
          playlistId: playlist.id,
        },
        {
          status: addResponse.status,
        }
      );
    }
  }

  return NextResponse.json({
    success: true,

    playlist: {
      id: playlist.id,
      name: playlist.name,

      url:
        playlist.external_urls?.spotify ??
        `https://open.spotify.com/playlist/${playlist.id}`,
    },
  });
}
