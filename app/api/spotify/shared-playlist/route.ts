import { after, NextResponse } from "next/server";
import {
  SHARED_PLAYLIST_LIFETIME_MINUTES,
  SHARED_PLAYLIST_SAVING_ENABLED,
  getOwnerAccessToken,
  removeExpiredSharedPlaylists,
  sharedPlaylistDescription,
} from "@/lib/spotify-owner";
import { upstreamTimeout } from "@/lib/upstream";

/*
 * Backup for visitors who can't save to their own Spotify: creates the
 * mix as a public playlist on the site owner's account. See
 * lib/spotify-owner.ts.
 */
const MAX_TRACKS = 200;

export async function POST(request: Request) {
  if (!SHARED_PLAYLIST_SAVING_ENABLED) {
    return NextResponse.json(
      { error: "shared_saving_off" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 100)
      : "My Echo";
  const uris: string[] = Array.isArray(body?.uris)
    ? [...new Set<string>(body.uris)]
    : [];

  if (
    uris.length === 0 ||
    uris.length > MAX_TRACKS ||
    uris.some(
      (uri) =>
        typeof uri !== "string" ||
        !/^spotify:track:[A-Za-z0-9]+$/.test(uri)
    )
  ) {
    return NextResponse.json(
      {
        error: "invalid_tracks",
        message: "This mix has songs Spotify can't add to a playlist.",
      },
      { status: 400 }
    );
  }

  const token = await getOwnerAccessToken();

  if (!token) {
    return NextResponse.json(
      {
        error: "shared_saving_unavailable",
        message: "Saving to Spotify isn't available right now. Share the Echo link instead.",
      },
      { status: 503 }
    );
  }

  const createResponse = await fetch("https://api.spotify.com/v1/me/playlists", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description: sharedPlaylistDescription(),
      public: true,
    }),
    signal: upstreamTimeout(),
  });

  if (!createResponse.ok) {
    console.error(
      "Shared playlist creation failed:",
      createResponse.status,
      await createResponse.text()
    );

    return NextResponse.json(
      {
        error: "shared_playlist_failed",
        message: "Spotify couldn't create the playlist. Try again in a minute.",
      },
      { status: 502 }
    );
  }

  const playlist = (await createResponse.json()) as {
    id: string;
    external_urls?: { spotify?: string };
  };

  for (let index = 0; index < uris.length; index += 100) {
    const addResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist.id}/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: uris.slice(index, index + 100) }),
        signal: upstreamTimeout(),
      }
    );

    if (!addResponse.ok) {
      console.error("Shared playlist add-items failed:", addResponse.status);

      return NextResponse.json(
        {
          error: "shared_playlist_items_failed",
          message: "Spotify created the playlist but couldn't add the songs. Try again in a minute.",
        },
        { status: 502 }
      );
    }
  }

  // Tidy up older shared playlists without making this visitor wait.
  after(async () => {
    try {
      await removeExpiredSharedPlaylists(token);
    } catch (error) {
      console.error("Shared playlist cleanup failed:", error);
    }
  });

  return NextResponse.json({
    playlist: {
      id: playlist.id,
      url:
        playlist.external_urls?.spotify ??
        `https://open.spotify.com/playlist/${playlist.id}`,
    },
    removeAfterMinutes: SHARED_PLAYLIST_LIFETIME_MINUTES,
  });
}
