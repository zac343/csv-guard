import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const siteUrl = "https://zac343.github.io/csv-guard/";
const checklistUrl = `${siteUrl}guides/csv-export-security-checklist/`;
const lifecycleUrl = `${siteUrl}guides/csv-injection-prevention-excel/`;

test("publishes one no-telemetry canonical CSV export security checklist", async () => {
  const [page, sitemap, robots] = await Promise.all([
    readFile(new URL("docs/guides/csv-export-security-checklist/index.html", root), "utf8"),
    readFile(new URL("docs/sitemap.xml", root), "utf8"),
    readFile(new URL("docs/robots.txt", root), "utf8"),
  ]);

  assert.match(page, new RegExp(`<link rel="canonical" href="${checklistUrl}"`));
  assert.equal((page.match(/<link rel="canonical"/g) ?? []).length, 1);
  assert.match(page, new RegExp(`<meta property="og:url" content="${checklistUrl}"`));
  assert.match(page, new RegExp(`<meta property="og:image" content="${siteUrl}og-checklist\\.png"`));
  assert.match(page, new RegExp(`<meta name="twitter:image" content="${siteUrl}og-checklist\\.png"`));
  assert.match(page, /CSV Export Security Checklist for SaaS Teams/);
  assert.match(page, /href="\.\.\/\.\.\/styles\.css"/);
  assert.match(page, /href="\.\.\/\.\.\/favicon\.svg"/);
  assert.match(page, /href="\.\.\/\.\.\/llms\.txt"/);
  assert.match(page, /connect-src 'none'/);
  assert.match(page, /script-src 'none'/);
  assert.doesNotMatch(page, /<script\b|\bfetch\s*\(|analytics|telemetry/i);
  assert.doesNotMatch(page, /csv-guard-action/i);
  assert.match(sitemap, new RegExp(`<loc>${checklistUrl}</loc>`));
  assert.doesNotMatch(sitemap, /chatgpt\.site/);
  assert.doesNotMatch(robots, /Disallow:\s*\/guides/i);
});

test("makes the checklist useful at the export boundary without overclaiming", async () => {
  const page = await readFile(
    new URL("docs/guides/csv-export-security-checklist/index.html", root),
    "utf8",
  );

  assert.equal((page.match(/<main\b/g) ?? []).length, 1);
  assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
  assert.match(page, /SaaS engineering|SaaS teams/i);
  assert.match(page, /AppSec/);
  assert.match(page, /QA/);
  assert.match(page, /export boundary/i);
  assert.match(page, /user-controlled/i);
  assert.match(page, /formula prefixes/i);
  for (const marker of ["=", "+", "-", "@"]) {
    assert.match(page, new RegExp(`<code>${marker.replace(/[+]/g, "\\+")}</code>`));
  }
  assert.match(page, /save[^<]{0,80}close[^<]{0,80}reopen/i);
  assert.match(page, /raw-file diff/i);
  assert.match(page, /synthetic/i);
  assert.match(page, /negative numbers/i);
  assert.match(page, /quoted fields/i);
  assert.match(page, /downstream/i);
  assert.match(page, /No prefix strategy is a universal safety guarantee/i);
  assert.match(page, /href="\.\.\/\.\.\/#cleaner"/);
  assert.match(page, new RegExp(lifecycleUrl.replaceAll(".", "\\.")));
  assert.match(page, /issues\/new\/choose/);
  assert.match(page, /synthetic or redacted/i);
  assert.match(page, /https:\/\/owasp\.org\/www-community\/attacks\/CSV_Injection/);
  assert.match(page, /https:\/\/owasp\.org\/www-project-web-security-testing-guide/);
  assert.match(page, /https:\/\/support\.microsoft\.com\/en-us\/excel\/get-started\/import-or-export-text-txt-or-csv-files/);
  assert.doesNotMatch(
    page,
    /neutralizes|prevents all|eliminates CSV injection|permanently safe|Excel-safe|Microsoft recommends tab|OWASP (?:certifies|endorses)/i,
  );
});

test("serves matching checklist intent from the dynamic fallback", async () => {
  const [route, site, sitemap] = await Promise.all([
    readFile(new URL("app/guides/csv-export-security-checklist/page.tsx", root), "utf8"),
    readFile(new URL("app/lib/site.ts", root), "utf8"),
    readFile(new URL("app/sitemap.ts", root), "utf8"),
  ]);

  assert.match(site, /CHECKLIST_URL/);
  assert.match(site, /guides\/csv-export-security-checklist\//);
  assert.match(route, /canonical: CHECKLIST_URL/);
  assert.match(route, /url: CHECKLIST_URL/);
  assert.match(route, /CHECKLIST_SOCIAL_IMAGE_URL/);
  assert.match(route, /CSV Export Security Checklist for SaaS Teams/);
  assert.match(route, /No prefix strategy is a universal safety guarantee/i);
  assert.match(route, /href="\/#cleaner"/);
  assert.match(route, /href=\{GUIDE_PATH\}/);
  assert.match(route, /href=\{SUPPORT_URL\}/);
  assert.doesNotMatch(route, /csv-guard-action|["']use client["']|\bfetch\s*\(|analytics|telemetry/i);
  assert.match(sitemap, /CHECKLIST_URL/);
});

test("advertises the checklist in matching LLM files and ships one bespoke social card", async () => {
  const [rootLlms, publicLlms] = await Promise.all([
    readFile(new URL("llms.txt", root), "utf8"),
    readFile(new URL("docs/llms.txt", root), "utf8"),
  ]);

  assert.equal(publicLlms, rootLlms);
  assert.match(rootLlms, new RegExp(checklistUrl));
  const [publicImage, staticImage] = await Promise.all([
    readFile(new URL("public/og-checklist.png", root)),
    readFile(new URL("docs/og-checklist.png", root)),
  ]);
  assert.ok(publicImage.length > 10_000);
  assert.deepEqual(publicImage, staticImage);
  await Promise.all([
    access(new URL("public/og-checklist.png", root)),
    access(new URL("docs/og-checklist.png", root)),
  ]);
});
