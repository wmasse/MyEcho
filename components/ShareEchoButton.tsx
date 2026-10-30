"use client";

import { useState } from "react";
import { encodeSharedEcho } from "@/lib/shared-echo";

type Props = {
  className?: string;
  playlistName: string;
  tracks: {
    id: string;
    uri: string;
    name: string;
    artist: string;
    album: string;
    image: string | null;
    source: "seed" | "library" | "discovery";
    echoScore: number;
    matchedSeeds: number;
  }[];
  disabled?: boolean;
};

export default function ShareEchoButton({
  className = "",
  playlistName,
  tracks,
  disabled = false,
}: Props) {
  const [status, setStatus] =
    useState<
      "idle" | "sharing" | "copied" | "error"
    >("idle");

  async function copyFallback(text: string) {
    try {
      if (
        navigator.clipboard
          ?.writeText
      ) {
        await navigator.clipboard.writeText(
          text
        );

        setStatus("copied");

        setTimeout(
          () =>
            setStatus("idle"),
          1800
        );

        return;
      }
    } catch {
      // Fall through to manual copy.
    }

    window.prompt("Copy this Echo link:", text);
    setStatus("idle");
  }

  async function shareEcho() {
    if (tracks.length === 0) return;

    setStatus("sharing");

    let shareUrl: string;

    try {
      const encodedEcho = await encodeSharedEcho(playlistName, tracks);
      shareUrl = `${window.location.origin}/shared#echo=${encodedEcho}`;
    } catch (error) {
      console.error(error);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
      return;
    }

    /*
     * Native share sheet:
     * Messages, AirDrop, Mail,
     * WhatsApp, etc. depending
     * on the device/browser.
     */
    if (
      typeof navigator.share ===
      "function"
    ) {
      try {
        await navigator.share({
          title: playlistName,
          text: `Open this Echo in Echo: ${playlistName}`,
          url: shareUrl,
        });

        setStatus("idle");
        return;
      } catch (error) {
        /*
         * User simply closed the
         * share sheet.
         */
        if (
          error instanceof DOMException &&
          error.name ===
            "AbortError"
        ) {
          setStatus("idle");
          return;
        }

        /*
         * Browser/device could not
         * use native sharing.
         * Fall back to copying.
         */
      }
    }

    await copyFallback(shareUrl);
  }

  return (
    <button
      type="button"
      onClick={shareEcho}
      disabled={disabled || status === "sharing"}
      className={className}
    >
      {status === "sharing"
        ? "Sharing..."
        : status === "copied"
        ? "Copied!"
        : status === "error"
        ? "Couldn’t create link"
        : "Share Echo"}
    </button>
  );
}
