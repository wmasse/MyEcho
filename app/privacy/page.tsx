import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "Privacy Policy | Echo",
  description: "What Echo collects, where it's kept, and how to remove it.",
};

const UPDATED = "November 4, 2026";
const CONTACT_EMAIL = "winstonreus22@gmail.com";

const contactLink = (
  <a
    href={`mailto:${CONTACT_EMAIL}`}
    className="text-zinc-200 underline decoration-white/20 underline-offset-4 transition-colors hover:decoration-[#1DB954]"
  >
    {CONTACT_EMAIL}
  </a>
);

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "The short version",
    body: (
      <>
        <p>
          Echo doesn&apos;t have accounts, ads, or analytics. Most of what you
          make stays in your own browser. Echo only keeps something on its
          servers when you choose to share an Echo as a link.
        </p>
      </>
    ),
  },
  {
    heading: "When you connect Spotify",
    body: (
      <>
        <p>
          Signing in with Spotify lets Echo read your liked songs, top and
          recently played tracks, what&apos;s playing now, and your display
          name and profile photo. If playlist saving is on, Echo can also
          create private playlists in your library.
        </p>
        <p>
          Spotify gives Echo sign-in tokens, which are stored in secure,
          HTTP-only cookies in your browser: the access token lasts about an
          hour and the refresh token up to 180 days. Echo uses them to ask
          Spotify for your data when a page needs it and doesn&apos;t store
          your library, listening history, or profile on its servers.
        </p>
        <p>
          Choosing <strong>Disconnect Spotify</strong> clears these cookies and
          the library Echo cached in your browser. To revoke Echo&apos;s access
          completely, remove it under <strong>Manage apps</strong> in your
          Spotify account settings.
        </p>
      </>
    ),
  },
  {
    heading: "What stays in your browser",
    body: (
      <>
        <p>
          Echo uses your browser&apos;s local storage for your saved Echoes, a
          copy of your liked songs (so it doesn&apos;t have to load them every
          visit), and the genres it has looked up for artists. This data never
          leaves your device unless you share an Echo. Delete saved Echoes on
          the Saved page, or clear this site&apos;s data in your browser to
          remove everything.
        </p>
      </>
    ),
  },
  {
    heading: "Shared Echoes",
    body: (
      <>
        <p>
          When you share an Echo, its name and track list (song titles,
          artists, albums, artwork and music links) are saved in private
          storage on Vercel and given a random link. Anyone with the link can
          open it. Shared Echoes don&apos;t include your Spotify name or
          account details. To have a shared Echo taken down, email {contactLink}{" "}
          with its link.
        </p>
        <p>
          If you save a shared Echo to Spotify and your account can&apos;t
          create playlists through Echo, the playlist may be created as a
          public playlist on the site owner&apos;s account for you to save.
          Echo removes it from that account after about an hour.
        </p>
      </>
    ),
  },
  {
    heading: "Services Echo uses",
    body: (
      <>
        <p>
          To search for songs and build recommendations, Echo sends song and
          artist names to Spotify, Last.fm and Apple&apos;s public music
          catalog. Your Spotify sign-in is only ever sent to Spotify. Echo is
          hosted on Vercel, which, like any web host, may briefly keep
          standard request logs such as IP addresses. Each service handles
          data under its own privacy policy.
        </p>
      </>
    ),
  },
  {
    heading: "What Echo doesn't do",
    body: (
      <>
        <p>
          Echo doesn&apos;t sell or share your data with advertisers, use
          tracking cookies, or build a profile of you. It isn&apos;t meant for
          children under 13.
        </p>
      </>
    ),
  },
  {
    heading: "Changes",
    body: (
      <>
        <p>
          If Echo starts handling data differently, this page will be updated
          along with the date at the top.
        </p>
      </>
    ),
  },
  {
    heading: "Contact",
    body: (
      <>
        <p>
          Questions about your data or this policy? Email {contactLink}.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <PageTransition>
    <main className="min-h-screen bg-[#070707] text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="echo-glow absolute inset-x-0 top-0 h-[520px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-20 md:px-10 lg:px-14">
        {/* NAV */}
        <SiteNav />

        {/* HEADER */}
        <section className="pb-14 pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1DB954]">
            Updated {UPDATED}
          </p>

          <h1 className="mt-4 text-6xl font-black tracking-[-0.055em] md:text-8xl">
            Privacy.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-500">
            What Echo collects, where it&apos;s kept, and how to remove it.
          </p>
        </section>

        {/* SECTIONS */}
        <div className="max-w-2xl space-y-12">
          {SECTIONS.map(({ heading, body }) => (
            <section key={heading}>
              <h2 className="text-2xl font-bold tracking-[-0.02em]">
                {heading}
              </h2>
              <div className="mt-4 space-y-4 leading-7 text-zinc-400 [&_strong]:font-semibold [&_strong]:text-zinc-200">
                {body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
    </PageTransition>
  );
}
