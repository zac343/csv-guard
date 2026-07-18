import assert from "node:assert/strict";
import test from "node:test";
import type { CleanResult } from "../app/lib/csv.ts";
import { createSecurityReviewReport } from "../app/lib/review-report.ts";

function result(mode: CleanResult["formulaProtectionMode"]): CleanResult {
  return {
    table: {
      headers: ["PRIVATE_CUSTOMER_ID", "secret_note"],
      rows: [["customer-1042", "do-not-share"]],
      delimiter: ",",
    },
    stats: {
      inputRows: 9,
      outputRows: 7,
      riskyPrefixesPrefixed: 3,
      duplicatesRemoved: 1,
      emptyRowsRemoved: 1,
      cellsTrimmed: 4,
      headersNormalized: 2,
    },
    inputDelimiterLabel: "comma-separated data",
    formulaProtectionMode: mode,
  };
}

test("creates a deterministic aggregate-only security review handoff", () => {
  const inspected = result("portable-apostrophe");
  const first = createSecurityReviewReport(inspected);
  const second = createSecurityReviewReport(inspected);

  assert.equal(first, second);
  assert.match(first, /csv-guard-review-report:v1/);
  assert.match(first, /ref=security-review-report-v1/);
  assert.match(first, /Input rows: 9/);
  assert.match(first, /Output rows: 7/);
  assert.match(first, /Formula-like segments changed: 3/);
  assert.match(first, /Duplicates removed: 1/);
  assert.match(first, /Empty rows removed: 1/);
  assert.match(first, /Cells trimmed: 4/);
  assert.match(first, /Headers normalized: 2/);
  assert.match(first, /Apostrophe prefix/);
  assert.match(first, /save, close, and reopen/i);
  assert.match(first, /raw-file diff/i);
  assert.match(first, /does not prove/i);
  assert.match(first, /aggregate counts only/i);
  assert.doesNotMatch(first, /PRIVATE_CUSTOMER_ID|secret_note|customer-1042|do-not-share/);
  assert.doesNotMatch(first, /comma-separated data/);
});

test("reports Excel review mode without claiming universal safety", () => {
  const report = createSecurityReviewReport(result("excel-tab"));

  assert.match(report, /Excel review prefix \(tab \+ apostrophe\)/);
  assert.match(report, /prefixes remain in exported data/i);
  assert.match(report, /exact spreadsheet and downstream lifecycle/i);
  assert.doesNotMatch(report, /safe CSV|fully protected|neutralized/i);
});

test("does not read table data or input format metadata", () => {
  const inspected = result("portable-apostrophe");
  Object.defineProperty(inspected, "table", {
    get() {
      throw new Error("report must not read the cleaned table");
    },
  });
  Object.defineProperty(inspected, "inputDelimiterLabel", {
    get() {
      throw new Error("report must not read input format metadata");
    },
  });

  assert.match(createSecurityReviewReport(inspected), /aggregate counts only/i);
});
