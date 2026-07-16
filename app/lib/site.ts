export const SITE_URL =
  "https://zac343.github.io/csv-guard/";

export const DYNAMIC_SITE_URL =
  "https://csv-guard-zac343.coral-ibis-2405.chatgpt.site";

export const GUIDE_PATH = "/guides/csv-injection-prevention-excel/";

export const GUIDE_URL = new URL(
  "guides/csv-injection-prevention-excel/",
  SITE_URL,
).toString();

export const SOCIAL_IMAGE_URL = new URL("og.png", SITE_URL).toString();

export const SOURCE_URL = "https://github.com/zac343/csv-guard";

export const SUPPORT_URL = `${SOURCE_URL}/issues/new/choose`;
