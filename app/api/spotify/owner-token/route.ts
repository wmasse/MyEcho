import { NextRequest } from "next/server";

/*
 * ONE-TIME SETUP FOR BACKUP SAVING, LOCAL ONLY
 *
 * After the site owner signs in at /api/spotify/login?owner=1 while
 * running Echo on their own computer, this shows the refresh token to
 * paste into Vercel as SPOTIFY_OWNER_REFRESH_TOKEN. It never runs on the
 * live site.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const token = request.cookies.get("spotify_refresh_token")?.value;

  if (!token) {
    return new Response(
      "Sign in first at /api/spotify/login?owner=1, then come back here.",
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  return new Response(
    [
      "Copy this into Vercel as SPOTIFY_OWNER_REFRESH_TOKEN (Production), then set SHARED_PLAYLIST_SAVING=on and redeploy.",
      "Keep it private: it lets Echo create playlists on your Spotify account.",
      "",
      token,
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
  );
}
