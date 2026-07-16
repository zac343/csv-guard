export const METRIC_EVENTS = [
  "page_view",
  "sample_loaded",
  "analyze",
  "download",
] as const;

export type MetricEvent = (typeof METRIC_EVENTS)[number];

export const MAX_EVENT_BODY_BYTES = 1_024;
export const METRIC_RATE_LIMIT = 20;
export const METRIC_RATE_WINDOW_SECONDS = 60;

const EVENT_SET = new Set<string>(METRIC_EVENTS);
const inMemoryRateBuckets = new Map<string, { count: number; window: number }>();

type MetricRateCache = Pick<Cache, "match" | "put">;

export type MetricRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export class MetricRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MetricRequestError";
    this.status = status;
  }
}

function assertSameOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() !== "same-origin") {
    throw new MetricRequestError("Cross-origin telemetry is not accepted.", 403);
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    throw new MetricRequestError("A same-origin request is required.", 403);
  }

  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      throw new MetricRequestError("Cross-origin telemetry is not accepted.", 403);
    }
  } catch (error) {
    if (error instanceof MetricRequestError) throw error;
    throw new MetricRequestError("A valid request origin is required.", 403);
  }
}

function assertJsonContentType(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new MetricRequestError("Content-Type must be application/json.", 415);
  }
}

async function readBoundedBody(request: Request) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    if (!/^\d+$/.test(declaredLength)) {
      throw new MetricRequestError("Invalid Content-Length.", 400);
    }
    if (Number(declaredLength) > MAX_EVENT_BODY_BYTES) {
      throw new MetricRequestError("Telemetry payload is too large.", 413);
    }
  }

  if (!request.body) {
    throw new MetricRequestError("A JSON body is required.", 400);
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_EVENT_BODY_BYTES) {
        await reader.cancel();
        throw new MetricRequestError("Telemetry payload is too large.", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch (error) {
    if (error instanceof MetricRequestError) throw error;
    throw new MetricRequestError("The request body is not valid UTF-8.", 400);
  }

  return body;
}

export async function readMetricEvent(request: Request): Promise<MetricEvent> {
  assertSameOrigin(request);
  assertJsonContentType(request);
  const body = await readBoundedBody(request);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new MetricRequestError("Invalid JSON.", 400);
  }

  const event =
    typeof payload === "object" && payload !== null && "event" in payload
      ? (payload as { event?: unknown }).event
      : undefined;
  if (typeof event !== "string" || !EVENT_SET.has(event)) {
    throw new MetricRequestError("Unknown event.", 400);
  }

  return event as MetricEvent;
}

export function isMetricsReadAuthorized(request: Request, token: string | null) {
  return Boolean(token) && request.headers.get("authorization") === `Bearer ${token}`;
}

function pruneRateBuckets(currentWindow: number) {
  if (inMemoryRateBuckets.size < 5_000) return;
  for (const [key, value] of inMemoryRateBuckets) {
    if (value.window !== currentWindow) inMemoryRateBuckets.delete(key);
  }
  while (inMemoryRateBuckets.size > 5_000) {
    const oldestKey = inMemoryRateBuckets.keys().next().value;
    if (typeof oldestKey !== "string") break;
    inMemoryRateBuckets.delete(oldestKey);
  }
}

export async function consumeMetricRateLimit(
  request: Request,
  secret: string | null,
  cache: MetricRateCache = caches.default,
  now = Date.now(),
): Promise<MetricRateLimitResult> {
  const retryAfterSeconds =
    METRIC_RATE_WINDOW_SECONDS -
    (Math.floor(now / 1_000) % METRIC_RATE_WINDOW_SECONDS);
  const clientIp = request.headers.get("cf-connecting-ip");
  if (!secret || !clientIp) return { allowed: false, retryAfterSeconds };

  const currentWindow = Math.floor(
    now / (METRIC_RATE_WINDOW_SECONDS * 1_000),
  );
  const digestInput = new TextEncoder().encode(
    `${secret}\u0000${clientIp}\u0000${currentWindow}`,
  );
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const cacheKey = new Request(`https://csv-guard.internal/metric-rate/${digest}`);

  try {
    const cached = await cache.match(cacheKey);
    const cachedCount = cached ? Number(await cached.text()) : 0;
    const memoryCount = inMemoryRateBuckets.get(digest)?.count ?? 0;
    const count = Math.max(
      Number.isSafeInteger(cachedCount) && cachedCount >= 0 ? cachedCount : 0,
      memoryCount,
    );
    if (count >= METRIC_RATE_LIMIT) {
      return { allowed: false, retryAfterSeconds };
    }

    const nextCount = count + 1;
    inMemoryRateBuckets.set(digest, { count: nextCount, window: currentWindow });
    pruneRateBuckets(currentWindow);
    await cache.put(
      cacheKey,
      new Response(String(nextCount), {
        headers: {
          "cache-control": `public, max-age=${METRIC_RATE_WINDOW_SECONDS}`,
          "content-type": "text/plain; charset=utf-8",
        },
      }),
    );
    return { allowed: true, retryAfterSeconds };
  } catch {
    return { allowed: false, retryAfterSeconds };
  }
}
