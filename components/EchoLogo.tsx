import Link from "next/link";

export default function EchoLogo({
  size = "default",
}: {
  size?: "default" | "home";
}) {
  return (
    <Link
      href="/"
      aria-label="Echo home"
      className="inline-flex shrink-0 rounded-sm text-[#1DB954] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1DB954]"
    >
      <svg
        aria-hidden="true"
        className={
          size === "home"
            ? "h-11 w-[154px] translate-y-12 sm:h-20 sm:w-[280px] lg:h-28 lg:w-[392px]"
            : "h-11 w-[154px] sm:h-16 sm:w-56"
        }
        viewBox="0 0 224 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="echo-orb-front" cx="30%" cy="24%" r="78%">
            <stop offset="0" stopColor="#A7FFC3" stopOpacity="0.9" />
            <stop offset="0.42" stopColor="#29D566" stopOpacity="0.72" />
            <stop offset="1" stopColor="#0E8D43" stopOpacity="0.55" />
          </radialGradient>
          <radialGradient id="echo-orb-middle" cx="30%" cy="24%" r="78%">
            <stop offset="0" stopColor="#81EFA4" stopOpacity="0.7" />
            <stop offset="0.48" stopColor="#1DB954" stopOpacity="0.56" />
            <stop offset="1" stopColor="#0B7138" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="echo-orb-back" cx="30%" cy="24%" r="78%">
            <stop offset="0" stopColor="#64D98C" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#159A49" stopOpacity="0.42" />
            <stop offset="1" stopColor="#075A2D" stopOpacity="0.3" />
          </radialGradient>
        </defs>

        <circle cx="192" cy="32" r="29" fill="url(#echo-orb-back)" />
        <circle cx="168" cy="32" r="29" fill="url(#echo-orb-middle)" />
        <circle cx="144" cy="32" r="29" fill="url(#echo-orb-front)" />
        <text
          x="0"
          y="50"
          fill="currentColor"
          fontFamily="Bodoni 72, Didot, Georgia, Times New Roman, serif"
          fontSize="58"
          fontWeight="400"
          letterSpacing="-4"
        >
          echo
        </text>
      </svg>
    </Link>
  );
}
