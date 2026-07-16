# CSV Guard

CSV Guard is a privacy-first CSV hygiene tool. It parses and cleans files in the browser, then downloads a guarded copy without uploading row data.

Current checks:

- neutralize likely spreadsheet formula injection;
- remove duplicate and empty rows;
- normalize and de-conflict headers;
- trim leading and trailing cell whitespace;
- auto-detect comma, semicolon, tab, and pipe delimiters.

The hosted app stores only anonymous daily counts for page views, sample loads, analyses, and downloads. It does not store filenames or CSV contents.

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

The project targets the Sites/vinext Cloudflare Worker runtime. D1 is used only for aggregate product metrics; the CSV itself remains in the browser.
