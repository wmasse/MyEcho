import Link from "next/link";

export default function EchoLogo() {
  return (
    <Link
      href="/"
      aria-label="Echo home"
      className="inline-flex shrink-0 rounded-sm text-stone-100 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-300"
    >
      <svg
        aria-hidden="true"
        className="h-12 w-[168px] sm:h-14 sm:w-[196px]"
        viewBox="0 0 224 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="echo-orb-front" cx="30%" cy="24%" r="78%">
            <stop offset="0" stopColor="#E4ECE8" stopOpacity="0.68" />
            <stop offset="0.42" stopColor="#A9BDC0" stopOpacity="0.4" />
            <stop offset="1" stopColor="#657A82" stopOpacity="0.22" />
          </radialGradient>
          <radialGradient id="echo-orb-middle" cx="30%" cy="24%" r="78%">
            <stop offset="0" stopColor="#E8EAE4" stopOpacity="0.52" />
            <stop offset="0.48" stopColor="#B9BFBB" stopOpacity="0.3" />
            <stop offset="1" stopColor="#7E8888" stopOpacity="0.16" />
          </radialGradient>
          <radialGradient id="echo-orb-back" cx="30%" cy="24%" r="78%">
            <stop offset="0" stopColor="#ECEAE2" stopOpacity="0.38" />
            <stop offset="0.5" stopColor="#C5C2B9" stopOpacity="0.2" />
            <stop offset="1" stopColor="#85847F" stopOpacity="0.1" />
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
