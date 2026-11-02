/*
 * Saves a mix to Spotify from the browser. It always tries the
 * visitor's own account first. Only when Spotify won't allow that (not
 * signed in, or not on the app's user list) does it fall back to a
 * shared playlist on the site owner's account, if that backup is
 * switched on.
 */
export type SpotifySaveResult =
  | { kind: "own"; url: string }
  | { kind: "shared"; url: string; removeAfterMinutes: number };

export async function saveMixToSpotify(playlist: {
  name: string;
  description: string;
  uris: string[];
}): Promise<SpotifySaveResult> {
  const response = await fetch("/api/spotify/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(playlist),
  });
  const data = await response.json();

  if (response.ok) {
    return { kind: "own", url: data.playlist.url };
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

export function sharedPlaylistNotice(removeAfterMinutes: number) {
  const wait =
    removeAfterMinutes >= 60
      ? `${Math.round(removeAfterMinutes / 60)} hour${removeAfterMinutes >= 120 ? "s" : ""}`
      : `${removeAfterMinutes} minutes`;
  return `Open it in Spotify and tap Save to keep it. Echo clears its own copy after about ${wait}.`;
}
