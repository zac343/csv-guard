import type { MetadataRoute } from "next";
import { CHECKLIST_URL, GUIDE_URL, SITE_URL } from "./lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date("2026-07-17T00:00:00+08:00"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: GUIDE_URL,
      lastModified: new Date("2026-07-17T00:00:00+08:00"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: CHECKLIST_URL,
      lastModified: new Date("2026-07-18T00:00:00+08:00"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
