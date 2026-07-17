# CSV Guard

CSV Guard is a privacy-first CSV hygiene tool. It parses and cleans files in the browser, then downloads a separately prefixed copy without uploading row data.

**[Use CSV Guard in your browser](https://zac343.github.io/csv-guard/)**

Current checks:

- detect and prefix `=`, `+`, `-`, and `@` markers at cell starts and supported delimiter or newline boundaries;
- remove duplicate and empty rows;
- normalize and de-conflict headers;
- trim leading and trailing cell whitespace;
- auto-detect comma, semicolon, tab, and pipe delimiters.

Formula handling is destination-specific:

- **Apostrophe prefix (default)** adds an apostrophe that stays in exported data; downstream tools must accept or strip it. Excel may remove its formula-escape behavior after a save/reopen cycle.
- **Excel review prefix (tab + apostrophe)** adds both prefixes before risky markers. The tab may better survive that Excel cycle, while the apostrophe keeps a formula marker from becoming the first character if a downstream parser treats the tab as a delimiter. Both prefixes remain in the data and can disrupt programmatic imports.

No universal CSV prefix strategy works across every spreadsheet and downstream consumer. Both modes also prefix negative numbers such as `-42`, changing their inferred type. These modes reduce formula-execution risk on initial import; they do not make an untrusted CSV permanently safe. Re-run the cleaner before reopening untrusted exports, and review the [OWASP CSV Injection guidance](https://owasp.org/www-community/attacks/CSV_Injection) for the lifecycle trade-offs.

File uploads must be valid UTF-8 and are rejected instead of being decoded with replacement characters. Files are limited to 10 MB, 100,000 data rows, 5,000 columns, 500,000 normalized cells, and 2,000,000 characters per field to bound parser work. Large inputs can still be memory-intensive, especially on mobile devices.

Both public editions have no analytics endpoint, and CSV Guard application code does not send or store product events, filenames, CSV contents, IP addresses, or interaction counts. The primary static app also uses a content security policy that blocks background connections. Hosting platforms may process ordinary HTTP request metadata under their own operational policies; CSV Guard exposes no application analytics database.

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
```

## Support

Use the [structured issue forms](https://github.com/zac343/csv-guard/issues/new/choose) for bugs and feature requests. Describe problems with synthetic or redacted examples only—never attach a private CSV or paste sensitive rows into a public issue. Security vulnerabilities should use GitHub's private vulnerability-reporting form described in [SECURITY.md](SECURITY.md).

## Deployment

The no-telemetry static edition is bundled into `docs/` for GitHub Pages with `npm run build:pages`. The project also targets the Sites/vinext Cloudflare Worker runtime without a D1, R2, or Images binding. The unused vinext image-optimization path is explicitly rejected; direct static assets remain available.
