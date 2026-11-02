/*
 * How long the server waits for Spotify,
 * Last.fm or Apple before giving up, so a
 * slow service shows an error instead of
 * leaving the page spinning.
 */
export const UPSTREAM_TIMEOUT_MS = 8_000;

export function upstreamTimeout() {
  return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
}
