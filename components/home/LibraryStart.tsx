"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/home";

/*
 * The first thing a new visitor sees: three
 * ways to give Echo some music. Spotify
 * sign-in only works for accounts on the
 * app's user list, so pasting songs and
 * plain search are offered alongside it.
 */
const TRACK_LINK =
  /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/g;
const BATCH_SIZE = 25;
const MAX_SONGS = 2000;

export function findTrackIds(text: string) {
  const ids = [...text.matchAll(TRACK_LINK)].map((match) => match[1]);
  return [...new Set(ids)].slice(0, MAX_SONGS);
}

type Choice = "spotify" | "paste" | "search";

export default function LibraryStart({
  onLoadLiked,
  onSkip,
  onImported,
}: {
  onLoadLiked: () => void;
  onSkip: () => void;
  onImported: (tracks: Omit<Track, "addedAt">[], missing: number) => void;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const ids = findTrackIds(text);
  const importing = progress !== null;

  useEffect(() => {
    fetch("/api/spotify/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { connected?: boolean }) => setSignedIn(Boolean(data.connected)))
      .catch(() => setSignedIn(false));

    return () => abortRef.current?.abort();
  }, []);

  async function importSongs() {
    if (ids.length === 0 || importing) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setProgress({ done: 0, total: ids.length });

    const found = new Map<string, Omit<Track, "addedAt">>();
    let missing = 0;

    try {
      for (let index = 0; index < ids.length; index += BATCH_SIZE) {
        const batch = ids.slice(index, index + BATCH_SIZE);

        for (let attempt = 0; ; attempt += 1) {
          const response = await fetch("/api/spotify/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: batch }),
            signal: controller.signal,
          });
          const data = await response.json();

          // Spotify asked us to slow down: wait, then resend this batch.
          if (response.status === 429 && attempt < 3) {
            await new Promise((resolve) =>
              setTimeout(resolve, (data.retryAfter ?? 5) * 1000)
            );
            continue;
          }

          if (!response.ok) {
            throw new Error(data.message ?? "Spotify couldn't look up those songs.");
          }

          for (const track of data.tracks as Omit<Track, "addedAt">[]) {
            found.set(track.id, track);
          }
          missing += (data.missing as string[]).length;
          break;
        }

        setProgress({ done: Math.min(index + BATCH_SIZE, ids.length), total: ids.length });
      }
    } catch (importError) {
      if (controller.signal.aborted) return;
      console.error("Song import failed:", importError);
      setError(
        importError instanceof Error
          ? `${importError.message} Songs found so far weren't saved.`
          : "Spotify couldn't look up those songs. Try again in a minute."
      );
      setProgress(null);
      return;
    }

    setProgress(null);

    if (found.size === 0) {
      setError("Echo couldn't find any of those songs on Spotify. Check that you copied song links, not a playlist link.");
      return;
    }

    // In the order they were pasted.
    const tracks = ids.flatMap((id) => {
      const track = found.get(id);
      return track ? [track] : [];
    });

    onImported(tracks, missing);
  }

  const tile =
    "flex w-full flex-col items-start gap-1 rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954] sm:p-5";
  const tileState = (value: Choice) =>
    choice === value
      ? "border-[#1DB954]/70 bg-[#1DB954]/[0.07]"
      : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]";

  return (
    <section className="mb-20 rounded-[30px] border border-white/[0.07] bg-[#111111] p-6 sm:p-8 md:p-12">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        How do you want to start?
      </h2>
      <p className="mt-3 max-w-xl text-base text-zinc-400 sm:text-lg">
        Echo builds a mix from songs you love. Give it your music one of these ways.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {signedIn ? (
          <button
            type="button"
            onClick={() => {
              setChoice("spotify");
              onLoadLiked();
            }}
            className={`${tile} ${tileState("spotify")}`}
          >
            <span className="text-base font-bold text-white">Load liked songs</span>
            <span className="text-sm text-zinc-500">From your connected Spotify account.</span>
          </button>
        ) : (
          <a
            href="/api/spotify/login"
            className={`${tile} ${tileState("spotify")}`}
          >
            <span className="text-base font-bold text-white">Connect Spotify</span>
            <span className="text-sm text-zinc-500">
              Use your liked songs. Invite only for now.
            </span>
          </a>
        )}

        <button
          type="button"
          aria-expanded={choice === "paste"}
          onClick={() => setChoice("paste")}
          className={`${tile} ${tileState("paste")}`}
        >
          <span className="text-base font-bold text-white">Paste songs</span>
          <span className="text-sm text-zinc-500">
            Copy songs in the Spotify app and paste them here. No sign-in.
          </span>
        </button>

        <button
          type="button"
          onClick={onSkip}
          className={`${tile} ${tileState("search")}`}
        >
          <span className="text-base font-bold text-white">Just search</span>
          <span className="text-sm text-zinc-500">Pick songs one by one.</span>
        </button>
      </div>

      {choice === "paste" && (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/30 p-4 sm:p-6">
          <ol className="flex flex-wrap gap-2 text-sm text-zinc-400">
            <li className="rounded-lg bg-white/[0.05] px-3 py-1.5">1. Open Liked Songs or a playlist in Spotify on a computer</li>
            <li className="rounded-lg bg-white/[0.05] px-3 py-1.5">2. Press ⌘A, then ⌘C (Ctrl on Windows)</li>
            <li className="rounded-lg bg-white/[0.05] px-3 py-1.5">3. Paste below</li>
          </ol>

          <label htmlFor="paste-songs" className="sr-only">
            Spotify song links
          </label>
          <textarea
            id="paste-songs"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={importing}
            rows={4}
            placeholder="https://open.spotify.com/track/…"
            className="mt-4 w-full resize-y rounded-xl border border-white/[0.08] bg-[#0b0b0b] px-4 py-3 font-mono text-base text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-[#1DB954]/50 sm:text-sm"
          />

          {progress ? (
            <div className="mt-4">
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full bg-[#1DB954] transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-zinc-500" aria-live="polite">
                Finding songs… {progress.done.toLocaleString()} of {progress.total.toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  void importSongs();
                }}
                disabled={ids.length === 0}
                className="min-h-12 rounded-full bg-[#1DB954] px-7 font-bold text-black transition hover:bg-[#22cf63] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ids.length > 0
                  ? `Import ${ids.length.toLocaleString()} ${ids.length === 1 ? "song" : "songs"}`
                  : "Import songs"}
              </button>
              <p className="text-sm text-zinc-600">
                {text.trim() && ids.length === 0
                  ? "No Spotify song links found yet. Playlist links won't work; copy the songs themselves."
                  : "Works best on a computer. Up to 2,000 songs."}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
