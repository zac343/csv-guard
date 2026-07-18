import type { Metadata } from "next";
import Link from "next/link";
import {
  CHECKLIST_SOCIAL_IMAGE_URL,
  CHECKLIST_PATH,
  CHECKLIST_URL,
  GUIDE_PATH,
  SITE_URL,
  SOURCE_URL,
  SUPPORT_URL,
} from "../../lib/site";

const title = "CSV Export Security Checklist for SaaS Teams";
const description =
  "A practical CSV export security checklist for SaaS engineering, AppSec, and QA teams, from threat modeling through save-close-reopen verification.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: CHECKLIST_URL,
  },
  openGraph: {
    type: "article",
    siteName: "CSV Guard",
    title,
    description,
    url: CHECKLIST_URL,
    images: [
      {
        url: CHECKLIST_SOCIAL_IMAGE_URL,
        width: 1536,
        height: 780,
        alt: "CSV export security checklist for SaaS engineering teams",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [CHECKLIST_SOCIAL_IMAGE_URL],
  },
};

const sources = [
  {
    label: "OWASP: CSV Injection",
    href: "https://owasp.org/www-community/attacks/CSV_Injection",
    note: "Formula markers, separator boundaries, and the limits of prefix-based mitigations.",
  },
  {
    label: "OWASP WSTG: Testing for CSV Injection",
    href: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/21-Testing_for_CSV_Injection",
    note: "A testing approach that follows the exported file into a spreadsheet application.",
  },
  {
    label: "Microsoft: Import or export text and CSV files",
    href: "https://support.microsoft.com/en-us/excel/get-started/import-or-export-text-txt-or-csv-files",
    note: "How import method, delimiter, and regional settings affect CSV interpretation in Excel.",
  },
];

export default function CsvExportSecurityChecklist() {
  return (
    <>
      <header className="site-header guide-header">
        <a className="brand" href={SITE_URL} aria-label="CSV Guard home">
          <span className="brand-mark" aria-hidden="true">CG</span>
          <span>CSV Guard</span>
        </a>
        <nav aria-label="Primary navigation">
          <Link href="/#cleaner">Cleaner</Link>
          <Link href={GUIDE_PATH}>Lifecycle guide</Link>
          <Link href={CHECKLIST_PATH} aria-current="page">Checklist</Link>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">Source</a>
        </nav>
        <span className="header-status">Export review</span>
      </header>

      <main className="guide-main">
        <article>
          <header className="guide-hero">
            <p className="eyebrow">SaaS engineering · AppSec · QA</p>
            <h1>CSV Export Security Checklist for SaaS Teams</h1>
            <p className="guide-deck">
              Review the boundary where user-controlled data becomes a downloadable
              spreadsheet. The goal is not to label every formula-like value as malicious;
              it is to make the export behavior explicit, testable, and repeatable.
            </p>
            <div className="guide-summary" role="note" aria-labelledby="scope-title">
              <p className="panel-kicker" id="scope-title">Scope the review</p>
              <p>
                Apply controls at the <strong>export boundary</strong>, preserve the source
                record, and verify the file through the same spreadsheet and downstream
                paths your customers use. <strong>No prefix strategy is a universal safety guarantee.</strong> Prefixes change data and can create compatibility or
                false-positive costs that your team must measure.
              </p>
            </div>
          </header>

          <section className="guide-section" id="threat-model" aria-labelledby="threat-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Threat model</p>
              <h2 id="threat-title">Define what crosses the trust boundary.</h2>
            </div>
            <div className="guide-table-frame" tabIndex={0} aria-label="CSV export threat model table">
              <table>
                <caption>Questions to answer before choosing a control</caption>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Evidence to collect</th>
                    <th scope="col">Why it matters</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Which fields are user-controlled?</th>
                    <td>Schema, field ownership, transformations, and tenant boundaries.</td>
                    <td>Only the export representation should change; do not silently rewrite the source record.</td>
                  </tr>
                  <tr>
                    <th scope="row">Where can a new cell begin?</th>
                    <td>Delimiter, quoted fields, embedded line breaks, and serializer behavior.</td>
                    <td>A marker can become first in a cell after a comma, semicolon, tab, pipe, or row boundary.</td>
                  </tr>
                  <tr>
                    <th scope="row">Who opens and reprocesses the file?</th>
                    <td>Spreadsheet product/version, locale, open method, and downstream parsers.</td>
                    <td>The same bytes can be interpreted differently across import and save workflows.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="guide-section guide-grid" id="markers" aria-labelledby="markers-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Formula prefixes</p>
              <h2 id="markers-title">Recognize markers without assuming intent.</h2>
            </div>
            <div>
              <p>
                At a cell start, conservatively review values beginning with
                <code>=</code>, <code>+</code>, <code>-</code>, or <code>@</code>.
                Repeat that check after every supported delimiter and embedded row boundary,
                using a real CSV parser rather than string replacement.
              </p>
              <p>
                Negative numbers such as <code>-42</code> are a deliberate false-positive
                test: a conservative prefix rule changes their type and value. Document how
                identifiers, leading zeros, joins, and numeric calculations behave after export.
              </p>
            </div>
          </section>

          <section className="guide-section" id="checklist" aria-labelledby="checklist-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Release checklist</p>
              <h2 id="checklist-title">Make every pass condition reproducible.</h2>
            </div>
            <ol className="workflow-list">
              <li><span>01</span><div><h3>Map the data path</h3><p>List source fields, user-controlled inputs, transformations, serializer, download endpoint, spreadsheet consumers, and machine consumers.</p></div></li>
              <li><span>02</span><div><h3>Separate storage from export</h3><p>Keep the original record intact. Create any prefix or representation change only in the exported artifact and name that contract.</p></div></li>
              <li><span>03</span><div><h3>Use one structured serializer</h3><p>Exercise quoted fields, escaped quotes, supported delimiters, embedded line breaks, UTF-8 validation, BOM decisions, and resource limits.</p></div></li>
              <li><span>04</span><div><h3>Choose a destination policy</h3><p>Record which formula prefixes trigger review, which prefix strategy is used, whether consumers strip it, and which data changes are acceptable.</p></div></li>
              <li><span>05</span><div><h3>Build a harmless corpus</h3><p>Use synthetic arithmetic markers, ordinary negative numbers, leading whitespace, delimiter boundaries, and already-prefixed values. Never require a customer CSV.</p></div></li>
              <li><span>06</span><div><h3>Test the real import path</h3><p>Open the file the same way customers do and inspect both the displayed cell and formula bar under the recorded version, locale, and settings.</p></div></li>
              <li><span>07</span><div><h3>Cross the save boundary</h3><p>Save, close, and reopen the CSV. Repeat the inspection, then perform a raw-file diff against the downloaded artifact.</p></div></li>
              <li><span>08</span><div><h3>Round-trip every consumer</h3><p>Load the saved file into downstream parsers, compare schema and values, and retain evidence with the release that produced the export.</p></div></li>
            </ol>
          </section>

          <section className="guide-section guide-grid" id="sample" aria-labelledby="sample-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Synthetic sample</p>
              <h2 id="sample-title">Use harmless arithmetic-only fixtures.</h2>
            </div>
            <div>
              <pre><code>{`customer,note,amount\nsynthetic-a,=1+1,-42\nsynthetic-b,"@SUM(1,1)",25\nsynthetic-c,+1+1,0`}</code></pre>
              <p>
                This corpus exercises all four markers without command execution or data
                exfiltration. Add delimiter, quote, newline, and already-prefixed variants
                that match your product. Use only synthetic or redacted data in feedback.
              </p>
            </div>
          </section>

          <section className="guide-section" id="release-evidence" aria-labelledby="evidence-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Release evidence</p>
              <h2 id="evidence-title">Ship a decision record, not a safety slogan.</h2>
            </div>
            <div className="guide-table-frame" tabIndex={0} aria-label="CSV export release evidence table">
              <table>
                <caption>Minimum evidence to retain with the release</caption>
                <thead><tr><th scope="col">Artifact</th><th scope="col">Minimum contents</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Policy</th><td>Threat boundary, formula markers, selected prefix mode, value-change contract, and accepted false positives.</td></tr>
                  <tr><th scope="row">Fixture report</th><td>Serializer cases, synthetic corpus, exact application versions/locales, import paths, and pass/fail output.</td></tr>
                  <tr><th scope="row">Lifecycle diff</th><td>Downloaded bytes, post-save bytes, raw-file diff, formula-bar observations, and downstream round-trip results.</td></tr>
                  <tr><th scope="row">Rollback</th><td>Owner, affected export version, compatibility warning, support path, and a reversible release procedure.</td></tr>
                </tbody>
              </table>
            </div>
            <p className="guide-caveat">
              A prefix can reduce a known spreadsheet interpretation risk in an observed
              workflow. It cannot validate business facts, authorize spreadsheet behavior,
              or promise the same result in every application and future release.
            </p>
          </section>

          <section className="guide-section" id="sources" aria-labelledby="sources-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Primary sources</p>
              <h2 id="sources-title">Verify behavior against the current workflow.</h2>
            </div>
            <ul className="source-list">
              {sources.map((source) => (
                <li key={source.href}>
                  <a href={source.href} target="_blank" rel="noreferrer">{source.label} ↗</a>
                  <p>{source.note}</p>
                </li>
              ))}
            </ul>
          </section>

          <aside className="guide-cta" aria-labelledby="cta-title">
            <div>
              <p className="eyebrow">Put the checklist to work</p>
              <h2 id="cta-title">Inspect a synthetic export locally.</h2>
              <p>Try the browser cleaner, compare destination-prefix trade-offs, or share a synthetic or redacted case.</p>
            </div>
            <div>
              <Link className="primary-button" href="/#cleaner">Open the CSV cleaner</Link>
              <p><Link href={GUIDE_PATH}>Compare apostrophe vs. tab →</Link></p>
              <p><a href={SUPPORT_URL} target="_blank" rel="noreferrer">Share a synthetic or redacted case ↗</a></p>
            </div>
          </aside>
        </article>
      </main>

      <footer>
        <a className="brand footer-brand" href={SITE_URL}>
          <span className="brand-mark" aria-hidden="true">CG</span>
          <span>CSV Guard</span>
        </a>
        <p>Engineering guidance, not a universal security guarantee.</p>
        <p><a href={SOURCE_URL} target="_blank" rel="noreferrer">View source ↗</a></p>
      </footer>
    </>
  );
}
