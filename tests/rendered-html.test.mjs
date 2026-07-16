import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships CSV Guard content and removes the disposable starter", async () => {
  const [page, layout, workbench, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CsvWorkbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Clean risky CSVs/);
  assert.match(page, /Your rows never touch our server/);
  assert.match(workbench, /Drop a CSV here/);
  assert.match(layout, /CSV Guard — Private CSV cleaner/);
  assert.doesNotMatch(`${page}${layout}${workbench}${packageJson}`, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
