import Image from "next/image";

/*
 * Must match images.remotePatterns in
 * next.config.ts. Other hosts (older
 * Spotify CDNs, artist photos) still
 * render, just without optimization,
 * instead of throwing.
 */
function canOptimize(src: string) {
  try {
    const url = new URL(src);

    if (
      url.protocol !== "https:" ||
      url.search ||
      !url.pathname.startsWith("/image/")
    ) {
      return false;
    }

    return (
      url.hostname === "image-cdn-fa.spotifycdn.com" ||
      url.hostname === "image-cdn-ak.spotifycdn.com" ||
      url.hostname.endsWith(".mzstatic.com")
    );
  } catch {
    return false;
  }
}

export default function CoverArt({
  src,
  alt = "",
  size,
  className,
}: {
  src: string;
  alt?: string;
  /** Largest size it's shown at, in CSS pixels. */
  size: number;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized={!canOptimize(src)}
      className={className}
    />
  );
}
