"use client";

import { useEffect, useRef } from "react";

/*
 * Shows the next batch of songs when the
 * reader scrolls near the end of the grid.
 * The button is the fallback for anyone who
 * gets there first, and for keyboard users.
 */
export default function LoadMore({
  remaining,
  onLoadMore,
}: {
  remaining: number;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const element = ref.current;

    if (!element || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: "800px 0px" }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="mt-10 flex justify-center">
      <button
        type="button"
        onClick={onLoadMore}
        className="min-h-11 rounded-full border border-white/[0.12] px-6 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
      >
        Show more songs ({remaining.toLocaleString()} left)
      </button>
    </div>
  );
}
