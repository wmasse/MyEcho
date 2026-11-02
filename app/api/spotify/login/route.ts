import { NextRequest, NextResponse } from "next/server";
import { SPOTIFY_PLAYLISTS_ENABLED } from "@/lib/spotify-playlists";

export async function GET(request: NextRequest) {
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
    "user-read-recently-played",
    "user-top-read",
    "user-read-currently-playing",
    ...(SPOTIFY_PLAYLISTS_ENABLED
      ? ["playlist-modify-private"]
      : []),
    // One-time setup for backup saving: the site owner signs in with
    // ?owner=1 to allow public playlists. See lib/spotify-owner.ts.
    ...(request.nextUrl.searchParams.get("owner") === "1"
      ? ["playlist-modify-public", "playlist-read-private"]
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

  response.cookies.set(
    "spotify_oauth_next",
    request.nextUrl.searchParams.get("next") === "/stats"
      ? "/stats"
      : "/",
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
      path: "/",
    }
  );

  return response;
}
