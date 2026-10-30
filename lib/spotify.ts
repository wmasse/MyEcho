import { cookies } from "next/headers";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

export async function getSpotifyAccessToken() {
  const cookieStore = await cookies();

  const accessToken =
    cookieStore.get("spotify_access_token")?.value;

  // If our current token still exists, use it.
  if (accessToken) {
    return accessToken;
  }

  // Otherwise try refreshing it.
  const refreshToken =
    cookieStore.get("spotify_refresh_token")?.value;

  if (!refreshToken) {
    return null;
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    cookieStore.delete("spotify_access_token");
    cookieStore.delete("spotify_refresh_token");
    return null;
  }

  const data = await response.json();

  cookieStore.set(
    "spotify_access_token",
    data.access_token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: data.expires_in - 60,
      path: "/",
    }
  );

  if (data.refresh_token) {
    cookieStore.set(
      "spotify_refresh_token",
      data.refresh_token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 180,
        path: "/",
      }
    );
  }

  return data.access_token;
}

/** Use app authentication for catalog search so it does not depend on a user session. */
export async function getSpotifyCatalogAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const credentials = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return typeof data.access_token === "string" ? data.access_token : null;
  } catch {
    return null;
  }
}
