import assert from "node:assert/strict";
import test from "node:test";
import { cleanCsv, detectDelimiter, parseCsv, serializeCsv } from "../app/lib/csv.ts";

test("detects common delimiters", () => {
  assert.equal(detectDelimiter("name;email\nAda;ada@example.com"), ";");
  assert.equal(detectDelimiter("name\temail\nAda\tada@example.com"), "\t");
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
    ["Linus", "Linus", "-42"],
  ]);
  assert.equal(result.stats.duplicatesRemoved, 1);
  assert.equal(result.stats.emptyRowsRemoved, 1);
  assert.equal(result.stats.formulasProtected, 2);
  assert.ok(result.stats.cellsTrimmed >= 6);
});

test("serializes RFC-style quoted fields with a UTF-8 BOM", () => {
  const output = serializeCsv({
    delimiter: ",",
    headers: ["name", "note"],
    rows: [["Ada", 'said "hello", then left']],
  });
  assert.equal(output, '\uFEFFname,note\r\nAda,"said ""hello"", then left"\r\n');
});
