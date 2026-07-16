import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { createLatestOperation } from "../docs-src/latest-operation.ts";

const root = new URL("../", import.meta.url);

test("ships a crawlable, no-telemetry GitHub Pages application", async () => {
  const [html, source, bundle, robots, sitemap, rootLlms, publicLlms] = await Promise.all([
    readFile(new URL("docs/index.html", root), "utf8"),
    readFile(new URL("docs-src/app.ts", root), "utf8"),
    readFile(new URL("docs/app.js", root), "utf8"),
    readFile(new URL("docs/robots.txt", root), "utf8"),
    readFile(new URL("docs/sitemap.xml", root), "utf8"),
    readFile(new URL("llms.txt", root), "utf8"),
    readFile(new URL("docs/llms.txt", root), "utf8"),
  ]);

  assert.match(html, /<link rel="canonical" href="https:\/\/zac343\.github\.io\/csv-guard\/"/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /href="\.\/favicon\.svg"/);
  assert.match(html, /href="\.\/llms\.txt"/);
  assert.match(html, /No telemetry/);
  assert.match(html, /no analytics endpoint/i);
  assert.doesNotMatch(`${html}${source}${bundle}`, /google-analytics|googletagmanager|segment\.com|mixpanel|posthog/i);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
  assert.match(source, /from "\.\.\/app\/lib\/csv\.ts"/);
  assert.match(source, /serializeCsv\(currentResult\.table\)/);
  assert.ok(bundle.length > 1_000, "expected a non-empty bundled application");
  assert.match(robots, /Sitemap: https:\/\/zac343\.github\.io\/csv-guard\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/zac343\.github\.io\/csv-guard\/<\/loc>/);
  assert.equal(publicLlms, rootLlms);
  assert.match(rootLlms, /^# CSV Guard\n\n> /);
  assert.match(rootLlms, /## Product/);
  assert.match(rootLlms, /## Technical reference/);
});

test("includes every local asset and the public IndexNow ownership file", async () => {
  const key = "473f8fbdae4103cc796043f52bf5b68a";
  const ownership = await readFile(new URL(`docs/${key}.txt`, root), "utf8");
  assert.equal(ownership.trim(), key);

  await Promise.all([
    access(new URL("docs/.nojekyll", root)),
    access(new URL("docs/app.js", root)),
    access(new URL("docs/styles.css", root)),
    access(new URL("docs/favicon.svg", root)),
    access(new URL("docs/robots.txt", root)),
    access(new URL("docs/sitemap.xml", root)),
    access(new URL("docs/llms.txt", root)),
  ]);
});

test("accepts only the latest asynchronous browser operation", () => {
  const operations = createLatestOperation();
  const slowFileRead = operations.begin();
  const newerInspection = operations.begin();

  assert.equal(operations.isCurrent(slowFileRead), false);
  assert.equal(operations.isCurrent(newerInspection), true);

  operations.invalidate();
  assert.equal(operations.isCurrent(newerInspection), false);
});
