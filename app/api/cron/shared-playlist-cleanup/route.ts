import { NextRequest, NextResponse } from "next/server";
import {
  SHARED_PLAYLIST_SAVING_ENABLED,
  getOwnerAccessToken,
  removeExpiredSharedPlaylists,
} from "@/lib/spotify-owner";

/*
 * Daily sweep of expired shared playlists, run by Vercel Cron (see
 * vercel.json). New saves also sweep, so this only catches quiet days.
 * Vercel sends the CRON_SECRET as a bearer token.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!SHARED_PLAYLIST_SAVING_ENABLED) {
    return NextResponse.json({ skipped: "shared playlist saving is off" });
  }

  const token = await getOwnerAccessToken();

  if (!token) {
    return NextResponse.json(
      { error: "owner_token_unavailable" },
      { status: 503 }
    );
  }

  const removed = await removeExpiredSharedPlaylists(token);
  return NextResponse.json({ removed });
}
