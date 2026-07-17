export class CsvFileDecodingError extends Error {
  constructor() {
    super("This CSV is not valid UTF-8. Convert it to UTF-8, then try again.");
    this.name = "CsvFileDecodingError";
  }
}

export function decodeUtf8Csv(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new CsvFileDecodingError();
  }
}
