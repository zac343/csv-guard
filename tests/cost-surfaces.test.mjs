import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

let builtWorkerPromise;

function getBuiltWorker() {
  builtWorkerPromise ??= import(new URL("dist/server/index.js", root)).then(
    (module) => module.default,
  );
  return builtWorkerPromise;
}

test("rejects the unused image optimizer without an Images binding", async () => {
  const [worker, nextConfig] = await Promise.all([
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("next.config.ts", root), "utf8"),
  ]);

  assert.match(nextConfig, /images\s*:\s*\{[\s\S]*?unoptimized\s*:\s*true/);
  assert.match(worker, /isImageOptimizerPath\(url\.pathname\)/);
  assert.match(worker, /status:\s*404/);
  assert.match(worker, /cache-control["']?\s*[:,]\s*["']no-store/i);
  assert.doesNotMatch(
    worker,
    /vinext\/server\/image-optimization|handleImageOptimization|DEFAULT_(?:DEVICE|IMAGE)_SIZES|\bIMAGES\s*:|env\.IMAGES|transformImage/,
  );

  const builtWorker = await getBuiltWorker();
  const equivalentPaths = [
    "/_vinext/image?url=%2Ffavicon.svg&w=64&q=75",
    "/%5Fvinext/image?url=%2Ffavicon.svg&w=64&q=75",
    "/%255Fvinext/image?url=%2Ffavicon.svg&w=64&q=75",
    "/_vinext/%69mage?url=%2Ffavicon.svg&w=64&q=75",
    "/_vinext%2Fimage?url=%2Ffavicon.svg&w=64&q=75",
    "/_vinext//image?url=%2Ffavicon.svg&w=64&q=75",
    "/_vinext/image.rsc?url=%2Ffavicon.svg&w=64&q=75",
  ];

  for (const path of equivalentPaths) {
    const response = await builtWorker.fetch(new Request(`https://example.test${path}`), {});
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
  }
});

test("gives both public editions a hard zero telemetry and D1 budget", async () => {
  const [workbench, page, readme, llms, hostingSource, packageSource, cloudflareTypes] =
    await Promise.all([
      readFile(new URL("app/components/CsvWorkbench.tsx", root), "utf8"),
      readFile(new URL("app/page.tsx", root), "utf8"),
      readFile(new URL("README.md", root), "utf8"),
      readFile(new URL("llms.txt", root), "utf8"),
      readFile(new URL(".openai/hosting.json", root), "utf8"),
      readFile(new URL("package.json", root), "utf8"),
      readFile(new URL("cloudflare-env.d.ts", root), "utf8"),
    ]);

  const hosting = JSON.parse(hostingSource);
  const packageJson = JSON.parse(packageSource);

  assert.doesNotMatch(workbench, /trackEvent|\/api\/events|\bfetch\s*\(/);
  assert.match(page, /no analytics endpoint/i);
  assert.doesNotMatch(page, /anonymous daily action counts|product database/i);
  assert.match(readme, /both public editions have no analytics endpoint/i);
  assert.doesNotMatch(readme, /METRICS_READ_TOKEN|D1 migrations|capped in D1|anonymous daily counts/i);
  assert.doesNotMatch(llms, /Hosted metrics route|aggregate-only telemetry/i);
  assert.equal(hosting.d1, null);
  assert.equal(packageJson.dependencies?.["drizzle-orm"], undefined);
  assert.equal(packageJson.devDependencies?.["drizzle-kit"], undefined);
  assert.equal(packageJson.scripts?.["db:generate"], undefined);
  assert.doesNotMatch(cloudflareTypes, /D1Database|METRICS_READ_TOKEN/);

  await Promise.all([
    assert.rejects(access(new URL("app/api/events/route.ts", root))),
    assert.rejects(access(new URL("app/lib/product-metrics.ts", root))),
    assert.rejects(access(new URL("db/index.ts", root))),
    assert.rejects(access(new URL("db/schema.ts", root))),
    assert.rejects(access(new URL("drizzle.config.ts", root))),
    assert.rejects(access(new URL("drizzle/0000_silky_iceman.sql", root))),
  ]);
});

test("compiled Sites output contains no transform or D1 binding", async () => {
  const [bundle, wranglerSource] = await Promise.all([
    readFile(new URL("dist/server/index.js", root), "utf8"),
    readFile(new URL("dist/server/wrangler.json", root), "utf8"),
  ]);
  const wrangler = JSON.parse(wranglerSource);

  assert.doesNotMatch(bundle, /\.IMAGES\.input|env\.IMAGES|transformImage/);
  assert.deepEqual(wrangler.d1_databases, []);
  assert.equal(wrangler.images, undefined);
  assert.equal(wrangler.assets?.directory, "../client");
  assert.equal(wrangler.observability?.enabled, false);
});

test("compiled Sites HTML has no automatic third-party resource requests", async () => {
  const builtWorker = await getBuiltWorker();
  const response = await builtWorker.fetch(new Request("https://example.test/"), {});
  const html = await response.text();
  const automaticallyLoadedLinks = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) =>
      /\brel="(?:stylesheet|icon|shortcut icon|preload|modulepreload|preconnect|dns-prefetch)"/i.test(
        tag,
      ),
    );

  assert.equal(response.status, 200);
  assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/i);
  assert.equal(
    automaticallyLoadedLinks.some((tag) => /\bhref="https?:\/\//i.test(tag)),
    false,
    automaticallyLoadedLinks.join("\n"),
  );
  assert.match(html, /<link\b[^>]*\brel="(?:icon|shortcut icon)"[^>]*\bhref="\/favicon\.svg"/i);
});
