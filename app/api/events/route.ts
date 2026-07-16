import { getD1, getMetricsReadToken } from "../../../db";
import {
  METRIC_EVENTS,
  MetricRequestError,
  consumeMetricRateLimit,
  isMetricsReadAuthorized,
  readMetricEvent,
} from "../../lib/product-metrics";

const PRIVATE_NO_STORE = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  let event: string;
  try {
    event = await readMetricEvent(request);
  } catch (error) {
    const status = error instanceof MetricRequestError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Invalid telemetry request.";
    return Response.json({ error: message }, { status, headers: PRIVATE_NO_STORE });
  }

  const db = getD1();
  if (!db) return new Response(null, { status: 204, headers: PRIVATE_NO_STORE });

  const rateLimit = await consumeMetricRateLimit(request, getMetricsReadToken());
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Telemetry rate limit exceeded." },
      {
        status: 429,
        headers: {
          ...PRIVATE_NO_STORE,
          "retry-after": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const day = new Date().toISOString().slice(0, 10);
  await db.prepare(
    `INSERT INTO product_metrics (day, event, count)
     VALUES (?, ?, 1)
     ON CONFLICT(day, event) DO UPDATE SET count = count + 1
     WHERE count < 100000`,
  ).bind(day, event).run();

  return new Response(null, { status: 204, headers: PRIVATE_NO_STORE });
}

export async function GET(request: Request) {
  const token = getMetricsReadToken();
  if (!isMetricsReadAuthorized(request, token)) {
    return new Response(null, { status: 404, headers: PRIVATE_NO_STORE });
  }

  const db = getD1();
  if (!db) {
    return Response.json({ totals: {}, days: [] }, { headers: PRIVATE_NO_STORE });
  }

  const [totalsResult, daysResult] = await Promise.all([
    db.prepare(
      `SELECT event, SUM(count) AS count
       FROM product_metrics
       GROUP BY event
       ORDER BY event ASC`,
    ).all<{ event: string; count: number | string }>(),
    db.prepare(
      `SELECT day, event, count
       FROM product_metrics
       ORDER BY day DESC, event ASC
       LIMIT 120`,
    ).all<{ day: string; event: string; count: number }>(),
  ]);

  const totals = Object.fromEntries(METRIC_EVENTS.map((event) => [event, 0]));
  for (const row of totalsResult.results ?? []) {
    if (!METRIC_EVENTS.includes(row.event as (typeof METRIC_EVENTS)[number])) continue;
    const count = Number(row.count);
    if (Number.isFinite(count) && count >= 0) totals[row.event] = count;
  }

  return Response.json(
    { totals, days: daysResult.results ?? [] },
    { headers: PRIVATE_NO_STORE },
  );
}
