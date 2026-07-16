import type { Metadata } from "next";
import { CsvWorkbench } from "./components/CsvWorkbench";
import { SITE_URL, SOURCE_URL } from "./lib/site";

export const metadata: Metadata = {
  title: "Clean risky CSVs locally",
  description:
    "Remove duplicates, empty rows, messy headers, stray whitespace, and spreadsheet formula injection without uploading your CSV.",
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
    "Spreadsheet formula-injection protection",
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
            Catch formula injection, duplicates, empty rows, messy headers, and
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
            CSV Guard makes the safe, repeatable fixes and shows the exact count
            for every change before you download.
          </p>
        </div>
        <div className="check-grid">
          <article>
            <span>01</span>
            <h3>Formula injection</h3>
            <p>Prefixes dangerous markers at cell starts and supported delimiter boundaries.</p>
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
              interpreted as formulas when opened. CSV Guard prefixes every
              such segment—including one exposed after a supported delimiter—with
              an apostrophe. This conservative rule also converts negative numbers
              to text.
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
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">View source on GitHub ↗</a>
        </p>
      </footer>
    </main>
  );
}
