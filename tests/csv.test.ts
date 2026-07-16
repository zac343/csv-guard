import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  CSV_LIMITS,
  cleanCsv,
  detectDelimiter,
  parseCsv,
  serializeCsv,
} from "../app/lib/csv.ts";

test("detects common delimiters", () => {
  assert.equal(detectDelimiter("name;email\nAda;ada@example.com"), ";");
  assert.equal(detectDelimiter("name\temail\nAda\tada@example.com"), "\t");
  assert.equal(detectDelimiter("name\nAda"), "");
});

test("parses quoted delimiters, quotes, and newlines", () => {
  const table = parseCsv('name,notes\r\nAda,"one, two"\r\nGrace,"line 1\nline 2"\r\nLinus,"said ""hello"""');
  assert.deepEqual(table.headers, ["name", "notes"]);
  assert.equal(table.rows[0][1], "one, two");
  assert.equal(table.rows[1][1], "line 1\nline 2");
  assert.equal(table.rows[2][1], 'said "hello"');
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
  assert.equal(result.stats.formulasProtected, 2);
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

  assert.equal(result.stats.formulasProtected, risky.length);
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

  assert.equal(result.stats.formulasProtected, boundaries.length);
  for (const boundary of boundaries) {
    assert.ok(result.table.rows[0][0].includes(`${boundary}'\u200B＝1+1`));
  }

  const output = serializeCsv(result.table);
  for (const delimiter of [",", ";", "\t", "|"]) {
    const reinterpretedSegments = output.split(delimiter).slice(1);
    assert.ok(
      reinterpretedSegments.every((segment) => !/^[\p{White_Space}\p{Cc}\p{Cf}]*[=+\-@]/u.test(segment.normalize("NFKC"))),
      `alternate ${JSON.stringify(delimiter)} parsing must not expose a formula prefix`,
    );
  }
});

test("survives quote-aware alternate-delimiter CSV reparsing", (context) => {
  const result = cleanCsv(parseCsv(
    'name,note\nAda,"safe;""=1+1;tail"',
  ));
  assert.equal(result.stats.formulasProtected, 1);
  assert.equal(result.table.rows[0][1], "safe;'\"=1+1;tail");

  const output = serializeCsv(result.table);
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

test("makes normalized headers unique even when a suffix already exists", () => {
  const result = cleanCsv(parseCsv("a,a,a_2\n1,2,3"));
  assert.deepEqual(result.table.headers, ["a", "a_2", "a_2_2"]);
  assert.equal(new Set(result.table.headers).size, result.table.headers.length);
});

test("deduplicates trimmed source rows before formula protection", () => {
  const result = cleanCsv({
    delimiter: ",",
    headers: ["value"],
    rows: [["=2+2"], ["'=2+2"], ["=2+2"]],
  });

  assert.deepEqual(result.table.rows, [["'=2+2"], ["'=2+2"]]);
  assert.equal(result.stats.outputRows, 2);
  assert.equal(result.stats.duplicatesRemoved, 1);
  assert.equal(result.stats.formulasProtected, 1);
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
