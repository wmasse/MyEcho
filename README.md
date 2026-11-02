# Echo

Echo helps you build music mixes from a few songs you choose. You can use your Spotify liked songs, find related tracks from Spotify or Apple Music, save mixes in your browser, and share an Echo with a link.

## Run locally

Install dependencies and start the Next.js development server:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Spotify features use the `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI` environment variables. For local development, set `SPOTIFY_REDIRECT_URI` to `http://127.0.0.1:3000/api/spotify/callback`; in deployed environments, set it to `https://myechosounds.com/api/spotify/callback`. Add both exact URLs to the Redirect URIs list in the Spotify app settings. Genre lookup and some recommendations use `LASTFM_API_KEY`. Set `NEXT_PUBLIC_SPOTIFY_PLAYLISTS_ENABLED=false` to pause creating playlists on Spotify.

## Short shared links

Sharing saves an Echo to a private Vercel Blob store and creates a short link at `/shared/{id}`. In the Vercel project, create a private Blob store and connect it to the environments where the app runs. For local development, add the store's `BLOB_READ_WRITE_TOKEN` to `.env.local`. Sharing is unavailable until the Blob store is connected. Existing `/shared#echo=...` links remain readable.

## Backup playlist saving

Spotify only lets accounts on the app's Development Mode user list save playlists to their own library. For everyone else, Echo can save the mix as a public playlist on the site owner's account instead. The visitor opens the link and taps **Save**. About an hour later, Echo removes the playlist from the owner's library; anyone who saved it keeps it. Visitors who can save to their own account always do, so this is only a backup.

It's off unless both `SHARED_PLAYLIST_SAVING=on` and `SPOTIFY_OWNER_REFRESH_TOKEN` are set.

### Turn it on
1. Run Echo locally (`npm run dev`) and open `http://127.0.0.1:3000/api/spotify/login?owner=1`. Sign in with the Spotify account the playlists should live on and allow access.
2. Open `http://127.0.0.1:3000/api/spotify/owner-token` and copy the token. This page only works locally.
3. In Vercel, add these Production environment variables, then redeploy:
   - `SPOTIFY_OWNER_REFRESH_TOKEN`: the token from step 2. Keep it private.
   - `SHARED_PLAYLIST_SAVING`: `on`
   - `CRON_SECRET`: any long random string. Vercel Cron sends it to the daily cleanup job.

Cleanup runs whenever someone saves a new shared playlist, and once a day from `vercel.json` (Vercel's Hobby plan allows daily cron jobs).

### Turn it off
Set `SHARED_PLAYLIST_SAVING` to `off` in Vercel and redeploy. Save to Spotify goes back to working only for listed accounts. Playlists people already saved stay in their libraries.

### Remove it completely
Delete these files and the environment variables above:
- `lib/spotify-owner.ts`
- `app/api/spotify/shared-playlist/route.ts`
- `app/api/spotify/owner-token/route.ts`
- `app/api/cron/shared-playlist-cleanup/route.ts`
- `vercel.json` (it only holds the cleanup schedule)

Then remove the fallback in `lib/save-to-spotify.ts` (the `401`/`403` branch) and the `?owner=1` scopes in `app/api/spotify/login/route.ts`. To revoke the owner token itself, remove Echo under **Manage apps** in your Spotify account settings.

## Project files

This guide covers the files checked into the repository. `node_modules`, `.next`, and other generated files are created locally and are not listed here.

### App pages and styles

| File | Language | Purpose |
| --- | --- | --- |
| `app/page.tsx` | TypeScript with React JSX (TSX) | Home page. Lets you connect Spotify, search for seed songs, choose tracks from your library, and start building an Echo. |
| `app/echo/page.tsx` | TypeScript with React JSX (TSX) | Echo builder. Requests recommendations, lets you tune and edit the mix, then save it in the browser, share it, or create a Spotify playlist. |
| `app/shared/page.tsx` | TypeScript with React JSX (TSX) | Opens a legacy fragment-based shared Echo and lets the visitor save a remix to their browser. |
| `app/shared/[id]/page.tsx` | TypeScript with React JSX (TSX) | Opens a shared Echo addressed by its short ID. |
| `app/saved/page.tsx` | TypeScript with React JSX (TSX) | Lists browser-saved Echoes and supports renaming, editing, deleting, and sending them to Spotify. |
| `app/saved/[id]/page.tsx` | TypeScript with React JSX (TSX) | Shows one saved Echo selected by its ID. Supports renaming tracks and saving the mix to Spotify. |
| `app/layout.tsx` | TypeScript with React JSX (TSX) | Defines the shared HTML document structure, page metadata, and global stylesheet for all routes. |
| `app/globals.css` | CSS with Tailwind CSS | Imports Tailwind, sets global colors and fonts, and defines the album-cover animation. |
| `app/favicon.ico` | ICO image (binary) | Browser tab and bookmark icon served by Next.js. |

### API routes

| File | Language | Purpose |
| --- | --- | --- |
| `app/api/echo/route.ts` | TypeScript | Builds an Echo recommendation list from seed songs and optional liked songs. Uses Last.fm similarity signals and resolves recommendations against Spotify or Apple Music catalogs. |
| `app/api/liked/route.ts` | TypeScript | Reads a page of the connected Spotify user's liked songs and returns normalized track data. |
| `app/api/spotify/login/route.ts` | TypeScript | Starts Spotify OAuth sign-in and requests access to the library and, when enabled, playlist creation. |
| `app/api/spotify/logout/route.ts` | TypeScript | Disconnects Spotify by clearing the sign-in cookies. |
| `app/api/spotify/callback/route.ts` | TypeScript | Validates Spotify's OAuth callback, exchanges the authorization code for tokens, and stores them in secure cookies. |
| `app/api/spotify/search/route.ts` | TypeScript | Searches Spotify's catalog for songs using the user's access token. |
| `app/api/spotify/playlist/route.ts` | TypeScript | Creates a private Spotify playlist and adds the supplied Spotify track URIs. Respects the playlist creation setting. |
| `app/api/apple/search/route.ts` | TypeScript | Searches Apple's public music catalog and returns normalized song data, including Apple Music links. |
| `app/api/genre/route.ts` | TypeScript | Looks up one artist's Last.fm tags and maps them to an Echo genre. |
| `app/api/genre/batch/route.ts` | TypeScript | Looks up genres for several artists in small concurrent groups to reduce the number of browser requests. |
| `app/api/shared/route.ts` | TypeScript | Validates and stores an Echo in private Vercel Blob, then returns its short ID. |
| `app/api/shared/[id]/route.ts` | TypeScript | Loads a stored Echo by short ID. |

### Shared components and libraries

| File | Language | Purpose |
| --- | --- | --- |
| `components/CoverArt.tsx` | TypeScript with React JSX (TSX) | Album and artist artwork. Uses Next.js image optimization for allowed hosts and loads other images as they are. |
| `components/EchoLogo.tsx` | TypeScript with React JSX (TSX) | Reusable Echo wordmark and home link. |
| `components/ShareEchoButton.tsx` | TypeScript with React JSX (TSX) | Saves an Echo for sharing, then uses the device share sheet or copies the short link as a fallback. |
| `components/SharedEchoView.tsx` | TypeScript with React JSX (TSX) | Displays a shared Echo and lets the visitor save a remix to their browser. |
| `lib/shared-echo.ts` | TypeScript | Validates shared Echo data and reads older fragment-based links. |
| `lib/upstream.ts` | TypeScript | Shared time limit for requests to Spotify, Last.fm, and Apple. |
| `lib/spotify.ts` | TypeScript | Retrieves the Spotify access token from cookies or refreshes it using the stored refresh token. |
| `lib/spotify-playlists.ts` | TypeScript | Reads the playlist creation setting and provides the message shown when that feature is paused. |

### Configuration and project metadata

| File | Language | Purpose |
| --- | --- | --- |
| `package.json` | JSON | Project metadata, dependencies, and npm scripts for development, production builds, serving, and linting. |
| `package-lock.json` | JSON | Locks the exact npm dependency versions used for repeatable installs. |
| `next.config.ts` | TypeScript | Next.js configuration, including allowed development origins, remote image hosts, caching, and the CSS build rule. |
| `tsconfig.json` | JSON | TypeScript compiler settings, including strict checking and the `@/` import alias. |
| `eslint.config.mjs` | JavaScript ES module | ESLint configuration using the Next.js Core Web Vitals and TypeScript rules. |
| `.gitignore` | Git ignore patterns | Excludes dependencies, build output, local environment files, logs, and other generated or machine-specific files from Git. |
| `AGENTS.md` | Markdown | Repository-specific instructions for coding agents, including the requirement to consult the installed Next.js guides before changing code. |
| `README.md` | Markdown | This project overview, local startup note, and file-by-file guide. |

### Public image assets

| File | Language / format | Purpose |
| --- | --- | --- |
| `public/echo-mark.svg` | SVG (XML-based vector markup) | Echo logo mark, used as the site icon. |
