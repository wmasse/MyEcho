import {
    NextRequest,
    NextResponse,
  } from "next/server";
  
  const GENRES = [
    "Indie / Alternative",
    "Rock",
    "Hip-Hop / Rap",
    "R&B / Soul",
    "Pop",
    "Electronic",
    "Metal / Punk",
    "Dreamy / Ambient",
    "Folk / Country",
    "Jazz / Classical",
    "Other",
  ] as const;
  
  type Genre =
    (typeof GENRES)[number];
  
  function normalize(
    value: string
  ) {
    return value
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
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
    const tags =
      rawTags.map(normalize);
  
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
        "electronic",
        "electronica",
        "techno",
        "house",
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
  
  function key(
    artist: string
  ) {
    return artist
      .trim()
      .toLowerCase();
  }
  
  async function lookupArtist(
    artist: string,
    apiKey: string
  ): Promise<Genre> {
    const params =
      new URLSearchParams({
        method:
          "artist.gettoptags",
  
        artist,
  
        api_key:
          apiKey,
  
        autocorrect:
          "1",
  
        format:
          "json",
      });
  
    try {
      const response =
        await fetch(
          `https://ws.audioscrobbler.com/2.0/?${params.toString()}`,
          {
            headers: {
              "User-Agent":
                "Echo/0.1 personal-music-project",
            },
  
            cache:
              "no-store",
          }
        );
  
      if (!response.ok) {
        return "Other";
      }
  
      const data =
        await response.json();
  
      const tags: string[] =
        (
          data?.toptags
            ?.tag ?? []
        )
          .slice(0, 10)
          .map(
            (tag: any) =>
              tag.name
          );
  
      return classifyGenre(
        tags
      );
    } catch {
      return "Other";
    }
  }
  
  export async function POST(
    request: NextRequest
  ) {
    const apiKey =
      process.env
        .LASTFM_API_KEY;
  
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing LASTFM_API_KEY",
        },
        {
          status: 500,
        }
      );
    }
  
    const body =
      await request.json();
  
    const artists: string[] =
      Array.isArray(
        body.artists
      )
        ? body.artists
            .filter(
              (artist: unknown) =>
                typeof artist ===
                  "string" &&
                artist.trim()
            )
            .slice(0, 25)
        : [];
  
    if (
      artists.length === 0
    ) {
      return NextResponse.json({
        genres: {},
      });
    }
  
    const genres: Record<
      string,
      Genre
    > = {};
  
    /*
     * Last.fm requests run in
     * small server-side groups.
     */
    const concurrency = 5;
  
    for (
      let i = 0;
      i < artists.length;
      i += concurrency
    ) {
      const group =
        artists.slice(
          i,
          i + concurrency
        );
  
      const results =
        await Promise.all(
          group.map(
            async (artist) => ({
              artist,
  
              genre:
                await lookupArtist(
                  artist,
                  apiKey
                ),
            })
          )
        );
  
      for (
        const result of results
      ) {
        genres[
          key(
            result.artist
          )
        ] =
          result.genre;
      }
    }
  
    return NextResponse.json({
      genres,
    });
  }