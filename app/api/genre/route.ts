import { NextRequest, NextResponse } from "next/server";

type Genre =
  | "Indie / Alternative"
  | "Rock"
  | "Hip-Hop / Rap"
  | "R&B / Soul"
  | "Pop"
  | "Electronic"
  | "Metal / Punk"
  | "Dreamy / Ambient"
  | "Folk / Country"
  | "Jazz / Classical"
  | "Other";

function extractTagNames(data: unknown): string[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const topTags = (data as { toptags?: unknown }).toptags;
  if (!topTags || typeof topTags !== "object") {
    return [];
  }

  const rawTags = (topTags as { tag?: unknown }).tag;
  const tags = Array.isArray(rawTags)
    ? rawTags
    : rawTags
      ? [rawTags]
      : [];

  return tags.slice(0, 10).flatMap((tag) => {
    if (!tag || typeof tag !== "object") {
      return [];
    }

    const name = (tag as { name?: unknown }).name;
    return typeof name === "string" ? [name] : [];
  });
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAny(
  tags: string[],
  words: string[]
) {
  return tags.some((tag) =>
    words.some((word) =>
      tag.includes(word)
    )
  );
}

function classifyGenre(
  rawTags: string[]
): Genre {
  const tags = rawTags.map(normalize);

  /*
   * More specific genres go first.
   */

  if (
    includesAny(tags, [
      "shoegaze",
      "dream pop",
      "dreampop",
      "ambient",
      "ethereal",
      "slowcore",
      "space rock",
    ])
  ) {
    return "Dreamy / Ambient";
  }

  if (
    includesAny(tags, [
      "hip hop",
      "hiphop",
      "rap",
      "trap",
      "cloud rap",
      "drill",
    ])
  ) {
    return "Hip-Hop / Rap";
  }

  if (
    includesAny(tags, [
      "rnb",
      "r and b",
      "rhythm and blues",
      "soul",
      "neo soul",
      "funk",
    ])
  ) {
    return "R&B / Soul";
  }

  if (
    includesAny(tags, [
      "techno",
      "house",
      "electronic",
      "electronica",
      "edm",
      "dance",
      "synthwave",
      "idm",
      "trance",
      "dubstep",
    ])
  ) {
    return "Electronic";
  }

  if (
    includesAny(tags, [
      "metal",
      "hardcore",
      "punk",
      "emo",
      "screamo",
      "metalcore",
      "deathcore",
    ])
  ) {
    return "Metal / Punk";
  }

  if (
    includesAny(tags, [
      "indie",
      "alternative",
      "post punk",
      "post-punk",
      "college rock",
    ])
  ) {
    return "Indie / Alternative";
  }

  if (
    includesAny(tags, [
      "folk",
      "country",
      "americana",
      "bluegrass",
      "singer songwriter",
      "singer-songwriter",
    ])
  ) {
    return "Folk / Country";
  }

  if (
    includesAny(tags, [
      "jazz",
      "classical",
      "orchestra",
      "orchestral",
      "baroque",
    ])
  ) {
    return "Jazz / Classical";
  }

  if (
    includesAny(tags, [
      "rock",
      "grunge",
      "garage",
      "psychedelic rock",
      "classic rock",
    ])
  ) {
    return "Rock";
  }

  if (
    includesAny(tags, [
      "pop",
      "k-pop",
      "kpop",
      "hyperpop",
      "art pop",
    ])
  ) {
    return "Pop";
  }

  return "Other";
}

export async function GET(
  request: NextRequest
) {
  const apiKey =
    process.env.LASTFM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Missing LASTFM_API_KEY",
      },
      {
        status: 500,
      }
    );
  }

  const artist =
    request.nextUrl.searchParams
      .get("artist")
      ?.trim();

  if (!artist) {
    return NextResponse.json(
      {
        error: "Missing artist",
      },
      {
        status: 400,
      }
    );
  }

  const params =
    new URLSearchParams({
      method: "artist.gettoptags",
      artist,
      api_key: apiKey,
      autocorrect: "1",
      format: "json",
    });

  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
      {
        headers: {
          "User-Agent":
            "Echo/0.1 personal-music-project",
        },

        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json({
        artist,
        genre: "Other",
        tags: [],
      });
    }

    const data: unknown =
      await response.json();

    const tags = extractTagNames(data);

    const genre =
      classifyGenre(tags);

    return NextResponse.json({
      artist,
      genre,
      tags,
    });
  } catch (error) {
    console.error(
      "Genre lookup failed:",
      artist,
      error
    );

    return NextResponse.json({
      artist,
      genre: "Other",
      tags: [],
    });
  }
}
