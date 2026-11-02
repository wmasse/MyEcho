import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://myechosounds.com"),
  title: "Echo",
  description: "Make and share music mixes with Echo.",
  openGraph: {
    title: "Echo",
    description: "Make and share music mixes with Echo.",
    siteName: "Echo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Echo",
    description: "Make and share music mixes with Echo.",
  },
  icons: {
    icon: "/echo-mark.svg",
    shortcut: "/echo-mark.svg",
  },
};

// Echo's text face: a warm grotesk that sits well beside the serif logo.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const viewport: Viewport = {
  // Matches the page background, so Safari's bars blend in on iPhone.
  themeColor: "#070707",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
