import { cookies } from "next/headers";

const SPOTIFY_COOKIES = [
  "spotify_access_token",
  "spotify_refresh_token",
  "spotify_oauth_state",
  "spotify_oauth_next",
];

export async function POST() {
  const cookieStore = await cookies();

  for (const name of SPOTIFY_COOKIES) {
    cookieStore.delete(name);
  }

  return Response.json({ success: true });
}
