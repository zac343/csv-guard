import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_EVENT_BODY_BYTES,
  METRIC_RATE_LIMIT,
  MetricRequestError,
  consumeMetricRateLimit,
  isMetricsReadAuthorized,
  readMetricEvent,
} from "../app/lib/product-metrics.ts";

const ENDPOINT = "https://csv-guard.example/api/events";

function request(
  body: BodyInit = JSON.stringify({ event: "analyze" }),
  headers: Record<string, string> = {},
) {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      origin: new URL(ENDPOINT).origin,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body,
  });
}

async function rejectsWithStatus(promise: Promise<unknown>, status: number) {
  await assert.rejects(
    promise,
    (error) => error instanceof MetricRequestError && error.status === status,
  );
}

test("accepts only a known same-origin metric event", async () => {
  assert.equal(await readMetricEvent(request()), "analyze");
  await rejectsWithStatus(
    readMetricEvent(request(JSON.stringify({ event: "purchase" }))),
    400,
  );
});

test("rejects missing or mismatched browser origin signals", async () => {
  await rejectsWithStatus(
    readMetricEvent(request(undefined, { "sec-fetch-site": "cross-site" })),
    403,
  );
  await rejectsWithStatus(
    readMetricEvent(request(undefined, { origin: "https://attacker.example" })),
    403,
  );
  const missingOrigin = request();
  missingOrigin.headers.delete("origin");
  await rejectsWithStatus(readMetricEvent(missingOrigin), 403);
});

test("requires JSON and rejects declared or streamed oversized bodies", async () => {
  await rejectsWithStatus(
    readMetricEvent(request(undefined, { "content-type": "text/plain" })),
    415,
  );
  await rejectsWithStatus(
    readMetricEvent(request(undefined, { "content-length": String(MAX_EVENT_BODY_BYTES + 1) })),
    413,
  );
  await rejectsWithStatus(readMetricEvent(request("x".repeat(MAX_EVENT_BODY_BYTES + 1))), 413);
});

test("rejects malformed UTF-8 and malformed JSON", async () => {
  await rejectsWithStatus(readMetricEvent(request(new Uint8Array([0xff]))), 400);
  await rejectsWithStatus(readMetricEvent(request("{")), 400);
});

test("metrics reads fail closed without the exact bearer token", () => {
  const readRequest = new Request(ENDPOINT, {
    headers: { authorization: "Bearer correct-token" },
  });
  assert.equal(isMetricsReadAuthorized(readRequest, "correct-token"), true);
  assert.equal(isMetricsReadAuthorized(readRequest, "wrong-token"), false);
  assert.equal(isMetricsReadAuthorized(readRequest, null), false);
});

test("caps sequential telemetry writes per edge client and time window", async () => {
  const values = new Map<string, string>();
  const cache = {
    async match(key: RequestInfo | URL) {
      const cacheKey = key instanceof Request ? key.url : String(key);
      const value = values.get(cacheKey);
      return value === undefined ? undefined : new Response(value);
    },
    async put(key: RequestInfo | URL, response: Response) {
      const cacheKey = key instanceof Request ? key.url : String(key);
      values.set(cacheKey, await response.text());
    },
  } as Pick<Cache, "match" | "put">;
  const rateRequest = new Request(ENDPOINT, {
    headers: { "cf-connecting-ip": "203.0.113.7" },
  });
  const now = 1_800_000;

  for (let index = 0; index < METRIC_RATE_LIMIT; index += 1) {
    assert.equal(
      (await consumeMetricRateLimit(rateRequest, "test-secret-a", cache, now)).allowed,
      true,
    );
  }
  const limited = await consumeMetricRateLimit(rateRequest, "test-secret-a", cache, now);
  assert.equal(limited.allowed, false);
  assert.ok(limited.retryAfterSeconds > 0);

  assert.equal(
    (
      await consumeMetricRateLimit(
        rateRequest,
        "test-secret-a",
        cache,
        now + 60_000,
      )
    ).allowed,
    true,
  );
});

test("telemetry rate limiting fails closed without an edge IP or secret", async () => {
  const cache = {
    async match() {
      return undefined;
    },
    async put() {},
  } as Pick<Cache, "match" | "put">;

  assert.equal(
    (await consumeMetricRateLimit(new Request(ENDPOINT), "secret", cache, 0)).allowed,
    false,
  );
  assert.equal(
    (
      await consumeMetricRateLimit(
        new Request(ENDPOINT, { headers: { "cf-connecting-ip": "203.0.113.8" } }),
        null,
        cache,
        0,
      )
    ).allowed,
    false,
  );
});
