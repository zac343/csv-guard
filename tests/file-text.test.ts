import assert from "node:assert/strict";
import test from "node:test";
import {
  CsvFileDecodingError,
  decodeUtf8Csv,
} from "../app/lib/file-text.ts";

test("decodes valid UTF-8 CSV bytes without replacement", () => {
  const bytes = new TextEncoder().encode("name\nJosé");
  assert.equal(decodeUtf8Csv(bytes.buffer), "name\nJosé");
});

test("rejects invalid UTF-8 instead of silently replacing bytes", () => {
  const bytes = Uint8Array.from([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x4a, 0x6f, 0x73, 0xe9]);
  assert.throws(
    () => decodeUtf8Csv(bytes.buffer),
    (error) => error instanceof CsvFileDecodingError && /valid UTF-8/i.test(error.message),
  );
});
