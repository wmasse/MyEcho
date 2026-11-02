import { NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";
import { upstreamTimeout } from "@/lib/upstream";

type SpotifyProfile = {
  display_name?: string | null;
  images?: { url: string; width?: number | null }[];
};

/*
 * Name and photo for the profile circle in
 * the nav. Answers { connected: false }
 * instead of an error when signed out, so
 * the nav can show "Connect" quietly.
 */
export async function GET() {
  const token = await getSpotifyAccessToken();

  if (!token) {
    return NextResponse.json({ connected: false });
  }

  try {
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: upstreamTimeout(),
    });

    if (response.status === 401) {
      return NextResponse.json({ connected: false });
    }

    if (!response.ok) {
      // Still signed in; the circle falls back to an initial.
      return NextResponse.json({ connected: true, name: null, image: null });
    }

    const profile = (await response.json()) as SpotifyProfile;

    // Smallest photo that's still sharp at 2x.
    const images = [...(profile.images ?? [])].sort(
      (a, b) => (a.width ?? 0) - (b.width ?? 0)
    );
    const image =
      images.find((candidate) => (candidate.width ?? 0) >= 64) ??
      images.at(-1);

    return NextResponse.json({
      connected: true,
      name: profile.display_name ?? null,
      image: image?.url ?? null,
    });
  } catch (error) {
    console.error("Could not load Spotify profile:", error);
    return NextResponse.json({ connected: true, name: null, image: null });
  }
}
