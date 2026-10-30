"use client";

import { useState } from "react";

type Props = {
  className?: string;
};

export default function ShareEchoButton({
  className = "",
}: Props) {
  const [status, setStatus] =
    useState<
      "idle" |
      "sharing" |
      "copied"
    >("idle");

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
      "Copy the Echo website link:",
      text
    );

    setStatus("idle");
  }

  async function shareEcho() {
    const url = new URL("/", window.location.origin).toString();
    const text = "Make your own Echo playlist with Echo.";

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
          title: "Echo",
          text,
          url,
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

    await copyFallback(`${text} ${url}`);
  }

  return (
    <button
      type="button"
      onClick={shareEcho}
      disabled={status === "sharing"}
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
