"use client";

import { useState } from "react";

type ShareTrack = {
  id: string;
  name: string;
  artist: string;

  source?:
    | "seed"
    | "library"
    | "discovery";
};

type Props = {
  name: string;
  tracks: ShareTrack[];
  seeds?: ShareTrack[];
  disabled?: boolean;
  className?: string;
};

export default function ShareEchoButton({
  name,
  tracks,
  seeds = [],
  disabled = false,
  className = "",
}: Props) {
  const [status, setStatus] =
    useState<
      "idle" |
      "sharing" |
      "copied"
    >("idle");

  function buildShareText() {
    const seedText =
      seeds.length > 0
        ? [
            "Built from:",
            ...seeds.map(
              (track) =>
                `• ${track.name} — ${track.artist}`
            ),
            "",
          ]
        : [];

    const trackText =
      tracks.map(
        (track, index) => {
          const label =
            track.source ===
            "seed"
              ? " [seed]"
              : track.source ===
                "discovery"
              ? " [new]"
              : "";

          return `${index + 1}. ${track.name} — ${track.artist}${label}`;
        }
      );

    return [
      `🎧 ${name}`,
      "Made with Echo",
      "",
      ...seedText,
      `${tracks.length} songs`,
      "",
      ...trackText,
    ].join("\n");
  }

  async function copyFallback(
    text: string
  ) {
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

    window.prompt(
      "Copy your Echo:",
      text
    );

    setStatus("idle");
  }

  async function shareEcho() {
    if (
      disabled ||
      tracks.length === 0
    ) {
      return;
    }

    const text =
      buildShareText();

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
          title: name,
          text,
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

    await copyFallback(text);
  }

  return (
    <button
      type="button"
      onClick={shareEcho}
      disabled={
        disabled ||
        status === "sharing"
      }
      className={className}
    >
      {status === "sharing"
        ? "Sharing..."
        : status === "copied"
        ? "Copied!"
        : "Share Echo"}
    </button>
  );
}