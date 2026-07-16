import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "./lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CSV Guard — Private CSV cleaner",
    template: "%s · CSV Guard",
  },
  description:
    "Clean risky CSV files locally: prefix formula-like segments, remove duplicates and empty rows, normalize headers, and trim whitespace.",
  applicationName: "CSV Guard",
  alternates: {
    canonical: SITE_URL,
  },
  keywords: [
    "CSV cleaner",
    "CSV formula injection",
    "remove duplicate CSV rows",
    "sanitize CSV",
    "private CSV tool",
  ],
  openGraph: {
    type: "website",
    siteName: "CSV Guard",
    title: "CSV Guard — Clean risky CSVs locally",
    description: "Private CSV hygiene in one browser-only pass.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: "CSV Guard — Clean risky CSVs locally",
    description: "Private CSV hygiene in one browser-only pass.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
