import { NextResponse } from "next/server";
import { SPOTIFY_PLAYLISTS_ENABLED } from "@/lib/spotify-playlists";

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing Spotify environment variables" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();

  const scopes = [
    "user-library-read",
    ...(SPOTIFY_PLAYLISTS_ENABLED
      ? ["playlist-modify-private"]
      : []),
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    show_dialog: "true",
  });

  const response = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params.toString()}`
  );

  response.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure:
  process.env.NODE_ENV ===
  "production",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
