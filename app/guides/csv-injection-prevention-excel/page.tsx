import type { Metadata } from "next";
import Link from "next/link";
import {
  GUIDE_URL,
  SITE_URL,
  SOCIAL_IMAGE_URL,
  SOURCE_URL,
} from "../../lib/site";

const title = "CSV Injection Prevention in Excel: Apostrophe vs. Tab Prefix";
const description =
  "Compare apostrophe and tab prefixes for CSV injection risk, understand Excel save/reopen trade-offs, and test the full spreadsheet lifecycle.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: GUIDE_URL,
  },
  openGraph: {
    type: "article",
    siteName: "CSV Guard",
    title,
    description,
    url: GUIDE_URL,
    images: [
      {
        url: SOCIAL_IMAGE_URL,
        width: 1731,
        height: 909,
        alt: "CSV Guard guide to apostrophe and tab prefix trade-offs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [SOCIAL_IMAGE_URL],
  },
};

const sources = [
  {
    label: "OWASP: CSV Injection",
    href: "https://owasp.org/www-community/attacks/CSV_Injection",
    note: "Risk markers, separator boundaries, and prefix trade-offs.",
  },
  {
    label: "OWASP WSTG: Testing for CSV Injection",
    href: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/21-Testing_for_CSV_Injection",
    note: "A lifecycle-oriented test method for spreadsheet behavior.",
  },
  {
    label: "Microsoft: Import or export text and CSV files",
    href: "https://support.microsoft.com/en-us/excel/get-started/import-or-export-text-txt-or-csv-files",
    note: "How open method, delimiter, and regional settings affect CSV interpretation.",
  },
];

export default function CsvInjectionPreventionGuide() {
  return (
    <>
      <header className="site-header guide-header">
        <a className="brand" href={SITE_URL} aria-label="CSV Guard home">
          <span className="brand-mark" aria-hidden="true">CG</span>
          <span>CSV Guard</span>
        </a>
        <nav aria-label="Primary navigation">
          <Link href="/#cleaner">Cleaner</Link>
          <a href="/guides/csv-injection-prevention-excel/" aria-current="page">Guide</a>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">Source</a>
        </nav>
        <span className="header-status">Lifecycle guide</span>
      </header>

      <main className="guide-main">
        <article>
          <header className="guide-hero">
            <p className="eyebrow">CSV injection prevention · Excel workflow</p>
            <h1>CSV Injection Prevention in Excel: Apostrophe vs. Tab Prefix</h1>
            <p className="guide-deck">
              Both prefixes change the underlying value. One may be easier for
              programmatic consumers; the other may better survive an observed Excel
              workflow. Neither is a universal safety guarantee.
            </p>
            <div className="guide-summary" role="note" aria-labelledby="answer-title">
              <p className="panel-kicker" id="answer-title">The short answer</p>
              <p>
                <strong>No CSV prefix is universally safe</strong> across spreadsheet
                applications and downstream consumers. Apostrophe prefixing can reduce
                risk on initial import but may not survive an Excel save/reopen cycle.
                OWASP documents a tab-inside-a-quoted-field mitigation observed in Excel.
                CSV Guard layers an apostrophe after that tab so TSV-style reinterpretation
                does not leave the formula marker first; both prefixes remain in the data and
                must be tested in your exact workflow.
              </p>
            </div>
          </header>

          <section className="guide-section" id="comparison" aria-labelledby="comparison-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Decision table</p>
              <h2 id="comparison-title">Choose for the destination, then verify the lifecycle.</h2>
            </div>
            <div className="guide-table-frame" tabIndex={0} aria-label="Prefix comparison table">
              <table>
                <caption>Apostrophe and tab prefix trade-offs</caption>
                <thead>
                  <tr>
                    <th scope="col">Prefix</th>
                    <th scope="col">Reason to consider it</th>
                    <th scope="col">What can go wrong</th>
                    <th scope="col">Use only after</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Apostrophe</th>
                    <td>Useful when every downstream consumer accepts or deliberately strips it.</td>
                    <td>It changes the value, and its escape behavior may disappear after Excel saves and reopens a CSV.</td>
                    <td>Testing the initial import and the saved file that users will reopen.</td>
                  </tr>
                  <tr>
                    <th scope="row">Tab + apostrophe</th>
                    <td>Layers an apostrophe after the Excel-observed tab mitigation so tab reinterpretation retains a text prefix.</td>
                    <td>Both prefixes remain in the data and can disrupt parsers, joins, type inference, or another spreadsheet.</td>
                    <td>Testing the exact Excel version, locale, import path, and downstream program.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="guide-caveat">
              “Observed in Excel” is not a Microsoft guarantee or a promise about every
              release, operating system, locale, file-open method, or spreadsheet product.
            </p>
          </section>

          <section className="guide-section" id="test-workflow" aria-labelledby="workflow-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Lifecycle test</p>
              <h2 id="workflow-title">Test the file users actually exchange.</h2>
            </div>
            <ol className="workflow-list">
              <li>
                <span>01</span>
                <div><h3>Record the environment</h3><p>Capture the Excel version and build, operating system, locale and list separator, import method, and relevant Trust Center settings.</p></div>
              </li>
              <li>
                <span>02</span>
                <div><h3>Inspect the raw output</h3><p>Confirm the actual delimiter, quoted fields, escaped quotes, BOM, and exact prefix positions before opening the file.</p></div>
              </li>
              <li>
                <span>03</span>
                <div><h3>Open it the real way</h3><p>Use the production import path—double-click, File Open, or Data &gt; From Text/CSV—then inspect both the displayed cell and the formula bar.</p></div>
              </li>
              <li>
                <span>04</span>
                <div><h3>Cross the save boundary</h3><p>Save the CSV, close Excel, and reopen it by the same path. Repeat the cell and formula-bar checks.</p></div>
              </li>
              <li>
                <span>05</span>
                <div><h3>Compare and consume</h3><p>Perform a raw-file diff before and after Excel, then load the saved file into every downstream parser that matters.</p></div>
              </li>
            </ol>
          </section>

          <section className="guide-section guide-grid" id="test-cases" aria-labelledby="cases-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Harmless cases</p>
              <h2 id="cases-title">Separate a risk marker from malicious intent.</h2>
            </div>
            <div>
              <p>
                Start with inert arithmetic examples such as <code>=1+1</code>,
                <code>+1+1</code>, <code>-1+1</code>, <code>-42</code>, and
                <code>@SUM(1,1)</code>. Exercise cell starts, supported delimiters,
                embedded line breaks, escaped quotes, leading whitespace, and values
                that already contain an apostrophe or tab.
              </p>
              <p>
                Negative numbers are an important false positive: <code>-42</code> can
                be ordinary data, yet a conservative marker rule prefixes it and changes
                its inferred type. Validate identifiers, leading zeros, joins, and numeric
                calculations after every mode.
              </p>
              <p>
                Do not copy command-execution or real exfiltration payloads into routine
                acceptance tests. Any external-impact testing belongs in an isolated,
                authorized environment.
              </p>
            </div>
          </section>

          <section className="guide-section" id="sources" aria-labelledby="sources-title">
            <div className="guide-section-heading">
              <p className="eyebrow">Primary sources</p>
              <h2 id="sources-title">Read the behavior, not a promise.</h2>
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
              <p className="eyebrow">Try both outputs locally</p>
              <h2 id="cta-title">Inspect a synthetic CSV in your browser.</h2>
              <p>CSV Guard keeps file contents in the tab and makes the chosen prefix visible in the downloaded filename.</p>
            </div>
            <Link className="primary-button" href="/#cleaner">Open the CSV cleaner</Link>
          </aside>
        </article>
      </main>

      <footer>
        <a className="brand footer-brand" href={SITE_URL}>
          <span className="brand-mark" aria-hidden="true">CG</span>
          <span>CSV Guard</span>
        </a>
        <p>Educational guidance, not a universal security guarantee.</p>
        <p><a href={SOURCE_URL} target="_blank" rel="noreferrer">View source ↗</a></p>
      </footer>
    </>
  );
}
