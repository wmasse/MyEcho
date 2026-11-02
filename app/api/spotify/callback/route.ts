import { NextRequest, NextResponse } from "next/server";
import { upstreamTimeout } from "@/lib/upstream";

export async function GET(request: NextRequest) {
  const code =
    request.nextUrl.searchParams.get("code");

  const returnedState =
    request.nextUrl.searchParams.get("state");

  const savedState =
    request.cookies.get("spotify_oauth_state")?.value;

  const nextPath =
    request.cookies.get("spotify_oauth_next")?.value === "/stats"
      ? "/stats"
      : "/";

  if (
    !code ||
    !returnedState ||
    !savedState ||
    returnedState !== savedState
  ) {
    console.error("Spotify state validation failed");

    return NextResponse.redirect(
      new URL("/?spotify=error", request.url)
    );
  }

  const clientId =
    process.env.SPOTIFY_CLIENT_ID;

  const clientSecret =
    process.env.SPOTIFY_CLIENT_SECRET;

  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    console.error(
      "Missing Spotify environment variables"
    );

    return NextResponse.redirect(
      new URL(
        "/?spotify=config_error",
        request.url
      )
    );
  }

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

  const tokenResponse =
    await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            grant_type:
              "authorization_code",

            code,

            redirect_uri:
              redirectUri,
          }),

        cache: "no-store",
        signal: upstreamTimeout(),
      }
    );

  const tokens =
    await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error(
      "Spotify token exchange failed:",
      tokens
    );

    return NextResponse.redirect(
      new URL(
        "/?spotify=token_error",
        request.url
      )
    );
  }

  if (!tokens.access_token) {
    console.error(
      "Spotify returned no access token"
    );

    return NextResponse.redirect(
      new URL(
        "/?spotify=no_token",
        request.url
      )
    );
  }

  const response =
    NextResponse.redirect(
      new URL(
        `${nextPath}?spotify=connected`,
        request.url
      )
    );

  /*
   * Access token
   */
  response.cookies.set({
    name: "spotify_access_token",

    value:
      tokens.access_token,

    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "lax",

    path: "/",

    maxAge:
      Math.max(
        Number(
          tokens.expires_in ?? 3600
        ) - 60,
        60
      ),
  });

  /*
   * Refresh token
   */
  if (
    tokens.refresh_token
  ) {
    response.cookies.set({
      name:
        "spotify_refresh_token",

      value:
        tokens.refresh_token,

      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "lax",

      path: "/",

      maxAge:
        60 *
        60 *
        24 *
        180,
    });
  }

  /*
   * OAuth state no longer needed.
   */
  response.cookies.set({
    name:
      "spotify_oauth_state",

    value: "",

    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "lax",

    path: "/",

    maxAge: 0,
  });

  response.cookies.set({
    name: "spotify_oauth_next",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
