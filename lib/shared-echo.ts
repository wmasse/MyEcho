export type SharedEchoTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  image: string | null;
  source: "seed" | "library" | "discovery";
  echoScore: number;
  matchedSeeds: number;
};

export type SharedEcho = {
  name: string;
  tracks: SharedEchoTrack[];
};

type EncodedTrack = [
  string, // id
  string, // uri
  string, // name
  string, // artist
  string, // album
  string | null, // image
  SharedEchoTrack["source"], // source
  number, // echoScore
  number, // matchedSeeds
];

const MAX_TRACKS = 50;
const MAX_FRAGMENT_LENGTH = 40_000;

const ALLOWED_IMAGE_HOSTS = new Set([
  "image-cdn-fa.spotifycdn.com",
  "image-cdn-ak.spotifycdn.com",
  "i.scdn.co",
]);

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (
    let index = 0;
    index < bytes.length;
    index += 0x8000
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        index,
        index + 0x8000
      )
    );
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/");

  const padded = base64.padEnd(
    Math.ceil(base64.length / 4) * 4,
    "="
  );

  const binary = atob(padded);

  const bytes =
    new Uint8Array(binary.length);

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}

function toBlob(bytes: Uint8Array) {
  const copy =
    new Uint8Array(bytes.byteLength);

  copy.set(bytes);

  return new Blob([
    copy.buffer,
  ]);
}

async function compress(
  bytes: Uint8Array
) {
  if (
    typeof CompressionStream ===
    "undefined"
  ) {
    return null;
  }

  const stream = toBlob(bytes)
    .stream()
    .pipeThrough(
      new CompressionStream("gzip")
    );

  return new Uint8Array(
    await new Response(
      stream
    ).arrayBuffer()
  );
}

async function decompress(
  bytes: Uint8Array
) {
  if (
    typeof DecompressionStream ===
    "undefined"
  ) {
    throw new Error(
      "This browser cannot open compressed Echo links."
    );
  }

  const stream = toBlob(bytes)
    .stream()
    .pipeThrough(
      new DecompressionStream("gzip")
    );

  return new Uint8Array(
    await new Response(
      stream
    ).arrayBuffer()
  );
}

function safeImageUrl(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      !ALLOWED_IMAGE_HOSTS.has(
        url.hostname
      )
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export async function encodeSharedEcho(
  name: string,
  tracks: SharedEchoTrack[]
) {
  if (
    tracks.length > MAX_TRACKS
  ) {
    throw new Error(
      "This Echo has too many songs to share."
    );
  }

  const encodedTracks: EncodedTrack[] =
    tracks.map(
      (
        track
      ): EncodedTrack => [
        track.id,
        track.uri,
        track.name,
        track.artist,
        track.album,
        safeImageUrl(track.image),
        track.source,
        track.echoScore,
        track.matchedSeeds,
      ]
    );

  const payload = {
    v: 1,
    n: name
      .slice(0, 200),
    t: encodedTracks,
  };

  const bytes =
    new TextEncoder().encode(
      JSON.stringify(payload)
    );

  const compressed =
    await compress(bytes);

  if (
    compressed &&
    compressed.length <
      bytes.length
  ) {
    return `v1g.${toBase64Url(
      compressed
    )}`;
  }

  return `v1.${toBase64Url(
    bytes
  )}`;
}

function decodePayload(
  value: unknown
): SharedEcho | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const payload = value as {
    v?: unknown;
    n?: unknown;
    t?: unknown;
  };

  if (
    payload.v !== 1 ||
    typeof payload.n !==
      "string" ||
    !Array.isArray(payload.t) ||
    payload.t.length >
      MAX_TRACKS
  ) {
    return null;
  }

  const tracks: SharedEchoTrack[] =
    [];

  for (
    const item of payload.t
  ) {
    if (
      !Array.isArray(item) ||
      item.length < 7
    ) {
      return null;
    }

    // Older Echo links stored seven fields. Keep them readable while
    // new links include album and matched-seed metadata.
    const isCurrentFormat = item.length >= 9;
    const [id, uri, name, artist] = item;
    const album = isCurrentFormat ? item[4] : "";
    const image = isCurrentFormat ? item[5] : item[4];
    const source = isCurrentFormat ? item[6] : item[5];
    const echoScore = isCurrentFormat ? item[7] : item[6];
    const matchedSeeds = isCurrentFormat ? item[8] : 0;

    if (
      typeof id !== "string" ||
      typeof uri !== "string" ||
      typeof name !== "string" ||
      typeof artist !== "string" ||
      typeof album !== "string"
    ) {
      return null;
    }

    if (
      id.length === 0 ||
      id.length > 100 ||
      uri.length > 200 ||
      name.length > 500 ||
      artist.length > 500 ||
      album.length > 500
    ) {
      return null;
    }

    const safeSource:
      SharedEchoTrack["source"] =
      source === "seed" ||
      source === "library" ||
      source === "discovery"
        ? source
        : "discovery";

    tracks.push({
      id,
      uri,
      name,
      artist,
      album,
      image:
        safeImageUrl(image),
      source: safeSource,
      echoScore:
        typeof echoScore ===
          "number" &&
        Number.isFinite(
          echoScore
        )
          ? echoScore
          : 0,
      matchedSeeds:
        typeof matchedSeeds ===
          "number" &&
        Number.isFinite(
          matchedSeeds
        )
          ? matchedSeeds
          : 0,
    });
  }

  return {
    name:
      payload.n
        .slice(0, 200)
        .trim() ||
      "My Echo",

    tracks,
  };
}

export async function decodeSharedEchoFragment(
  fragment: string
): Promise<SharedEcho | null> {
  if (
    !fragment.startsWith(
      "#echo="
    ) ||
    fragment.length >
      MAX_FRAGMENT_LENGTH
  ) {
    return null;
  }

  const encoded =
    fragment.slice(
      "#echo=".length
    );

  try {
    let bytes: Uint8Array;

    if (
      encoded.startsWith(
        "v1g."
      )
    ) {
      bytes =
        await decompress(
          fromBase64Url(
            encoded.slice(4)
          )
        );
    } else if (
      encoded.startsWith(
        "v1."
      )
    ) {
      bytes =
        fromBase64Url(
          encoded.slice(3)
        );
    } else {
      return null;
    }

    const json =
      new TextDecoder().decode(
        bytes
      );

    const parsed =
      JSON.parse(json);

    return decodePayload(
      parsed
    );
  } catch (
    error
  ) {
    console.error(
      "Could not decode shared Echo:",
      error
    );

    return null;
  }
}
