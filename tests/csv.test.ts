import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  CSV_LIMITS,
  cleanCsv,
  detectDelimiter,
  parseCsv,
  serializeCleanCsv,
  serializeCsv,
} from "../app/lib/csv.ts";

test("detects common delimiters", () => {
  assert.equal(detectDelimiter("name;email\nAda;ada@example.com"), ";");
  assert.equal(detectDelimiter("name\temail\nAda\tada@example.com"), "\t");
  assert.equal(detectDelimiter("name\nAda"), "");
});

test("prefers a consistent delimiter over frequent text punctuation", () => {
  const note = Array.from({ length: 13 }, (_, index) => `part${index}`).join(";");
  const input = `name,note\nAda,${note}\nGrace,${note}`;

  assert.equal(detectDelimiter(input), ",");
  assert.deepEqual(parseCsv(input), {
    delimiter: ",",
    headers: ["name", "note"],
    rows: [
      ["Ada", note],
      ["Grace", note],
    ],
  });

  const shortText = Array.from({ length: 7 }, (_, index) => `head${index}`).join(";");
  const unevenInput = `${shortText},note\n${note},one\n${note},two`;
  assert.equal(detectDelimiter(unevenInput), ",");

  const quotedInput = `name,note\nAda,"${note}"\nGrace,"${note}"`;
  assert.equal(detectDelimiter(quotedInput), ",");
  assert.deepEqual(parseCsv(quotedInput).rows, [
    ["Ada", note],
    ["Grace", note],
  ]);

  const raggedInput = "a,b\nx;y,1,2\nz;w,3,4,5";
  assert.equal(detectDelimiter(raggedInput), ",");
  assert.deepEqual(parseCsv(raggedInput), {
    delimiter: ",",
    headers: ["a", "b", "", ""],
    rows: [
      ["x;y", "1", "2", ""],
      ["z;w", "3", "4", "5"],
    ],
  });
});

test("parses quoted delimiters, quotes, and newlines", () => {
  const table = parseCsv('name,notes\r\nAda,"one, two"\r\nGrace,"line 1\nline 2"\r\nLinus,"said ""hello"""');
  assert.deepEqual(table.headers, ["name", "notes"]);
  assert.equal(table.rows[0][1], "one, two");
  assert.equal(table.rows[1][1], "line 1\nline 2");
  assert.equal(table.rows[2][1], 'said "hello"');
});

test("preserves literal quotes inside unquoted fields", () => {
  const paired = parseCsv('name,note\nAda,he said "hello"');
  assert.equal(paired.rows[0][1], 'he said "hello"');

  const single = parseCsv('name,note\nGrace,5" widget');
  assert.equal(single.rows[0][1], '5" widget');

  const quotedHeader = parseCsv('part"code,note\nA,B');
  assert.deepEqual(quotedHeader.headers, ['part"code', "note"]);
  assert.equal(quotedHeader.delimiter, ",");
});

test("cleans headers, duplicates, blanks, whitespace, and executable cells", () => {
  const result = cleanCsv(parseCsv(
    " Customer Name ,Customer Name,Note\n Ada , Ada , =2+2 \n Ada , Ada , =2+2 \n,,\nLinus,Linus,-42",
  ));
  assert.deepEqual(result.table.headers, ["customer_name", "customer_name_2", "note"]);
  assert.deepEqual(result.table.rows, [
    ["Ada", "Ada", "'=2+2"],
    ["Linus", "Linus", "'-42"],
  ]);
  assert.equal(result.stats.duplicatesRemoved, 1);
  assert.equal(result.stats.emptyRowsRemoved, 1);
  assert.equal(result.stats.riskyPrefixesPrefixed, 2);
  assert.ok(result.stats.cellsTrimmed >= 6);
});

test("protects every executable marker after Unicode and control prefixes", () => {
  const risky = [
    "=2+2",
    "+SUM(A1:A2)",
    "-42",
    "-1-SUM(A1:A2)",
    "--SUM(A1:A2)",
    "-@SUM(A1:A2)",
    "@SUM(A1:A2)",
    "\u0000=cmd",
    "\u200B＝2+2",
    "＋1",
    "－1",
    "＠SUM(A1:A2)",
  ];
  const safe = ["42", "plain text", "'=2+2"];
  const result = cleanCsv({
    delimiter: ",",
    headers: ["value"],
    rows: [...risky, ...safe].map((value) => [value]),
  });

  assert.equal(result.stats.riskyPrefixesPrefixed, risky.length);
  assert.ok(result.table.rows.slice(0, risky.length).every(([value]) => value.startsWith("'")));
  assert.deepEqual(result.table.rows.slice(risky.length), safe.map((value) => [value]));
});

test("protects formulas exposed by alternate-delimiter reinterpretation", () => {
  const boundaries = [",", ";", "\t", "|", "\r", "\n"];
  const value = boundaries.map((boundary) => `safe${boundary}\u200B＝1+1`).join("");
  const result = cleanCsv({
    delimiter: ",",
    headers: ["value"],
    rows: [[value]],
  });

  assert.equal(result.stats.riskyPrefixesPrefixed, boundaries.length);
  for (const boundary of boundaries) {
    assert.ok(result.table.rows[0][0].includes(`${boundary}'\u200B＝1+1`));
  }

  const output = serializeCleanCsv(result);
  for (const delimiter of [",", ";", "\t", "|"]) {
    const reinterpretedSegments = output.split(delimiter).slice(1);
    assert.ok(
      reinterpretedSegments.every((segment) => !/^[\p{White_Space}\p{Cc}\p{Cf}]*[=+\-@]/u.test(segment.normalize("NFKC"))),
      `alternate ${JSON.stringify(delimiter)} parsing must not expose a formula prefix`,
    );
  }
});

test("protects formulas after compatibility-normalized delimiter boundaries", () => {
  const compatibilityBoundaries = [
    "\u037E",
    "\uFE10",
    "\uFE14",
    "\uFE50",
    "\uFE54",
    "\uFF0C",
    "\uFF1B",
    "\uFF5C",
    ...Array.from({ length: 10 }, (_, index) => String.fromCodePoint(0x1F101 + index)),
  ];
  const value = compatibilityBoundaries
    .map((boundary) => `safe${boundary}=1+1`)
    .join("");

  for (const mode of ["portable-apostrophe", "excel-tab"] as const) {
    const result = cleanCsv({
      delimiter: ",",
      headers: ["value"],
      rows: [[value]],
    }, mode);

    assert.equal(result.stats.riskyPrefixesPrefixed, compatibilityBoundaries.length);
    const prefix = mode === "excel-tab" ? "\t'" : "'";
    for (const boundary of compatibilityBoundaries) {
      assert.ok(result.table.rows[0][0].includes(`${boundary}${prefix}=1+1`));
    }

    const normalizedOutput = serializeCleanCsv(result).normalize("NFKC");
    for (const delimiter of [",", ";", "\t", "|"]) {
      assert.ok(
        normalizedOutput.split(delimiter).every((segment) => {
          const probe = segment.replace(/^["\p{White_Space}\p{Cc}\p{Cf}]+/u, "");
          return !/^[=+\-@]/u.test(probe);
        }),
        `${mode}: NFKC then ${JSON.stringify(delimiter)} parsing must not expose a formula prefix`,
      );
    }
  }
});

test("survives quote-aware alternate-delimiter CSV reparsing", (context) => {
  const result = cleanCsv(parseCsv(
    'name,note\nAda,"safe;""=1+1;tail"',
  ));
  assert.equal(result.stats.riskyPrefixesPrefixed, 1);
  assert.equal(result.table.rows[0][1], "safe;'\"=1+1;tail");

  const output = serializeCleanCsv(result);
  const python = spawnSync(
    "python3",
    [
      "-c",
      [
        "import csv, io, json, sys",
        "text = sys.stdin.read()",
        "parsed = {}",
        "for delimiter in [',', ';', '\\t', '|']:",
        "    parsed[delimiter] = [field for row in csv.reader(io.StringIO(text, newline=''), delimiter=delimiter) for field in row]",
        "print(json.dumps(parsed))",
      ].join("\n"),
    ],
    { input: output, encoding: "utf8" },
  );
  if (python.error) {
    if ((python.error as NodeJS.ErrnoException).code === "ENOENT") {
      context.skip("python3 is unavailable for the independent CSV parser check");
      return;
    }
    throw python.error;
  }
  assert.equal(python.status, 0, python.stderr);

  const parsed = JSON.parse(python.stdout) as Record<string, string[]>;
  for (const [delimiter, fields] of Object.entries(parsed)) {
    assert.ok(
      fields.every((field) => {
        const probe = field
          .normalize("NFKC")
          .replace(/^["\p{White_Space}\p{Cc}\p{Cf}]+/u, "");
        return !/^[=+\-@]/u.test(probe);
      }),
      `quote-aware ${JSON.stringify(delimiter)} parsing must not expose a formula field`,
    );
  }
});

test("offers explicit portable and Excel-review prefix modes without double-prefixing", () => {
  const source = {
    delimiter: ",",
    headers: ["value", "note"],
    rows: [
      ["=2+2", "plain"],
      ["safe;=3+3", "plain"],
      ["\u200B＝4+4", "plain"],
    ],
  };

  const portable = cleanCsv(source, "portable-apostrophe");
  assert.equal(portable.formulaProtectionMode, "portable-apostrophe");
  assert.deepEqual(portable.table.rows.map(([value]) => value), [
    "'=2+2",
    "safe;'=3+3",
    "'\u200B＝4+4",
  ]);

  const excelReview = cleanCsv(source, "excel-tab");
  assert.equal(excelReview.formulaProtectionMode, "excel-tab");
  assert.equal(excelReview.stats.riskyPrefixesPrefixed, 3);
  assert.deepEqual(excelReview.table.rows.map(([value]) => value), [
    "\t'=2+2",
    "safe;\t'=3+3",
    "\t'\u200B＝4+4",
  ]);

  const output = serializeCleanCsv(excelReview);
  assert.match(output, /"\t'=2\+2"/);
  assert.match(output, /"safe;\t'=3\+3"/);
  assert.doesNotMatch(output, /\t\t'=/);
  assert.deepEqual(parseCsv(output).rows, excelReview.table.rows);
});

test("keeps Excel-review formulas non-executable after tab reinterpretation", () => {
  const rawBoundaries = [",", ";", "\t", "|", "\r", "\n"];
  const source = {
    delimiter: ",",
    headers: ["value"],
    rows: [
      ["=1+1\ttail"],
      ...rawBoundaries.map((boundary) => [`safe${boundary}\t=2+2`]),
    ],
  };
  const result = cleanCsv(source, "excel-tab");

  assert.equal(result.table.rows[0][0], "\t'=1+1\ttail");
  rawBoundaries.forEach((boundary, index) => {
    assert.equal(
      result.table.rows[index + 1][0],
      `safe${boundary}\t\t'=2+2`,
    );
  });
  const output = serializeCleanCsv(result);
  assert.ok(
    output.split("\t").every((segment) => {
      const probe = segment
        .normalize("NFKC")
        .replace(/^["\p{White_Space}\p{Cc}\p{Cf}]+/u, "");
      return !/^[=+\-@]/u.test(probe);
    }),
  );
  assert.equal(serializeCsv(source, "excel-tab"), output);
});

test("upgrades apostrophe-prefixed formulas when Excel-tab mode is selected", () => {
  const source = {
    delimiter: ",",
    headers: ["value"],
    rows: [
      ["'=1+1"],
      ["''+2+2"],
      ["safe;'@SUM(A1:A2)"],
      ["'-42"],
    ],
  };

  const portable = cleanCsv(source, "portable-apostrophe");
  assert.deepEqual(portable.table.rows, source.rows);

  const excelReview = cleanCsv(source, "excel-tab");
  assert.deepEqual(excelReview.table.rows, [
    ["\t'=1+1"],
    ["\t''+2+2"],
    ["safe;\t'@SUM(A1:A2)"],
    ["\t'-42"],
  ]);
  assert.equal(excelReview.stats.riskyPrefixesPrefixed, source.rows.length);
});

test("keeps Excel-tab cleanup and serialization idempotent across every boundary", () => {
  const boundaries = [",", ";", "\t", "|", "\r", "\n"];
  const value = ["=0", ...boundaries.map((boundary) => `safe${boundary}=1`)].join(" tail ");
  const first = cleanCsv({
    delimiter: ",",
    headers: ["value", "note"],
    rows: [[value, "ok"]],
  }, "excel-tab");
  const second = cleanCsv(first.table, "excel-tab");
  const downloadedAndReparsed = cleanCsv(
    parseCsv(serializeCleanCsv(first)),
    "excel-tab",
  );

  assert.deepEqual(second.table, first.table);
  assert.deepEqual(downloadedAndReparsed.table, first.table);
  assert.equal(serializeCsv(first.table, "excel-tab"), serializeCleanCsv(first));
  assert.match(first.table.rows[0][0], /^\t'=0/);
  for (const boundary of boundaries) {
    const expectedPrefix = boundary === "\t" ? "\t\t'" : `${boundary}\t'`;
    assert.ok(
      first.table.rows[0][0].includes(`${expectedPrefix}=1`),
      `${JSON.stringify(boundary)} must have exactly one Excel-tab prefix after its boundary`,
    );
  }
});

test("makes normalized headers unique even when a suffix already exists", () => {
  const result = cleanCsv(parseCsv("a,a,a_2\n1,2,3"));
  assert.deepEqual(result.table.headers, ["a", "a_2", "a_2_2"]);
  assert.equal(new Set(result.table.headers).size, result.table.headers.length);
});

test("deduplicates trimmed source rows before risky-prefix handling", () => {
  const result = cleanCsv({
    delimiter: ",",
    headers: ["value"],
    rows: [["=2+2"], ["'=2+2"], ["=2+2"]],
  });

  assert.deepEqual(result.table.rows, [["'=2+2"], ["'=2+2"]]);
  assert.equal(result.stats.outputRows, 2);
  assert.equal(result.stats.duplicatesRemoved, 1);
  assert.equal(result.stats.riskyPrefixesPrefixed, 1);
});

test("quotes every output field and preserves a parse/serialize round trip", () => {
  const output = serializeCsv({
    delimiter: ",",
    headers: ["name", "note"],
    rows: [["Ada", 'ok;=WEBSERVICE("https://example.test")|x\tvalue']],
  });
  assert.equal(
    output,
    '\uFEFF"name","note"\r\n"Ada","ok;\'=WEBSERVICE(""https://example.test"")|x\tvalue"\r\n',
  );
  assert.deepEqual(parseCsv(output), {
    delimiter: ",",
    headers: ["name", "note"],
    rows: [["Ada", 'ok;\'=WEBSERVICE("https://example.test")|x\tvalue']],
  });
});

test("enforces the exact data-row boundary", () => {
  const exact = `h\n${Array.from({ length: CSV_LIMITS.dataRows }, () => "x").join("\n")}`;
  assert.equal(parseCsv(exact).rows.length, CSV_LIMITS.dataRows);

  const over = `${exact}\nx`;
  assert.throws(
    () => parseCsv(over),
    new RegExp(`${CSV_LIMITS.dataRows.toLocaleString("en-US")} data row`),
  );
});

test("enforces the exact column boundary", () => {
  const exact = Array.from({ length: CSV_LIMITS.columns }, (_, index) => `h${index}`).join(",");
  assert.equal(parseCsv(exact).headers.length, CSV_LIMITS.columns);
  assert.throws(
    () => parseCsv(`${exact},overflow`),
    new RegExp(`${CSV_LIMITS.columns.toLocaleString("en-US")} column`),
  );
});

test("enforces the exact per-field character boundary", () => {
  const exact = "x".repeat(CSV_LIMITS.fieldCharacters);
  assert.equal(parseCsv(`h\n${exact}`).rows[0][0].length, CSV_LIMITS.fieldCharacters);
  assert.throws(
    () => parseCsv(`h\n${exact}x`),
    new RegExp(`${CSV_LIMITS.fieldCharacters.toLocaleString("en-US")} character`),
  );
});

test("checks normalized cell limits before padding sparse records", () => {
  const header = Array.from({ length: CSV_LIMITS.columns }, (_, index) => `h${index}`).join(",");
  const exactLogicalRows = CSV_LIMITS.cells / CSV_LIMITS.columns;
  const exact = `${header}\n${Array.from({ length: exactLogicalRows - 1 }, () => "x").join("\n")}`;
  const table = parseCsv(exact);
  assert.equal((table.rows.length + 1) * table.headers.length, CSV_LIMITS.cells);

  assert.throws(
    () => parseCsv(`${exact}\nx`),
    new RegExp(`${CSV_LIMITS.cells.toLocaleString("en-US")} normalized cell`),
  );
});
