"use client";

import { useEffect, useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
import CoverArt from "@/components/CoverArt";
import PageTransition from "@/components/PageTransition";

type TimeRange = "short_term" | "medium_term" | "long_term";

type SpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  images?: { url: string }[];
  external_urls?: { spotify?: string };
};

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  artists: { id: string; name: string }[];
  album: { name: string; images?: { url: string }[] };
  external_urls?: { spotify?: string };
};

type StatsData = {
  range: TimeRange;
  topTracks: SpotifyTrack[];
  topArtists: SpotifyArtist[];
  recentlyPlayed: { played_at: string; track: SpotifyTrack }[];
  currentlyPlaying: { is_playing?: boolean; item?: SpotifyTrack | null } | null;
  unavailable: string[];
  needsReauthorization: boolean;
  needsCurrentlyPlayingAuthorization: boolean;
  rateLimited: boolean;
};

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "short_term", label: "4 weeks" },
  { value: "medium_term", label: "6 months" },
  { value: "long_term", label: "1 year" },
];

function trackImage(track: SpotifyTrack) {
  return track.album.images?.[0]?.url ?? null;
}

function artistNames(track: SpotifyTrack) {
  return track.artists.map((artist) => artist.name).join(", ");
}

function hourLabel(hour: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
  }).format(new Date(2020, 0, 1, hour));
}

function timestampLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateGroup(value: string) {
  const date = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / 86_400_000
  );

  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
  }).format(date);
}

const HISTORY_PREVIEW = 10;

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="min-w-0 rounded-[24px] border border-white/[0.07] bg-[#111111]/90 p-4 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs sm:tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
        {value}
      </p>
      {detail && <p className="mt-2 text-sm text-zinc-600">{detail}</p>}
    </article>
  );
}

export default function StatsDashboard() {
  const [range, setRange] = useState<TimeRange>("short_term");
  const [data, setData] = useState<StatsData | null>(null);
  const [loadedRange, setLoadedRange] = useState<TimeRange | null>(null);
  const [errorState, setErrorState] = useState<{
    range: TimeRange;
    message: string;
  } | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const loading = loadedRange !== range;
  const error = errorState?.range === range ? errorState.message : "";

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/spotify/stats?range=${range}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) {
          setConnected(false);
          setLoadedRange(range);
          return;
        }
        if (!response.ok) {
          throw new Error(
            result.error === "spotify_request_failed"
              ? "Spotify could not load your stats right now. Try again in a moment."
              : "Could not load your Spotify stats."
          );
        }
        setConnected(true);
        setData(result as StatsData);
        setErrorState(null);
        setLoadedRange(range);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setErrorState({
          range,
          message:
            fetchError instanceof Error
              ? fetchError.message
              : "Could not load your Spotify stats.",
        });
        setLoadedRange(range);
      });

    return () => controller.abort();
  }, [range]);

  const insights = useMemo(() => {
    const plays = data?.recentlyPlayed ?? [];
    const artistIds = new Set<string>();
    const hourly = Array.from({ length: 24 }, () => 0);
    const repeats = new Map<string, { count: number; track: SpotifyTrack }>();

    for (const play of plays) {
      const playedAt = new Date(play.played_at);
      hourly[playedAt.getHours()] += 1;
      for (const artist of play.track.artists) {
        artistIds.add(artist.id || artist.name);
      }
      const existing = repeats.get(play.track.id);
      repeats.set(play.track.id, {
        count: (existing?.count ?? 0) + 1,
        track: play.track,
      });
    }

    const mostRepeated = [...repeats.values()].sort(
      (left, right) => right.count - left.count
    )[0];
    const peakHour = hourly.reduce(
      (best, count, hour) => (count > hourly[best] ? hour : best),
      0
    );
    const genres = new Set(
      (data?.topArtists ?? []).flatMap((artist) => artist.genres ?? [])
    );

    return {
      playCount: plays.length,
      artistCount: artistIds.size,
      trackCount: repeats.size,
      genreCount: genres.size,
      hourly,
      peakHour: plays.length > 0 ? peakHour : null,
      mostRepeated: mostRepeated && mostRepeated.count > 1 ? mostRepeated : null,
      maxHourly: Math.max(1, ...hourly),
    };
  }, [data]);

  const groupedHistory = useMemo(() => {
    const groups = new Map<string, StatsData["recentlyPlayed"]>();
    for (const play of data?.recentlyPlayed ?? []) {
      const group = dateGroup(play.played_at);
      groups.set(group, [...(groups.get(group) ?? []), play]);
    }
    return [...groups.entries()];
  }, [data]);

  // Show the latest plays first; the full 50 are one tap away.
  const [showAllHistory, setShowAllHistory] = useState(false);
  const historyPlayCount = data?.recentlyPlayed.length ?? 0;
  const visibleHistory = useMemo(() => {
    if (showAllHistory) return groupedHistory;
    let left = HISTORY_PREVIEW;
    const trimmed: typeof groupedHistory = [];
    for (const [group, plays] of groupedHistory) {
      if (left <= 0) break;
      trimmed.push([group, plays.slice(0, left)]);
      left -= plays.length;
    }
    return trimmed;
  }, [groupedHistory, showAllHistory]);

  const missingRequiredAccess = data?.needsReauthorization ?? false;

  return (
    <PageTransition>
    <main className="min-h-screen bg-[#070707] pb-24 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="echo-glow absolute inset-x-0 top-0 h-[520px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 md:px-10 lg:px-14">
        <SiteNav current="stats" />

        <header className="pb-9 pt-12 md:pb-12 md:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1DB954]">
            Your listening, in focus
          </p>
          <div className="mt-4 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-6xl font-black tracking-[-0.06em] sm:text-7xl md:text-8xl">
                Your stats.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-500 sm:text-lg">
                The artists, tracks, and little listening habits that make your taste yours.
              </p>
            </div>

            <div className="inline-flex w-fit rounded-full border border-white/[0.08] bg-[#111111] p-1">
              {RANGES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  aria-pressed={range === option.value}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition sm:px-5 ${
                    range === option.value
                      ? "bg-[#1DB954] text-black"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {connected === false && (
          <section className="rounded-[30px] border border-[#1DB954]/20 bg-[#101612] px-7 py-12 text-center sm:px-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1DB954]">
              One quick connection
            </p>
            <h2 className="mx-auto mt-4 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
              Your listening story starts with Spotify.
            </h2>
            <p className="mx-auto mt-4 max-w-lg leading-7 text-zinc-500">
              Connect your account to see your top artists, top tracks, and recent listening.
            </p>
            <a
              href="/api/spotify/login?next=%2Fstats"
              className="mt-8 inline-flex rounded-full bg-[#1DB954] px-7 py-3.5 font-bold text-black transition hover:scale-[1.02]"
            >
              Connect Spotify
            </a>
          </section>
        )}

        {connected !== false && error && (
          <section role="alert" className="rounded-[24px] border border-red-400/20 bg-red-400/[0.06] px-6 py-5 text-red-200">
            {error}
          </section>
        )}

        {connected !== false && data?.rateLimited && (
          <section role="status" className="mb-6 rounded-[24px] border border-amber-300/20 bg-amber-300/[0.05] px-6 py-5 text-sm text-amber-100/80">
            Spotify is temporarily limiting requests. Some stats may be missing; try refreshing in a little while.
          </section>
        )}

        {connected !== false && missingRequiredAccess && (
          <section className="mb-6 rounded-[24px] border border-[#1DB954]/20 bg-[#101612] px-6 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="font-bold text-white">Echo needs updated Spotify access.</p>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Reconnect to allow Echo to read your top items and recent plays.
              </p>
            </div>
            <a
              href="/api/spotify/login?next=%2Fstats"
              className="mt-4 inline-flex shrink-0 rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-bold text-black sm:mt-0"
            >
              Reconnect Spotify
            </a>
          </section>
        )}

        {connected !== false && (
          <>
            <section aria-label="Listening overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Recent plays" value={loading ? "—" : String(insights.playCount)} detail="from Spotify’s recent history" />
              <StatCard label="Artists heard" value={loading ? "—" : String(insights.artistCount)} detail="in the recent play sample" />
              {insights.genreCount > 0 ? (
                <StatCard label="Genres among top artists" value={loading ? "—" : String(insights.genreCount)} detail={RANGES.find((item) => item.value === range)?.label} />
              ) : (
                <StatCard label="Different songs" value={loading ? "—" : String(insights.trackCount)} detail="in the recent play sample" />
              )}
              <StatCard label="Most active hour" value={loading || insights.peakHour === null ? "—" : hourLabel(insights.peakHour)} detail="based on recent play times" />
            </section>

            <section className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
              <article className="overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#111111] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1DB954]">Your number one</p>
                    <h2 className="mt-2 text-2xl font-black">Top artist</h2>
                  </div>
                  <span className="rounded-full border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-500">
                    {RANGES.find((item) => item.value === range)?.label}
                  </span>
                </div>
                {loading ? (
                  <div className="mt-7 h-44 animate-pulse rounded-2xl bg-white/[0.04]" />
                ) : data?.topArtists[0] ? (
                  <div className="mt-7 flex items-center gap-5 sm:gap-7">
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full bg-zinc-900 sm:h-36 sm:w-36">
                      {data.topArtists[0].images?.[0]?.url ? (
                        <CoverArt src={data.topArtists[0].images[0].url} alt="" className="h-full w-full object-cover" size={144} />
                      ) : <div className="flex h-full items-center justify-center text-4xl font-black text-zinc-700">♪</div>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-3xl font-black tracking-tight sm:text-4xl">{data.topArtists[0].name}</p>
                      <p className="mt-2 text-sm text-zinc-500">#1 artist in this period</p>
                      <a href={data.topArtists[0].external_urls?.spotify ?? "https://open.spotify.com"} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-semibold text-[#1DB954] hover:text-[#8af0a8]">
                        Open in Spotify <span aria-hidden="true" className="ml-1">↗</span>
                      </a>
                    </div>
                  </div>
                ) : <p className="py-12 text-sm text-zinc-500">No top artist data for this period yet.</p>}
                {!loading && (data?.topArtists.length ?? 0) > 1 && (
                  <div className="mt-7 border-t border-white/[0.06] pt-2">
                    {data?.topArtists.slice(1, 6).map((artist, index) => (
                      <a
                        key={artist.id}
                        href={artist.external_urls?.spotify ?? "https://open.spotify.com"}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-3 border-b border-white/[0.05] py-3 last:border-0"
                      >
                        <span className="w-5 text-right text-xs font-semibold tabular-nums text-zinc-600">{String(index + 2).padStart(2, "0")}</span>
                        {artist.images?.[0]?.url ? (
                          <CoverArt src={artist.images[0].url} alt="" className="h-9 w-9 rounded-full object-cover" size={36} />
                        ) : <div className="h-9 w-9 rounded-full bg-zinc-900" />}
                        <span className="truncate text-sm font-semibold text-zinc-300 transition group-hover:text-[#1DB954]">{artist.name}</span>
                        <span aria-hidden="true" className="ml-auto text-xs text-zinc-700 group-hover:text-[#1DB954]">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </article>

              <div className="flex min-w-0 flex-col gap-7">
              <article className="rounded-[30px] border border-white/[0.07] bg-[#111111] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1DB954]">Right now</p>
                    <h2 className="mt-2 text-2xl font-black">Your listening pulse</h2>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954]/10 text-xl text-[#1DB954]">♫</span>
                </div>
                {loading ? (
                  <div className="mt-7 h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
                ) : data?.currentlyPlaying?.item ? (
                  <div className="mt-7 flex items-center gap-4">
                    {trackImage(data.currentlyPlaying.item) ? <CoverArt src={trackImage(data.currentlyPlaying.item)!} alt="" className="h-20 w-20 rounded-2xl object-cover" size={80} /> : <div className="h-20 w-20 rounded-2xl bg-zinc-900" />}
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold">{data.currentlyPlaying.item.name}</p>
                      <p className="mt-1 truncate text-sm text-zinc-500">{artistNames(data.currentlyPlaying.item)}</p>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[#1DB954]">{data.currentlyPlaying.is_playing ? "Playing now" : "Recently active"}</p>
                    </div>
                  </div>
                ) : insights.mostRepeated ? (
                  <div className="mt-7 flex items-center gap-4">
                    {trackImage(insights.mostRepeated.track) ? <CoverArt src={trackImage(insights.mostRepeated.track)!} alt="" className="h-20 w-20 rounded-2xl object-cover" size={80} /> : <div className="h-20 w-20 rounded-2xl bg-zinc-900" />}
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold">{insights.mostRepeated.track.name}</p>
                      <p className="mt-1 truncate text-sm text-zinc-500">{artistNames(insights.mostRepeated.track)}</p>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[#1DB954]">Played {insights.mostRepeated.count} times recently</p>
                    </div>
                  </div>
                ) : data?.needsCurrentlyPlayingAuthorization ? (
                  <div className="mt-7">
                    <p className="text-sm leading-6 text-zinc-500">Reconnect Spotify to show what is playing on your account.</p>
                    <a href="/api/spotify/login?next=%2Fstats" className="mt-4 inline-flex text-sm font-semibold text-[#1DB954] hover:text-[#8af0a8]">Reconnect Spotify <span aria-hidden="true" className="ml-1">↗</span></a>
                  </div>
                ) : (
                  <p className="mt-7 text-sm leading-6 text-zinc-500">Nothing playing at the moment. Your most repeated track will show up here when Spotify has a repeat in your recent plays.</p>
                )}
              </article>
                <article className="rounded-[30px] border border-white/[0.07] bg-[#111111] p-6 sm:p-8">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1DB954]">Your rhythm</p>
                    <h2 className="mt-2 text-2xl font-black">Listening by hour</h2>
                    <p className="mt-2 text-sm text-zinc-600">When your recent plays happened, in your local time.</p>
                  </div>
                  <div className="mt-7 flex h-32 items-end gap-1.5 sm:gap-2" role="img" aria-label="Recent plays by local hour">
                    {insights.hourly.map((count, hour) => (
                      <div key={hour} className="group relative flex h-full flex-1 items-end">
                        <div className={`w-full rounded-t-sm transition-colors ${count > 0 ? "bg-[#1DB954]/75 group-hover:bg-[#1DB954]" : "bg-white/[0.05]"}`} style={{ height: `${Math.max(5, (count / insights.maxHourly) * 100)}%` }} />
                        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-[10px] text-white opacity-0 shadow-lg transition group-hover:opacity-100">{hourLabel(hour)} · {count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-[10px] font-medium text-zinc-600 sm:text-xs">
                    <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
                  </div>
                  {insights.genreCount > 0 && (
                    <div className="mt-7 border-t border-white/[0.06] pt-6">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">In your top artists</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[...new Set((data?.topArtists ?? []).flatMap((artist) => artist.genres ?? []))].slice(0, 8).map((genre) => (
                          <span key={genre} className="rounded-full border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400">{genre}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              </div>
            </section>

            <section className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <article className="min-w-0 rounded-[30px] border border-white/[0.07] bg-[#111111] p-6 sm:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1DB954]">The soundtrack</p>
                    <h2 className="mt-2 text-2xl font-black">Top tracks</h2>
                  </div>
                  <span className="text-sm text-zinc-600">Top 10</span>
                </div>
                <div className="mt-5 divide-y divide-white/[0.06]">
                  {loading ? Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="flex items-center gap-4 py-3.5">
                      <div className="h-12 w-12 animate-pulse rounded-xl bg-white/[0.05]" />
                      <div className="flex-1"><div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.05]" /><div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-white/[0.04]" /></div>
                    </div>
                  )) : (data?.topTracks ?? []).map((track, index) => (
                    <a key={track.id} href={track.external_urls?.spotify ?? "https://open.spotify.com"} target="_blank" rel="noreferrer" className="group flex items-center gap-4 py-3.5">
                      <span className="w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-600">{String(index + 1).padStart(2, "0")}</span>
                      {trackImage(track) ? <CoverArt src={trackImage(track)!} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" size={48} /> : <div className="h-12 w-12 shrink-0 rounded-xl bg-zinc-900" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-zinc-100 transition group-hover:text-[#1DB954]">{track.name}</p>
                        <p className="mt-1 truncate text-sm text-zinc-500">{artistNames(track)}</p>
                      </div>
                      <span aria-hidden="true" className="px-1 text-zinc-700 transition group-hover:text-[#1DB954]">↗</span>
                    </a>
                  ))}
                  {!loading && data?.topTracks.length === 0 && <p className="py-8 text-sm text-zinc-500">No top tracks for this period yet.</p>}
                </div>
              </article>

              <article className="min-w-0 rounded-[30px] border border-white/[0.07] bg-[#111111] p-6 sm:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1DB954]">The latest</p>
                    <h2 className="mt-2 text-2xl font-black">Listening history</h2>
                  </div>
                  <span className="text-sm text-zinc-600">Last {historyPlayCount} plays</span>
                </div>
                {loading ? (
                  <div className="mt-6 space-y-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
                ) : visibleHistory.length > 0 ? (
                  <div className="mt-5 space-y-5">
                    {visibleHistory.map(([group, plays]) => (
                      <div key={group}>
                        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{group}</h3>
                        <div className="mt-1 divide-y divide-white/[0.05]">
                          {plays.map((play) => (
                            <a key={`${play.track.id}-${play.played_at}`} href={play.track.external_urls?.spotify ?? "https://open.spotify.com"} target="_blank" rel="noreferrer" className="group flex items-center gap-3 py-2.5">
                              {trackImage(play.track) ? <CoverArt src={trackImage(play.track)!} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" size={40} /> : <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-900" />}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-zinc-200 transition group-hover:text-[#1DB954]">{play.track.name}</p>
                                <p className="mt-0.5 truncate text-xs text-zinc-600">{artistNames(play.track)}</p>
                              </div>
                              <span className="shrink-0 text-xs tabular-nums text-zinc-600">{timestampLabel(play.played_at)}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                    {historyPlayCount > HISTORY_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setShowAllHistory((value) => !value)}
                        className="min-h-11 w-full rounded-full border border-white/[0.1] text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        {showAllHistory ? "Show fewer" : `Show all ${historyPlayCount} plays`}
                      </button>
                    )}
                  </div>
                ) : <p className="mt-7 rounded-2xl border border-white/[0.06] bg-black/20 px-5 py-8 text-sm text-zinc-500">No recent plays were returned. Spotify may have limited history available right now.</p>}
              </article>

            </section>


            <p className="mx-auto mt-7 max-w-3xl text-center text-xs leading-5 text-zinc-600">
              Top items reflect Spotify’s affinity rankings. Recent-play insights use up to 50 plays from Spotify’s limited history window, not your lifetime listening history; Echo does not currently keep a separate archive.
            </p>
          </>
        )}
      </div>
    </main>
    </PageTransition>
  );
}
