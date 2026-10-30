import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const savedState =
    request.cookies.get("spotify_oauth_state")?.value;

  if (
    !code ||
    !returnedState ||
    !savedState ||
    returnedState !== savedState
  ) {
    return NextResponse.redirect(
      new URL("/?spotify=error", request.url)
    );
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const tokenResponse = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      }),
    }
  );

  const tokens = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error(tokens);

    return NextResponse.redirect(
      new URL("/?spotify=token_error", request.url)
    );
  }

  const response = NextResponse.redirect(
    new URL("/?spotify=connected", request.url)
  );

  response.cookies.set(
    "spotify_access_token",
    tokens.access_token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: tokens.expires_in - 60,
      path: "/",
    }
  );

  if (tokens.refresh_token) {
    response.cookies.set(
      "spotify_refresh_token",
      tokens.refresh_token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 60 * 60 * 24 * 180,
        path: "/",
      }
    );
  }

  response.cookies.delete("spotify_oauth_state");

  return response;
}