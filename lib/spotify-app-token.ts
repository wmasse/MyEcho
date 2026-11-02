import { upstreamTimeout } from "@/lib/upstream";

/*
 * Echo's own Spotify key (client credentials).
 * It reads public catalog data, such as a
 * single song by ID, without anyone signing
 * in, so it isn't limited to the accounts on
 * the app's Development Mode user list.
 */
let cached: { token: string; expiresAt: number } | null = null;

export async function getSpotifyAppToken() {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
    signal: upstreamTimeout(),
  });

  if (!response.ok) {
    console.error("Spotify app token failed:", response.status);
    return null;
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cached = {
    token: data.access_token,
    // Refresh a minute early.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cached.token;
}
