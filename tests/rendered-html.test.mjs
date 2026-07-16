import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships CSV Guard content and removes the disposable starter", async () => {
  const [page, layout, workbench, packageJson, metricsRoute, robots, sitemap, site] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CsvWorkbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/site.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Clean risky CSVs/);
  assert.match(page, /Your rows never touch our server/);
  assert.match(workbench, /Drop a CSV here/);
  assert.match(workbench, /Formula handling/);
  assert.match(workbench, /portable-apostrophe/);
  assert.match(workbench, /excel-tab/);
  assert.match(workbench, /serializeCleanCsv/);
  assert.match(workbench, /Apostrophe prefix \(default\)/);
  assert.match(workbench, /apostrophe stays in (?:the )?exported data/i);
  assert.match(workbench, /aria-describedby/);
  assert.match(workbench, /Formula-like segments changed/);
  assert.match(workbench, /apostrophe-prefixed/);
  assert.match(workbench, /tab-prefixed/);
  assert.match(workbench, /replaceAll\("\\t", "⇥"\)/);
  assert.doesNotMatch(workbench, /\.guarded\.csv/);
  assert.doesNotMatch(`${page}${workbench}`, /Programmatic reuse/i);
  assert.match(
    workbench,
    /const readFile[\s\S]+?const operation = operations\.begin\(\);[\s\S]+?setIsProcessing\(true\);[\s\S]+?await file\.text\(\)/,
  );
  assert.match(workbench, /handleFormulaModeChange[\s\S]+?operations\.invalidate\(\)/);
  assert.match(layout, /CSV Guard — Private CSV cleaner/);
  assert.match(layout, /metadataBase: new URL\(SITE_URL\)/);
  assert.match(layout, /canonical: SITE_URL/);
  assert.match(page, /SoftwareApplication/);
  assert.match(page, /View source/);
  assert.match(page, /Report an issue/);
  assert.match(page, /save and reopen/i);
  assert.match(page, /owasp\.org\/www-community\/attacks\/CSV_Injection/);
  assert.match(page, /className="mode-comparison"/);
  assert.match(page, /No universal CSV prefix strategy/i);
  assert.match(page, /negative numbers/i);
  assert.doesNotMatch(`${page}${layout}${workbench}`, /Formulas protected|stay text|neutralize formula injection/i);
  assert.match(robots, /sitemap/);
  assert.match(sitemap, /changeFrequency: "weekly"/);
  assert.match(site, /zac343\.github\.io\/csv-guard\//);
  assert.doesNotMatch(`${page}${layout}${workbench}${packageJson}`, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
  assert.doesNotMatch(metricsRoute, /CREATE TABLE/i);
  assert.match(metricsRoute, /SUM\(count\) AS count/);
  assert.match(metricsRoute, /GROUP BY event/);
  assert.match(metricsRoute, /LIMIT 120/);
  assert.match(metricsRoute, /consumeMetricRateLimit/);
  assert.match(metricsRoute, /WHERE count < 100000/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
