/*
 * Types, sample data and small helpers
 * for the home page.
 */

export type Track = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;
  externalUrl?: string;
  addedAt?: string;
};

export type GenreMap = Record<string, Genre>;

export const GENRES = [
  "All",
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

export type Genre = (typeof GENRES)[number];

export type SortMode =
  | "recent"
  | "title"
  | "artist";

export type PopularAlbum = {
  id: string;
  name: string;
  artist: string;
  image: string;
};

export const POPULAR_ALBUMS: PopularAlbum[] = [
  {
    id: "midnights",
    name: "Midnights",
    artist: "Taylor Swift",
    image:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fa747621a53c8e2cc436dee0",
  },
  {
    id: "after-hours",
    name: "After Hours",
    artist: "The Weeknd",
    image:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e028863bc11d2aa12b54f5aeb36",
  },
  {
    id: "sour",
    name: "SOUR",
    artist: "Olivia Rodrigo",
    image:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02a91c10fe9472d9bd89802e5a",
  },
  {
    id: "un-verano-sin-ti",
    name: "Un Verano Sin Ti",
    artist: "Bad Bunny",
    image:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0249d694203245f241a1bcaa72",
  },
  {
    id: "starboy",
    name: "Starboy",
    artist: "The Weeknd",
    image:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e024718e2b124f79258be7bc452",
  },
  {
    id: "damn",
    name: "DAMN.",
    artist: "Kendrick Lamar",
    image:
      "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028b52c6b9bc4e43d873869699",
  },
  {
    id: "happier-than-ever",
    name: "Happier Than Ever",
    artist: "Billie Eilish",
    image:
      "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e022a038d3bf875d23e4aeaa84e",
  },
];

export function shuffledPopularAlbums(
  source: PopularAlbum[] = POPULAR_ALBUMS
) {
  const albums = [...source];

  for (
    let index = albums.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() * (index + 1)
      );

    [
      albums[index],
      albums[randomIndex],
    ] = [
      albums[randomIndex],
      albums[index],
    ];
  }

  return albums;
}

export function primaryArtist(
  artist: string
) {
  return artist
    .split(",")[0]
    .trim();
}

export function artistKey(
  artist: string
) {
  return primaryArtist(
    artist
  ).toLowerCase();
}

export function normalizeSearchText(
  value: string
) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseRetryAfterSeconds(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return seconds;
  }

  const retryAt = Date.parse(value);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(
    0,
    (retryAt - Date.now()) / 1000
  );
}

export function formatSpotifyCountdown(
  totalSeconds: number
) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}
