import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { createLatestOperation } from "../app/lib/latest-operation.ts";

const root = new URL("../", import.meta.url);

test("ships a crawlable, no-telemetry GitHub Pages application", async () => {
  const [html, source, bundle, robots, sitemap, rootLlms, publicLlms, bugForm, security] = await Promise.all([
    readFile(new URL("docs/index.html", root), "utf8"),
    readFile(new URL("docs-src/app.ts", root), "utf8"),
    readFile(new URL("docs/app.js", root), "utf8"),
    readFile(new URL("docs/robots.txt", root), "utf8"),
    readFile(new URL("docs/sitemap.xml", root), "utf8"),
    readFile(new URL("llms.txt", root), "utf8"),
    readFile(new URL("docs/llms.txt", root), "utf8"),
    readFile(new URL(".github/ISSUE_TEMPLATE/bug-report.yml", root), "utf8"),
    readFile(new URL("SECURITY.md", root), "utf8"),
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
  assert.match(html, /issues\/new\/choose/);
  assert.match(html, /Never attach a private CSV/);
  assert.match(html, /id="formula-mode"/);
  assert.match(html, /aria-describedby="formula-mode-note"/);
  assert.match(html, /Apostrophe prefix \(default\)/);
  assert.match(html, /Excel review prefix \(tab \+ apostrophe\)/);
  assert.match(html, /save and reopen/i);
  assert.match(html, /owasp\.org\/www-community\/attacks\/CSV_Injection/);
  assert.match(html, /class="mode-comparison"/);
  assert.match(html, /No universal CSV prefix strategy/i);
  assert.match(html, /apostrophe stays in (?:the )?data/i);
  assert.match(html, /negative numbers/i);
  assert.doesNotMatch(html, /Programmatic reuse/i);
  assert.match(html, /Formula-like segments changed/);
  assert.match(source, /apostrophe-prefixed/);
  assert.match(source, /tab-apostrophe-prefixed/);
  assert.match(source, /real tab and an apostrophe/i);
  assert.match(source, /decodeUtf8Csv/);
  assert.match(source, /file\.arrayBuffer\(\)/);
  assert.match(source, /Download requested/);
  assert.doesNotMatch(source, /CSV downloaded/);
  assert.match(source, /replaceAll\("\\t", "⇥"\)/);
  assert.doesNotMatch(`${html}${source}`, /\.guarded\.csv/);
  assert.doesNotMatch(html, /Formulas protected|stay text|neutralize formula injection/i);
  assert.doesNotMatch(`${html}${source}${bundle}`, /google-analytics|googletagmanager|segment\.com|mixpanel|posthog/i);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
  assert.match(source, /from "\.\.\/app\/lib\/csv\.ts"/);
  assert.match(source, /formulaProtectionMode/);
  assert.match(source, /serializeCleanCsv\(currentResult\)/);
  assert.ok(bundle.length > 1_000, "expected a non-empty bundled application");
  assert.match(robots, /Sitemap: https:\/\/zac343\.github\.io\/csv-guard\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/zac343\.github\.io\/csv-guard\/<\/loc>/);
  assert.equal(publicLlms, rootLlms);
  assert.match(rootLlms, /^# CSV Guard\n\n> /);
  assert.match(rootLlms, /## Product/);
  assert.match(rootLlms, /## Technical reference/);
  assert.match(bugForm, /Never paste private rows/);
  assert.match(bugForm, /Privacy confirmation/);
  assert.match(security, /private vulnerability-reporting form/);
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
