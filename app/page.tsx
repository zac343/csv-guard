import type { Metadata } from "next";
import { CsvWorkbench } from "./components/CsvWorkbench";
import {
  GUIDE_PATH,
  SITE_URL,
  SOCIAL_IMAGE_URL,
  SOURCE_URL,
  SUPPORT_URL,
} from "./lib/site";

export const metadata: Metadata = {
  title: "Clean risky CSVs locally",
  description:
    "Prefix formula-like CSV segments, remove duplicate and empty rows, normalize headers, and trim whitespace without uploading your file.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    siteName: "CSV Guard",
    title: "CSV Guard — Clean risky CSVs locally",
    description: "Private CSV hygiene in one browser-only pass.",
    url: SITE_URL,
    images: [{ url: SOCIAL_IMAGE_URL, width: 1731, height: 909, alt: "CSV Guard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CSV Guard — Clean risky CSVs locally",
    description: "Private CSV hygiene in one browser-only pass.",
    images: [SOCIAL_IMAGE_URL],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CSV Guard",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any modern browser",
  url: SITE_URL,
  codeRepository: SOURCE_URL,
  description:
    "A privacy-first browser tool that cleans risky CSV files without uploading file contents.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Configurable prefix handling for formula-like CSV segments",
    "Duplicate and empty row removal",
    "Header normalization",
    "Whitespace cleanup",
    "Local browser processing",
  ],
};

export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="CSV Guard home">
          <span className="brand-mark" aria-hidden="true">
            CG
          </span>
          <span>CSV Guard</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#cleaner">Cleaner</a>
          <a href={GUIDE_PATH}>Guide</a>
          <a href="#checks">Checks</a>
          <a href="#privacy">Privacy</a>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">Source</a>
        </nav>
        <span className="header-status">Local-only processing</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span aria-hidden="true" /> CSV hygiene, before production
          </p>
          <h1>
            Clean risky CSVs
            <br />
            before they spread.
          </h1>
          <p className="hero-lede">
            Detect formula-like prefixes, duplicates, empty rows, messy headers, and
            stray whitespace in one private, browser-only pass.
          </p>
          <p className="hero-cn" lang="zh-CN">
            文件不离开浏览器。无需账号，不上传文件内容，清理后立即下载。
          </p>
          <div className="hero-signals" aria-label="Product guarantees">
            <span>0 file bytes uploaded</span>
            <span>10 MB max</span>
            <span>No account</span>
          </div>
        </div>

        <CsvWorkbench />
      </section>

      <section className="checks-section" id="checks" aria-labelledby="checks-title">
        <div className="section-heading">
          <p className="eyebrow">Five deterministic checks</p>
          <h2 id="checks-title">Small CSV defects become expensive downstream.</h2>
          <p>
            CSV Guard makes conservative, repeatable fixes and shows the exact count
            for every change before you download.
          </p>
        </div>
        <div className="check-grid">
          <article>
            <span>01</span>
            <h3>Formula-like prefixes</h3>
            <p>Prefixes risky markers with your selected escape to reduce execution risk on initial spreadsheet import.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Duplicate rows</h3>
            <p>Removes identical duplicate records after whitespace cleanup.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Empty records</h3>
            <p>Drops rows that contain no meaningful value across every column.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Messy headers</h3>
            <p>Normalizes names and makes collisions unique without losing columns.</p>
          </article>
          <article>
            <span>05</span>
            <h3>Stray whitespace</h3>
            <p>Trims invisible leading and trailing spaces that break matching.</p>
          </article>
        </div>
      </section>

      <section className="guidance-section" aria-labelledby="guidance-title">
        <div className="guidance-copy">
          <p className="eyebrow">Choose by destination</p>
          <h2 id="guidance-title">Two prefixes. Different trade-offs.</h2>
          <p>
            Cells beginning with =, +, -, or @ may be interpreted as formulas.
            CSV Guard prefixes those markers at cell starts and supported delimiter
            boundaries. No universal CSV prefix strategy works across every spreadsheet
            and downstream consumer.
          </p>
          <p className="lifecycle-note">
            Excel can remove apostrophe-based escaping after you save and reopen a file;
            the Excel review mode leaves a real tab and an apostrophe in the data. Re-clean
            untrusted exports before reopening them. Both modes also prefix negative numbers such as -42, changing
            their inferred type. See the{" "}
            <a href="https://owasp.org/www-community/attacks/CSV_Injection" target="_blank" rel="noreferrer">
              OWASP CSV Injection guidance
            </a>.
          </p>
          <p>
            <a className="text-link" href={GUIDE_PATH}>
              Compare apostrophe and layered tab prefixes, then test your Excel workflow →
            </a>
          </p>
        </div>
        <div className="mode-comparison">
          <table>
            <caption className="visually-hidden">Formula prefix mode trade-offs</caption>
            <thead><tr><th scope="col">Mode</th><th scope="col">Best fit</th><th scope="col">Known trade-off</th></tr></thead>
            <tbody>
              <tr><td>Apostrophe prefix</td><td>Downstream accepts or strips apostrophe</td><td>Apostrophe stays in data; escape may not survive Excel save/reopen</td></tr>
              <tr><td>Excel review tab + apostrophe</td><td>One-time human review in Excel</td><td>Both prefixes stay in data and may disrupt imports</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="privacy-section" id="privacy" aria-labelledby="privacy-title">
        <div>
          <p className="eyebrow">Privacy by architecture</p>
          <h2 id="privacy-title">Your rows never touch our server.</h2>
        </div>
        <div className="privacy-copy">
          <p>
            Parsing, cleanup, preview, and export run in this browser tab. The
            site records only anonymous daily action counts such as “analyze”
            and “download”—never filenames, cell values, IP addresses, or file
            contents in its product database.
          </p>
          <p>
            Need stronger assurance? Open developer tools, disconnect the
            network after loading, and the cleaner still works.
          </p>
        </div>
      </section>

      <section className="faq-section" aria-labelledby="faq-title">
        <p className="eyebrow">Straight answers</p>
        <h2 id="faq-title">FAQ</h2>
        <div className="faq-list">
          <details>
            <summary>Does CSV Guard upload my file?</summary>
            <p>No. File parsing and cleaning happen locally in your browser.</p>
          </details>
          <details>
            <summary>Which delimiters are supported?</summary>
            <p>Comma, semicolon, tab, and pipe delimiters are detected automatically.</p>
          </details>
          <details>
            <summary>What are the browser safety limits?</summary>
            <p>
              Each file is limited to 10 MB, 100,000 data rows, 5,000 columns,
              500,000 normalized cells, and 2,000,000 characters per field.
              Large inputs can still be memory-intensive, especially on mobile.
            </p>
          </details>
          <details>
            <summary>What is spreadsheet formula injection?</summary>
            <p>
              Cells whose first effective character is =, +, -, or @ may be
              interpreted as formulas when opened. CSV Guard prefixes every such
              segment—including one exposed after a supported delimiter—using the
              selected mode. This reduces risk on initial import but is not a
              universal spreadsheet-safety guarantee. Negative numbers are also
              exported as text.
            </p>
          </details>
          <details>
            <summary>Is this a data validation platform?</summary>
            <p>
              Not yet. This first release performs deterministic hygiene checks;
              it does not infer business rules or validate whether an email,
              address, or identifier is factually correct.
            </p>
          </details>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark" aria-hidden="true">CG</span>
          <span>CSV Guard</span>
        </a>
        <p>Private CSV hygiene for careful teams.</p>
        <p>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">View source ↗</a>
          {" · "}
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer">Report an issue ↗</a>
        </p>
      </footer>
    </main>
  );
}
