import { upstreamTimeout } from "@/lib/upstream";

/*
 * BACKUP SAVING THROUGH THE OWNER'S ACCOUNT
 *
 * When a visitor can't save a mix to their own Spotify (not signed in,
 * or not on the app's Development Mode user list), Echo can create it
 * as a public playlist on the site owner's account instead. The visitor
 * opens the link and taps Save. After a while Echo removes the playlist
 * from the owner's library; people who saved it keep it.
 *
 * Off unless SHARED_PLAYLIST_SAVING=on and SPOTIFY_OWNER_REFRESH_TOKEN
 * are both set. To remove it entirely, see "Backup playlist saving" in
 * the README.
 */
export const SHARED_PLAYLIST_SAVING_ENABLED =
  process.env.SHARED_PLAYLIST_SAVING === "on" &&
  Boolean(process.env.SPOTIFY_OWNER_REFRESH_TOKEN);

/** How long a shared playlist stays on the owner's account. */
export const SHARED_PLAYLIST_LIFETIME_MINUTES = 60;

// Written into each playlist's description so cleanup can find it and tell its age.
const MARKER = /\(echo-shared:(\d+)\)/;

export function sharedPlaylistDescription(createdAt = Date.now()) {
  return `Made with Echo. Tap Save to keep it. (echo-shared:${Math.floor(createdAt / 1000)})`;
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getOwnerAccessToken() {
  if (!SHARED_PLAYLIST_SAVING_ENABLED) {
    return null;
  }

  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.SPOTIFY_OWNER_REFRESH_TOKEN!,
    }),
    cache: "no-store",
    signal: upstreamTimeout(),
  });

  if (!response.ok) {
    // Usually means the owner revoked Echo or the token was replaced.
    console.error("Owner Spotify token refresh failed:", response.status);
    return null;
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cached.token;
}

/*
 * Removes Echo's shared playlists older than the lifetime from the
 * owner's library. Spotify has no true delete: unfollowing hides the
 * playlist from the owner, while anyone who saved it keeps it.
 */
export async function removeExpiredSharedPlaylists(token: string) {
  const cutoff = Date.now() / 1000 - SHARED_PLAYLIST_LIFETIME_MINUTES * 60;
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
  let removed = 0;

  // Ten pages is 500 playlists, plenty for a daily sweep.
  for (let page = 0; url && page < 10; page += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: upstreamTimeout(),
    });

    if (!response.ok) {
      console.error("Could not list owner playlists:", response.status);
      break;
    }

    const data = (await response.json()) as {
      next: string | null;
      items: ({ id: string; description?: string | null } | null)[];
    };

    for (const playlist of data.items) {
      const createdAt = Number(playlist?.description?.match(MARKER)?.[1]);

      if (!playlist || !createdAt || createdAt > cutoff) continue;

      const unfollow = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/followers`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          signal: upstreamTimeout(),
        }
      );

      if (unfollow.ok) removed += 1;
    }

    url = data.next;
  }

  return removed;
}
