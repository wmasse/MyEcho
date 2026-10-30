"use client";

import { useState } from "react";

type Props = {
  className?: string;
  playlistName: string;
  tracks: { name: string; artist: string }[];
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
      "idle" |
      "sharing" |
      "copied"
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

    window.prompt("Copy this playlist:", text);

    setStatus("idle");
  }

  async function shareEcho() {
    if (tracks.length === 0) return;

    const playlistText = [
      playlistName,
      "",
      ...tracks.map(
        (track, index) => `${index + 1}. ${track.name} — ${track.artist}`
      ),
    ].join("\n");

    setStatus("sharing");

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
          text: playlistText,
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

    await copyFallback(playlistText);
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
        : "Share playlist"}
    </button>
  );
}
