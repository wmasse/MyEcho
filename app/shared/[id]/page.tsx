import { Suspense } from "react";
import Link from "next/link";
import EchoLogo from "@/components/EchoLogo";
import SharedEchoById from "./SharedEchoById";

export default function SharedEchoByIdPage() {
  return (
    <Suspense fallback={<SharedEchoLoading />}>
      <SharedEchoById />
    </Suspense>
  );
}

function SharedEchoLoading() {
  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-500px] h-[750px] w-[1200px] -translate-x-1/2 rounded-full bg-[#1DB954]/10 blur-[190px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 pb-20 md:px-10">
        <nav className="flex h-24 items-center justify-between">
          <EchoLogo />
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            Create an Echo
          </Link>
        </nav>

        <section className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-800 border-t-[#1DB954]" />
          <p className="mt-5 font-semibold">Opening shared Echo...</p>
        </section>
      </div>
    </main>
  );
}
