"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import CoverArt from "@/components/CoverArt";
import EchoLogo from "@/components/EchoLogo";
import {
  BookmarkIcon,
  ChartIcon,
  LogoutIcon,
  PlusIcon,
  RefreshIcon,
  UserIcon,
} from "@/components/icons";

type Page = "create" | "saved" | "stats";

type Profile =
  | { connected: false }
  | { connected: true; name: string | null; image: string | null };

const LINKS: {
  page: Page;
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}[] = [
  { page: "create", href: "/", label: "Create", Icon: PlusIcon },
  { page: "saved", href: "/saved", label: "Saved", Icon: BookmarkIcon },
  { page: "stats", href: "/stats", label: "Stats", Icon: ChartIcon },
];

export type NavLibrary = {
  /** e.g. "1,240 liked songs" */
  summary: string;
  refreshLabel: string;
  refreshing: boolean;
  /** Left out when there's nothing to refresh, e.g. library skipped. */
  onRefresh?: () => void;
};

export default function SiteNav({
  current,
  library,
  className = "",
}: {
  current?: Page;
  library?: NavLibrary;
  className?: string;
}) {
  return (
    <nav
      aria-label="Main"
      className={`flex h-20 items-center justify-between gap-2 sm:h-28 sm:gap-3 lg:h-32 ${className}`}
    >
      <EchoLogo />

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        {LINKS.map(({ page, href, label, Icon }) => {
          const active = page === current;

          return (
            <Link
              key={page}
              href={href}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`flex h-10 min-w-9 items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954] sm:h-9 sm:min-w-10 sm:px-3 ${
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Icon />
              <span className="sr-only sm:not-sr-only">{label}</span>
            </Link>
          );
        })}

        <AccountMenu library={library} />
      </div>
    </nav>
  );
}

function AccountMenu({ library }: { library?: NavLibrary }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/spotify/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Profile) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile({ connected: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside tap or Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    menuRef.current
      ?.querySelector<HTMLButtonElement>("[role=menuitem]")
      ?.focus();

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /*
   * Signs out of Spotify and forgets the
   * cached library, so the next person on
   * this browser doesn't see it. Saved
   * Echoes stay.
   */
  async function disconnect() {
    setDisconnecting(true);
    setError("");

    try {
      const response = await fetch("/api/spotify/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Logout returned ${response.status}`);
      }
    } catch (logoutError) {
      console.error("Could not disconnect Spotify:", logoutError);
      setError("Couldn't disconnect. Check your connection and try again.");
      setDisconnecting(false);
      return;
    }

    try {
      localStorage.removeItem("echoSpotifyLibrary");
      localStorage.removeItem("echoSpotifyLibraryCachedAt");
    } catch {
      // Storage can be unavailable in private windows.
    }

    // A full reload clears every bit of in-memory library state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  // Same footprint while loading, so the bar doesn't shift.
  if (!profile) {
    return (
      <span className="ml-1 h-9 w-9 shrink-0 rounded-full bg-white/[0.06] sm:ml-2" />
    );
  }

  if (!profile.connected) {
    return (
      <a
        href="/api/spotify/login"
        title="Connect Spotify"
        className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-sm font-medium text-zinc-200 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954] sm:ml-2 sm:w-auto sm:px-3.5"
      >
        {/* Same footprint as the profile circle on phones, so the bar fits. */}
        <UserIcon className="h-[18px] w-[18px] sm:hidden" />
        <span className="sr-only sm:not-sr-only">Connect</span>
      </a>
    );
  }

  const initial = (profile.name?.trim()[0] ?? "S").toUpperCase();
  const menuItem =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:bg-white/[0.06] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div ref={rootRef} className="relative ml-1 shrink-0 sm:ml-2">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Spotify account"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.14] bg-zinc-900 text-sm font-semibold text-zinc-100 transition-colors hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954]"
      >
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
          {profile.image ? (
            <CoverArt
              src={profile.image}
              size={36}
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </span>
        <span
          aria-hidden="true"
          className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-[#070707] bg-[#1DB954]"
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Spotify account"
          className="absolute right-0 top-full z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-white/[0.1] bg-[#141414] p-1.5 shadow-2xl shadow-black/60"
        >
          <div className="border-b border-white/[0.07] px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-white">
              {profile.name ?? "Your Spotify account"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {library?.summary ?? "Connected to Spotify"}
            </p>
          </div>

          <div className="pt-1.5">
            {library?.onRefresh && (
              <button
                type="button"
                role="menuitem"
                disabled={library.refreshing}
                onClick={() => {
                  setOpen(false);
                  library.onRefresh?.();
                }}
                className={`${menuItem} text-zinc-200 hover:bg-white/[0.06]`}
              >
                <RefreshIcon className="h-4 w-4 text-zinc-500" />
                {library.refreshLabel}
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={disconnecting}
              onClick={() => {
                void disconnect();
              }}
              className={`${menuItem} text-zinc-400 hover:bg-white/[0.06] hover:text-white`}
            >
              <LogoutIcon className="h-4 w-4 text-zinc-500" />
              {disconnecting ? "Disconnecting…" : "Disconnect Spotify"}
            </button>

            {error && (
              <p role="alert" className="px-3 pb-2 pt-1 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
