export type SharedEchoTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  image: string | null;
  source: "seed" | "library" | "discovery";
  echoScore: number;
};

export type SharedEcho = {
  name: string;
  tracks: SharedEchoTrack[];
};

type EncodedTrack = [
  string,
  string,
  string,
  string,
  string | null,
  SharedEchoTrack["source"],
  number,
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

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + 0x8000)
    );
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toBlob(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer]);
}

async function compress(bytes: Uint8Array) {
  if (typeof CompressionStream === "undefined") return null;

  const stream = toBlob(bytes)
    .stream()
    .pipeThrough(new CompressionStream("gzip"));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot open compressed Echo links.");
  }

  const stream = toBlob(bytes)
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function encodeSharedEcho(
  name: string,
  tracks: SharedEchoTrack[]
) {
  if (tracks.length > MAX_TRACKS) {
    throw new Error("This Echo has too many songs to share.");
  }

  const encodedTracks: EncodedTrack[] = tracks.map((track) => [
    track.id,
    track.uri,
    track.name,
    track.artist,
    safeImageUrl(track.image),
    track.source,
    track.echoScore,
  ]);
  const bytes = new TextEncoder().encode(
    JSON.stringify({ v: 1, n: name.slice(0, 200), t: encodedTracks })
  );
  const compressed = await compress(bytes);

  if (compressed && compressed.length < bytes.length) {
    return `v1g.${toBase64Url(compressed)}`;
  }

  return `v1.${toBase64Url(bytes)}`;
}

function decodePayload(value: unknown): SharedEcho | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as { v?: unknown; n?: unknown; t?: unknown };
  if (
    payload.v !== 1 ||
    typeof payload.n !== "string" ||
    !Array.isArray(payload.t) ||
    payload.t.length > MAX_TRACKS
  ) {
    return null;
  }

  const tracks: SharedEchoTrack[] = [];

  for (const item of payload.t) {
    if (
      !Array.isArray(item) ||
      item.length < 7 ||
      !item.slice(0, 4).every((field) => typeof field === "string")
    ) {
      return null;
    }

    const [id, uri, name, artist, image, source, echoScore] = item;

    if (
      id.length === 0 ||
      id.length > 100 ||
      uri.length > 200 ||
      name.length > 500 ||
      artist.length > 500
    ) {
      return null;
    }

    tracks.push({
      id,
      uri,
      name,
      artist,
      image: safeImageUrl(image),
      source:
        source === "seed" || source === "library" || source === "discovery"
          ? source
          : "discovery",
      echoScore: Number.isFinite(echoScore) ? echoScore : 0,
    });
  }

  return { name: payload.n.slice(0, 200) || "My Echo", tracks };
}

export async function decodeSharedEchoFragment(
  fragment: string
): Promise<SharedEcho | null> {
  if (!fragment.startsWith("#echo=") || fragment.length > MAX_FRAGMENT_LENGTH) {
    return null;
  }

  const encoded = fragment.slice("#echo=".length);

  try {
    let bytes: Uint8Array;

    if (encoded.startsWith("v1g.")) {
      bytes = await decompress(fromBase64Url(encoded.slice(4)));
    } else if (encoded.startsWith("v1.")) {
      bytes = fromBase64Url(encoded.slice(3));
    } else {
      return null;
    }

    return decodePayload(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
