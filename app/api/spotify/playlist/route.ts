import { NextRequest, NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";
import {
  SPOTIFY_PLAYLISTS_ENABLED,
  SPOTIFY_PLAYLISTS_UNAVAILABLE_MESSAGE,
} from "@/lib/spotify-playlists";

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
      { error: "not_authenticated" },
      { status: 401 }
    );
  }

  const body = await request.json();

  const name =
    body.name?.trim() || "My Echo";

  const description =
    body.description?.trim() ||
    "Made with Echo.";

  const uris: string[] = body.uris ?? [];

  if (uris.length === 0) {
    return NextResponse.json(
      { error: "No songs supplied." },
      { status: 400 }
    );
  }

  // Create playlist
  const createResponse = await fetch(
    "https://api.spotify.com/v1/me/playlists",
    {
      method: "POST",

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
        details: error,
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
          playlistId: playlist.id,
          details: error,
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
