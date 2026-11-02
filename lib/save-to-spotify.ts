/*
 * Saves a mix to Spotify from the browser. It always tries the
 * visitor's own account first. Only when Spotify won't allow that (not
 * signed in, or not on the app's user list) does it fall back to a
 * shared playlist on the site owner's account, if that backup is
 * switched on. Apple Music songs are matched to Spotify first.
 */
export type SpotifySaveResult = (
  | { kind: "own"; url: string }
  | { kind: "shared"; url: string; removeAfterMinutes: number }
) & {
  /** Apple Music songs with no Spotify match, left out of the playlist. */
  skipped: number;
};

type MixTrack = { uri: string; name: string; artist: string };

const SPOTIFY_URI = /^spotify:track:[A-Za-z0-9]+$/;

/*
 * Swaps Apple Music songs for their Spotify versions, keeping the mix
 * order. Songs Spotify doesn't have are dropped and counted.
 */
async function toSpotifyUris(tracks: MixTrack[]) {
  const others = tracks.filter((track) => !SPOTIFY_URI.test(track.uri));
  const matched = new Map<MixTrack, string | null>();

  for (let index = 0; index < others.length; index += 50) {
    const batch = others.slice(index, index + 50);
    const response = await fetch("/api/spotify/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: batch.map(({ name, artist }) => ({ name, artist })),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message ?? "Couldn't find these songs on Spotify.");
    }

    batch.forEach((track, offset) => matched.set(track, data.uris[offset]));
  }

  const uris = [
    ...new Set(
      tracks.flatMap((track) => {
        const uri = SPOTIFY_URI.test(track.uri) ? track.uri : matched.get(track);
        return uri ? [uri] : [];
      })
    ),
  ];

  return {
    uris,
    skipped: others.filter((track) => !matched.get(track)).length,
  };
}

export async function saveMixToSpotify(mix: {
  name: string;
  description: string;
  tracks: MixTrack[];
}): Promise<SpotifySaveResult> {
  const { uris, skipped } = await toSpotifyUris(mix.tracks);

  if (uris.length === 0) {
    throw new Error("None of these songs are on Spotify, so there's nothing to save.");
  }

  const playlist = { name: mix.name, description: mix.description, uris };

  const response = await fetch("/api/spotify/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(playlist),
  });
  const data = await response.json();

  if (response.ok) {
    return { kind: "own", url: data.playlist.url, skipped };
  }

  // 401: not signed in. 403: Spotify refused this account.
  if (response.status === 401 || response.status === 403) {
    const backup = await fetch("/api/spotify/shared-playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playlist.name, uris: playlist.uris }),
    });
    const backupData = await backup.json();

    if (backup.ok) {
      return {
        kind: "shared",
        url: backupData.playlist.url,
        removeAfterMinutes: backupData.removeAfterMinutes,
        skipped,
      };
    }

    // Backup is off: explain the original problem.
    if (backupData.error !== "shared_saving_off") {
      throw new Error(backupData.message ?? "Could not save to Spotify.");
    }
  }

  throw new Error(
    data.message || data.error || "Could not save to Spotify."
  );
}

export function skippedSongsNotice(skipped: number) {
  return skipped === 0
    ? ""
    : `${skipped} ${skipped === 1 ? "song isn't" : "songs aren't"} on Spotify, so ${skipped === 1 ? "it was" : "they were"} left out.`;
}

export function sharedPlaylistNotice(removeAfterMinutes: number) {
  const wait =
    removeAfterMinutes >= 60
      ? `${Math.round(removeAfterMinutes / 60)} hour${removeAfterMinutes >= 120 ? "s" : ""}`
      : `${removeAfterMinutes} minutes`;
  return `Open it in Spotify and tap Save to keep it. Echo clears its own copy after about ${wait}.`;
}
