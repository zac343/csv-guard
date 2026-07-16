# CSV Guard

CSV Guard is a privacy-first CSV hygiene tool. It parses and cleans files in the browser, then downloads a guarded copy without uploading row data.

**[Use CSV Guard in your browser](https://zac343.github.io/csv-guard/)**

Current checks:

- neutralize `=`, `+`, `-`, and `@` markers at cell starts and supported delimiter or newline boundaries;
- remove duplicate and empty rows;
- normalize and de-conflict headers;
- trim leading and trailing cell whitespace;
- auto-detect comma, semicolon, tab, and pipe delimiters.

Files are limited to 10 MB, 100,000 data rows, 5,000 columns, 500,000 normalized cells, and 2,000,000 characters per field to bound parser work. Large inputs can still be memory-intensive, especially on mobile devices.

The primary static app has no analytics endpoint and a content security policy that blocks background connections. A separate Sites/vinext edition stores only anonymous daily counts for page views, sample loads, analyses, and downloads. It does not store filenames or CSV contents. Those writes are rate-limited at the edge and capped in D1; client-originated counts remain directional, untrusted product signals—not authoritative order, revenue, billing, or security records.

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
```

## Deployment

The no-telemetry static edition is bundled into `docs/` for GitHub Pages with `npm run build:pages`. The project also targets the Sites/vinext Cloudflare Worker runtime. D1 migrations create the aggregate product-metrics table for that separate edition; the CSV itself remains in the browser. Reading aggregate metrics requires a server-side `METRICS_READ_TOKEN` secret.
