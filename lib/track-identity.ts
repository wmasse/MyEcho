const VERSION_QUALIFIER =
  /\b(?:feat(?:uring)?|live|acoustic|remix|mix|edit|version|remaster(?:ed)?|instrumental|karaoke|demo|radio|extended|club|mono|stereo|session)\b/i;

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTrackTitle(value: string) {
  const withoutAnnotations = value.replace(
    /\(([^)]*)\)|\[([^\]]*)\]/g,
    (annotation) =>
      VERSION_QUALIFIER.test(annotation) ? " " : annotation
  );

  const withoutSuffixVersion = withoutAnnotations.replace(
    /\s*[-–—:]\s*(?:\d{4}\s+)?(?:live|acoustic|remix|mix|edit|version|remaster(?:ed)?|instrumental|karaoke|demo|radio|extended|club|mono|stereo|session)\b.*$/i,
    ""
  );

  return normalizeText(withoutSuffixVersion);
}

export function trackIdentityKey(name: string, artist: string) {
  const primaryArtist = artist.split(",")[0].trim();

  return `${normalizeText(primaryArtist)}::${normalizeTrackTitle(name)}`;
}

export function dedupeTracksByIdentity<T extends { name: string; artist: string }>(
  tracks: readonly T[]
) {
  const seen = new Set<string>();

  return tracks.filter((track) => {
    const key = trackIdentityKey(track.name, track.artist);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}
