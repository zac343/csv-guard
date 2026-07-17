import type { Metadata } from "next";
import "./globals.css";
import { SITE_URL } from "./lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CSV Guard — Private CSV cleaner",
    template: "%s · CSV Guard",
  },
  description:
    "Clean risky CSV files locally: prefix formula-like segments, remove duplicates and empty rows, normalize headers, and trim whitespace.",
  applicationName: "CSV Guard",
  keywords: [
    "CSV cleaner",
    "CSV formula injection",
    "remove duplicate CSV rows",
    "sanitize CSV",
    "private CSV tool",
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
