import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const siteUrl = "https://zac343.github.io/csv-guard/";
const guideUrl = `${siteUrl}guides/csv-injection-prevention-excel/`;
const dynamicHost = "csv-guard-zac343.coral-ibis-2405.chatgpt.site";

test("publishes one crawlable guide with a single static canonical", async () => {
  const [guide, home, sitemap, robots] = await Promise.all([
    readFile(new URL("docs/guides/csv-injection-prevention-excel/index.html", root), "utf8"),
    readFile(new URL("docs/index.html", root), "utf8"),
    readFile(new URL("docs/sitemap.xml", root), "utf8"),
    readFile(new URL("docs/robots.txt", root), "utf8"),
  ]);

  assert.match(guide, new RegExp(`<link rel="canonical" href="${guideUrl}"`));
  assert.match(guide, new RegExp(`<meta property="og:url" content="${guideUrl}"`));
  assert.match(guide, /CSV Injection Prevention in Excel: Apostrophe vs\. Tab Prefix/);
  assert.match(guide, /href="\.\.\/\.\.\/styles\.css"/);
  assert.match(guide, /href="\.\.\/\.\.\/favicon\.svg"/);
  assert.match(guide, /href="\.\.\/\.\.\/llms\.txt"/);
  assert.match(guide, /href="\.\.\/\.\.\/#cleaner"/);
  assert.match(guide, /connect-src 'none'/);
  assert.match(guide, /script-src 'none'/);
  assert.doesNotMatch(guide, /<script\b|\bfetch\s*\(|analytics|telemetry/i);
  assert.match(home, /href="\.\/guides\/csv-injection-prevention-excel\/"[^>]*>Guide</);

  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, [siteUrl, guideUrl]);
  assert.doesNotMatch(sitemap, new RegExp(dynamicHost.replaceAll(".", "\\.")));
  assert.doesNotMatch(robots, /Disallow:\s*\/guides/i);
});

test("keeps the guide lifecycle-bound, sourced, and accessible", async () => {
  const guide = await readFile(
    new URL("docs/guides/csv-injection-prevention-excel/index.html", root),
    "utf8",
  );

  assert.equal((guide.match(/<main\b/g) ?? []).length, 1);
  assert.equal((guide.match(/<h1\b/g) ?? []).length, 1);
  assert.match(guide, /aria-current="page"/);
  assert.match(guide, /<caption[^>]*>[^<]*Apostrophe and tab prefix trade-offs/i);
  assert.match(guide, /<th scope="col">/);
  assert.match(guide, /No CSV prefix is universally safe/i);
  assert.match(guide, /initial import/i);
  assert.match(guide, /save[^<]{0,80}close[^<]{0,80}reopen/i);
  assert.match(guide, /real tab[^<]{0,100}(?:data|value)/i);
  assert.match(guide, /negative numbers/i);
  assert.match(guide, /Excel version/i);
  assert.match(guide, /locale/i);
  assert.match(guide, /import (?:path|method)/i);
  assert.match(guide, /formula bar/i);
  assert.match(guide, /raw-file diff/i);
  assert.match(guide, /https:\/\/owasp\.org\/www-community\/attacks\/CSV_Injection/);
  assert.match(guide, /https:\/\/owasp\.org\/www-project-web-security-testing-guide\/latest\/4-Web_Application_Security_Testing\/07-Input_Validation_Testing\/21-Testing_for_CSV_Injection/);
  assert.match(guide, /https:\/\/support\.microsoft\.com\/en-us\/excel\/get-started\/import-or-export-text-txt-or-csv-files/);
  assert.doesNotMatch(
    guide,
    /neutralizes|prevents all|eliminates CSV injection|permanently safe|Excel-safe|Microsoft recommends tab|OWASP (?:certifies|endorses)/i,
  );
});

test("serves the same guide from the dynamic fallback without claiming its host as canonical", async () => {
  const [route, home, layout, sitemap, site] = await Promise.all([
    readFile(new URL("app/guides/csv-injection-prevention-excel/page.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/sitemap.ts", root), "utf8"),
    readFile(new URL("app/lib/site.ts", root), "utf8"),
  ]);

  assert.match(site, /GUIDE_URL/);
  assert.match(site, /guides\/csv-injection-prevention-excel\//);
  assert.match(route, /import[^;]+GUIDE_URL[^;]+from/);
  assert.match(route, /export const metadata: Metadata/);
  assert.match(route, /canonical: GUIDE_URL/);
  assert.match(route, /url: GUIDE_URL/);
  assert.match(route, /CSV Injection Prevention in Excel: Apostrophe vs\. Tab Prefix/);
  assert.match(route, /No CSV prefix is universally safe/i);
  assert.match(route, /<caption[^>]*>Apostrophe and tab prefix trade-offs/i);
  assert.match(route, /<th scope="col">/);
  assert.match(route, /aria-current="page"/);
  assert.match(route, /href="\/#cleaner"/);
  assert.doesNotMatch(route, /["']use client["']|\bfetch\s*\(|analytics|telemetry/i);

  assert.match(home, /canonical: SITE_URL/);
  assert.match(home, /url: SITE_URL/);
  assert.match(home, /href=\{GUIDE_PATH\}/);
  assert.doesNotMatch(layout, /canonical:\s*SITE_URL/);
  assert.doesNotMatch(layout, /url:\s*SITE_URL/);
  assert.match(sitemap, /GUIDE_URL/);
  assert.doesNotMatch(sitemap, /DYNAMIC_SITE_URL/);
});

test("advertises the guide in matching LLM context files and ships its social image", async () => {
  const [rootLlms, publicLlms] = await Promise.all([
    readFile(new URL("llms.txt", root), "utf8"),
    readFile(new URL("docs/llms.txt", root), "utf8"),
  ]);

  assert.equal(publicLlms, rootLlms);
  assert.match(rootLlms, new RegExp(guideUrl));
  await Promise.all([
    access(new URL("public/og.png", root)),
    access(new URL("docs/og.png", root)),
  ]);
});
